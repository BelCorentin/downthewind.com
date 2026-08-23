/* ============================================================
   map — Leaflet base, run/node/zone layers, and the Windy-style
   weather canvases (colour field + particles / wave arrows).
   ============================================================ */

/* ---- palettes ---- */
const WIND_PAL = [
  [0,[75,95,168]],[6,[61,110,171]],[10,[77,141,133]],[14,[93,164,89]],
  [18,[147,180,71]],[22,[212,181,62]],[27,[214,139,60]],[33,[207,92,52]],
  [40,[181,50,89]],[50,[134,50,181]],
];
const WAVE_PAL = [
  [0,[40,60,100]],[0.5,[50,90,140]],[1,[60,130,160]],[1.5,[80,170,150]],
  [2.5,[150,190,90]],[3.5,[215,170,70]],[5,[210,100,60]],[7,[170,50,90]],
];
function palColor(pal, v) {
  if (v <= pal[0][0]) return pal[0][1];
  for (let i = 1; i < pal.length; i++) {
    if (v <= pal[i][0]) {
      const [v0, c0] = pal[i - 1], [v1, c1] = pal[i], f = (v - v0) / (v1 - v0);
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
    }
  }
  return pal.at(-1)[1];
}
function palCss(pal, v) { const c = palColor(pal, v); return `rgb(${c[0]},${c[1]},${c[2]})`; }
function palGradientCss(pal, max) {
  const stops = pal.filter(([v]) => v < max).map(([v, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${(v / max * 100).toFixed(1)}%`);
  stops.push(`${palCss(pal, max)} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/* ---- base map ----------------------------------------------------
   Place names used to sit UNDER the wind field and turn to mush. Split
   the basemap into geometry and labels, and give the weather canvases a
   Leaflet pane of their own so the labels can be stacked on top:

     tiles 200 → weather 350 → labels 380 → track 400 → markers 600

   The canvases draw in CONTAINER pixels, so they are re-pinned to the
   container origin on every move; without that they would drift with the
   pane transform while panning.
   ------------------------------------------------------------------ */
const map = L.map("map", { zoomControl: true, attributionControl: false, zoomSnap: 0.5 })
  .setView(FRANCE_VIEW.center, FRANCE_VIEW.zoom);

map.createPane("weather").style.zIndex = 350;
map.getPane("weather").style.pointerEvents = "none";
map.createPane("labels").style.zIndex = 380;
map.getPane("labels").style.pointerEvents = "none";

const CARTO = "https://{s}.basemaps.cartocdn.com";
L.tileLayer(`${CARTO}/dark_nolabels/{z}/{x}/{y}{r}.png`, { maxZoom: 19 }).addTo(map);
L.tileLayer(`${CARTO}/dark_only_labels/{z}/{x}/{y}{r}.png`, { maxZoom: 19, pane: "labels" }).addTo(map);

const runLayer   = L.layerGroup().addTo(map);   // the selected run's track
const nodeLayer  = L.layerGroup().addTo(map);   // its nodes
const zoneLayer  = L.layerGroup().addTo(map);   // its active zones
const pinLayer   = L.layerGroup().addTo(map);   // overview pins
const reportLayer = L.layerGroup().addTo(map);  // community reports

const EASE_HEX = {
  easy: "#7fd6a2", ok: "#d9c26f", hard: "#e08a4f", rocky: "#e0555f", none: "#5a6579",
};
const EFFECT_HEX = {
  boost: "#7fd6a2", shelter: "#6fb3d9", shadow: "#d9c26f",
  hazard: "#e08a4f", commit: "#b58fd6", trap: "#e0555f", traffic: "#c98fd6",
};

function clearRunLayers() { [runLayer, nodeLayer, zoneLayer, reportLayer].forEach(l => l.clearLayers()); }

/** Community reports as map pins. Titles are user text — Leaflet tooltips take
    a string, so escape before handing it over. */
function drawReports(list, opts = {}) {
  reportLayer.clearLayers();
  for (const r of list) {
    if (!r.where?.ll) continue;
    const k = REPORT_KINDS[r.type];
    const stale = isStale(r);
    L.marker(r.where.ll, {
      icon: L.divIcon({
        className: "report-pin",
        html: `<span style="color:${k.hex};opacity:${stale ? .45 : 1}">${k.icon}</span>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      }),
      zIndexOffset: r.type === "danger" ? 1000 : 0,
    }).bindTooltip(esc(r.title), { direction: "top" })
      .on("click", () => opts.onReport?.(r))
      .addTo(reportLayer);
  }
}

/** Overview: one pin per run, at its start. */
function drawOverviewPins(runs, onPick) {
  pinLayer.clearLayers();
  for (const r of runs) {
    const start = r.track[0];
    L.marker(start, { icon: L.divIcon({ className: "spot-icon", html: "🏄", iconSize: [24, 24], iconAnchor: [12, 12] }) })
      .bindTooltip(`${t(r.name)} · ${trackLength(r.track).toFixed(0)} km`, { direction: "top" })
      .on("click", () => onPick(r.id))
      .addTo(pinLayer);
  }
}

/** Bearing a→b in degrees, for rotating the flow arrows. */
function bearing(a, b) {
  const p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180;
  const dl = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Chevrons along the leg. A downwind is directional; the line should say so. */
function drawFlowArrows(track, cum, kmA, kmB, layer) {
  const span = kmB - kmA;
  const n = Math.max(2, Math.min(9, Math.round(span / 6)));
  for (let i = 1; i <= n; i++) {
    const km = kmA + span * i / (n + 1);
    const p = pointAtKm(track, km, cum);
    const q = pointAtKm(track, Math.min(kmB, km + 0.35), cum);
    const deg = bearing(p, q);
    L.marker(p, {
      interactive: false,
      icon: L.divIcon({
        className: "flow-arrow",
        html: `<span style="transform:rotate(${deg - 90}deg)">➤</span>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      }),
    }).addTo(layer);
  }
}

/** Draw a run: track, active zones, node markers. Returns the bounds. */
function drawRun(ev, opts = {}) {
  clearRunLayers();
  pinLayer.clearLayers();
  const { run } = ev;

  // full track, dimmed, so a composed leg still reads against the whole run
  L.polyline(run.track, { color: "#7fe3d2", weight: 2, opacity: .22, dashArray: "1 7", lineCap: "round" }).addTo(runLayer);

  const leg = sliceTrack(run.track, ev.kmA, ev.kmB, ev.cum);
  // casing under the line: without it the track disappears into the wind field
  L.polyline(leg, { color: "#04161c", weight: 8, opacity: .55, lineCap: "round", lineJoin: "round" }).addTo(runLayer);
  L.polyline(leg, { color: "#7fe3d2", weight: 3.5, opacity: .95, lineCap: "round", lineJoin: "round" }).addTo(runLayer);
  L.polyline(leg, {
    color: "#eafffb", weight: 2, opacity: .9, lineCap: "round",
    dashArray: "2 14", className: "track-flow",
  }).addTo(runLayer);
  drawFlowArrows(run.track, ev.cum, ev.kmA, ev.kmB, runLayer);

  // zones that are actually firing at this hour
  for (const z of ev.active) {
    if (z.severity === "info" && z.effect !== "boost" && z.effect !== "shelter") continue;
    const hex = EFFECT_HEX[z.effect], high = z.severity === "high";
    // soft wide glow + a crisp core, so zones read as areas rather than routes
    L.polyline(z.zone.geom, {
      color: hex, weight: high ? 22 : 16, opacity: high ? .17 : .1,
      lineCap: "round", lineJoin: "round", interactive: false,
    }).addTo(zoneLayer);
    L.polyline(z.zone.geom, {
      color: hex, weight: high ? 4 : 3, opacity: high ? .85 : .55,
      lineCap: "round", lineJoin: "round",
      dashArray: z.effect === "trap" || z.effect === "hazard" ? null : "6 8",
    }).bindTooltip(`${EFFECT_META[z.effect].icon} ${t(z.zone.name)}`, { direction: "top" })
      .on("click", () => opts.onZone?.(z.zone.id))
      .addTo(zoneLayer);
  }

  // nodes
  for (const n of ev.nodes) {
    const ease = n.node.exit?.ease || "none";
    const isLandmark = n.node.kind.includes("landmark");
    const hi = n.id === opts.highlightId;
    const tip = `${t(n.node.name)} · ${n.km.toFixed(1)} km`
      + (n.node.train ? ` · ${n.node.train.walkMin} min ${s("walk")}` : "");
    L.circleMarker(n.node.ll, {
      radius: isLandmark ? 3.5 : hi ? 8 : 6,
      color: EASE_HEX[ease], fillColor: "#070b11", fillOpacity: 1,
      weight: hi ? 4 : 2.5, className: hi ? "node-hi" : "",
    }).bindTooltip(tip, { direction: "top" })
      .on("click", () => opts.onNode?.(n.id))
      .addTo(nodeLayer);
    // a station is the thing people are actually looking for
    if (n.node.train && !isLandmark) {
      L.marker(n.node.ll, {
        interactive: false,
        icon: L.divIcon({ className: "rail-dot", html: "", iconSize: [7, 7], iconAnchor: [-4, 8] }),
      }).addTo(nodeLayer);
    }
  }

  // start / finish of the selected leg, named so the direction is unambiguous
  const endpoints = [
    { km: ev.kmA, cls: "start", label: getLang() === "fr" ? "départ" : "start" },
    { km: ev.kmB, cls: "finish", label: getLang() === "fr" ? "arrivée" : "finish" },
  ];
  for (const e of endpoints) {
    L.marker(pointAtKm(run.track, e.km, ev.cum), {
      interactive: false,
      icon: L.divIcon({
        className: `endpoint ${e.cls}`,
        html: `<span class="dot"></span><span class="lbl">${esc(e.label)}</span>`,
        iconSize: [0, 0], iconAnchor: [0, 0],
      }),
    }).addTo(runLayer);
  }
  return L.latLngBounds(run.track.concat(ev.nodes.map(n => n.node.ll)));
}

/* ============================================================
   weather overlay
   ============================================================ */
const cv = document.getElementById("overlayCanvas"), ctx = cv.getContext("2d");
const heatCv = document.getElementById("heatCanvas"), heatCtx = heatCv.getContext("2d");
map.getPane("weather").appendChild(heatCv);
map.getPane("weather").appendChild(cv);
function pinCanvases() {
  const origin = map.containerPointToLayerPoint([0, 0]);
  L.DomUtil.setPosition(heatCv, origin);
  L.DomUtil.setPosition(cv, origin);
}
map.on("move zoom moveend zoomend viewreset resize", pinCanvases);
pinCanvases();
const off = document.createElement("canvas"), offCtx = off.getContext("2d");

let mode = null, hour = 0, playing = false, playTimer = null;
let windGrid = null, waveGrid = null, gridKey = null;
let activeBBox = FRANCE_BBOX;

/** Point the overlay at a region (or back at France). Invalidates the grids. */
function setOverlayArea(bbox, key) {
  if (gridKey === key) return;
  gridKey = key; activeBBox = bbox;
  windGrid = waveGrid = null;
  if (mode) setMode(mode, true);
}

function drawHeat() {
  const w = heatCv.clientWidth, h = heatCv.clientHeight;
  if (heatCv.width !== w || heatCv.height !== h) { heatCv.width = w; heatCv.height = h; }
  heatCtx.clearRect(0, 0, w, h);
  if (!mode || !w || !h) return;
  const g = mode === "wind" ? windGrid : waveGrid;
  if (!g) return;
  const pal = mode === "wind" ? WIND_PAL : WAVE_PAL;
  const W = 170, H = Math.max(2, Math.round(W * h / w));
  off.width = W; off.height = H;
  const img = offCtx.createImageData(W, H);
  let k = 0;
  for (let y = 0; y < H; y++) {
    for (let xp = 0; xp < W; xp++, k += 4) {
      const ll = map.containerPointToLatLng([(xp + .5) * w / W, (y + .5) * h / H]);
      const val = mode === "wind"
        ? windAt(g, ll.lat, ll.lng, hour)?.s ?? null
        : waveAt(g, ll.lat, ll.lng, hour);
      if (val == null) continue;
      const c = palColor(pal, val);
      img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
    }
  }
  offCtx.putImageData(img, 0, 0);
  heatCtx.globalAlpha = .42;
  heatCtx.imageSmoothingEnabled = true;
  heatCtx.drawImage(off, 0, 0, w, h);
  heatCtx.globalAlpha = 1;
}

let parts = [];
function resizeCanvas() {
  cv.width = cv.clientWidth * devicePixelRatio;
  cv.height = cv.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  parts = [];
  drawHeat();
  if (mode === "waves") drawWaves();
}
addEventListener("resize", () => { resizeCanvas(); redrawProfile?.(); });
map.on("moveend zoomend", () => { parts = []; drawHeat(); if (mode === "waves") drawWaves(); });
map.on("move zoom", () => { if (mode === "waves") drawWaves(); });

function spawn() {
  return { x: Math.random() * cv.clientWidth, y: Math.random() * cv.clientHeight, life: 40 + Math.random() * 80 };
}
function stepWind() {
  if (mode !== "wind") return;
  const w = cv.clientWidth, h = cv.clientHeight;
  while (parts.length < 1300) parts.push(spawn());
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  for (const p of parts) {
    const ll = map.containerPointToLatLng([p.x, p.y]);
    const f = windAt(windGrid, ll.lat, ll.lng, hour);
    if (!f || p.life-- < 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) { Object.assign(p, spawn()); continue; }
    const k = 0.05 + map.getZoom() * 0.012;
    const nx = p.x + f.u * k, ny = p.y - f.v * k;
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.24 + Math.min(0.5, f.s / 70);
    ctx.lineWidth = 1.05;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
    p.x = nx; p.y = ny;
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(stepWind);
}

function drawWaves() {
  if (mode !== "waves" || !waveGrid) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const g = waveGrid;
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
    const p = g.pts[i * g.n + j];
    const hgt = p.sp[hour];
    if (hgt == null) continue;
    const pt = map.latLngToContainerPoint([g.lats[i], g.lons[j]]);
    if (pt.x < -30 || pt.x > w + 30 || pt.y < -30 || pt.y > h + 30) continue;
    const dir = (p.dir[hour] + 180) * Math.PI / 180;
    const len = 8 + (p.per[hour] || 6) * 1.2;
    ctx.strokeStyle = ctx.fillStyle = "rgba(240,246,255,.9)";
    ctx.lineWidth = 2; ctx.globalAlpha = .9;
    const dx = Math.sin(dir) * len, dy = -Math.cos(dir) * len;
    ctx.beginPath(); ctx.moveTo(pt.x - dx / 2, pt.y - dy / 2); ctx.lineTo(pt.x + dx / 2, pt.y + dy / 2); ctx.stroke();
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(pt.x + dx / 2, pt.y + dy / 2);
    ctx.lineTo(pt.x + dx / 2 - 6 * Math.cos(ang - .4), pt.y + dy / 2 - 6 * Math.sin(ang - .4));
    ctx.lineTo(pt.x + dx / 2 - 6 * Math.cos(ang + .4), pt.y + dy / 2 - 6 * Math.sin(ang + .4));
    ctx.fill();
    ctx.globalAlpha = .35;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5 + hgt * 1.5, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

async function setMode(m, force) {
  if (mode === m && !force) m = null;
  mode = m;
  document.getElementById("btnWind").classList.toggle("on", m === "wind");
  document.getElementById("btnWaves").classList.toggle("on", m === "waves");
  document.getElementById("timeCtl").style.display = m ? "flex" : "none";
  document.getElementById("ovLegend").style.display = m ? "block" : "none";
  ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  parts = [];
  stopPlay();
  drawHeat();
  if (!m) return;
  const L_ = document.getElementById("ovLegendTitle");
  L_.textContent = m === "wind"
    ? (getLang() === "fr" ? "vitesse du vent" : "wind speed")
    : (getLang() === "fr" ? "hauteur de vague" : "wave height");
  document.getElementById("legLo").textContent = m === "wind" ? "0 kn" : "0 m";
  document.getElementById("legHi").textContent = m === "wind" ? "40+ kn" : "5+ m";
  document.getElementById("ovLegendBar").style.background =
    m === "wind" ? palGradientCss(WIND_PAL, 40) : palGradientCss(WAVE_PAL, 5);
  document.getElementById("timeLbl").textContent = s("loading");
  try {
    if (m === "wind" && !windGrid) windGrid = await fetchWindGrid(activeBBox, gridKey);
    if (m === "waves" && !waveGrid) waveGrid = await fetchWaveGrid(activeBBox, gridKey);
  } catch (e) {
    document.getElementById("timeLbl").textContent = s("fetchFail");
    return;
  }
  if (mode !== m) return;
  updateTimeLbl(); buildDayTicks(); drawHeat();
  if (m === "wind") requestAnimationFrame(stepWind); else drawWaves();
}

function overlayTime() { return (windGrid || waveGrid)?.time || null; }

function updateTimeLbl() {
  const time = overlayTime();
  if (!time) return;
  document.getElementById("timeLbl").textContent =
    new Date(time[hour] + "Z").toLocaleString(getLang() === "fr" ? "fr-FR" : "en-GB",
      { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}
function buildDayTicks() {
  const time = overlayTime();
  if (!time) return;
  const days = [];
  for (const x of time) { const d = x.slice(0, 10); if (!days.includes(d)) days.push(d); }
  document.getElementById("dayTicks").innerHTML = days.map(d =>
    `<span>${new Date(d + "T12:00").toLocaleDateString(getLang() === "fr" ? "fr-FR" : "en-GB",
      { weekday: "short", day: "numeric" })}</span>`).join("");
}
function togglePlay() { playing ? stopPlay() : startPlay(); }
function startPlay() {
  const time = overlayTime();
  if (!time) return;
  playing = true;
  document.getElementById("playBtn").textContent = "⏸";
  playTimer = setInterval(() => {
    hour = (hour + 1) % time.length;
    document.getElementById("timeSlider").value = hour;
    updateTimeLbl(); drawHeat();
    if (mode === "waves") drawWaves();
    onHourChange?.(hour);
  }, 480);
}
function stopPlay() {
  playing = false;
  document.getElementById("playBtn").textContent = "▶";
  clearInterval(playTimer);
}
