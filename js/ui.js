/* ============================================================
   ui — views (France → region → run), the conditions panel,
   the leg picker, the exits table, and the 4-day strip.
   ============================================================ */

let view = { kind: "france", regionId: null, runId: null };
let series = null;          // point forecasts for the current run's nodes
let evalCache = null;       // last evaluateRun() result
let legFrom = null, legTo = null;
let highlightId = null;

const $ = id => document.getElementById(id);

/* ---------- helpers ---------- */
function runsInRegion(id) { return RUNS.filter(r => r.region === id); }
function levelBadge(run) {
  return `<span class="badge lv-${run.levelKey}">${t(run.level).split("—")[0].trim()}</span>`;
}
function fmtKm(km) { return `${km.toFixed(km < 10 ? 1 : 0)} ${s("km")}`; }

/* ============================================================
   France view
   ============================================================ */
function showFrance() {
  view = { kind: "france", regionId: null, runId: null };
  legFrom = legTo = null; highlightId = null;
  clearRunLayers();
  drawProfile(null);
  setOverlayArea(FRANCE_BBOX, "france");
  map.flyTo(FRANCE_VIEW.center, FRANCE_VIEW.zoom, { duration: .8 });
  drawOverviewPins(RUNS, selectRun);

  $("backBtn").style.display = "none";
  $("panel").innerHTML = `
    <div class="kicker">${s("regions")}</div>
    ${REGIONS.map(r => {
      const n = runsInRegion(r.id).length;
      return `<button class="card" data-region="${r.id}">
        <div class="top"><div class="n">${t(r.name)}</div>
          <span class="note">${n} ${s("runsIn")}</span></div>
        <div class="blurb">${t(r.blurb)}</div>
      </button>`;
    }).join("")}
    ${addRunBlock()}`;
  bindCards();
}

/* ============================================================
   Region view
   ============================================================ */
function showRegion(id) {
  const reg = REGION_BY_ID[id];
  if (!reg) return showFrance();
  view = { kind: "region", regionId: id, runId: null };
  legFrom = legTo = null; highlightId = null;
  clearRunLayers();
  drawProfile(null);
  setOverlayArea(reg.bbox, reg.id);
  map.flyTo(reg.view.center, reg.view.zoom, { duration: .8 });

  const runs = runsInRegion(id);
  drawOverviewPins(runs, selectRun);
  // show every run's track faintly so the coast reads as a network
  for (const r of runs) {
    L.polyline(r.track, { color: "#7fe3d2", weight: 2, opacity: .32, dashArray: "1 6" })
      .on("click", () => selectRun(r.id)).addTo(runLayer);
  }

  $("backBtn").style.display = "block";
  $("backBtn").textContent = s("allRuns");
  $("backBtn").onclick = showFrance;
  $("panel").innerHTML = `
    <h2 style="font-size:1.15rem;font-weight:700">${t(reg.name)}</h2>
    <p class="note" style="margin-top:.4rem">${t(reg.blurb)}</p>
    <div class="kicker">${runs.length} ${s("runsIn")}</div>
    ${runs.map(r => `
      <button class="card" data-run="${r.id}">
        <div class="top"><div class="n">${t(r.name)}</div>${levelBadge(r)}</div>
        <div class="a">${fmtKm(trackLength(r.track))} · ${t(r.windName)}</div>
      </button>`).join("")}
    ${addRunBlock()}`;
  bindCards();
}

function addRunBlock() {
  return `<div class="addrun">
    <a class="addrun-btn" href="https://github.com/BelCorentin/downthewind.com/issues/new?template=new-run.yml"
       target="_blank" rel="noopener">${s("addRun")}</a>
    <div class="note" style="margin-top:.5rem;text-align:center">${s("addRunNote")}</div>
  </div>`;
}

function bindCards() {
  document.querySelectorAll("[data-region]").forEach(el =>
    el.onclick = () => showRegion(el.dataset.region));
  document.querySelectorAll("[data-run]").forEach(el =>
    el.onclick = () => selectRun(el.dataset.run));
}

/* ============================================================
   Run view
   ============================================================ */
async function selectRun(runId) {
  const run = RUN_BY_ID[runId];
  if (!run) return;
  view = { kind: "run", regionId: run.region, runId };
  legFrom = legTo = null; highlightId = null;

  const reg = REGION_BY_ID[run.region];
  if (reg) setOverlayArea(reg.bbox, reg.id);

  $("backBtn").style.display = "block";
  $("backBtn").textContent = reg ? `← ${t(reg.name)}` : s("allRuns");
  $("backBtn").onclick = () => showRegion(run.region);
  $("panel").innerHTML = `<div class="note" style="padding:2rem 0">${s("loading")}</div>`;

  /* point forecasts at the run's own nodes: wind at the node, marine at
     its projection on the offshore track (marine is null over land). */
  const cum = cumulative(run.track);
  const windPts = run.nodes.map(id => NODE_BY_ID[id].ll);
  const marinePts = run.nodes.map(id => projectOnTrack(NODE_BY_ID[id].ll, run.track, cum).ll);
  try {
    series = await fetchPointSeries(windPts, marinePts, run.id);
  } catch (e) {
    series = null;
  }
  renderRun();
  const b = evalCache && drawRun(evalCache, { onNode: focusNode, onZone: focusZone });
  if (b) map.flyToBounds(b, { padding: [60, 60], duration: .8 });
}

function sampleFor(run) {
  if (!series) return () => null;
  return (i, h) => series.at(i, h);
}

function currentBounds(run, cum) {
  if (legFrom == null || legTo == null) return null;
  const kmOf = id => projectOnTrack(NODE_BY_ID[id].ll, run.track, cum).km;
  const a = kmOf(legFrom), b = kmOf(legTo);
  return a < b ? { kmA: a, kmB: b } : { kmA: b, kmB: a };
}

function renderRun() {
  const run = RUN_BY_ID[view.runId];
  if (!run) return;
  const cum = cumulative(run.track);
  const ev = evaluateRun(run, sampleFor(run), hour, currentBounds(run, cum));
  evalCache = ev;

  const legKm = ev.kmB - ev.kmA;
  $("panel").innerHTML = `
    <h2>${t(run.name)}</h2>
    <div class="meta">
      ${levelBadge(run)}<br>
      <b>${fmtKm(legKm)}</b>${legKm < ev.total - 0.05 ? ` <span class="note">/ ${fmtKm(ev.total)} ${s("fullRun")}</span>` : ""}
      · ${t(run.windName)}, ${run.wind.idealMin}–${run.wind.idealMax} kn<br>
      ${t(run.level)}
    </div>

    <div class="kicker">${s("conditions")}</div>
    <div id="condBox"></div>

    <div class="kicker">${s("profile")}</div>
    <div class="note">${getLang() === "fr"
      ? "Barres = qualité par tronçon à l'heure choisie. Points = sorties, colorées par difficulté. 🚉 = gare."
      : "Bars = per-segment quality at the selected hour. Dots = exits, coloured by difficulty. 🚉 = station."}</div>

    <div class="kicker">${s("legPicker")}</div>
    <div class="legpicker">
      <div class="fld"><label>${s("from")}</label>${nodeSelect("legFromSel", legFrom ?? run.nodes[0])}</div>
      <div class="fld"><label>${s("to")}</label>${nodeSelect("legToSel", legTo ?? run.nodes.at(-1))}</div>
    </div>
    <button class="legreset" id="legReset">↺ ${s("fullRun")}</button>

    <div class="kicker">${s("exits")}</div>
    <div class="exits" id="exitList"></div>
    <div id="nodeDetail"></div>
    <div class="note" style="margin-top:.55rem">${s("walkNote")}</div>

    <div class="kicker">${s("theRun")}</div>
    <p class="desc">${t(run.description)}</p>

    <div class="kicker">${s("localKnow")}</div>
    <ul class="tips">${run.tips.map(x => `<li>${t(x)}</li>`).join("")}</ul>

    <div class="fc">
      <div class="kicker">${s("window")}</div>
      <div class="days" id="fcDays"></div>
      <div id="readout">${s("hoverCell")}</div>
      <div class="legend"><span>${s("noGo")}</span><div class="bar" id="fcLegendBar"></div><span>${s("sendIt")}</span></div>
      <div class="note" style="margin-top:.5rem">${s("srcNote")}</div>
    </div>
    ${addRunBlock()}`;

  renderConditions(ev);
  renderExits(ev);
  renderForecastStrip(run, ev);
  drawProfile(ev, { onNode: focusNode, onZone: focusZone, onHover: hoverNode, highlightId });

  $("legFromSel").onchange = e => { legFrom = e.target.value; syncLeg(); };
  $("legToSel").onchange   = e => { legTo   = e.target.value; syncLeg(); };
  $("legReset").onclick    = () => { legFrom = legTo = null; syncLeg(); };
}

function nodeSelect(id, sel) {
  const run = RUN_BY_ID[view.runId];
  const cum = cumulative(run.track);
  return `<select id="${id}">${run.nodes.map(nid => {
    const n = NODE_BY_ID[nid];
    const km = projectOnTrack(n.ll, run.track, cum).km;
    return `<option value="${nid}"${nid === sel ? " selected" : ""}>${t(n.name)} · ${km.toFixed(0)} km</option>`;
  }).join("")}</select>`;
}

function syncLeg() {
  const run = RUN_BY_ID[view.runId];
  if (legFrom == null) legFrom = run.nodes[0];
  if (legTo == null) legTo = run.nodes.at(-1);
  if (legFrom === legTo) return;
  renderRun();
  drawRun(evalCache, { onNode: focusNode, onZone: focusZone, highlightId });
}

/* ---------- conditions panel ---------- */
function renderConditions(ev) {
  const box = $("condBox");
  const mid = ev.nodes[Math.floor(ev.nodes.length / 2)];
  const time = series?.time || overlayTime();
  const when = time
    ? new Date(time[hour] + "Z").toLocaleString(getLang() === "fr" ? "fr-FR" : "en-GB",
        { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : "—";

  const rows = ev.active
    .filter(z => z.severity !== "info" || z.effect === "boost" || z.effect === "shelter" || z.effect === "trap")
    .map(z => `
      <div class="cond-row e-${z.effect} sev-${z.severity}" data-zone="${z.zone.id}">
        <div class="ic">${EFFECT_META[z.effect].icon}</div>
        <div class="tx">
          <b>${t(z.zone.name)}
            <span class="where">${z.kmA.toFixed(0)}–${z.kmB.toFixed(0)} ${s("km")} · ${s("effect", z.effect)}</span></b>
          ${t(z.rule.text)}
        </div>
      </div>`).join("");

  const g = ev.suggestion;
  const sug = g
    ? `<div class="suggest">
         <div class="lbl">${s("suggested")}</div>
         <div class="val">${t(g.from.node.name)} → ${t(g.to.node.name)} · ${fmtKm(g.km)}</div>
         <div class="sub">${getLang() === "fr" ? "meilleure portion continue à cette heure" : "best continuous stretch at this hour"}${
           g.compromised ? (getLang() === "fr" ? " — sortie difficile aux deux bouts" : " — hard exits at both ends") : ""}</div>
       </div>`
    : `<div class="suggest none"><div class="lbl">${s("suggested")}</div>
         <div class="val">—</div>
         <div class="sub">${getLang() === "fr"
            ? "rien de rideable sur ce créneau" : "nothing rideable at this hour"}</div></div>`;

  box.innerHTML = `
    <div class="cond-head">
      <div class="when">${when}</div>
      <div class="what">${conditionsLine(mid.f)}</div>
      ${mid.f && !mid.f.hasMarine ? `<div class="note" style="margin-top:.3rem">${
        getLang() === "fr" ? "données de houle indisponibles — règles de mer croisée inactives"
                           : "swell data unavailable — cross-sea rules inactive"}</div>` : ""}
    </div>
    ${rows || `<div class="note" style="padding:.3rem 0 .5rem">${s("noneToday")}</div>`}
    ${sug}`;

  box.querySelectorAll("[data-zone]").forEach(el =>
    el.onclick = () => focusZone(el.dataset.zone));
}

/* ---------- exits & stations ---------- */
function renderExits(ev) {
  $("exitList").innerHTML = ev.nodes.map(n => {
    const e = n.node.exit || {};
    const tr = n.node.train;
    return `<div class="exit-row" data-node="${n.id}">
      <div class="km">${n.km.toFixed(1)}</div>
      <div>
        <div class="nm"><span class="dot" style="background:${EASE_HEX[e.ease] || "#5a6579"}"></span>${t(n.node.name)}</div>
        <div class="sub">${s("ease", e.ease) || "—"}${e.shore ? " · " + s("shore", e.shore) : ""}</div>
      </div>
      <div class="tr">${tr ? `🚉 <span class="w">${tr.walkMin} ${s("min")}</span>` : "<span style='opacity:.4'>—</span>"}</div>
    </div>`;
  }).join("");
  $("exitList").querySelectorAll("[data-node]").forEach(el =>
    el.onclick = () => focusNode(el.dataset.node));
}

function focusNode(id) {
  highlightId = id;
  const n = NODE_BY_ID[id];
  const ev = evalCache;
  const en = ev?.nodes.find(x => x.id === id);
  const e = n.exit || {}, tr = n.train;
  $("nodeDetail").innerHTML = `
    <div class="node-detail">
      <h4>${t(n.name)}${en ? ` <span class="note">· ${en.km.toFixed(1)} ${s("km")}</span>` : ""}</h4>
      ${t(e.note) || ""}
      <dl>
        <dt>${s("exits")}</dt><dd>${s("ease", e.ease) || "—"}${e.shore ? " · " + s("shore", e.shore) : ""}</dd>
        ${tr ? `
          <dt>${s("station")}</dt><dd>${tr.station}</dd>
          <dt>${s("walk")}</dt><dd>${tr.walkMin} ${s("min")} <span class="note">(${s("estimated")})</span> — ${t(tr.carry)}</dd>
          <dt>${s("backTo")}</dt><dd>${tr.hub ? `${t(NODE_BY_ID[tr.hub].name)} · ~${tr.toHubMin} ${s("min")}` : "—"}</dd>
          <dt>${tr.line}</dt><dd>~${tr.freqPerHour}/h${tr.seasonal ? ` · <span style="color:var(--e-shadow)">${s("verify")}</span>` : ""}</dd>
        ` : ""}
      </dl>
    </div>`;
  document.querySelectorAll(".exit-row").forEach(r => r.classList.toggle("hi", r.dataset.node === id));
  if (evalCache) {
    drawRun(evalCache, { onNode: focusNode, onZone: focusZone, highlightId });
    drawProfile(evalCache, { onNode: focusNode, onZone: focusZone, onHover: hoverNode, highlightId });
  }
  map.panTo(n.ll, { duration: .5 });
}

function hoverNode(id) {
  document.querySelectorAll(".exit-row").forEach(r => r.classList.toggle("hi", r.dataset.node === id));
}

function focusZone(zoneId) {
  const z = ZONE_BY_ID[zoneId];
  if (!z) return;
  map.flyToBounds(L.latLngBounds(z.geom), { padding: [80, 80], maxZoom: 13, duration: .7 });
  const row = document.querySelector(`.cond-row[data-zone="${zoneId}"]`);
  row?.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

/* ---------- 4-day strip ---------- */
function renderForecastStrip(run, ev) {
  $("fcLegendBar").style.background = palGradientCss(WIND_PAL, 30);
  if (!series) {
    $("fcDays").innerHTML = `<div class="note">${s("fetchFail")}</div>`;
    return;
  }
  // score the whole run per hour: mean of per-node base scores, so the strip
  // and the profile agree instead of measuring different things
  const N = run.nodes.length;
  const days = {};
  series.time.forEach((x, i) => { (days[x.slice(0, 10)] ||= []).push(i); });
  const readout = $("readout");
  const fmtDay = d => new Date(d + "T12:00").toLocaleDateString(
    getLang() === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric" });

  $("fcDays").innerHTML = Object.entries(days).map(([day, idxs]) => `
    <div class="day">
      <div class="lbl">${fmtDay(day)}</div>
      <div class="cells">${idxs.map(h => {
        let sum = 0, m = null;
        for (let k = 0; k < N; k++) {
          const f = series.at(k, h);
          if (!f) continue;
          sum += baseScore(f, run.wind);
          if (k === Math.floor(N / 2)) m = f;
        }
        const sc = sum / N;
        const utc = new Date(series.time[h] + "Z");
        const paris = +utc.toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false });
        const night = paris < 7 || paris > 21;
        const info = m
          ? `${utc.toLocaleString(getLang() === "fr" ? "fr-FR" : "en-GB",
               { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} — `
            + `${compass(m.windDir)} ${Math.round(m.windKn)} kn`
            + (m.gustKn != null ? ` (${Math.round(m.gustKn)})` : "")
            + ` · ${(sc * 100).toFixed(0)}%`
          : "—";
        return `<div class="cell${night ? " night" : ""}${h === hour ? " sel" : ""}"
           style="background:${palCss(WIND_PAL, sc * 30)}" data-h="${h}" data-info="${info.replace(/"/g, "&quot;")}"></div>`;
      }).join("")}</div>
    </div>`).join("");

  $("fcDays").querySelectorAll(".cell").forEach(c => {
    c.addEventListener("pointerenter", () => readout.textContent = c.dataset.info);
    c.addEventListener("click", () => setHour(+c.dataset.h));
  });
}

/* ---------- hour changes drive everything ---------- */
function setHour(h) {
  hour = h;
  $("timeSlider").value = h;
  updateTimeLbl();
  drawHeat();
  if (mode === "waves") drawWaves();
  onHourChange(h);
}

function onHourChange() {
  if (view.kind !== "run") return;
  renderRun();
  drawRun(evalCache, { onNode: focusNode, onZone: focusZone, highlightId });
}

function redrawProfile() { if (evalCache && view.kind === "run") drawProfile(evalCache, {
  onNode: focusNode, onZone: focusZone, onHover: hoverNode, highlightId }); }

/* ---------- boot ---------- */
function boot() {
  document.documentElement.lang = getLang();
  $("tagline").innerHTML = `${s("tagline")} ${s("by")} <a href="https://corentinbel.com">Corentin Bel</a>.`;
  document.querySelectorAll(".langtoggle button").forEach(b =>
    b.classList.toggle("on", b.dataset.lang === getLang()));

  $("timeSlider").addEventListener("input", e => setHour(+e.target.value));
  $("sheetHandle").onclick = () => $("aside").classList.toggle("open");
  $("brand").onclick = showFrance;

  document.querySelectorAll(".langtoggle button").forEach(b =>
    b.onclick = () => setLang(b.dataset.lang));
  document.addEventListener("langchange", () => {
    document.querySelectorAll(".langtoggle button").forEach(b =>
      b.classList.toggle("on", b.dataset.lang === getLang()));
    $("tagline").innerHTML = `${s("tagline")} ${s("by")} <a href="https://corentinbel.com">Corentin Bel</a>.`;
    buildDayTicks(); updateTimeLbl();
    if (view.kind === "run") onHourChange();
    else if (view.kind === "region") showRegion(view.regionId);
    else showFrance();
  });

  resizeCanvas();
  // deep link: #run/frejus-nice or #region/cote-azur
  const [kind, id] = (location.hash || "").replace(/^#/, "").split("/");
  if (kind === "run" && RUN_BY_ID[id]) selectRun(id);
  else if (kind === "region" && REGION_BY_ID[id]) showRegion(id);
  else showFrance();
}
