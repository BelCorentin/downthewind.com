# downthewind — v4 rebuild

**Built 2026-08-22.** Côte d'Azur flagship · runs curated + composable · bilingual FR/EN.
All six phases of the plan are implemented. See `docs/DATA.md` for how to add content.

## Why the rewrite

The old site was `index.html` (28K, everything inline) + `spots.js` with 3 runs, where a
run was a polyline plus prose. Every piece of local knowledge — capes, cross-seas, dead-end
bays, stations — had to be copy-pasted into each run's `tips[]`, because there was nowhere
else to put it. That model does not survive run #6, and it cannot express anything
conditional at all.

The knowledge is geographic and conditional. So it now lives on the coast, and runs
compose it.

## What shipped

**Data model.** `data/nodes.js` (33 nodes), `data/zones.js` (17 zones / 29 rules),
`data/runs.js` (6 runs), `data/regions.js` (3 regions). A run is an ordered list of node
ids plus an offshore track; distances are computed, never written. Any pair of a run's
nodes is a valid leg, exposed through the leg picker — which is why there is no
`frejus-theoule` entry.

**Rule engine** (`js/rules.js`). Each zone rule fires on a `when` clause matched against
the live forecast (`windDir`, `windKn`, `swellDir`, `swellM`, `swellPeriodS`, `windWaveM`)
and emits one of seven effects. Scoring is **per segment**, not per run: a 62 km run does
not have one wind, and the whole point of the cape knowledge is that it is local. The
engine also proposes a leg — the longest contiguous stretch that is neither trapped nor
bad, ending on nodes you can actually land at.

**Two forecast fixes the rules depend on.**
1. The old grid was 10×10 over all of France, ≈150 km spacing — physically unable to
   resolve a cape. Regions now carry their own bbox; Côte d'Azur is ≈5 km.
2. The old marine call fetched only `wave_height/direction/period`. "West wind over a WSW
   swell" is not expressible in combined sea, so `swell_wave_*` and `wind_wave_*` are now
   requested and the cross-sea rules key on the ground swell specifically.

Runs are scored from point forecasts at their own node coordinates — wind at the node,
marine at the node's projection on the offshore track, since marine returns null over
land. Two requests per run regardless of length.

**Profile strip** (`js/profile.js`). Horizontal distance axis carrying nodes coloured by
exit difficulty, station glyphs, live hazard/boost spans, and per-segment score bars. This
is now the primary way to read a run.

**Rest.** Region → run navigation, mobile bottom sheet, FR/EN toggle persisted to
localStorage, deep links (`#run/frejus-nice`), file split with no build step,
`scripts/validate.js`, `docs/DATA.md`, and a rewritten issue template that asks
contributors for exits and conditional knowledge rather than a distance.

## The Côte d'Azur knowledge encoded

- **Cross-seas.** Saint-Raphaël → Agay and Nice airport → Villefranche both go square and
  unrideable in W wind over WSW swell. Same rule signature, two stretches.
- **Capes.** Cap du Dramont, Cap Roux, Cap d'Antibes, Cap Ferrat: worth going wide when
  the wind is well oriented (W, ≥15 kn), and each masks its own lee in NW.
- **Villefranche.** A `trap` scoped to `finish`: the roadstead looks correctly oriented and
  is dead in a Mistral, while swell still enters — but riding past its mouth is fine, so
  the rule must not penalise transit. It flips to `shelter` in an E–S flow.
- **The Esterel.** Rocky and committing over ~9 km, with the mitigating fact that the TER
  runs along it — a station roughly every 3 km, several of them limited or seasonal.

## Verified

The rule engine was tested headlessly against five synthetic scenarios, and the whole page
was run in jsdom with a stubbed Leaflet against the live Open-Meteo API: zero runtime
errors, at 980 px and 380 px. `scripts/validate.js` passes with no warnings.

Three real bugs were found and fixed that way: zones attaching past a run's finish (Port
of Nice appearing on a run ending 2.5 km west of it), the Villefranche trap zeroing
transit as well as finishes, and the profile strip dropping Agay — the most useful
bail-out on the coast — because labels were placed left-to-right instead of by importance.

## Still open

- **Station service patterns are the one unmeasured field.** Coordinates come from OSM and
  walk times are computed from the OSM coastline, but `freqPerHour` and `seasonal` are
  from memory. Verify against SNCF before anyone relies on them — the Esterel halts
  (Le Dramont, Anthéor, Le Trayas) are the ones that matter and the ones most likely wrong.
- `photos: []` is still empty everywhere. What an exit actually looks like from the water
  is probably the single most useful photo this site could carry.
- Bretagne/Manche and Provence-ouest have runs but almost no nodes and few zones; they are
  migrated, not documented.
