#!/usr/bin/env node
/* Data integrity checks. Run after editing anything in data/.
   Usage: node scripts/validate.js            */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const bundle = ["js/geo.js", "data/nodes.js", "data/zones.js", "data/runs.js", "data/regions.js"]
  .map(read).join("\n;\n").replace(/getLang\(\)/g, '"en"');

let bad = 0, warn = 0;
const fail = m => { console.log("  ✗ " + m); bad++; };
const note = m => { console.log("  ! " + m); warn++; };

const ctx = {};
new Function("ctx", bundle + `
  Object.assign(ctx, { NODES, NODE_BY_ID, ZONES, ZONE_BY_ID, RUNS, RUN_BY_ID, REGIONS, REGION_BY_ID,
    cumulative, projectOnTrack, trackLength });`)(ctx);
const { NODES, NODE_BY_ID, ZONES, RUNS, REGION_BY_ID, cumulative, projectOnTrack } = ctx;

const EASE = new Set(["easy", "ok", "hard", "rocky", "none"]);
const SHORE = new Set(["sand", "pebble", "rock", "slipway", "port"]);
const EFFECTS = new Set(["boost", "shelter", "shadow", "hazard", "commit", "trap", "traffic"]);
const SEV = new Set(["high", "warn", "info"]);
const bilingual = (o, where) => {
  if (o == null) return;
  if (typeof o === "string") return note(`${where}: plain string, should be {fr,en}`);
  if (!o.fr || !o.en) fail(`${where}: missing ${!o.fr ? "fr" : "en"}`);
};

console.log("NODES");
const ids = new Set();
for (const n of NODES) {
  if (ids.has(n.id)) fail(`duplicate node id ${n.id}`); ids.add(n.id);
  bilingual(n.name, `node ${n.id}.name`);
  bilingual(n.short, `node ${n.id}.short`);
  if (!Array.isArray(n.ll) || n.ll.length !== 2) fail(`node ${n.id}: bad ll`);
  if (n.exit) {
    if (!EASE.has(n.exit.ease)) fail(`node ${n.id}: bad exit.ease "${n.exit.ease}"`);
    if (n.exit.shore && !SHORE.has(n.exit.shore)) fail(`node ${n.id}: bad exit.shore`);
    bilingual(n.exit.note, `node ${n.id}.exit.note`);
  }
  if (n.train) {
    bilingual(n.train.carry, `node ${n.id}.train.carry`);
    if (n.train.hub && !NODE_BY_ID[n.train.hub]) fail(`node ${n.id}: train.hub "${n.train.hub}" not a node`);
    if (typeof n.train.walkMin !== "number") fail(`node ${n.id}: train.walkMin not a number`);
  }
}
console.log(`  ${NODES.length} nodes`);

console.log("ZONES");
for (const z of ZONES) {
  bilingual(z.name, `zone ${z.id}.name`);
  if (!z.geom?.length) fail(`zone ${z.id}: empty geom`);
  for (const sp of z.span || []) if (!NODE_BY_ID[sp]) fail(`zone ${z.id}: span node "${sp}" missing`);
  for (const r of z.rules) {
    if (!EFFECTS.has(r.effect)) fail(`zone ${z.id}: unknown effect "${r.effect}"`);
    if (r.severity && !SEV.has(r.severity)) fail(`zone ${z.id}: bad severity "${r.severity}"`);
    if (r.scope && !["transit", "finish"].includes(r.scope)) fail(`zone ${z.id}: bad scope "${r.scope}"`);
    bilingual(r.text, `zone ${z.id} rule text`);
    for (const k of ["windDir", "swellDir"])
      if (r.when?.[k] && r.when[k].some(v => v < 0 || v > 360)) fail(`zone ${z.id}: ${k} out of 0-360`);
  }
}
console.log(`  ${ZONES.length} zones, ${ZONES.reduce((a, z) => a + z.rules.length, 0)} rules`);

console.log("RUNS");
const reached = new Set();
for (const r of RUNS) {
  if (!REGION_BY_ID[r.region]) fail(`run ${r.id}: unknown region "${r.region}"`);
  bilingual(r.name, `run ${r.id}.name`);
  bilingual(r.description, `run ${r.id}.description`);
  r.tips.forEach((x, i) => bilingual(x, `run ${r.id}.tips[${i}]`));
  const cum = cumulative(r.track);
  let prev = -Infinity;
  for (const id of r.nodes) {
    const n = NODE_BY_ID[id];
    if (!n) { fail(`run ${r.id}: node "${id}" missing`); continue; }
    const p = projectOnTrack(n.ll, r.track, cum);
    // out-of-order nodes silently corrupt the profile strip
    if (p.km < prev - 0.01) fail(`run ${r.id}: node "${id}" projects at ${p.km.toFixed(1)} km, before the previous node (${prev.toFixed(1)} km) — add a track waypoint near it`);
    if (p.offsetKm > 3.5) note(`run ${r.id}: node "${id}" is ${p.offsetKm.toFixed(1)} km off the track`);
    prev = p.km;
  }
  // which zones this run actually picks up
  for (const z of ZONES) {
    const near = z.geom.some(g => {
      const p = projectOnTrack(g, r.track, cum);
      return p && p.offsetKm <= (p.offEnd ? 1.2 : 4.0);
    });
    if (near) reached.add(z.id);
  }
  console.log(`  ${r.id.padEnd(22)} ${cum.at(-1).toFixed(1).padStart(5)} km  ${r.nodes.length} nodes`);
}
for (const z of ZONES) if (!reached.has(z.id)) fail(`zone ${z.id} is not reachable from any run`);

console.log(bad ? `\n${bad} error(s), ${warn} warning(s)` : `\nOK — ${warn} warning(s)`);
process.exit(bad ? 1 : 0);
