/* ============================================================
   profile — the horizontal band under the map.

   One SVG, distance along the run on the x axis. It carries, in
   one glance: how far it is, where you can get out, where the
   trains are, and which stretches are good or bad AT THE HOUR
   YOU ARE LOOKING AT. This replaces the bullet list as the
   primary way to read a run.
   ============================================================ */

const PF = { padL: 30, padR: 30, segY: 30, segH: 13, zoneY: 46, zoneH: 7 };

const EASE_COLOR = {
  easy: "var(--ease-easy)", ok: "var(--ease-ok)", hard: "var(--ease-hard)",
  rocky: "var(--ease-rocky)", none: "var(--ease-none)",
};
const EFFECT_COLOR = {
  boost: "var(--e-boost)", shelter: "var(--e-shelter)", shadow: "var(--e-shadow)",
  hazard: "var(--e-hazard)", commit: "var(--e-commit)", trap: "var(--e-trap)",
  traffic: "var(--e-traffic)",
};

function scoreColor(v) {
  // same ramp as the forecast strip so the two read as one system
  return palCss(WIND_PAL, v * 30);
}

/**
 * @param ev      result of evaluateRun()
 * @param opts    { onNode, onZone, highlightId }
 */
function drawProfile(ev, opts = {}) {
  const wrap = document.getElementById("profileWrap");
  const svg = document.getElementById("profile");
  if (!ev || !ev.nodes.length) { wrap.classList.remove("on"); return; }
  wrap.classList.add("on");

  const W = svg.clientWidth || wrap.clientWidth - 20 || 600;
  const x = km => PF.padL + (km / ev.total) * (W - PF.padL - PF.padR);

  const parts = [];

  /* --- composed-leg window --- */
  if (ev.kmA > 0.01 || ev.kmB < ev.total - 0.01) {
    parts.push(`<rect class="pf-legwin" x="${x(ev.kmA)}" y="4" width="${Math.max(1, x(ev.kmB) - x(ev.kmA))}" height="${PF.h - 26}" rx="6"/>`);
  }

  /* --- segment score bars --- */
  for (const sg of ev.segments) {
    const w = Math.max(1.5, x(sg.kmB) - x(sg.kmA));
    const inLeg = sg.kmB > ev.kmA - 0.01 && sg.kmA < ev.kmB + 0.01;
    parts.push(
      `<rect class="pf-seg" x="${x(sg.kmA)}" y="${PF.segY}" width="${w}" height="${PF.segH}" rx="2.5"
         fill="${scoreColor(sg.score)}" opacity="${inLeg ? 0.9 : 0.22}"
         data-seg="${sg.i}"><title>${esc(segTitle(sg))}</title></rect>`);
  }

  /* --- zone spans, stacked so overlapping ones stay visible --- */
  const lanes = [];
  const drawn = ev.active.filter(z => z.severity !== "info" || z.effect === "boost" || z.effect === "shelter");
  for (const z of drawn) {
    let lane = 0;
    while (lanes[lane] != null && lanes[lane] > x(z.kmA) - 3) lane++;
    lanes[lane] = x(z.kmB);
    const y = PF.zoneY + lane * (PF.zoneH + 2);
    const w = Math.max(3, x(z.kmB) - x(z.kmA));
    parts.push(
      `<rect class="pf-zone" x="${x(z.kmA)}" y="${y}" width="${w}" height="${PF.zoneH}" rx="3"
         fill="${EFFECT_COLOR[z.effect]}" opacity="${z.severity === "high" ? .95 : .6}"
         data-zone="${esc(z.zone.id)}" style="cursor:pointer">
         <title>${esc(t(z.zone.name) + " — " + t(z.rule.text))}</title></rect>`);
  }
  const laneCount = Math.max(1, lanes.length);
  const axisY = PF.zoneY + laneCount * (PF.zoneH + 2) + 8;

  /* --- axis + km ticks --- */
  parts.push(`<line class="pf-axis" x1="${PF.padL}" y1="${axisY}" x2="${W - PF.padR}" y2="${axisY}"/>`);
  const step = ev.total > 45 ? 10 : ev.total > 18 ? 5 : 2;
  for (let k = 0; k <= ev.total + 0.001; k += step) {
    parts.push(`<line class="pf-axis" x1="${x(k)}" y1="${axisY - 3}" x2="${x(k)}" y2="${axisY + 3}"/>`);
    parts.push(`<text class="pf-tick" x="${x(k)}" y="${axisY + 14}" text-anchor="middle">${k}</text>`);
  }
  const lastTick = Math.floor(ev.total / step) * step;
  if (x(ev.total) - x(lastTick) > 22) {
    parts.push(`<text class="pf-tick" x="${W - PF.padR}" y="${axisY + 14}" text-anchor="end">${ev.total.toFixed(0)} km</text>`);
  }

  /* --- nodes --- */
  for (const n of ev.nodes) {
    const cx = x(n.km);
    const ease = n.node.exit?.ease || "none";
    const hi = opts.highlightId === n.id;
    const r = n.node.kind.includes("landmark") ? 3.2 : 4.6;
    parts.push(
      `<g class="pf-node" data-node="${esc(n.id)}">
         <circle cx="${cx}" cy="${axisY}" r="${hi ? r + 2.2 : r}" fill="${EASE_COLOR[ease]}"/>
         ${n.node.train ? trainGlyph(cx, axisY - 13) : ""}
         <title>${esc(nodeTitle(n))}</title>
       </g>`);
  }

  /* --- labels: place by importance, not left-to-right.
     Left-to-right greedy dropped Agay, which is the single most useful
     bail-out on the run. Rank first, then place what fits. --- */
  // Width must be measured per label, not assumed: a fixed 52 px let
  // "Cros-de-Cagnes" overlap its neighbour on a phone.
  const labelW = str => str.length * 4.55 + 7;      // ~8.5px sans-serif
  const ROWS = [axisY + 25, axisY + 36];
  const taken = [[], []];
  const ranked = ev.nodes
    .map((n, i) => ({ n, i, cx: x(n.km), pri: labelPriority(n, i, ev) }))
    .sort((a, b) => b.pri - a.pri || a.cx - b.cx);

  for (const { n, cx, pri } of ranked) {
    const hi = opts.highlightId === n.id;
    const txt = shortName(n.node);
    const half = labelW(txt) / 2;
    let placed = false;
    for (let row = 0; row < ROWS.length && !placed; row++) {
      // reject on span overlap, not just centre-inside-span
      if (taken[row].some(([a, b]) => cx + half > a - 2 && cx - half < b + 2)) continue;
      // keep the end labels inside the box instead of clipping them
      const anchor = cx - half < 2 ? "start" : cx + half > W - 2 ? "end" : "middle";
      const tx = anchor === "start" ? 2 : anchor === "end" ? W - 2 : cx;
      const lo = anchor === "start" ? tx : anchor === "end" ? tx - half * 2 : tx - half;
      taken[row].push([lo, lo + half * 2]);
      parts.push(`<text class="pf-label${hi ? " hi" : ""}" x="${tx}" y="${ROWS[row]}" text-anchor="${anchor}">${esc(txt)}</text>`);
      placed = true;
    }
  }
  svg.setAttribute("viewBox", `0 0 ${W} ${axisY + 44}`);
  svg.setAttribute("height", axisY + 44);
  svg.innerHTML = parts.join("");

  /* --- interaction --- */
  svg.querySelectorAll("[data-node]").forEach(el => {
    el.addEventListener("click", () => opts.onNode?.(el.dataset.node));
    el.addEventListener("pointerenter", () => opts.onHover?.(el.dataset.node));
  });
  svg.querySelectorAll("[data-zone]").forEach(el => {
    el.addEventListener("click", () => opts.onZone?.(el.dataset.zone));
  });
}

function shortName(node) {
  return t(node.short) || t(node.name);
}

/** Endpoints and decision points survive crowding; filler drops first. */
function labelPriority(n, i, ev) {
  if (i === 0 || i === ev.nodes.length - 1) return 5;
  const k = n.node.kind;
  if (k.includes("danger")) return 4;
  if (k.includes("hub")) return 4;
  if (k.includes("landmark")) return 3;                    // capes decide the run
  if (n.node.exit?.ease === "easy" && n.node.train) return 2;
  if (n.node.train) return 1;
  return 0;
}

/* A drawn glyph, not an emoji: emoji in SVG <text> depends on a font the
   viewer may not have, and renders as tofu when it is missing. */
function trainGlyph(cx, cy) {
  return `<g fill="var(--sea-bright)" opacity=".85">
    <rect x="${cx - 3.4}" y="${cy}" width="6.8" height="6" rx="1.6"/>
    <rect x="${cx - 2.2}" y="${cy + 1.2}" width="4.4" height="2.2" rx=".6" fill="#070b11"/>
    <circle cx="${cx - 2}" cy="${cy + 6.6}" r=".9"/><circle cx="${cx + 2}" cy="${cy + 6.6}" r=".9"/>
  </g>`;
}

function nodeTitle(n) {
  const bits = [t(n.node.name), `${n.km.toFixed(1)} km`];
  if (n.node.exit) bits.push(`${s("exits").toLowerCase()}: ${s("ease", n.node.exit.ease)}`);
  if (n.node.train) bits.push(`${n.node.train.station} — ${n.node.train.walkMin} ${s("min")} ${s("walk")}`);
  return bits.join(" · ");
}

function segTitle(sg) {
  const pct = Math.round(sg.score * 100);
  const names = sg.hits.map(h => `${EFFECT_META[h.effect].icon} ${t(h.zone.name)}`).join(", ");
  return `${shortName(sg.a.node)} → ${shortName(sg.b.node)} · ${(sg.kmB - sg.kmA).toFixed(1)} km · ${pct}%${names ? " · " + names : ""}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
