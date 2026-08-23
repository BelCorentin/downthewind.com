#!/usr/bin/env node
/* ============================================================
   check-tracks — do any run tracks cross land?

   A track is supposed to be an offshore line. If it intersects the
   OSM coastline at all, it has crossed a shoreline, which for an
   offshore route means it is cutting over land (or over an island).

   Coastline is fetched from Overpass at run time and cached in
   .cache/ — it is a dev tool, not a runtime dependency, so the site
   never ships 28k coastline points.

   Usage: node scripts/check-tracks.js [--min-clearance 0.25]
   ============================================================ */
const fs = require("fs"), path = require("path"), https = require("https");
const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, ".cache");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const MIN_CLEARANCE_KM = parseFloat(
  (process.argv.find(a => a.startsWith("--min-clearance")) || "").split("=")[1] ||
  process.argv[process.argv.indexOf("--min-clearance") + 1] || "0.25");

/* ---- load the site's data ---- */
const ctx = {};
new Function("ctx", read("js/geo.js").replace(/getLang\(\)/g, '"en"')
  + read("data/nodes.js") + read("data/runs.js") + read("data/regions.js")
  + `;Object.assign(ctx,{NODES,NODE_BY_ID,RUNS,REGIONS,REGION_BY_ID,haversine,cumulative});`)(ctx);
const { RUNS, REGIONS, haversine, NODE_BY_ID } = ctx;

/* ---- coastline ---- */
function bboxOf(track, pad = 0.15) {
  const la = track.map(p => p[0]), lo = track.map(p => p[1]);
  return { lat0: Math.min(...la) - pad, lat1: Math.max(...la) + pad,
           lon0: Math.min(...lo) - pad, lon1: Math.max(...lo) + pad };
}

const MIRRORS = ["overpass-api.de", "overpass.kumi.systems", "overpass.private.coffee"];

function overpass(query, host) {
  return new Promise((res, rej) => {
    const body = "data=" + encodeURIComponent(query);
    const req = https.request({
      host, path: "/api/interpreter", method: "POST",
      // Overpass refuses the IPv6 route from here; node prefers v6 by default.
      family: 4, timeout: 190000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        // Overpass answers 406 without a User-Agent.
        "User-Agent": "downthewind-track-check/1.0 (https://downthewind.com)",
        "Accept": "application/json",
      },
    }, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => {
      try { res(JSON.parse(d)); } catch { rej(new Error(`${host} ${r.statusCode}: ` + d.slice(0, 120).replace(/\s+/g, " "))); } }); });
    req.on("error", rej);
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.write(body); req.end();
  });
}

async function coastlineFor(bbox, key) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, `coast-${key}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const q = `[out:json][timeout:180];way["natural"="coastline"]`
    + `(${bbox.lat0},${bbox.lon0},${bbox.lat1},${bbox.lon1});out geom;`;
  let data = null;
  for (let i = 0; i < 6 && !data; i++) {
    const host = MIRRORS[i % MIRRORS.length];
    try { data = await overpass(q, host); }
    catch (e) { process.stderr.write(`  ${e.message} — retrying\n`); await new Promise(r => setTimeout(r, 5000)); }
  }
  if (!data) throw new Error("overpass unavailable");
  const ways = (data.elements || []).map(e => (e.geometry || []).map(g => [g.lat, g.lon]))
    .filter(w => w.length > 1);
  fs.writeFileSync(f, JSON.stringify(ways));
  return ways;
}

/* ---- geometry, in a local flat projection (fine over tens of km) ---- */
const REF = [43.5, 7.0];
function xy(ll, ref) {
  const k = Math.cos(ref[0] * Math.PI / 180);
  return [(ll[1] - ref[1]) * k * 111.32, (ll[0] - ref[0]) * 110.574];
}
function segIntersect(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}
function distToSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
}

(async () => {
  let bad = 0, warn = 0, skipped = 0, checked = 0;
  for (const run of RUNS) {
    const reg = run.region;
    const bbox = bboxOf(run.track);
    process.stderr.write(`fetching coastline for ${run.id}…\n`);
    let ways;
    try { ways = await coastlineFor(bbox, run.id); }
    catch (e) { console.log(`? ${run.id}: ${e.message} — SKIPPED, not verified`); skipped++; continue; }

    const ref = run.track[0];
    const coast = ways.map(w => w.map(ll => xy(ll, ref)));
    const track = run.track.map(ll => xy(ll, ref));

    console.log(`\n${run.id}  (${ways.length} coastline ways, ${ways.reduce((a, w) => a + w.length, 0)} pts)`);

    // 1. crossings
    const cum = ctx.cumulative(run.track);
    let crossings = 0;
    for (let i = 0; i < track.length - 1; i++) {
      const hits = [];
      for (const w of coast)
        for (let j = 0; j < w.length - 1; j++) {
          const x = segIntersect(track[i], track[i + 1], w[j], w[j + 1]);
          if (x) hits.push(x);
        }
      if (hits.length) {
        crossings += hits.length;
        console.log(`  ✗ CROSSES LAND: waypoint ${i} → ${i + 1}  `
          + `[${run.track[i]}] → [${run.track[i + 1]}]  (${hits.length} shoreline crossings, ~${cum[i].toFixed(1)} km)`);
        bad++;
      }
    }

    // 2. clearance of each waypoint from the shore
    for (let i = 0; i < track.length; i++) {
      let min = Infinity;
      for (const w of coast)
        for (let j = 0; j < w.length - 1; j++)
          min = Math.min(min, distToSeg(track[i], w[j], w[j + 1]));
      if (min < MIN_CLEARANCE_KM) {
        console.log(`  ! waypoint ${i} [${run.track[i]}] only ${(min * 1000).toFixed(0)} m from shore`);
        warn++;
      }
    }
    if (!crossings) console.log(`  ✓ no land crossings`);
    checked++;
  }
  console.log(`\nchecked ${checked} run(s), skipped ${skipped}`);
  if (bad) console.log(`${bad} segment(s) cross land, ${warn} tight clearance(s)`);
  else if (checked) console.log(`no land crossings in the runs that were checked (${warn} tight clearance(s))`);
  if (skipped) console.log(`WARNING: ${skipped} run(s) could not be verified — do not read this as a pass`);
  process.exit(bad || skipped ? 1 : 0);
})();
