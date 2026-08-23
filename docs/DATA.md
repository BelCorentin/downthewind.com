# Adding to downthewind

No build step. Edit a file, push to `main`, it is live (GitHub Pages, legacy build).

The old model was "a run is a polyline plus prose", and every piece of local
knowledge got copy-pasted into each run's `tips[]`. That does not survive run #6.
Now knowledge belongs to the **coast**, and runs **compose** it.

```
data/nodes.js    points you can start / stop / bail out at, and their trains
data/zones.js    stretches of coast that behave differently by condition
data/runs.js     a run = ordered node ids + an offshore track
data/regions.js  forecast bbox + map view per region
```

Every human-facing string is `{ fr, en }`. Resolve it with `t()` at render time.
Never store a resolved string.

---

## Add a node

A node is a place, not part of a run. Runs reference it by id; several runs share it.

```js
{
  id: "agay",
  name:  { fr: "Agay", en: "Agay" },
  short: { fr: "Agay", en: "Agay" },     // profile-strip label, space is tight
  ll: [43.4312, 6.8571],                 // the SHORE point — where you land
  kind: ["launch", "exit", "train"],     // launch | exit | train | hub | landmark | danger
  exit: {
    ease: "easy",                        // easy | ok | hard | rocky | none
    shore: "sand",                       // sand | pebble | rock | slipway | port
    parking: true,
    note: { fr: "…", en: "…" },
  },
  train: {
    station: "Agay",
    ll: [43.4314, 6.8565],               // from OpenStreetMap railway=station|halt
    line: TER_AZUR,
    walkMin: 1,                          // COMPUTED — see below
    carry: { fr: "…", en: "…" },         // honest, with a board and a wing
    hub: "saint-raphael", toHubMin: 12,
    freqPerHour: 1, seasonal: false,     // the one unmeasured field — check SNCF
  },
}
```

`exit.ease` drives the marker colour on the map and the profile strip, and decides
whether the engine will suggest ending a leg there. Be honest with it.

### walkMin is computed, not guessed

Station coordinates come from OSM. Walk time is the straight-line distance from the
station to the nearest `natural=coastline` node, ×1.35 for detour, at 3.2 km/h
carrying gear, minimum 1 min. To regenerate for a new area:

```
Overpass:  node["railway"~"station|halt"](bbox);  out body;
Overpass:  way["natural"="coastline"](bbox);      out geom;
then:      walkMin = max(1, round(haversine(station, nearest_coast) * 1.35 / 3.2 * 60))
```

Do not hand-write a walk time. A wrong "you can bail out here" is the one error on
this site with real consequences.

---

## Add a zone — the conditional knowledge

This is what the site is for. A zone owns a geometry and a list of rules; a rule
fires when the live forecast matches its `when`.

```js
{
  id: "stRaphael-agay-crosssea",
  kind: "cross-sea",
  name: { fr: "Saint-Raphaël → Agay", en: "Saint-Raphaël → Agay" },
  span: ["saint-raphael", "agay"],   // documentation; matching is geometric
  geom: [[43.418, 6.770], [43.412, 6.808], [43.426, 6.858]],
  rules: [
    { when: { windDir: [250, 292], swellDir: [222, 265], swellM: [0.5, 99] },
      effect: "hazard", severity: "high",
      text: { fr: "…", en: "…" } },
  ],
}
```

**`when`** — all fields optional, all AND-ed. No `when` at all = always active.

| field | meaning |
|---|---|
| `windDir: [from, to]` | ° FROM, clockwise, wraps 360 |
| `windKn: [min, max]` | knots |
| `swellDir: [from, to]` | ground swell, ° FROM |
| `swellM`, `swellPeriodS` | ground swell height / period |
| `windWaveM` | wind sea, separate from ground swell |

The swell/wind-wave split is why the cross-sea rules work at all. `wave_height`
alone cannot express "west wind over a WSW swell".

**`effect`** — fixed vocabulary; it drives colour, icon, and the score modifier:

| effect | meaning |
|---|---|
| `boost` | actively good here, in these conditions |
| `shelter` | protected; a safe bail-out even when it is big |
| `shadow` | wind hole / lull |
| `hazard` | bad or dangerous sea state |
| `commit` | no easy exit for a while |
| `trap` | looks fine on a map, is not |
| `traffic` | shipping, ferry or naval lane |

**`severity`** — `high` | `warn` | `info`. See `EFFECT_MULT` in `js/rules.js` for
exactly how much each combination bends a segment score.

**`scope`** — `"transit"` (default) or `"finish"`. Use `finish` when the warning is
about *ending* a run there rather than passing through. Villefranche forced this
field: the bay is a dead end to land in, but riding past its mouth is fine.

### How a zone attaches to a run

Geometrically: a zone applies when its `geom` projects onto the run's track within
4 km laterally (1.2 km if the projection falls off the end of the track, so features
beyond the finish do not attach). Nothing has to be registered anywhere. Write the
zone once, and every run that passes it inherits it.

---

## Add a run

```js
{
  id: "frejus-cannes",
  region: "cote-azur",
  name: { fr: "…", en: "…" },
  windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
  wind: { dirMin: 250, dirMax: 330, minKn: 12, idealMin: 18, idealMax: 35 },
  levelKey: "intermediate",              // intermediate | advanced | expert
  level: { fr: "…", en: "…" },
  nodes: ["frejus-base-nature", "saint-raphael", …],   // ORDERED, west → east
  track: [[43.418, 6.750], …],           // offshore waypoints
  description: { fr: "…", en: "…" },
  tips: [{ fr: "…", en: "…" }],
  photos: [],
}
```

There is no `distanceKm` — distance is computed from `track`.

Any pair of a run's nodes is itself a valid leg; the leg picker exposes that. So do
not author `frejus-theoule` as a separate run.

### After editing, run the checks

```bash
node --check data/runs.js                          # syntax
node /path/to/validate.js                          # node order + zone reachability
```

Node projections onto the track **must come out monotone**: if a node projects
earlier than the one before it, the profile strip is wrong. That happens when the
track lacks a waypoint near a node — e.g. before Cap d'Antibes, without a waypoint
off Juan-les-Pins, Juan projects to the far side of the cape. Add a waypoint.

---

## Layout

```
index.html      markup + <script src> only
css/app.css
js/i18n.js      LANG, t(), STRINGS
js/geo.js       haversine, distance along track, projection
js/forecast.js  Open-Meteo: region grids + per-node point series
js/rules.js     when-matching, effects, per-segment scoring, leg suggestion
js/map.js       Leaflet layers + wind/wave canvases
js/profile.js   the strip
js/ui.js        views, panels, wiring
data/*.js       the content
```

Load order matters — `map.js` reads `FRANCE_VIEW` and `EFFECT_META`, `profile.js`
reads `WIND_PAL`. Keep the `<script>` order in `index.html` as it is.

---

## Community reports

GitHub Issues *is* the database. There is no backend, no accounts, no comment
service — the site reads the repo's issues through the public API and renders
them on the map.

```
someone clicks "flag a danger" on the map
  → a prefilled issue form opens, already carrying the node id and conditions
  → they submit; the template labels it danger / correction / report
  → you read it and add the `on-map` label
  → it appears on the map within 30 minutes (sessionStorage cache TTL)
```

### The `on-map` label is the publish action

Nothing a stranger writes reaches the map on its own. Two things enforce that:

1. No issue template declares `on-map`.
2. GitHub ignores the `labels=` URL parameter for anyone without triage rights
   on the repo, so it cannot be self-applied by editing the link.

To publish a report, label it `on-map`. To unpublish, remove the label or close
the issue (the query is `state=open&labels=on-map`).

**Labels the repo needs:** `on-map`, `danger`, `correction`, `report`, `new-run`.

```bash
gh label create on-map     -c 0EA5A4 -d "Published to the map"
gh label create danger     -c E0555F -d "Hazard flag"
gh label create correction -c D9C26F -d "Data correction"
gh label create report     -c 7FE3D2 -d "Condition report"
gh label create new-run    -c 6FB3D9 -d "Proposed run"
```

### Report lifetimes

| type | on the map until |
|---|---|
| `danger` | you close the issue |
| `correction` | you close it (ideally after fixing `data/*.js`) |
| `report` | greyed out after 21 days (`CONDITION_REPORT_FRESH_DAYS`) |

### Locations

The `Where` field accepts `node:agay`, `zone:cap-antibes`, `run:frejus-cannes`,
or bare `43.431, 6.857`. Anything else still lists, it just does not get a pin.
Report links from the UI prefill this, so hand-typed locations are the exception.

A report attaches to a run if it names that run, one of its nodes, one of its
zones, or a coordinate within 4 km of its track.

### Two things to be careful about

- **Issue text is untrusted input from the internet.** It is escaped at every
  render site, including Leaflet tooltips. The `on-map` label is moderation, not
  sanitising — keep the escaping if you touch `reportRow` or `drawReports`.
- **The unauthenticated GitHub API allows 60 requests/hour per IP.** Responses
  are cached in `sessionStorage` for 30 minutes and a rate-limit failure is
  swallowed: reports simply do not appear, and the map still works. Never let
  the reports fetch block the forecast — that is the part people came for.
