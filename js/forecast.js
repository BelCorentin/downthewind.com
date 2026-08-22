/* ============================================================
   forecast — Open-Meteo (AROME / MeteoFrance + marine).

   Two things differ from the old single-grid version:

   1. RESOLUTION. A 10x10 grid over the whole of France is ~150 km
      spacing, which cannot resolve a cape at all. Each region gets
      its own bbox, so `cote-azur` at 10x10 is ~5 km.

   2. SWELL SPLIT. The old marine call fetched only wave_height /
      direction / period, i.e. the combined sea. The cross-sea rules
      ("W wind over WSW swell") need GROUND SWELL separated from
      WIND WAVE, so we request swell_wave_* and wind_wave_* too.
   ============================================================ */

const FC_HOURS = 96;                 // 4 days
const GRID_N = 10;
const CACHE_MIN = 30;

const WIND_API   = "https://api.open-meteo.com/v1/meteofrance";
const MARINE_API = "https://marine-api.open-meteo.com/v1/marine";

const WIND_VARS   = "wind_speed_10m,wind_direction_10m,wind_gusts_10m";
const MARINE_VARS = [
  "wave_height", "wave_direction", "wave_period",
  "swell_wave_height", "swell_wave_direction", "swell_wave_period",
  "wind_wave_height", "wind_wave_direction",
].join(",");

/* ---- tiny sessionStorage cache so panning does not re-fetch ---- */
function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return Date.now() - at < CACHE_MIN * 60e3 ? data : null;
  } catch { return null; }
}
function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); }
  catch { /* quota — not worth failing over */ }
}
async function getJSON(url, key) {
  const hit = key && cacheGet(key);
  if (hit) return hit;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const j = await r.json();
  if (key) cacheSet(key, j);
  return j;
}

/* ---- grids ------------------------------------------------- */

function gridCoords(bbox, n = GRID_N) {
  const lats = [], lons = [];
  for (let i = 0; i < n; i++) {
    lats.push(bbox.lat0 + (bbox.lat1 - bbox.lat0) * i / (n - 1));
    lons.push(bbox.lon0 + (bbox.lon1 - bbox.lon0) * i / (n - 1));
  }
  const la = [], lo = [];
  for (const a of lats) for (const o of lons) { la.push(a.toFixed(3)); lo.push(o.toFixed(3)); }
  return { lats, lons, la, lo, n };
}

async function fetchWindGrid(bbox, key) {
  const g = gridCoords(bbox);
  const url = `${WIND_API}?latitude=${g.la.join(",")}&longitude=${g.lo.join(",")}`
    + `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`
    + `&forecast_days=4&timezone=UTC`;
  const arr = await getJSON(url, key && "wg-" + key);
  return {
    n: g.n, bbox, lats: g.lats, lons: g.lons, time: arr[0].hourly.time,
    pts: arr.map(p => ({ sp: p.hourly.wind_speed_10m, dir: p.hourly.wind_direction_10m })),
  };
}

async function fetchWaveGrid(bbox, key) {
  const g = gridCoords(bbox);
  const url = `${MARINE_API}?latitude=${g.la.join(",")}&longitude=${g.lo.join(",")}`
    + `&hourly=wave_height,wave_direction,wave_period&forecast_days=4&timezone=UTC`;
  const arr = await getJSON(url, key && "vg-" + key);
  return {
    n: g.n, bbox, lats: g.lats, lons: g.lons, time: arr[0].hourly.time,
    pts: arr.map(p => ({
      sp: p.hourly.wave_height, dir: p.hourly.wave_direction, per: p.hourly.wave_period,
    })),
  };
}

/* bilinear weights for a lat/lon inside a grid */
function cellWeights(g, lat, lon) {
  const b = g.bbox, n = g.n;
  if (lat < b.lat0 || lat > b.lat1 || lon < b.lon0 || lon > b.lon1) return null;
  const fi = (lat - b.lat0) / (b.lat1 - b.lat0) * (n - 1);
  const fj = (lon - b.lon0) / (b.lon1 - b.lon0) * (n - 1);
  const i = Math.min(n - 2, Math.floor(fi)), j = Math.min(n - 2, Math.floor(fj));
  const di = fi - i, dj = fj - j;
  return [[i, j, (1 - di) * (1 - dj)], [i + 1, j, di * (1 - dj)],
          [i, j + 1, (1 - di) * dj], [i + 1, j + 1, di * dj]];
}

/** Wind at a point, interpolated through u/v so 359°→0° does not seam. */
function windAt(g, lat, lon, hour) {
  if (!g) return null;
  const cw = cellWeights(g, lat, lon);
  if (!cw) return null;
  let u = 0, v = 0;
  for (const [i, j, w] of cw) {
    const p = g.pts[i * g.n + j], sp = p.sp[hour];
    if (sp == null) return null;
    const d = p.dir[hour] * Math.PI / 180;
    u += -Math.sin(d) * sp * w;
    v += -Math.cos(d) * sp * w;
  }
  return { u, v, s: Math.hypot(u, v) };
}

/** Wave height at a point; tolerant of land (null) corners. */
function waveAt(g, lat, lon, hour) {
  if (!g) return null;
  const cw = cellWeights(g, lat, lon);
  if (!cw) return null;
  let sum = 0, wt = 0;
  for (const [i, j, w] of cw) {
    const h = g.pts[i * g.n + j].sp[hour];
    if (h == null) continue;
    sum += h * w; wt += w;
  }
  return wt < 0.25 ? null : sum / wt;
}

/* ---- point forecasts -------------------------------------------
   For scoring a RUN we do not interpolate a grid: we ask the API
   for the node coordinates themselves. Wind is sampled at the node
   (so coastal effects are in the model), marine at the node's
   projected point on the offshore track (marine returns null on land).
   Two requests total, whatever the run length.
   ---------------------------------------------------------------- */

async function fetchPointSeries(windPts, marinePts, key) {
  const wlat = windPts.map(p => p[0].toFixed(4)).join(",");
  const wlon = windPts.map(p => p[1].toFixed(4)).join(",");
  const mlat = marinePts.map(p => p[0].toFixed(4)).join(",");
  const mlon = marinePts.map(p => p[1].toFixed(4)).join(",");

  const windUrl = `${WIND_API}?latitude=${wlat}&longitude=${wlon}`
    + `&hourly=${WIND_VARS}&wind_speed_unit=kn&forecast_days=4&timezone=UTC`;
  const marineUrl = `${MARINE_API}?latitude=${mlat}&longitude=${mlon}`
    + `&hourly=${MARINE_VARS}&forecast_days=4&timezone=UTC`;

  const [wind, marine] = await Promise.all([
    getJSON(windUrl, key && "pw-" + key),
    // marine is the optional half: a null here must not kill the wind panel
    getJSON(marineUrl, key && "pm-" + key).catch(() => null),
  ]);

  const asArray = x => (Array.isArray(x) ? x : [x]);
  const W = asArray(wind), M = marine ? asArray(marine) : [];

  return {
    time: W[0].hourly.time,
    at(i, hour) {
      const w = W[i]?.hourly, m = M[i]?.hourly;
      if (!w) return null;
      return {
        windKn:       w.wind_speed_10m[hour],
        windDir:      w.wind_direction_10m[hour],
        gustKn:       w.wind_gusts_10m?.[hour] ?? null,
        waveM:        m?.wave_height?.[hour] ?? null,
        waveDir:      m?.wave_direction?.[hour] ?? null,
        wavePeriodS:  m?.wave_period?.[hour] ?? null,
        swellM:       m?.swell_wave_height?.[hour] ?? null,
        swellDir:     m?.swell_wave_direction?.[hour] ?? null,
        swellPeriodS: m?.swell_wave_period?.[hour] ?? null,
        windWaveM:    m?.wind_wave_height?.[hour] ?? null,
        windWaveDir:  m?.wind_wave_direction?.[hour] ?? null,
        hasMarine:    !!m,
      };
    },
  };
}
