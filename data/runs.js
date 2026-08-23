/* ============================================================
   RUNS — a run is an ORDERED LIST OF NODE IDS plus an offshore
   track. Distances are computed from the track (see js/geo.js),
   never written here.

   Because a run is a node list, ANY pair of its nodes is itself
   a valid leg: that is what the leg picker exposes, and it is
   why there is no `frejus-theoule` entry.
   ============================================================ */

const RUNS = [

  {
    id: "frejus-nice",
    region: "cote-azur",
    name: { fr: "Fréjus → Nice", en: "Fréjus → Nice" },
    windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
    wind: { dirMin: 250, dirMax: 330, minKn: 12, idealMin: 18, idealMax: 35 },
    levelKey: "expert",
    level: {
      fr: "Expert — trois caps, deux zones sans sortie confortable",
      en: "Expert — three capes, two stretches with no comfortable exit",
    },
    nodes: [
      "frejus-base-nature", "saint-raphael", "boulouris", "le-dramont", "agay",
      "antheor", "le-trayas", "theoule", "la-napoule", "cannes-bocca", "cannes-midi",
      "golfe-juan", "juan-les-pins", "cap-antibes-tip", "antibes", "biot",
      "villeneuve-loubet", "cros-de-cagnes", "saint-laurent-var", "nice-airport",
      "nice-promenade",
    ],
    track: [
      [43.4102, 6.7566], [43.3984, 6.7703], [43.4020, 6.8570], [43.4183, 6.8979],
      [43.4464, 6.9351], [43.4898, 6.9686], [43.5079, 6.9686], [43.5142, 6.9562],
      [43.5395, 6.9934], [43.5305, 7.0206], [43.5296, 7.0466], [43.5603, 7.0987],
      [43.5296, 7.1037], [43.5314, 7.1495], [43.5657, 7.1619], [43.6209, 7.1458],
      [43.6462, 7.1693], [43.6372, 7.1917], [43.6399, 7.2214], [43.6851, 7.2648],
    ],
    description: {
      fr: "Le grand parcours de la Côte d'Azur, bout à bout. Départ à la Base Nature de Fréjus, train de houle O–NO le long de l'Esterel rouge, traversée du golfe de La Napoule, Cannes, puis le morceau de bravoure : contourner le cap d'Antibes au large avant la longue glisse dans la baie des Anges. Arrivée sur les galets de Nice. Pour continuer au-delà, voir « Nice → Beaulieu » — et lire l'avertissement sur la rade de Villefranche avant d'y penser.",
      en: "The full Côte d'Azur line, end to end. Launch at the Base Nature in Fréjus, ride the W–NW swell train along the red Esterel, cross the Golfe de La Napoule, pass Cannes, then the centrepiece: round Cap d'Antibes wide before the long glide across the Baie des Anges. Finish on the Nice pebbles. To carry on past that, see « Nice → Beaulieu » — and read the Villefranche roadstead warning before you even think about it.",
    },
    tips: [
      { fr: "Mistral établi, jour 2 ou 3 : la mer a besoin de temps pour s'organiser.",
        en: "Established Mistral, day 2 or 3: the sea needs time to organise." },
      { fr: "Découpe le run. Fréjus → Cannes (30 km) est déjà une grosse journée ; Cannes → Nice (39 km) est un run à part entière.",
        en: "Break it up. Fréjus → Cannes (30 km) is already a big day; Cannes → Nice (39 km) is a run in its own right." },
      { fr: "Logistique : gare-toi à l'arrivée, reviens en TER. La ligne longe la côte et la plupart des gares sont à moins de 10 min de marche de l'eau.",
        en: "Logistics: park at the finish and come back by TER. The line hugs the coast and most stations are under a 10 min walk from the water." },
    ],
    photos: [],
  },

  {
    id: "frejus-cannes",
    region: "cote-azur",
    name: { fr: "Fréjus → Cannes", en: "Fréjus → Cannes" },
    windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
    wind: { dirMin: 250, dirMax: 330, minKn: 12, idealMin: 18, idealMax: 35 },
    levelKey: "intermediate",
    level: {
      fr: "Intermédiaire+ — longue portion engagée le long de l'Esterel",
      en: "Intermediate+ — one long committed leg along the Esterel",
    },
    nodes: [
      "frejus-base-nature", "saint-raphael", "boulouris", "le-dramont", "agay",
      "antheor", "le-trayas", "theoule", "la-napoule", "cannes-bocca", "cannes-midi",
    ],
    track: [
      [43.4102, 6.7565], [43.3984, 6.7701], [43.4020, 6.8567], [43.4183, 6.8976],
      [43.4464, 6.9347], [43.4898, 6.9681], [43.5088, 6.9681], [43.5142, 6.9570],
      [43.5395, 7.0003],
    ],
    description: {
      fr: "Le classique du mistral. Départ à la Base Nature de Fréjus, train de houle O–NO le long des falaises rouges de l'Esterel, arrivée sur le sable à Cannes. Le vent est légèrement offshore dans les baies et accélère autour des caps — les bumps se rangent vraiment après Agay.",
      en: "The classic Mistral run. Launch at the Base Nature in Fréjus, ride the W–NW swell train along the red Esterel cliffs, finish on the sand in Cannes. The wind is slightly offshore in the bays and accelerates round the capes — the bumps really organise after Agay.",
    },
    tips: [
      { fr: "Mistral établi, jour 2+ : la mer a besoin de temps pour se former.",
        en: "Established Mistral, day 2+: the sea needs time to organise." },
      { fr: "Arrivée : la plage du Midi est large et tolérante. Reste à l'écart du chenal des navettes de Lérins.",
        en: "Landing: the Plage du Midi is wide and forgiving. Stay clear of the Lérins shuttle channel." },
      { fr: "Logistique : gare-toi à Cannes, retour en TER vers Saint-Raphaël (~35 min).",
        en: "Logistics: park in Cannes, TER back to Saint-Raphaël (~35 min)." },
    ],
    photos: [],
  },

  {
    id: "cannes-nice",
    region: "cote-azur",
    name: { fr: "Cannes → Nice", en: "Cannes → Nice" },
    windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
    wind: { dirMin: 250, dirMax: 325, minKn: 13, idealMin: 18, idealMax: 32 },
    levelKey: "advanced",
    level: {
      fr: "Avancé — le contournement du cap d'Antibes est le vrai sujet",
      en: "Advanced — rounding Cap d'Antibes is the real subject",
    },
    nodes: [
      "cannes-midi", "golfe-juan", "juan-les-pins", "cap-antibes-tip", "antibes",
      "biot", "villeneuve-loubet", "cros-de-cagnes", "saint-laurent-var",
      "nice-airport", "nice-promenade",
    ],
    track: [
      [43.5383, 6.9997], [43.5310, 7.0208], [43.5301, 7.0270], [43.5301, 7.0468],
      [43.5600, 7.0989], [43.5292, 7.1064], [43.5310, 7.1486], [43.5645, 7.1622],
      [43.6224, 7.1473], [43.6459, 7.1684], [43.6368, 7.1920], [43.6396, 7.2218],
      [43.6857, 7.2677],
    ],
    description: {
      fr: "La seconde moitié de la côte, et un run complet à lui seul. Sortie de Cannes en traversant le chenal de Lérins, baie de Golfe-Juan, puis le cap d'Antibes qu'il faut passer LARGE. Derrière, la baie des Anges offre le plus long fetch dégagé de la côte : c'est là que les bumps sont les plus longs. Arrivée sur les galets de Nice, qui sont plus durs qu'ils n'en ont l'air.",
      en: "The second half of the coast, and a complete run on its own. Leave Cannes across the Lérins channel, cross Golfe-Juan, then Cap d'Antibes — which you round WIDE. Behind it the Baie des Anges gives the longest clean fetch on the coast, and the longest bumps with it. Finish on the Nice pebbles, which are harder work than they look.",
    },
    tips: [
      { fr: "Le cap d'Antibes décide du run : bien orienté c'est le meilleur passage, mal orienté c'est un trou de vent au moment où tu voudrais rentrer.",
        en: "Cap d'Antibes decides the run: well oriented it is the best passage, badly oriented it is a wind hole exactly where you want to turn in." },
      { fr: "Sortie à Nice : galets, pente forte, shore break. Antibes ou Cros-de-Cagnes sont plus simples si la houle est rentrée.",
        en: "Landing at Nice: pebbles, steep, shore break. Antibes or Cros-de-Cagnes are simpler if swell has got in." },
      { fr: "Ne prolonge pas jusqu'à Villefranche par mistral. Voir l'avertissement sur la rade.",
        en: "Do not extend to Villefranche in a Mistral. See the roadstead warning." },
    ],
    photos: [],
  },

  {
    id: "nice-beaulieu",
    region: "cote-azur",
    // the Villefranche detour IS this run — keep the router from smoothing it out
    smoothKm: 0.45,
    name: { fr: "Nice → Beaulieu", en: "Nice → Beaulieu" },
    windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
    wind: { dirMin: 250, dirMax: 320, minKn: 14, idealMin: 18, idealMax: 30 },
    levelKey: "advanced",
    level: {
      fr: "Avancé — court, mais c'est le tronçon le plus piégeux de la côte",
      en: "Advanced — short, but the trickiest stretch on the coast",
    },
    nodes: ["nice-promenade", "nice-port", "villefranche", "cap-ferrat-tip", "beaulieu"],
    track: [
      [43.6851, 7.2649], [43.6770, 7.3046], [43.6842, 7.3145], [43.6996, 7.3158],
      [43.6716, 7.3145], [43.6652, 7.3431], [43.6788, 7.3618], [43.6915, 7.3618],
      [43.6978, 7.3481],
    ],
    description: {
      fr: "Court sur la carte, tordu dans la réalité. On sort de Nice devant le port — gros ferries, à passer au large — puis on longe le mont Boron jusqu'à la rade de Villefranche, qui est le piège le mieux déguisé de la côte : elle a l'air parfaitement orientée et elle est morte par mistral. Passé la rade, il reste à contourner la pointe de Saint-Hospice, elle aussi masquée par vent d'ouest, avant Beaulieu.",
      en: "Short on a map, awkward in practice. You leave Nice past the harbour — big ferries, pass well outside — then run under Mont Boron to the Villefranche roadstead, the best-disguised trap on the coast: it looks perfectly oriented and it is dead in a Mistral. Past the roadstead you still have to round the Pointe de Saint-Hospice, also masked in a westerly, before Beaulieu.",
    },
    tips: [
      { fr: "Par mistral, ne t'arrête pas à Villefranche : tu perdras le vent avant la plage et finiras à la pagaie dans du clapot.",
        en: "In a Mistral, do not stop at Villefranche: you will lose the wind before the beach and finish paddling through chop." },
      { fr: "Par secteur est à sud, l'inverse est vrai : Villefranche redevient un abri, sable et gare sur le quai.",
        en: "In an E to S flow the opposite holds: Villefranche becomes genuine shelter, sand, station on the quay." },
      { fr: "Le ferry Corse ne te verra pas. Passe largement au large de l'entrée du port de Nice.",
        en: "The Corsica ferry will not see you. Pass well outside the Nice harbour entrance." },
    ],
    photos: [],
  },

  {
    id: "laciotat-almanarre",
    region: "provence-ouest",
    name: { fr: "La Ciotat → L'Almanarre", en: "La Ciotat → Almanarre" },
    windName: { fr: "Mistral (O–NO)", en: "Mistral (W–NW)" },
    wind: { dirMin: 260, dirMax: 340, minKn: 14, idealMin: 18, idealMax: 35 },
    levelKey: "advanced",
    level: {
      fr: "Avancé — gros kilométrage, mer sérieuse au cap Sicié",
      en: "Advanced — big mileage, serious sea state off Cap Sicié",
    },
    nodes: ["la-ciotat", "bandol", "sanary", "cap-sicie", "toulon-rade", "almanarre"],
    track: [
      [43.1526, 5.5929], [43.1038, 5.7835], [43.0866, 5.7405], [43.0712, 5.7405],
      [43.0323, 5.8253], [43.0287, 6.0738], [43.0188, 6.0873], [43.0070, 6.1488],
      [43.0296, 6.1845], [43.0631, 6.1636],
    ],
    description: {
      fr: "Un marathon de mistral : sortie de la baie de La Ciotat, Bandol, Sanary, puis le morceau clé — le contournement du cap Sicié, où vent et houle se compriment et où la mer devient franchement grosse — avant la longue glisse à travers la rade de Toulon jusqu'au plan d'eau plat de l'Almanarre.",
      en: "A Mistral marathon: out of La Ciotat bay, past Bandol and Sanary, then the crux — rounding Cap Sicié, where wind and swell compress and the sea turns properly big — before the long glide across the Toulon roadstead to the flat-water finish at L'Almanarre.",
    },
    tips: [
      { fr: "Le cap Sicié est le point d'engagement : la plus grosse mer du run, contourne large.",
        en: "Cap Sicié is the commitment point: biggest sea of the run, round it wide." },
      { fr: "Option courte : La Ciotat → Sanary est un excellent premier essai sur la même ligne.",
        en: "Short option: La Ciotat → Sanary is a great first taste of the same line." },
    ],
    photos: [],
  },

  {
    id: "saintmalo-jersey",
    region: "manche",
    name: { fr: "Saint-Malo → Jersey", en: "Saint-Malo → Jersey" },
    windName: { fr: "Flux de S–SO", en: "S–SW flow" },
    wind: { dirMin: 180, dirMax: 240, minKn: 14, idealMin: 18, idealMax: 30 },
    levelKey: "expert",
    level: {
      fr: "Expert — 60 km au large, bateau d'assistance obligatoire",
      en: "Expert — 60 km offshore crossing, support boat mandatory",
    },
    nodes: ["saint-malo", "jersey-st-helier"],
    track: [
      [48.6615, -2.0365], [49.0142, -2.0311], [49.1625, -2.1336],
    ],
    description: {
      fr: "La grosse : une vraie traversée hauturière du golfe de Saint-Malo, au large des Minquiers, arrivée à St Helier. Sur un flux de S–SO bien établi, le fetch construit des rouleaux métriques que tu enchaînes une heure durant. Les marées ici sont parmi les plus fortes d'Europe et redessinent complètement la route — c'est une expédition, pas une session d'après-boulot.",
      en: "The big one: a true open-sea downwind across the gulf of Saint-Malo, past the Minquiers, landing in St Helier. On a solid S–SW flow the fetch builds meter-scale rollers you can connect for an hour straight. Tides here are among the strongest in Europe and completely reshape the route — this is an expedition, not an after-work session.",
    },
    tips: [
      { fr: "Bateau d'assistance non négociable : rails de navigation, 10 m de marnage, et les Minquiers découvrent à basse mer.",
        en: "Support boat non-negotiable: shipping lanes, 10 m tidal range, and the Minquiers dry at low water." },
      { fr: "Cale la fenêtre de marée pour que le courant te pousse au nord — contre le flot, c'est un tapis roulant.",
        en: "Plan the tide window so the current pushes north with you — against the flood it becomes a treadmill." },
      { fr: "Passeport : tu débarques à Jersey (UK), vérifie les formalités d'arrivée par la mer.",
        en: "Passport! You are landing in Jersey (UK) — check customs requirements for arrival by sea." },
    ],
    photos: [],
  },
];

const RUN_BY_ID = Object.fromEntries(RUNS.map(r => [r.id, r]));
