/* ============================================================
   geo — haversine, distance along a track, projection of a
   node onto a track. Distances are ALWAYS computed here,
   never hand-written in the data files.
   ============================================================ */

const R_EARTH = 6371.0088;   // km

function haversine(a, b) {
  const [la1, lo1] = a, [la2, lo2] = b;
  const p1 = la1 * Math.PI / 180, p2 = la2 * Math.PI / 180;
  const dp = (la2 - la1) * Math.PI / 180, dl = (lo2 - lo1) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Cumulative distance (km) at each vertex of a track. */
function cumulative(track) {
  const cum = [0];
  for (let i = 1; i < track.length; i++) cum.push(cum[i - 1] + haversine(track[i - 1], track[i]));
  return cum;
}

function trackLength(track) { return cumulative(track).at(-1); }

/* Local equirectangular projection — fine over a few tens of km. */
function toXY(ll, ref) {
  const k = Math.cos(ref[0] * Math.PI / 180);
  return [(ll[1] - ref[1]) * k * 111.32, (ll[0] - ref[0]) * 110.574];
}

/**
 * Project a point onto a track.
 * → { km, ll, seg, tFrac, offsetKm }  (offsetKm = perpendicular distance to the track)
 */
function projectOnTrack(ll, track, cum) {
  cum = cum || cumulative(track);
  const ref = track[0];
  const p = toXY(ll, ref);
  let best = null;
  for (let i = 0; i < track.length - 1; i++) {
    const a = toXY(track[i], ref), b = toXY(track[i + 1], ref);
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const len2 = vx * vx + vy * vy;
    let tt = len2 === 0 ? 0 : ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2;
    tt = Math.max(0, Math.min(1, tt));
    const qx = a[0] + vx * tt, qy = a[1] + vy * tt;
    const d = Math.hypot(p[0] - qx, p[1] - qy);
    if (!best || d < best.d) {
      const segLen = cum[i + 1] - cum[i];
      best = {
        d, seg: i, tFrac: tt,
        km: cum[i] + segLen * tt,
        ll: [
          track[i][0] + (track[i + 1][0] - track[i][0]) * tt,
          track[i][1] + (track[i + 1][1] - track[i][1]) * tt,
        ],
      };
    }
  }
  if (!best) return null;
  // `offEnd` = the projection clamped to a terminal vertex, i.e. the point lies
  // BEYOND the track rather than alongside it. Callers use this to reject
  // features that sit past a run's finish.
  const offEnd = (best.seg === 0 && best.tFrac === 0)
              || (best.seg === track.length - 2 && best.tFrac === 1);
  return { km: best.km, ll: best.ll, seg: best.seg, tFrac: best.tFrac, offsetKm: best.d, offEnd };
}

/** Point on the track at a given distance from the start. */
function pointAtKm(track, km, cum) {
  cum = cum || cumulative(track);
  if (km <= 0) return track[0];
  if (km >= cum.at(-1)) return track.at(-1);
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < km) i++;
  const f = (km - cum[i]) / (cum[i + 1] - cum[i] || 1);
  return [
    track[i][0] + (track[i + 1][0] - track[i][0]) * f,
    track[i][1] + (track[i + 1][1] - track[i][1]) * f,
  ];
}

/** Slice a track between two distances — used to draw a composed leg. */
function sliceTrack(track, km0, km1, cum) {
  cum = cum || cumulative(track);
  const out = [pointAtKm(track, km0, cum)];
  for (let i = 0; i < track.length; i++) if (cum[i] > km0 && cum[i] < km1) out.push(track[i]);
  out.push(pointAtKm(track, km1, cum));
  return out;
}

/* ---- angles ---- */

/** Is bearing `a` inside the clockwise sector from → to (degrees, wraps 360)? */
function inSector(a, from, to) {
  const span = (to - from + 360) % 360;
  const rel = (a - from + 360) % 360;
  return rel <= span;
}

/** Smallest absolute angular distance between two bearings. */
function angDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Compass label for a bearing, in the active language. */
function compass(deg) {
  const en = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const fr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  const i = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return (getLang() === "fr" ? fr : en)[i];
}
