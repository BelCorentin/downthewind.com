/* ============================================================
   rules — turn a forecast hour into ACTIVE LOCAL KNOWLEDGE.

   The old site scored a whole run with one number. A 30–60 km run
   does not have one wind: the whole point of the cape and bay
   knowledge is that it is local. So everything here is per SEGMENT
   (node → next node), and zones attach GEOMETRICALLY — a zone
   applies to a run when its geometry runs alongside that run's
   track, not because someone remembered to list it.
   ============================================================ */

const ZONE_ATTACH_KM = 4.0;   // max lateral distance from track for a zone to apply
const ZONE_ATTACH_END_KM = 1.2;  // stricter, when the projection falls off the track's end

/* ---- base scoring: is the wind itself any good for this run? ---- */

function dirFactor(dir, w) {
  if (dir == null) return 0;
  if (inSector(dir, w.dirMin, w.dirMax)) return 1;
  const d = Math.min(angDist(dir, w.dirMin), angDist(dir, w.dirMax));
  return Math.max(0, 1 - d / 20);          // 20° of grace outside the sector
}

function speedFactor(kn, w) {
  if (kn == null) return 0;
  if (kn < w.minKn) return 0;
  if (kn < w.idealMin) return (kn - w.minKn) / (w.idealMin - w.minKn);
  if (kn <= w.idealMax) return 1;
  return Math.max(0, 1 - (kn - w.idealMax) / 15);   // too much wind is also a no
}

function baseScore(f, w) {
  if (!f) return 0;
  return speedFactor(f.windKn, w) * dirFactor(f.windDir, w);
}

/* ---- rule matching ---- */

function inRange(v, [lo, hi]) { return v != null && v >= lo && v <= hi; }

/** Every field of `when` is optional and they are AND-ed. */
function matchWhen(when, f) {
  if (!when) return true;                   // no condition = always active
  if (!f) return false;
  if (when.windDir     && !(f.windDir != null && inSector(f.windDir, ...when.windDir))) return false;
  if (when.windKn      && !inRange(f.windKn, when.windKn)) return false;
  if (when.swellDir    && !(f.swellDir != null && inSector(f.swellDir, ...when.swellDir))) return false;
  if (when.swellM      && !inRange(f.swellM, when.swellM)) return false;
  if (when.swellPeriodS&& !inRange(f.swellPeriodS, when.swellPeriodS)) return false;
  if (when.windWaveM   && !inRange(f.windWaveM, when.windWaveM)) return false;
  return true;
}

/* Effects: display order, icon, and how much an active one bends a
   segment score. A plain table beats a formula here — every number is
   a judgement call and should be readable as one. */
const EFFECT_META = {
  trap:    { rank: 0, icon: "\u2717" },
  hazard:  { rank: 1, icon: "\u26a0" },
  shadow:  { rank: 2, icon: "\u25cc" },
  traffic: { rank: 3, icon: "\u26f4" },
  commit:  { rank: 4, icon: "\u21af" },
  shelter: { rank: 5, icon: "\u2693" },
  boost:   { rank: 6, icon: "\u2713" },
};

const EFFECT_MULT = {
  trap:    { high: 0.00, warn: 0.05, info: 0.20 },
  hazard:  { high: 0.25, warn: 0.55, info: 0.80 },
  shadow:  { high: 0.30, warn: 0.45, info: 0.70 },
  traffic: { high: 0.90, warn: 0.95, info: 1.00 },
  commit:  { high: 0.85, warn: 0.90, info: 1.00 },
  shelter: { high: 1.00, warn: 1.00, info: 1.00 },
  boost:   { high: 1.15, warn: 1.15, info: 1.15 },
};

function effectMult(effect, severity) {
  return EFFECT_MULT[effect]?.[severity] ?? 1;
}

/* ---- attach zones to a run, geometrically ---- */

/**
 * Which zones lie alongside this run, and over what distance range?
 * → [{ zone, kmA, kmB }]  (kmA/kmB clipped to the run)
 */
function zonesForRun(run, cum) {
  cum = cum || cumulative(run.track);
  const total = cum.at(-1);
  const out = [];
  for (const z of ZONES) {
    let lo = Infinity, hi = -Infinity;
    for (const g of z.geom) {
      const p = projectOnTrack(g, run.track, cum);
      if (!p) continue;
      // A point beyond the finish projects onto the last vertex. Without this
      // the Port of Nice attached to a run ending 2.5 km west of it.
      const limit = p.offEnd ? ZONE_ATTACH_END_KM : ZONE_ATTACH_KM;
      if (p.offsetKm > limit) continue;
      lo = Math.min(lo, p.km); hi = Math.max(hi, p.km);
    }
    if (lo === Infinity) continue;                       // zone is not on this run
    // a point-like zone still needs a drawable width
    if (hi - lo < 0.6) { lo = Math.max(0, lo - 0.4); hi = Math.min(total, hi + 0.4); }
    out.push({ zone: z, kmA: lo, kmB: hi });
  }
  return out.sort((a, b) => a.kmA - b.kmA);
}

/* ---- the main evaluation ---- */

/**
 * @param run       a run from data/runs.js
 * @param sample    (index, hour) → forecast object, one entry per run node
 * @param hour      index into the 96 h series
 * @param bounds    optional { kmA, kmB } to restrict to a composed leg
 */
function evaluateRun(run, sample, hour, bounds) {
  const cum = cumulative(run.track);
  const total = cum.at(-1);
  const kmA = bounds ? bounds.kmA : 0;
  const kmB = bounds ? bounds.kmB : total;

  /* nodes, with their distance along the run and their own forecast */
  const nodes = run.nodes.map((id, i) => {
    const node = NODE_BY_ID[id];
    const p = projectOnTrack(node.ll, run.track, cum);
    return { node, id, km: p.km, ll: p.ll, offsetKm: p.offsetKm, f: sample(i, hour) };
  });

  /* zones active at this hour, sampled at their own midpoint */
  const active = [];
  for (const { zone, kmA: zA, kmB: zB } of zonesForRun(run, cum)) {
    const mid = (zA + zB) / 2;
    // use the forecast of the nearest node — zones are local, so is the sample
    let near = nodes[0];
    for (const n of nodes) if (Math.abs(n.km - mid) < Math.abs(near.km - mid)) near = n;
    for (const rule of zone.rules) {
      if (!matchWhen(rule.when, near.f)) continue;
      active.push({
        zone, rule, kmA: zA, kmB: zB, f: near.f,
        effect: rule.effect,
        severity: rule.severity || "info",
        // "finish": the warning is about ENDING here, not about passing through.
        // Villefranche is the case that forced this: the bay is a dead end to
        // land in, but riding past its mouth is fine.
        scope: rule.scope || "transit",
        rank: EFFECT_META[rule.effect]?.rank ?? 9,
      });
    }
  }
  active.sort((a, b) => a.rank - b.rank || a.kmA - b.kmA);

  /* segments: node i → node i+1 */
  const segments = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const base = (baseScore(a.f, run.wind) + baseScore(b.f, run.wind)) / 2;
    let score = base;
    const hits = [];
    for (const z of active) {
      if (z.kmB < a.km || z.kmA > b.km) continue;        // no overlap
      hits.push(z);
      if (z.scope !== "finish") score *= effectMult(z.effect, z.severity);
    }
    segments.push({
      i, a, b, kmA: a.km, kmB: b.km, base,
      score: Math.max(0, Math.min(1, score)),
      hits,
      blocked: hits.some(h => h.effect === "trap" && h.scope !== "finish"),
    });
  }

  return {
    run, cum, total, kmA, kmB, nodes, segments, active,
    suggestion: suggestLeg(nodes, segments, kmA, kmB,
      active.filter(z => z.effect === "trap").map(z => [z.kmA, z.kmB])),
  };
}

/* ---- leg suggestion --------------------------------------------
   Longest contiguous stretch of segments that is neither trapped
   nor bad, ending on nodes you can actually get out at.
   ---------------------------------------------------------------- */

const GOOD_ENOUGH = 0.35;
const LANDABLE = new Set(["easy", "ok"]);

function isLandable(n) { return LANDABLE.has(n.node.exit?.ease); }

function suggestLeg(nodes, segments, kmA, kmB, trapRanges = []) {
  const inTrap = km => trapRanges.some(([a, b]) => km >= a - 0.3 && km <= b + 0.3);
  const usable = segments.filter(s => s.kmA >= kmA - 0.01 && s.kmB <= kmB + 0.01);
  if (!usable.length) return null;

  let best = null, startIdx = null;
  const flush = (endIdx) => {
    if (startIdx == null) return;
    // walk the ends inward until both sit on a landable node
    let a = startIdx, b = endIdx;
    const okEnd = (n, tier) =>
      (tier === 0 ? isLandable(n) : n.node.exit?.ease && n.node.exit.ease !== "none")
      && !inTrap(n.km);
    // tier 0: land on a genuinely easy exit. tier 1: this run has none, so accept
    // a hard exit rather than telling the user "nothing rideable" in 22 kn.
    let a0 = a, b0 = b, tier = 0, found = false;
    for (; tier < 2; tier++) {
      a = a0; b = b0;
      while (a <= b && !okEnd(usable[a].a, tier)) a++;
      while (b >= a && !okEnd(usable[b].b, tier)) b--;
      if (a <= b) { found = true; break; }
    }
    if (!found) { startIdx = null; return; }
    const km = usable[b].kmB - usable[a].kmA;
    const mean = usable.slice(a, b + 1).reduce((s, x) => s + x.score, 0) / (b - a + 1);
    if (km > 1 && (!best || km > best.km)) {
      best = { from: usable[a].a, to: usable[b].b, km, meanScore: mean, compromised: tier > 0 };
    }
    startIdx = null;
  };

  usable.forEach((s, i) => {
    const ok = !s.blocked && s.score >= GOOD_ENOUGH;
    if (ok && startIdx == null) startIdx = i;
    if (!ok) flush(i - 1);
  });
  flush(usable.length - 1);
  return best;
}

/* ---- summary line for the conditions panel ---- */
function conditionsLine(f) {
  if (!f) return s("fetchFail");
  const bits = [`${compass(f.windDir)} ${Math.round(f.windKn)} kn`];
  if (f.gustKn != null) bits[0] += ` (${Math.round(f.gustKn)})`;
  if (f.swellM != null && f.swellDir != null) {
    const sw = getLang() === "fr" ? "houle" : "swell";
    bits.push(`${sw} ${compass(f.swellDir)} ${f.swellM.toFixed(1)} m`
      + (f.swellPeriodS != null ? ` ${f.swellPeriodS.toFixed(0)} s` : ""));
  }
  if (f.windWaveM != null) {
    const ww = getLang() === "fr" ? "mer du vent" : "wind wave";
    bits.push(`${ww} ${f.windWaveM.toFixed(1)} m`);
  }
  return bits.join(" · ");
}
