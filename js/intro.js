/* ============================================================
   intro — a cartoon golden-hour scene shown over the map on the
   first visit of a session. The map boots underneath, so leaving
   the intro is instant. Signposts jump straight to a region.
   ============================================================ */

const INTRO_KEY = "dtw-intro-seen";

const INTRO_STR = {
  lead: {
    fr: "Des runs de downwind en wing et SUP-foil le long des côtes françaises : où partir, où sortir, quel train reprendre, et le vent qu'il fera.",
    en: "Wing and SUP-foil downwind runs along the French coast: where to start, where to get out, which train takes you back, and what the wind will do.",
  },
  open: { fr: "Ouvrir la carte →", en: "Open the map →" },
  runs: { fr: "runs", en: "runs" },
  run: { fr: "run", en: "run" },
  hint: { fr: "ou choisis un panneau", en: "or pick a signpost" },
};

function introSVG() {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const svg = el("svg", { viewBox: "0 0 1600 1000", preserveAspectRatio: "xMidYMid slice", id: "introScene", role: "img", "aria-label": "A wing foiler riding swells along a Mediterranean coast at golden hour" });
  svg.innerHTML = `
  <defs>
    <linearGradient id="iSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#14254a"/><stop offset=".38" stop-color="#4a5a8a"/><stop offset=".7" stop-color="#e89a6a"/><stop offset="1" stop-color="#ffd08a"/>
    </linearGradient>
    <linearGradient id="iSea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8a27a"/><stop offset=".08" stop-color="#4a7aa0"/><stop offset=".5" stop-color="#1e4a72"/><stop offset="1" stop-color="#0c2440"/>
    </linearGradient>
    <linearGradient id="iCliff" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8603a"/><stop offset="1" stop-color="#7a3020"/>
    </linearGradient>
    <linearGradient id="iSand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0d29a"/><stop offset="1" stop-color="#c9a066"/>
    </linearGradient>
    <linearGradient id="iWing" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff6a5a"/><stop offset="1" stop-color="#ffb02a"/>
    </linearGradient>
    <radialGradient id="iSun" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff0c0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc070" stop-opacity=".35"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="iSeaClip"><rect x="0" y="560" width="1600" height="440"/></clipPath>
  </defs>
  <rect width="1600" height="1000" fill="url(#iSky)"/>
  <g id="iWind" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round" fill="none"></g>
  <circle cx="1230" cy="540" r="230" fill="url(#iSun)"/>
  <circle cx="1230" cy="548" r="52" fill="#fff0c0"/>
  <path d="M520 560 Q600 500 680 520 Q760 470 860 510 Q940 480 1020 530 Q1100 520 1160 560z" fill="#8a4a6a" opacity=".7"/>
  <path d="M1300 560 Q1380 530 1450 540 Q1530 515 1600 530 V560z" fill="#7a4060" opacity=".6"/>
  <rect y="558" width="1600" height="442" fill="url(#iSea)"/>
  <g clip-path="url(#iSeaClip)">
    <g id="iGlitter" fill="#fff4c8"></g>
    <g id="iSwells" fill="none" stroke-linecap="round"></g>
  </g>
  <g id="iFar"></g>
  <g id="iRider"></g>
  <g transform="translate(0 70)">
  <path d="M0 520 Q120 470 260 500 Q380 520 470 600 Q520 650 560 700 Q600 760 640 1000 H0z" fill="url(#iCliff)" stroke="#3a1a14" stroke-width="3"/>
  <path d="M0 610 Q200 560 420 640" fill="none" stroke="#5a2418" stroke-width="2" opacity=".5"/>
  <path d="M60 700 q60 -30 120 0 M220 760 q50 -20 110 4" fill="none" stroke="#5a2418" stroke-width="2" opacity=".4"/>
  <g id="iRail">
    <path d="M0 640 Q240 600 470 690 L520 740" fill="none" stroke="#e8d0b0" stroke-width="10"/>
    <path d="M0 640 Q240 600 470 690 L520 740" fill="none" stroke="#3a1a14" stroke-width="2"/>
  </g>
  <g id="iTrain"></g>
  <g id="iPines"></g>
  </g>
  <path d="M0 860 Q300 820 640 880 Q900 920 1600 900 V1000 H0z" fill="url(#iSand)" stroke="#8a6a3a" stroke-width="3"/>
  <path id="iFoam" d="M640 880 Q900 916 1600 896" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-dasharray="40 18"/>
  <g id="iGulls" fill="none" stroke="#2a2030" stroke-width="2.4" stroke-linecap="round"></g>
  <g id="iSigns"></g>`;

  // umbrella pines on the cape
  const pines = svg.querySelector("#iPines");
  for (const [x, y, s] of [[90, 520, 1], [190, 500, .8], [330, 536, 1.1], [430, 600, .7]]) {
    const g = el("g", { transform: `translate(${x} ${y}) scale(${s})` }, pines);
    el("path", { d: "M0 0 q-6 -40 14 -78", fill: "none", stroke: "#4a2a18", "stroke-width": 7, "stroke-linecap": "round" }, g);
    el("ellipse", { cx: 18, cy: -86, rx: 54, ry: 18, fill: "#2f5a3a", stroke: "#16301e", "stroke-width": 2.5 }, g);
    el("ellipse", { cx: 6, cy: -94, rx: 30, ry: 10, fill: "#3d7048" }, g);
  }
  // a little regional train on the cliff line: the ride back after the run
  const train = svg.querySelector("#iTrain");
  for (let i = 0; i < 3; i++) {
    const c = el("g", { class: "car" }, train);
    el("rect", { x: -26, y: -16, width: 52, height: 16, rx: 5, fill: i ? "#f4efe4" : "#e04848", stroke: "#2a1410", "stroke-width": 2 }, c);
    el("rect", { x: -26, y: -8, width: 52, height: 4, fill: "#2a5aa8" }, c);
    for (let w = -18; w < 20; w += 12) el("rect", { x: w, y: -14, width: 8, height: 5, rx: 1, fill: "#2a3a5a" }, c);
  }
  // distant sails
  const far = svg.querySelector("#iFar");
  for (const [x, y, s] of [[760, 570, .5], [1450, 574, .4]]) {
    const g = el("g", { transform: `translate(${x} ${y}) scale(${s})` }, far);
    el("path", { d: "M0 0 V-60 l26 52z M-2 -50 l-18 46 h18z", fill: "#fff4e0", opacity: .8 }, g);
  }
  // the rider: board flying on the foil above a swell, wing held overhead
  svg.querySelector("#iRider").innerHTML = `
    <path id="iWake" d="" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
    <g id="iFoiler">
      <!-- spray where the mast cuts the surface, foil faint under water -->
      <path d="M-30 52 q30 10 62 0" fill="none" stroke="#bfe8ff" stroke-opacity=".5" stroke-width="3"/>
      <path d="M-34 60 q36 8 70 -2 q-34 -4 -70 2z" fill="#0c2440" opacity=".55"/>
      <path d="M-2 4 L2 50" stroke="#16181c" stroke-width="5"/>
      <path d="M-14 44 q8 -10 18 -2 q10 -10 16 2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <!-- board -->
      <path d="M-58 0 q0 -8 10 -8 h92 q16 0 22 8 q-6 6 -20 6 h-96 q-8 0 -8 -6z" fill="#2fb3a8" stroke="#0e2a28" stroke-width="2.5"/>
      <path d="M-40 -6 h56" stroke="#16181c" stroke-width="4" stroke-linecap="round"/>
      <!-- rider in a dark wetsuit, knees bent -->
      <path d="M-14 -8 L-22 -34 L-8 -58 M10 -8 L14 -34 L4 -60" fill="none" stroke="#1d2026" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-2 -58 L4 -98" stroke="#1d2026" stroke-width="15" stroke-linecap="round"/>
      <path d="M-2 -70 L2 -96" stroke="#3a6aa8" stroke-width="5" stroke-linecap="round"/>
      <circle cx="7" cy="-112" r="10" fill="#e8b48a" stroke="#1d2026" stroke-width="2"/>
      <path d="M-3 -116 q10 -10 20 -2 q-8 -2 -20 2z" fill="#3a2418"/>
      <path d="M0 -92 L-26 -112 M6 -92 L34 -118" stroke="#1d2026" stroke-width="7" stroke-linecap="round"/>
      <g id="iWingSail">
        <path d="M-84 -122 Q4 -222 98 -130 Q6 -162 -84 -122z" fill="url(#iWing)" stroke="#5a1a10" stroke-width="2.5"/>
        <path d="M-80 -124 Q4 -168 94 -132" fill="none" stroke="#5a1a10" stroke-width="5" stroke-linecap="round"/>
        <path d="M6 -170 V-126" stroke="#5a1a10" stroke-width="4"/>
        <path d="M-40 -152 q14 -8 30 -6 l-2 14 q-14 0 -26 4z" fill="#d9f3ff" opacity=".7"/>
      </g>
    </g>`;
  return svg;
}

function showIntro(force) {
  if (!force && sessionStorage.getItem(INTRO_KEY)) return;
  const NS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.id = "intro";
  wrap.innerHTML = `
    <div class="intro-copy">
      <h1>down<b>the</b>wind</h1>
      <p>${t(INTRO_STR.lead)}</p>
      <button class="intro-go">${t(INTRO_STR.open)}</button>
      <div class="intro-hint">${t(INTRO_STR.hint)} ↘</div>
      <div class="intro-regions"></div>
    </div>
    <div class="intro-lang"><button data-lang="fr">FR</button><button data-lang="en">EN</button></div>
    <div class="intro-by">by <a href="https://corentinbel.com">Corentin Bel</a></div>`;
  const svg = introSVG();
  wrap.prepend(svg);
  document.body.appendChild(wrap);

  // one signpost per region, with its run count from the data
  const signs = svg.querySelector("#iSigns");
  const posts = [[700, 900, -4], [960, 912, 3], [1220, 906, -3]];
  REGIONS.forEach((reg, i) => {
    const [x, y, rot] = posts[i % posts.length];
    const n = RUNS.filter(r => r.region === reg.id).length;
    const name = t(reg.name), w = Math.max(120, name.length * 8.6 + 26);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "intro-sign"); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
    g.setAttribute("transform", `translate(${x} ${y})`);
    g.innerHTML = `
      <path d="M-4 0 V-120" stroke="#5a3a20" stroke-width="9" stroke-linecap="round"/>
      <g transform="rotate(${rot} 0 -110)">
        <path d="M-6 -134 h${w} l18 18 l-18 18 h-${w}z" fill="#e8c890" stroke="#4a2a14" stroke-width="3" stroke-linejoin="round"/>
        <path d="M0 -128 h${w - 10}" stroke="#c9a060" stroke-width="1.5"/>
        <text x="${w / 2 - 2}" y="-112" text-anchor="middle" font-size="15" font-weight="700" fill="#3a2010"></text>
        <text x="${w / 2 - 2}" y="-100" text-anchor="middle" font-size="11" fill="#6a4a2a">${n} ${t(n === 1 ? INTRO_STR.run : INTRO_STR.runs)}</text>
      </g>`;
    g.querySelector("text").textContent = name;
    const go = () => { closeIntro(); showRegion(reg.id); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    signs.appendChild(g);
    const btn = document.createElement("button");
    btn.textContent = `${name} · ${n}`;
    btn.onclick = go;
    wrap.querySelector(".intro-regions").appendChild(btn);
  });

  wrap.querySelector(".intro-go").onclick = () => closeIntro();
  wrap.querySelectorAll(".intro-lang button").forEach(b => {
    b.classList.toggle("on", b.dataset.lang === getLang());
    b.onclick = () => { setLang(b.dataset.lang); if (wrap._stop) wrap._stop(); wrap.remove(); showIntro(true); };
  });

  // ---------- animation ----------
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const swells = [];
  for (let i = 0; i < 26; i++) {
    const depth = i / 25, y = 570 + Math.pow(depth, 1.6) * 420;
    swells.push({ e: el("path", { stroke: depth < .3 ? "#f4c8a0" : "#9fd0f0", "stroke-opacity": .25 + depth * .45, "stroke-width": 1 + depth * 3 }, svg.querySelector("#iSwells")), y, depth, ph: i * 1.7 });
  }
  for (let i = 0; i < 40; i++) {
    const y = 566 + Math.pow(Math.random(), 1.8) * 200;
    el("rect", { x: 1230 - (20 + (y - 560) * .5) * Math.random(), y, width: 10 + Math.random() * 40, height: 2, rx: 1, opacity: .3 + Math.random() * .5 }, svg.querySelector("#iGlitter"));
  }
  const winds = [];
  for (let i = 0; i < 9; i++) winds.push({ e: el("path", {}, svg.querySelector("#iWind")), x: Math.random() * 1800, y: 80 + Math.random() * 420, v: 120 + Math.random() * 120, l: 60 + Math.random() * 90 });
  const gulls = [];
  for (let i = 0; i < 4; i++) gulls.push({ e: el("path", {}, svg.querySelector("#iGulls")), x: Math.random() * 1600, y: 200 + Math.random() * 220, p: Math.random() * 6, s: .7 + Math.random() * .5 });
  const cars = [...svg.querySelectorAll("#iTrain .car")];
  const railPath = svg.querySelector("#iRail path"), railLen = railPath.getTotalLength();
  const foiler = svg.querySelector("#iFoiler"), wake = svg.querySelector("#iWake"), sail = svg.querySelector("#iWingSail"), foam = svg.querySelector("#iFoam");
  const trail = [];
  let T = 6, last = performance.now(), alive = true;
  wrap._stop = () => { alive = false; };
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    // swells march downwind, nearer ones bigger and faster
    for (const s of swells) {
      const amp = 3 + s.depth * 14, k = .006 + (1 - s.depth) * .01, off = T * (30 + s.depth * 60) + s.ph * 40;
      let d = "";
      for (let x = -40; x <= 1640; x += 40) d += (x === -40 ? "M" : "L") + x + " " + (s.y + Math.sin(x * k + off * .02) * amp - x * .02 * s.depth).toFixed(1);
      s.e.setAttribute("d", d);
    }
    for (const w of winds) {
      w.x -= w.v * dt; if (w.x < -200) { w.x = 1700; w.y = 80 + Math.random() * 420; }
      w.e.setAttribute("d", `M${w.x.toFixed(0)} ${w.y.toFixed(0)} q${-w.l / 2} 6 ${-w.l} 0`);
    }
    for (const g of gulls) {
      g.x -= 26 * dt; if (g.x < -60) g.x = 1660; g.p += dt * 6;
      const f = Math.sin(g.p) * 6 * g.s, w = 12 * g.s;
      g.e.setAttribute("d", `M${(g.x - w).toFixed(1)} ${(g.y - f).toFixed(1)} Q${(g.x - w / 2).toFixed(1)} ${(g.y - 6 * g.s).toFixed(1)} ${g.x.toFixed(1)} ${g.y.toFixed(1)} Q${(g.x + w / 2).toFixed(1)} ${(g.y - 6 * g.s).toFixed(1)} ${(g.x + w).toFixed(1)} ${(g.y - f).toFixed(1)}`);
    }
    cars.forEach((c, i) => {
      const loop = railLen + 400, s = ((T * 70 - i * 56) % loop + loop) % loop - 200;
      const p = railPath.getPointAtLength(Math.max(0, Math.min(railLen, s)));
      const p2 = railPath.getPointAtLength(Math.max(0, Math.min(railLen, s + 2)));
      c.setAttribute("transform", `translate(${p.x.toFixed(1)} ${(p.y - 4).toFixed(1)}) rotate(${(Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI).toFixed(1)})`);
      c.style.opacity = s < 0 || s > railLen ? 0 : 1;
    });
    // the rider carves across the swells from right to left, pumping a little
    const u = (T * .045) % 1, x = 1560 - u * 980, y = 730 + Math.sin(T * .9) * 10 + u * 40;
    foiler.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(Math.sin(T * .9 + 1) * 4).toFixed(1)}) scale(1.15)`);
    sail.setAttribute("transform", `rotate(${(Math.sin(T * 1.3) * 4).toFixed(1)} 0 -110)`);
    if (u < .02) trail.length = 0;
    trail.push([x + 40, y + 58]); if (trail.length > 50) trail.shift();
    wake.setAttribute("d", trail.length > 1 ? "M" + trail.map(p => p[0].toFixed(0) + " " + p[1].toFixed(0)).join("L") : "");
    foam.setAttribute("stroke-dashoffset", (-T * 20).toFixed(1));
    if (!reduced) requestAnimationFrame(frame);
  }
  frame(performance.now());
  if (!reduced) requestAnimationFrame(frame);
}

function closeIntro() {
  const w = document.getElementById("intro");
  if (!w) return;
  sessionStorage.setItem(INTRO_KEY, "1");
  w.classList.add("leaving");
  setTimeout(() => { if (w._stop) w._stop(); w.remove(); if (typeof map !== "undefined") map.invalidateSize(); }, 600);
}

addEventListener("keydown", e => { if (e.key === "Escape") closeIntro(); });
