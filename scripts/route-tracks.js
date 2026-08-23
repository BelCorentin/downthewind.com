#!/usr/bin/env node
/* ============================================================
   route-tracks — regenerate run `track` arrays so they stay at sea.

   Hand-placed waypoints cut across headlands; 28 segments were doing
   it. Rather than nudge them by eye, build a sea mask from the OSM
   coastline and route through it.

     1. rasterise the coastline into a ~100 m grid
     2. flood-fill the sea, seeded by OSM's own convention that a
        coastline way has land on its LEFT and sea on its RIGHT
     3. guard: every train station must land OUTSIDE the sea set,
        otherwise the fill leaked through a gap at the bbox edge
     4. BFS distance transform → clearance from shore, per cell
     5. A* between consecutive nodes, cost = distance + a penalty for
        sitting closer to shore than the target clearance
     6. Douglas-Peucker simplify

   Target clearance is per run (`offshoreKm`, default 0.9 km) and can
   be raised at a node (`offshoreKm` on the node) — Cap d'Antibes has
   to be rounded WIDE, which is the whole point of its local knowledge,
   so the router must not hug it.

   Writes scripts/out/tracks.json. Apply with --write.
   ============================================================ */
const fs = require("fs"), path = require("path"), https = require("https");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const WRITE = process.argv.includes("--write");

const ctx = {};
new Function("ctx", read("js/geo.js").replace(/getLang\(\)/g, '"en"')
  + read("data/nodes.js") + read("data/runs.js")
  + `;Object.assign(ctx,{NODES,NODE_BY_ID,RUNS,haversine,cumulative});`)(ctx);
const { RUNS, NODE_BY_ID, haversine } = ctx;

const BASE_OFFSHORE_KM = 0.9;
const CELL_KM = 0.1;
const SIMPLIFY_KM = 0.12;

/* ---------- overpass ---------- */
const MIRRORS = ["overpass-api.de", "overpass.kumi.systems", "overpass.private.coffee"];
function overpass(query, host) {
  return new Promise((res, rej) => {
    const body = "data=" + encodeURIComponent(query);
    const req = https.request({
      host, path: "/api/interpreter", method: "POST", family: 4, timeout: 190000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "downthewind-router/1.0 (https://downthewind.com)",
        Accept: "application/json",
      },
    }, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => {
      try { res(JSON.parse(d)); } catch { rej(new Error(`${host} ${r.statusCode}`)); } }); });
    req.on("error", rej);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(body); req.end();
  });
}
async function coastline(bbox, key) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, `coast2-${key}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  /* Query a LARGER box than the grid. `way(bbox)` selects ways with a node
     inside it, so a long coastline way that merely crosses a corner is not
     returned — that gap is what merged land and sea around Toulon. */
  const P = 0.3;
  const q = `[out:json][timeout:180];way["natural"="coastline"]`
    + `(${bbox.lat0 - P},${bbox.lon0 - P},${bbox.lat1 + P},${bbox.lon1 + P});out geom;`;
  let data = null;
  for (let i = 0; i < 6 && !data; i++) {
    try { data = await overpass(q, MIRRORS[i % MIRRORS.length]); }
    catch (e) { process.stderr.write(`  ${e.message} — retry\n`); await new Promise(r => setTimeout(r, 5000)); }
  }
  if (!data) throw new Error("overpass unavailable");
  const ways = (data.elements || []).map(e => (e.geometry || []).map(g => [g.lat, g.lon])).filter(w => w.length > 1);
  fs.writeFileSync(f, JSON.stringify(ways));
  return ways;
}

/* ---------- grid ---------- */
function makeGrid(bbox) {
  const midLat = (bbox.lat0 + bbox.lat1) / 2;
  const kmPerLat = 110.574, kmPerLon = 111.32 * Math.cos(midLat * Math.PI / 180);
  const H = Math.ceil((bbox.lat1 - bbox.lat0) * kmPerLat / CELL_KM);
  const W = Math.ceil((bbox.lon1 - bbox.lon0) * kmPerLon / CELL_KM);
  return {
    bbox, W, H, kmPerLat, kmPerLon,
    toCell: ([la, lo]) => [
      Math.round((la - bbox.lat0) * kmPerLat / CELL_KM),
      Math.round((lo - bbox.lon0) * kmPerLon / CELL_KM)],
    toLL: (r, c) => [bbox.lat0 + r * CELL_KM / kmPerLat, bbox.lon0 + c * CELL_KM / kmPerLon],
    idx: (r, c) => r * W + c,
    inside: (r, c) => r >= 0 && r < H && c >= 0 && c < W,
  };
}

/* ------------------------------------------------------------------
   Sea mask.

   Two failed approaches got us here, both worth recording:

   1. Flood fill seeded on the sea side. Needs the coastline to be a
      closed barrier; it is not — a single one-cell gap anywhere lets
      the fill walk into the continent, and it produced a 97% "sea".
   2. Per-cell side test against the nearest shore cell. OSM orients a
      coastline way with land on its LEFT, so for segment a→b in
      (row=north, col=east) the sea-side normal is (row=-dc, col=dr).
      That rule is exact, but the BFS feature transform approximates
      "nearest" badly at long range and the mask came out in radial
      wedges.

   So: use the side rule ONLY in a narrow band where "nearest shore
   cell" really is local and the test is reliable, then flood-fill each
   side from its own band seeds. Then VERIFY the two fills are disjoint;
   any overlap is a gap in the barrier, so thicken it and try again.
   ------------------------------------------------------------------ */
function rasterShore(g, ways, dilate) {
  const N = g.W * g.H;
  const hit = new Uint8Array(N);
  const nrm = new Float32Array(N * 2);
  for (const w of ways) {
    for (let i = 0; i < w.length - 1; i++) {
      const [r0, c0] = g.toCell(w[i]), [r1, c1] = g.toCell(w[i + 1]);
      const dr = r1 - r0, dc = c1 - c0, len = Math.hypot(dr, dc);
      if (!len) continue;
      const nr = -dc / len, nc = dr / len;               // sea side
      const n = Math.max(Math.abs(dr), Math.abs(dc), 1);
      for (let k = 0; k <= n; k++) {
        const r = Math.round(r0 + dr * k / n), c = Math.round(c0 + dc * k / n);
        if (!g.inside(r, c)) continue;
        const i2 = g.idx(r, c);
        hit[i2] = 1; nrm[i2 * 2] += nr; nrm[i2 * 2 + 1] += nc;
      }
    }
  }
  let barrier = hit;
  for (let d = 0; d < dilate; d++) {
    const next = new Uint8Array(barrier);
    for (let r = 0; r < g.H; r++) for (let c = 0; c < g.W; c++) {
      if (!barrier[g.idx(r, c)]) continue;
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
        if (g.inside(r + dr, c + dc)) next[g.idx(r + dr, c + dc)] = 1;
    }
    barrier = next;
  }
  return { hit, nrm, barrier };
}

/** BFS from `seeds` over cells where `passable(i)`, returns visited mask + distance. */
function bfs(g, seeds, passable) {
  const N = g.W * g.H;
  const seen = new Uint8Array(N), dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let head = 0, tail = 0;
  for (const i of seeds) if (!seen[i] && passable(i)) { seen[i] = 1; dist[i] = 0; q[tail++] = i; }
  const NB = [[1,0],[-1,0],[0,1],[0,-1]];
  while (head < tail) {
    const i = q[head++], r = (i / g.W) | 0, c = i % g.W;
    for (const [dr, dc] of NB) {
      const r2 = r + dr, c2 = c + dc;
      if (!g.inside(r2, c2)) continue;
      const j = g.idx(r2, c2);
      if (seen[j] || !passable(j)) continue;
      seen[j] = 1; dist[j] = dist[i] + 1; q[tail++] = j;
    }
  }
  return { seen, dist };
}

/* Connected components of open water/land, each labelled by a MAJORITY VOTE
   of the band seeds inside it.

   Voting rather than a two-sided flood fill, because the side rule is ~99%
   accurate and not 100%: a couple of dozen misclassified seeds made an
   all-or-nothing fill claim land and sea were the same region. A vote shrugs
   those off, and it handles islands and lagoons for free. */
function seaMask(g, ways, landTruth) {
  const N = g.W * g.H;
  let last = null;
  for (let dilate = 1; dilate <= 4; dilate++) {
    const { hit, nrm, barrier } = rasterShore(g, ways, dilate);

    // nearest shore cell, computed only out to the band — the side rule is
    // reliable near the coast and meaningless far from it
    const near = new Int32Array(N).fill(-1), d0 = new Int32Array(N).fill(-1);
    const q = new Int32Array(N); let head = 0, tail = 0;
    for (let i = 0; i < N; i++) if (hit[i]) { near[i] = i; d0[i] = 0; q[tail++] = i; }
    const NB8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    while (head < tail) {
      const i = q[head++], r = (i / g.W) | 0, c = i % g.W;
      if (d0[i] > dilate + 8) continue;
      for (const [dr, dc] of NB8) {
        const r2 = r + dr, c2 = c + dc;
        if (!g.inside(r2, c2)) continue;
        const j = g.idx(r2, c2);
        if (d0[j] >= 0) continue;
        d0[j] = d0[i] + 1; near[j] = near[i]; q[tail++] = j;
      }
    }

    // components of everything that is not barrier
    const comp = new Int32Array(N).fill(-1);
    let nComp = 0;
    const stack = new Int32Array(N);
    for (let start = 0; start < N; start++) {
      if (barrier[start] || comp[start] >= 0) continue;
      let sp = 0; stack[sp++] = start; comp[start] = nComp;
      while (sp) {
        const i = stack[--sp], r = (i / g.W) | 0, c = i % g.W;
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const r2 = r + dr, c2 = c + dc;
          if (!g.inside(r2, c2)) continue;
          const j = g.idx(r2, c2);
          if (barrier[j] || comp[j] >= 0) continue;
          comp[j] = nComp; stack[sp++] = j;
        }
      }
      nComp++;
    }

    // vote
    const votes = Array.from({ length: nComp }, () => [0, 0]);   // [sea, land]
    const lo = dilate + 1, hi = dilate + 6;
    let seeds = 0;
    for (let i = 0; i < N; i++) {
      if (barrier[i] || d0[i] < lo || d0[i] > hi || comp[i] < 0) continue;
      const sIdx = near[i];
      if (sIdx < 0) continue;
      const sr = (sIdx / g.W) | 0, sc = sIdx % g.W;
      const vr = ((i / g.W) | 0) - sr, vc = (i % g.W) - sc;
      const dot = vr * nrm[sIdx * 2] + vc * nrm[sIdx * 2 + 1];
      if (dot > 0.6) { votes[comp[i]][0]++; seeds++; }
      else if (dot < -0.6) { votes[comp[i]][1]++; seeds++; }
    }
    if (!seeds) continue;

    const sea = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const k = comp[i];
      if (k < 0) continue;
      if (votes[k][0] > votes[k][1]) sea[i] = 1;
    }

    /* Guards. A merged land+sea component is the dangerous failure — it votes
       once and paints the continent blue — so check known land explicitly. */
    const seaFrac = sea.reduce((a, b) => a + b, 0) / N;
    let agree = 0, tot = 0;
    for (let i = 0; i < N; i++) {
      if (barrier[i] || d0[i] < lo || d0[i] > hi || comp[i] < 0) continue;
      const sIdx = near[i]; if (sIdx < 0) continue;
      const sr = (sIdx / g.W) | 0, sc = sIdx % g.W;
      const vr = ((i / g.W) | 0) - sr, vc = (i % g.W) - sc;
      const dot = vr * nrm[sIdx * 2] + vc * nrm[sIdx * 2 + 1];
      if (Math.abs(dot) <= 0.6) continue;
      tot++;
      if ((dot > 0) === !!sea[i]) agree++;
    }
    const wrongLand = (landTruth || []).filter(ll => {
      const [r, c] = g.toCell(ll);
      return g.inside(r, c) && sea[g.idx(r, c)];
    }).length;

    const ok = seaFrac > 0.08 && seaFrac < 0.92
            && tot > 100 && agree / tot > 0.9
            && wrongLand <= Math.floor((landTruth || []).length * 0.15);
    last = { sea, shore: hit, barrier, seaFrac, agree: tot ? agree / tot : 0, wrongLand, dilate };
    if (!ok) {
      process.stderr.write(`  dilate ${dilate}: sea ${(seaFrac * 100).toFixed(1)}%, `
        + `band agreement ${(100 * agree / Math.max(1, tot)).toFixed(1)}%, `
        + `${wrongLand} station(s) marked sea — retrying\n`);
      continue;
    }
    /* Clearance = 8-connected distance to the nearest shore cell, over ALL
       cells. It must not be a constrained walk: the dilated barrier sits
       between `hit` and `sea`, so a passability-restricted BFS never reached
       the water and left every sea cell at -1. Distance is a property of the
       nearest shore, not of a route. */
    const clear = new Int32Array(N).fill(-1);
    {
      const q2 = new Int32Array(N); let h2 = 0, t2 = 0;
      for (let i = 0; i < N; i++) if (hit[i]) { clear[i] = 0; q2[t2++] = i; }
      const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      while (h2 < t2) {
        const i = q2[h2++], r = (i / g.W) | 0, c = i % g.W;
        for (const [dr, dc] of NB) {
          const r2 = r + dr, c2 = c + dc;
          if (!g.inside(r2, c2)) continue;
          const j = g.idx(r2, c2);
          if (clear[j] >= 0) continue;
          clear[j] = clear[i] + 1; q2[t2++] = j;
        }
      }
    }
    return { sea, shore: hit, dist: clear, dilate, seaFrac, agree: agree / tot };
  }
  return null;
}

/* nearest sea cell to a point with at least `want` clearance */
function anchor(g, sea, clear, ll, wantCells) {
  const [r0, c0] = g.toCell(ll);
  let best = null;
  for (let rad = 0; rad < 260 && !best; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      const dcs = Math.abs(dr) === rad ? null : [-rad, rad];
      const cols = dcs || Array.from({ length: 2 * rad + 1 }, (_, k) => k - rad);
      for (const dc of cols) {
        const r = r0 + dr, c = c0 + dc;
        if (!g.inside(r, c)) continue;
        const i = g.idx(r, c);
        if (sea[i] && clear[i] >= wantCells) { best = [r, c]; break; }
      }
      if (best) break;
    }
  }
  return best;
}

/* A* through sea cells, biased to sit at the target clearance */
function route(g, sea, clear, a, b, wantCells, hardCells) {
  const key = (r, c) => g.idx(r, c);
  const pad = 90;
  const r0 = Math.max(0, Math.min(a[0], b[0]) - pad), r1 = Math.min(g.H - 1, Math.max(a[0], b[0]) + pad);
  const c0 = Math.max(0, Math.min(a[1], b[1]) - pad), c1 = Math.min(g.W - 1, Math.max(a[1], b[1]) + pad);
  const gScore = new Map(), came = new Map();
  const h = (r, c) => Math.hypot(r - b[0], c - b[1]);
  const open = [[h(a[0], a[1]), a[0], a[1]]];
  gScore.set(key(...a), 0);
  /* A GENTLE preference for the target clearance, over a hard floor.
     A quadratic penalty here charged 3.5x per cell for sitting inside the
     target, which bought a 15 km detour around Cap d'Antibes rather than
     briefly passing a little closer. Cap it at 2.2x. */
  const cost = (r, c) => {
    const cl = clear[g.idx(r, c)];
    if (cl < hardCells) return Infinity;               // never this close to rock
    const short = Math.max(0, wantCells - cl);
    return 1 + 1.2 * Math.min(1, short / wantCells);
  };
  while (open.length) {
    open.sort((x, y) => x[0] - y[0]);
    const [, r, c] = open.shift();
    if (r === b[0] && c === b[1]) break;
    const gc = gScore.get(key(r, c));
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < r0 || nr > r1 || nc < c0 || nc > c1) continue;
      const j = g.idx(nr, nc);
      if (!sea[j]) continue;
      const stepCost = cost(nr, nc);
      if (!isFinite(stepCost)) continue;
      const ng = gc + (Math.abs(dr) + Math.abs(dc) === 2 ? 1.414 : 1) * stepCost;
      if (gScore.has(j) && gScore.get(j) <= ng) continue;
      gScore.set(j, ng); came.set(j, key(r, c));
      open.push([ng + h(nr, nc), nr, nc]);
    }
    if (open.length > 400000) return null;
  }
  if (!gScore.has(key(...b))) return null;
  const out = []; let cur = key(...b);
  while (cur !== undefined) { out.push([(cur / g.W) | 0, cur % g.W]); cur = came.get(cur); }
  return out.reverse();
}

/* ------------------------------------------------------------------
   Smoothing.

   Two things went wrong before landing here:
   - Routing through one anchor per node traced every indentation of the
     shore, making Fréjus → Nice 72 km.
   - Pure string pulling (shortest taut path with a clearance floor) went
     the other way: 5 waypoints over 55 km, a near-straight offshore line
     that left the Esterel nodes kilometres from their own run.

   What a downwind line actually is: the coast's shape, smoothed, held a
   safe distance off. So simplify WITHIN A CORRIDOR — Douglas-Peucker with
   a tolerance — and additionally refuse any simplified segment that would
   pass closer to shore than the floor. Shape preserved, wiggles gone,
   never over land.
   ------------------------------------------------------------------ */
function segmentClear(g, sea, clear, a, b, minCells) {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1) * 2;
  for (let k = 0; k <= n; k++) {
    const r = Math.round(a[0] + (b[0] - a[0]) * k / n);
    const c = Math.round(a[1] + (b[1] - a[1]) * k / n);
    if (!g.inside(r, c)) return false;
    const i = g.idx(r, c);
    if (!sea[i] || clear[i] < minCells) return false;
  }
  return true;
}

/** Douglas-Peucker over grid cells, with a hard "must stay at sea" veto. */
function smoothPath(g, sea, clear, cells, tolCells, minCells) {
  const perp = (p, a, b) => {
    const vr = b[0] - a[0], vc = b[1] - a[1], l2 = vr * vr + vc * vc;
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * vr + (p[1] - a[1]) * vc) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + vr * t), p[1] - (a[1] + vc * t));
  };
  const rec = (lo, hi) => {
    if (hi - lo < 2) return [cells[lo]];
    let maxD = 0, idx = lo;
    for (let i = lo + 1; i < hi; i++) {
      const d = perp(cells[i], cells[lo], cells[hi]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= tolCells && segmentClear(g, sea, clear, cells[lo], cells[hi], minCells))
      return [cells[lo]];
    // No interior split point: recursing would call rec(lo, hi) again forever.
    // Keep every cell instead — correct, just unsimplified.
    if (idx <= lo || idx >= hi) {
      const out = [];
      for (let i = lo; i < hi; i++) out.push(cells[i]);
      return out;
    }
    return [...rec(lo, idx), ...rec(idx, hi)];
  };
  return [...rec(0, cells.length - 1), cells.at(-1)];
}

/* ---------- Douglas-Peucker on lat/lon, epsilon in km ---------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const perp = (p, a, b) => {
    const A = haversine(a, p), B = haversine(b, p), C = haversine(a, b);
    if (C === 0) return A;
    const s = (A + B + C) / 2;
    const area = Math.max(0, s * (s - A) * (s - B) * (s - C));
    return 2 * Math.sqrt(area) / C;
  };
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts.at(-1));
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [pts[0], pts.at(-1)];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

/* ---------- main ---------- */
(async () => {
  const out = {};
  for (const run of RUNS) {
    const lls = run.nodes.map(id => NODE_BY_ID[id].ll).concat(run.track);
    const la = lls.map(p => p[0]), lo = lls.map(p => p[1]);
    const bbox = { lat0: Math.min(...la) - 0.15, lat1: Math.max(...la) + 0.15,
                   lon0: Math.min(...lo) - 0.15, lon1: Math.max(...lo) + 0.15 };
    process.stderr.write(`\n${run.id}: coastline…\n`);
    const ways = await coastline(bbox, run.id);
    const g = makeGrid(bbox);
    const landTruth = run.nodes.map(id => NODE_BY_ID[id]).filter(n => n.train).map(n => n.train.ll);
    const mask = seaMask(g, ways, landTruth);
    if (!mask) { console.error(`  ✗ ${run.id}: could not build a consistent sea mask`); continue; }
    const { sea, shore, dist } = mask;

    process.stderr.write(`  grid ${g.W}x${g.H}, sea ${(mask.seaFrac * 100).toFixed(1)}%, `
      + `band agreement ${(mask.agree * 100).toFixed(1)}%, dilate ${mask.dilate}\n`);

    // distance to shore in cells, straight out of the BFS above
    const clear = dist;
    const base = (run.offshoreKm || BASE_OFFSHORE_KM);
    /* A node's own offshoreKm is authoritative for its anchor, in BOTH
       directions. Taking max(base, node) meant Villefranche — a bay narrower
       than the base clearance — could never get an anchor inside it, so the
       router skipped the bay that the whole run is about. */
    const anchors = run.nodes.map(id => {
      const n = NODE_BY_ID[id];
      const want = Math.round((n.offshoreKm ?? base) / CELL_KM);
      const a = anchor(g, sea, clear, n.ll, want)
             || anchor(g, sea, clear, n.ll, Math.round(base / CELL_KM * 0.5));
      if (!a) console.error(`  ! no sea anchor for ${id}`);
      return a;
    });

    let cells = [];
    let failed = false;
    for (let i = 0; i < anchors.length - 1; i++) {
      if (!anchors[i] || !anchors[i + 1]) { failed = true; break; }
      const n0 = NODE_BY_ID[run.nodes[i]], n1 = NODE_BY_ID[run.nodes[i + 1]];
      // prefer the wider of the two, but let the floor drop to the tighter one
      // so the router can physically get into a narrow bay
      const want = Math.round(Math.max(n0.offshoreKm ?? base, n1.offshoreKm ?? base) / CELL_KM);
      const hard = Math.round(Math.min(run.minClearanceKm || 0.45,
        n0.offshoreKm ?? 9, n1.offshoreKm ?? 9) / CELL_KM);
      const leg = route(g, sea, clear, anchors[i], anchors[i + 1], want, hard);
      if (!leg) { console.error(`  ! no route ${run.nodes[i]} → ${run.nodes[i + 1]}`); failed = true; break; }
      cells = cells.length ? cells.concat(leg.slice(1)) : leg;
    }
    if (failed) { console.error(`  ✗ ${run.id} not regenerated`); continue; }

    // the floor must admit the tightest place the route was allowed into,
    // or smoothing rejects every shortcut and the recursion degenerates
    const tightest = Math.min(run.minClearanceKm || 0.45,
      ...run.nodes.map(id => NODE_BY_ID[id].offshoreKm ?? 9));
    const minCells = Math.max(2, Math.round(tightest / CELL_KM));
    const tolCells = Math.round((run.smoothKm || 1.2) / CELL_KM);
    const smoothed = smoothPath(g, sea, clear, cells, tolCells, minCells);
    const simp = smoothed.map(([r, c]) => g.toLL(r, c)).map(p => [+p[0].toFixed(4), +p[1].toFixed(4)]);
    out[run.id] = simp;
    let len = 0;
    for (let i = 1; i < simp.length; i++) len += haversine(simp[i - 1], simp[i]);
    console.log(`  ${run.id}: ${cells.length} cells → ${simp.length} waypoints, ${len.toFixed(1)} km`);
  }

  fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "out", "tracks.json"), JSON.stringify(out, null, 1));
  console.log(`\nwrote scripts/out/tracks.json (${Object.keys(out).length} runs)`);
  if (WRITE) console.log("apply with scripts/apply-tracks.js");
})();
