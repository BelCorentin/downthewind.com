/* ============================================================
   i18n — every human-facing string in the data files is
   { fr: "...", en: "..." }. Resolve at RENDER time only,
   never store a resolved string anywhere.
   ============================================================ */

const LANG_KEY = "dtw-lang";

let LANG = (() => {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "fr" || saved === "en") return saved;
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
})();

/** Resolve a bilingual string. Tolerates plain strings and missing sides. */
function t(s) {
  if (s == null) return "";
  if (typeof s === "string") return s;
  return s[LANG] ?? s.en ?? s.fr ?? "";
}

function getLang() { return LANG; }

function setLang(l) {
  if (l !== "fr" && l !== "en") return;
  LANG = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l;
  document.dispatchEvent(new CustomEvent("langchange", { detail: l }));
}

/* ---- UI chrome strings, same shape as the data ---- */
const STRINGS = {
  tagline: {
    fr: "Runs de downwind en wing & SUP-foil. Choisis un run, regarde le vent, pars.",
    en: "Wing &amp; SUP-foil downwind runs. Pick a run, check the wind, send it.",
  },
  by:            { fr: "Par",                     en: "By" },
  allRuns:       { fr: "← tous les runs",         en: "← all runs" },
  theRun:        { fr: "Le run",                  en: "The run" },
  localKnow:     { fr: "Connaissance locale",     en: "Local knowledge" },
  conditions:    { fr: "Conditions du moment",    en: "Conditions right now" },
  window:        { fr: "Fenêtre downwind — 4 jours", en: "Downwind window — next 4 days" },
  profile:       { fr: "Profil du run",           en: "Run profile" },
  legPicker:     { fr: "Composer un tronçon",     en: "Compose a leg" },
  from:          { fr: "Départ",                  en: "Start" },
  to:            { fr: "Arrivée",                 en: "Finish" },
  fullRun:       { fr: "run complet",             en: "full run" },
  exits:         { fr: "Sorties & gares",         en: "Exits & stations" },
  noGo:          { fr: "no-go",                   en: "no-go" },
  sendIt:        { fr: "ça envoie",               en: "send it" },
  hoverCell:     { fr: "survole une case",        en: "hover a cell for details" },
  addRun:        { fr: "➕ Ajoute ton run",       en: "➕ Add your run" },
  addRunNote:    { fr: "Les runs sont relus et ajoutés à la main — laisse ta trace et tes commentaires.",
                   en: "Runs are reviewed and added by hand — leave your track and comments." },
  regions:       { fr: "Régions",                 en: "Regions" },
  runsIn:        { fr: "runs",                    en: "runs" },
  km:            { fr: "km",                      en: "km" },
  walk:          { fr: "marche",                  en: "walk" },
  min:           { fr: "min",                     en: "min" },
  station:       { fr: "Gare",                    en: "Station" },
  backTo:        { fr: "retour vers",             en: "back to" },
  suggested:     { fr: "Tronçon conseillé",       en: "Suggested leg" },
  noneToday:     { fr: "Rien de notable sur ce créneau.", en: "Nothing notable at this hour." },
  loading:       { fr: "chargement…",             en: "loading…" },
  fetchFail:     { fr: "prévision indisponible",  en: "forecast unavailable" },
  srcNote:       { fr: "Modèle AROME via Open-Meteo · heures de nuit atténuées · score = vitesse × orientation",
                   en: "AROME model via Open-Meteo · night hours dimmed · score = wind speed × direction fit" },
  estimated:     { fr: "estimé",                  en: "estimated" },
  verify:        { fr: "à vérifier",              en: "unverified" },
  walkNote:      { fr: "Temps de marche estimés depuis le trait de côte OSM (détour ×1,35 · 3,2 km/h avec board et aile). Horaires SNCF à vérifier avant de compter dessus.",
                   en: "Walk times estimated from the OSM coastline (×1.35 detour · 3.2 km/h carrying board and wing). Check SNCF timetables before relying on them." },
  ease: {
    easy:   { fr: "facile",     en: "easy" },
    ok:     { fr: "correct",    en: "ok" },
    hard:   { fr: "difficile",  en: "hard" },
    rocky:  { fr: "rocheux",    en: "rocky" },
    none:   { fr: "pas de sortie", en: "no exit" },
  },
  shore: {
    sand:    { fr: "sable",    en: "sand" },
    pebble:  { fr: "galets",   en: "pebble" },
    rock:    { fr: "rocher",   en: "rock" },
    slipway: { fr: "cale",     en: "slipway" },
    port:    { fr: "port",     en: "port" },
  },
  effect: {
    boost:   { fr: "ça marche",     en: "prime" },
    shelter: { fr: "abri",          en: "shelter" },
    shadow:  { fr: "trou de vent",  en: "wind hole" },
    hazard:  { fr: "mer difficile", en: "bad sea" },
    commit:  { fr: "engagement",    en: "committing" },
    trap:    { fr: "piège",         en: "trap" },
    traffic: { fr: "trafic",        en: "shipping" },
  },
};

/** Shorthand for chrome strings: `s("theRun")` or `s("ease","easy")`. */
function s(...path) {
  let v = STRINGS;
  for (const k of path) v = v?.[k];
  return t(v);
}
