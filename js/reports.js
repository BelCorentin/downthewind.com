/* ============================================================
   reports — community contributions, with GitHub Issues as the
   database and no backend of our own.

   Flow:
     someone opens a prefilled issue
       → you read it and add the `on-map` label
       → this module fetches label:on-map and renders it

   The LABEL IS THE PUBLISH ACTION. Nothing a stranger writes ever
   reaches the map on its own: issue templates deliberately do not
   declare `on-map`, and the `labels=` query parameter is ignored by
   GitHub for anyone without triage rights on the repo.

   Everything here is untrusted text off the internet. It is escaped
   at every render site — the label gate is moderation, not sanitising.
   ============================================================ */

const REPO = "BelCorentin/downthewind.com";
const GATE_LABEL = "on-map";
const REPORTS_TTL_MIN = 30;
const CONDITION_REPORT_FRESH_DAYS = 21;   // older ones stop being "recent"

const REPORT_KINDS = {
  danger:     { label: "danger",     icon: "⚠", color: "var(--e-trap)",    hex: "#e0555f" },
  correction: { label: "correction", icon: "✎", color: "var(--e-shadow)",  hex: "#d9c26f" },
  report:     { label: "report",     icon: "◈", color: "var(--sea-bright)",hex: "#7fe3d2" },
  "new-run":  { label: "new-run",    icon: "＋", color: "var(--e-shelter)", hex: "#6fb3d9" },
};

let REPORTS = null;          // null = not loaded, [] = loaded and empty
let reportsError = null;

/* ---- fetch ---- */

async function loadReports() {
  if (REPORTS) return REPORTS;
  const key = "dtw-reports";
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at < REPORTS_TTL_MIN * 60e3) {
        REPORTS = data.map(reviveDates);
        return REPORTS;
      }
    }
  } catch { /* ignore a bad cache entry */ }

  const url = `https://api.github.com/repos/${REPO}/issues`
    + `?state=open&labels=${encodeURIComponent(GATE_LABEL)}&per_page=100&sort=created&direction=desc`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(r.status === 403 ? "rate-limited" : `${r.status}`);
    const issues = await r.json();
    REPORTS = issues
      .filter(i => !i.pull_request)        // the issues endpoint also returns PRs
      .map(parseIssue)
      .filter(Boolean);
    reportsError = null;
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data: REPORTS })); } catch {}
  } catch (e) {
    reportsError = e.message;
    REPORTS = [];
  }
  return REPORTS;
}

function reviveDates(r) { return { ...r, createdAt: new Date(r.createdAt) }; }

/* ---- parse ---- */

/** GitHub issue forms render as "### Field\n\nvalue". Pull them into an object. */
function parseIssueBody(body) {
  const out = {};
  if (!body) return out;
  const parts = body.split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    if (nl < 0) continue;
    const k = p.slice(0, nl).trim().toLowerCase();
    const v = p.slice(nl + 1).trim();
    if (v && v !== "_No response_") out[k] = v;
  }
  return out;
}

/** "node:agay" / "run:frejus-nice" / "zone:cap-antibes" / "43.43, 6.85" → a place. */
function parseLocation(raw) {
  if (!raw) return null;
  const s0 = raw.trim();
  const m = /^(node|run|zone)\s*:\s*([a-z0-9-]+)/i.exec(s0);
  if (m) {
    const kind = m[1].toLowerCase(), id = m[2].toLowerCase();
    if (kind === "node" && NODE_BY_ID[id]) return { kind, id, ll: NODE_BY_ID[id].ll };
    if (kind === "zone" && ZONE_BY_ID[id]) return { kind, id, ll: ZONE_BY_ID[id].geom[0] };
    if (kind === "run" && RUN_BY_ID[id]) return { kind, id, ll: RUN_BY_ID[id].track[0] };
    return { kind, id, ll: null };          // unknown id: still listed, just not pinned
  }
  const ll = /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/.exec(s0);
  if (ll) return { kind: "latlon", id: null, ll: [parseFloat(ll[1]), parseFloat(ll[2])] };
  return { kind: "text", id: null, ll: null, text: s0 };
}

/** Tolerant field lookup: exact key first, then prefix. Issue-form headings are
    the field LABELS, so an innocuous label edit must not silently orphan a
    report — that is exactly what "Which run" vs "Where" did. */
function pick(f, keys, allowPrefix = false) {
  for (const k of keys) if (f[k]) return f[k];
  if (!allowPrefix) return "";
  // Prefix matching only where the candidates cannot collide. "what" must NOT
  // prefix-match, or it grabs "What kind" ahead of the actual free-text field.
  for (const k of keys) {
    const hit = Object.keys(f).find(x => x.startsWith(k));
    if (hit) return f[hit];
  }
  return "";
}

function parseIssue(i) {
  const names = (i.labels || []).map(l => (typeof l === "string" ? l : l.name));
  const type = Object.keys(REPORT_KINDS).find(k => names.includes(k)) || "report";
  const f = parseIssueBody(i.body);
  const loc = parseLocation(pick(f, ["where", "location", "which run", "run"], true));
  return {
    number: i.number,
    title: i.title || "",
    url: i.html_url,
    author: i.user?.login || "",
    createdAt: new Date(i.created_at),
    type,
    where: loc,
    // exact only, with the older labels listed explicitly as alternates
    text: pick(f, ["what", "what exactly", "how was it", "correction",
                   "what it should say", "details", "description"]),
    kindOf: pick(f, ["what kind", "what is wrong"]),
    seenOn: pick(f, ["seen on", "ridden on"]),
    conditions: pick(f, ["conditions"]),
    source: pick(f, ["how do you know", "source"]),
  };
}

/* ---- selection ---- */

function reportAgeDays(r) { return (Date.now() - r.createdAt.getTime()) / 864e5; }

function isStale(r) {
  // danger flags and corrections stay until closed; observations decay
  return r.type === "report" && reportAgeDays(r) > CONDITION_REPORT_FRESH_DAYS;
}

/** Reports attached to a run: its own id, any of its nodes, or any zone on it. */
function reportsForRun(run, cum) {
  if (!REPORTS?.length) return [];
  const nodeIds = new Set(run.nodes);
  const zoneIds = new Set(zonesForRun(run, cum).map(z => z.zone.id));
  return REPORTS.filter(r => {
    const w = r.where;
    if (!w) return false;
    if (w.kind === "run") return w.id === run.id;
    if (w.kind === "node") return nodeIds.has(w.id);
    if (w.kind === "zone") return zoneIds.has(w.id);
    if (w.kind === "latlon" && w.ll) {
      const p = projectOnTrack(w.ll, run.track, cum);
      return p && p.offsetKm < 4;
    }
    return false;
  }).sort(byUrgency);
}

/** Reports inside a region's bbox — hazards are worth seeing before you have
    even picked a run. */
function reportsInBBox(bbox) {
  return (REPORTS || []).filter(r => {
    const ll = r.where?.ll;
    if (!ll) return false;
    return ll[0] >= bbox.lat0 && ll[0] <= bbox.lat1 && ll[1] >= bbox.lon0 && ll[1] <= bbox.lon1;
  }).sort(byUrgency);
}

function reportsForNode(id) {
  return (REPORTS || []).filter(r => r.where?.kind === "node" && r.where.id === id).sort(byUrgency);
}

function byUrgency(a, b) {
  const rank = r => (r.type === "danger" ? 0 : r.type === "correction" ? 1 : 2) + (isStale(r) ? 10 : 0);
  return rank(a) - rank(b) || b.createdAt - a.createdAt;
}

/* ---- render ---- */

function fmtReportDate(d) {
  return d.toLocaleDateString(getLang() === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" });
}

function reportRow(r) {
  const k = REPORT_KINDS[r.type];
  const stale = isStale(r);
  return `<a class="report-row${stale ? " stale" : ""}" style="color:${k.color}"
             href="${esc(r.url)}" target="_blank" rel="noopener">
    <div class="ic">${k.icon}</div>
    <div class="tx">
      <b>${esc(r.title)}
        <span class="where">${esc(reportWhereLabel(r))} · ${esc(fmtReportDate(r.createdAt))}${
          stale ? " · " + esc(s("stale")) : ""}</span></b>
      ${r.text ? esc(r.text).slice(0, 260) : ""}
      ${r.conditions ? `<span class="cond">${esc(r.conditions)}</span>` : ""}
    </div>
  </a>`;
}

function reportWhereLabel(r) {
  const w = r.where;
  if (!w) return "—";
  if (w.kind === "node" && NODE_BY_ID[w.id]) return t(NODE_BY_ID[w.id].name);
  if (w.kind === "zone" && ZONE_BY_ID[w.id]) return t(ZONE_BY_ID[w.id].name);
  if (w.kind === "run" && RUN_BY_ID[w.id]) return t(RUN_BY_ID[w.id].name);
  if (w.kind === "latlon") return w.ll.map(x => x.toFixed(3)).join(", ");
  return w.text || w.id || "—";
}

/* ---- prefilled "report this" links ---- */

/**
 * Today a contributor has to find the repo, pick a template and describe WHERE
 * in prose. These links carry the location and the conditions being looked at,
 * so the form opens already knowing what the person is looking at.
 */
function reportUrl(template, fields = {}) {
  const q = new URLSearchParams({ template, ...fields });
  return `https://github.com/${REPO}/issues/new?${q.toString()}`;
}

function contextString(ev) {
  if (!ev) return "";
  const mid = ev.nodes[Math.floor(ev.nodes.length / 2)];
  const when = series?.time?.[hour];
  return [t(ev.run.name), when ? when.replace("T", " ") + " UTC" : "", conditionsLine(mid.f)]
    .filter(Boolean).join(" · ");
}

function reportLinks(opts) {
  const { location, context, runName } = opts;
  const mk = (tpl, key) => `<a class="rep-btn" target="_blank" rel="noopener"
      href="${esc(reportUrl(tpl, { where: location, conditions: context || "", title: `[${key}] ${runName || location}` }))}"
      >${REPORT_KINDS[key].icon} ${esc(s("rep", key))}</a>`;
  return `<div class="rep-btns">
    ${mk("danger.yml", "danger")}
    ${mk("correction.yml", "correction")}
    ${mk("report.yml", "report")}
  </div>`;
}
