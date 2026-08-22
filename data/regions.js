/* ============================================================
   REGIONS — each carries its own forecast grid. The France-wide
   10x10 grid used before was ~150 km spacing, which physically
   cannot resolve a cape; a region grid is ~5 km.
   ============================================================ */

const FRANCE_VIEW = { center: [46.4, 2.6], zoom: 6 };
const FRANCE_BBOX = { lat0: 41.0, lat1: 51.5, lon0: -5.5, lon1: 9.5 };

const REGIONS = [
  {
    id: "cote-azur",
    name: { fr: "Côte d'Azur", en: "Côte d'Azur" },
    blurb: {
      fr: "De l'Esterel au cap Ferrat. Du mistral, des caps qui accélèrent, et une ligne TER à quelques mètres de l'eau : c'est la côte la mieux documentée du site.",
      en: "From the Esterel to Cap Ferrat. Mistral, capes that accelerate the flow, and a rail line metres from the water: the best-documented coast on this site.",
    },
    bbox: { lat0: 43.30, lat1: 43.80, lon0: 6.60, lon1: 7.50 },
    view: { center: [43.56, 7.05], zoom: 10 },
  },
  {
    id: "provence-ouest",
    name: { fr: "Provence ouest", en: "Western Provence" },
    blurb: {
      fr: "La Ciotat, cap Sicié, la rade de Toulon. Du gros mistral et de l'engagement.",
      en: "La Ciotat, Cap Sicié, the Toulon roadstead. Heavy Mistral and real commitment.",
    },
    bbox: { lat0: 42.95, lat1: 43.30, lon0: 5.50, lon1: 6.30 },
    view: { center: [43.09, 5.88], zoom: 10 },
  },
  {
    id: "manche",
    name: { fr: "Manche & Îles Anglo-Normandes", en: "Channel & Channel Islands" },
    blurb: {
      fr: "Traversées hauturières, marnage extrême. Expédition, pas session d'après-boulot.",
      en: "Open-sea crossings, extreme tides. An expedition, not an after-work session.",
    },
    bbox: { lat0: 48.55, lat1: 49.30, lon0: -2.40, lon1: -1.80 },
    view: { center: [48.92, -2.07], zoom: 9 },
  },
];

const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));
