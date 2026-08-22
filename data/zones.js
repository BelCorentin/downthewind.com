/* ============================================================
   ZONES — stretches of coast that BEHAVE differently depending
   on the conditions. This is the local knowledge that used to
   be prose in each run's `tips[]`.

   A zone belongs to the coast, so it is written once and every
   run that crosses it inherits it.

   span   : [fromNodeId, toNodeId] — where it sits along a run.
            A run that does not contain both nodes simply never
            sees this zone.
   geom   : polyline for drawing on the map.
   rules  : fire when the live forecast matches `when`.
            All `when` fields are optional and AND-ed together:
              windDir:[from,to]        ° FROM, clockwise, wraps 360
              windKn:[min,max]
              swellDir:[from,to]       ° FROM (ground swell)
              swellM:[min,max]
              swellPeriodS:[min,max]
              windWaveM:[min,max]
            No `when` at all = always active.
   scope  : "transit" (default) — the rule affects riding through here.
            "finish"  — the rule is about ENDING a run here and must NOT
            penalise simply passing by. Villefranche forced this field:
            the bay is a dead end to land in, but its mouth rides fine.

   effect vocabulary (fixed — drives colour and icon):
     boost   actively good here, in these conditions
     shelter protected; a safe bail-out even when it is big
     shadow  wind hole / lull
     hazard  bad or dangerous sea state
     commit  no easy exit for a while
     trap    looks fine on a map, is not
     traffic shipping, ferry or naval lane
   ============================================================ */

const ZONES = [

  /* ---------- Esterel ---------- */
  {
    id: "stRaphael-agay-crosssea",
    kind: "cross-sea",
    name: { fr: "Saint-Raphaël → Agay", en: "Saint-Raphaël → Agay" },
    span: ["saint-raphael", "agay"],
    geom: [[43.4180, 6.7700], [43.4120, 6.8080], [43.4130, 6.8440], [43.4260, 6.8580]],
    rules: [
      { when: { windDir: [250, 292], swellDir: [222, 265], swellM: [0.5, 99] },
        effect: "hazard", severity: "high",
        text: { fr: "Vent d'ouest sur houle d'OSO : les deux trains se croisent et la mer devient carrée. Bumps courts, désorganisés, impossibles à enchaîner. C'est le tronçon le plus pénible de la côte dans cette config.",
                en: "West wind over a WSW swell: the two trains cross and the sea goes square. Short, disorganised bumps you cannot link. In this configuration this is the most unpleasant stretch on the coast." } },
      { when: { windDir: [255, 320], windKn: [15, 99], swellDir: [265, 330] },
        effect: "boost", severity: "info",
        text: { fr: "Vent et houle alignés — le train se met en place dès la sortie de Saint-Raphaël.",
                en: "Wind and swell aligned — the train sets up right out of Saint-Raphaël." } },
    ],
  },
  {
    id: "cap-dramont",
    kind: "cape",
    name: { fr: "Cap du Dramont", en: "Cap du Dramont" },
    span: ["le-dramont", "agay"],
    geom: [[43.4130, 6.8430], [43.4090, 6.8490], [43.4160, 6.8560]],
    rules: [
      { when: { windDir: [250, 300], windKn: [14, 99] },
        effect: "boost", severity: "info",
        text: { fr: "Petit cap, mais il accélère déjà : passe à 500 m au large, les bumps se rangent derrière.",
                en: "A small cape, but it already accelerates: pass 500 m off and the bumps line up behind it." } },
      { when: { windDir: [300, 350] },
        effect: "shadow", severity: "warn",
        text: { fr: "Par NO le cap et l'île d'Or masquent : molle juste derrière, reste au large.",
                en: "In a NW flow the cape and the Île d'Or mask the wind: a lull right behind, stay offshore." } },
    ],
  },
  {
    id: "agay-shelter",
    kind: "bay",
    name: { fr: "Baie d'Agay", en: "Agay bay" },
    span: ["agay", "agay"],
    geom: [[43.4290, 6.8500], [43.4330, 6.8570], [43.4290, 6.8630]],
    rules: [
      { effect: "shelter", severity: "info",
        text: { fr: "Baie profonde, sable, gare sur la plage : la sortie de secours la plus fiable de tout l'Esterel. Si ça part en vrille, c'est ici que tu t'arrêtes.",
                en: "Deep bay, sand, station on the beach: the most reliable bail-out on the whole Esterel. If it goes wrong, this is where you stop." } },
    ],
  },
  {
    id: "esterel-commitment",
    kind: "commitment",
    name: { fr: "Corniche de l'Esterel", en: "Esterel corniche" },
    span: ["antheor", "theoule"],
    geom: [[43.4340, 6.8930], [43.4450, 6.9100], [43.4740, 6.9250], [43.4950, 6.9350], [43.5130, 6.9370]],
    rules: [
      { effect: "commit", severity: "warn",
        text: { fr: "Falaises de porphyre et calanques : les sorties sont rocheuses et rares sur ~9 km. La voie ferrée longe la côte en balcon (haltes d'Anthéor et du Trayas) — mais desserte réduite, parfois saisonnière, à vérifier avant de compter dessus.",
                en: "Porphyry cliffs and calanques: exits are rocky and rare over ~9 km. The railway runs along the coast on a ledge (Anthéor and Le Trayas halts) — but service is sparse and sometimes seasonal, so check before relying on it." } },
      { when: { windKn: [28, 99] },
        effect: "hazard", severity: "high",
        text: { fr: "Au-dessus de 28 nœuds, ne t'engage pas dans l'Esterel sans être sûr de tenir jusqu'à Théoule : sortir dans les rochers par mer formée, c'est casser du matériel au mieux.",
                en: "Above 28 knots, do not commit to the Esterel unless you are sure of reaching Théoule: landing on rock in a big sea means broken gear at best." } },
    ],
  },
  {
    id: "cap-roux",
    kind: "cape",
    name: { fr: "Cap Roux", en: "Cap Roux" },
    span: ["antheor", "le-trayas"],
    geom: [[43.4400, 6.9000], [43.4460, 6.9080], [43.4600, 6.9180]],
    rules: [
      { when: { windDir: [250, 300], windKn: [15, 99] },
        effect: "boost", severity: "info",
        text: { fr: "Le massif tombe droit dans l'eau : compression du flux au large du cap, c'est souvent le meilleur segment du run.",
                en: "The massif drops straight into the sea: the flow compresses off the cape, often the best segment of the run." } },
      { when: { windDir: [300, 355] },
        effect: "shadow", severity: "warn",
        text: { fr: "Par NO, l'Esterel décolle le vent : molles marquées le long de la corniche, il faut sortir loin.",
                en: "In a NW flow the Esterel lifts the wind off the water: marked lulls along the corniche, you need to go well offshore." } },
    ],
  },

  /* ---------- Golfe de La Napoule → Cannes ---------- */
  {
    id: "napoule-bay-shadow",
    kind: "bay",
    name: { fr: "Golfe de La Napoule", en: "Golfe de La Napoule" },
    span: ["theoule", "cannes-midi"],
    geom: [[43.5130, 6.9380], [43.5240, 6.9500], [43.5400, 6.9800], [43.5510, 7.0160]],
    rules: [
      { when: { windDir: [292, 345] },
        effect: "shadow", severity: "warn",
        text: { fr: "Par NO, le golfe est sous le vent de l'Esterel : le vent décolle et laisse une molle au fond de la baie. Garde de la vitesse, ne rentre pas trop tôt.",
                en: "In a NW flow the bay sits in the lee of the Esterel: the wind lifts off and leaves a lull at the head of the bay. Carry speed, do not come inshore too early." } },
      { when: { windDir: [250, 292], windKn: [14, 99] },
        effect: "boost", severity: "info",
        text: { fr: "Plein ouest : le golfe est ouvert, le fetch est franc jusqu'à la plage du Midi.",
                en: "Straight west: the bay is open and the fetch runs clean all the way to the Plage du Midi." } },
    ],
  },
  {
    id: "lerins-ferry",
    kind: "traffic",
    name: { fr: "Chenal des Îles de Lérins", en: "Lérins ferry channel" },
    span: ["cannes-midi", "golfe-juan"],
    geom: [[43.5480, 7.0210], [43.5300, 7.0400], [43.5200, 7.0500]],
    rules: [
      { effect: "traffic", severity: "warn",
        text: { fr: "Navettes Cannes ↔ Sainte-Marguerite toute la journée, plus le trafic du Vieux-Port. Traverse perpendiculairement, ne longe pas le chenal.",
                en: "Cannes ↔ Sainte-Marguerite shuttles run all day, plus Vieux-Port traffic. Cross the channel square, never ride along it." } },
    ],
  },

  /* ---------- Cap d'Antibes ---------- */
  {
    id: "cap-antibes",
    kind: "cape",
    name: { fr: "Cap d'Antibes", en: "Cap d'Antibes" },
    span: ["juan-les-pins", "antibes"],
    geom: [[43.5680, 7.1090], [43.5560, 7.1150], [43.5480, 7.1230], [43.5560, 7.1290], [43.5750, 7.1230]],
    rules: [
      { when: { windDir: [250, 298], windKn: [15, 99] },
        effect: "boost", severity: "info",
        text: { fr: "Bien orienté : passe LARGE, 1,5 à 2 km au sud de la pointe. Le flux comprime autour du cap, la houle se réorganise et les bumps s'alignent — c'est le meilleur moment du run.",
                en: "Well oriented: go WIDE, 1.5–2 km south of the tip. The flow compresses round the cape, the swell reorganises and the bumps line up — the best part of the run." } },
      { when: { windDir: [298, 350] },
        effect: "shadow", severity: "warn",
        text: { fr: "Par NO le cap masque : trou de vent dans sa face est, juste là où tu voudrais rentrer sur Antibes. Reste au large jusqu'à voir la baie des Anges se rider.",
                en: "In a NW flow the cape masks: a wind hole on its east face, exactly where you want to turn in for Antibes. Stay offshore until you can see the Baie des Anges ruffling." } },
      { when: { windDir: [250, 350], windKn: [25, 99] },
        effect: "hazard", severity: "warn",
        text: { fr: "Au-delà de 25 nœuds l'accélération du cap se paie : rafales et mer croisée sur la pointe elle-même. Passer large n'est plus une option, c'est obligatoire.",
                en: "Above 25 knots the cape's acceleration has a price: gusts and cross sea right on the tip. Passing wide stops being an option and becomes mandatory." } },
    ],
  },

  /* ---------- Baie des Anges ---------- */
  {
    id: "baie-des-anges",
    kind: "bay",
    name: { fr: "Baie des Anges", en: "Baie des Anges" },
    span: ["antibes", "nice-airport"],
    geom: [[43.5860, 7.1230], [43.6100, 7.1300], [43.6300, 7.1400], [43.6570, 7.1700], [43.6600, 7.2200]],
    rules: [
      { when: { swellDir: [180, 250], swellM: [1.0, 99] },
        effect: "hazard", severity: "warn",
        text: { fr: "La houle de sud-ouest rentre plein dans la baie et vient se casser sur des plages de galets en forte pente : shore break sec de Biot à Cros-de-Cagnes. La sortie est plus dure que la navigation.",
                en: "SW swell drives straight into the bay and breaks on steep pebble beaches: a dumping shore break from Biot to Cros-de-Cagnes. Getting out is harder than the ride in." } },
      { when: { windDir: [250, 300], windKn: [15, 99] },
        effect: "boost", severity: "info",
        text: { fr: "Long fetch dégagé depuis le cap d'Antibes : c'est ici que les bumps sont les plus longs de tout le run.",
                en: "Long clean fetch from Cap d'Antibes: the longest bumps of the whole run are here." } },
    ],
  },

  /* ---------- Nice → Villefranche ---------- */
  {
    id: "nice-villefranche-crosssea",
    kind: "cross-sea",
    name: { fr: "Aéroport de Nice → Villefranche", en: "Nice airport → Villefranche" },
    span: ["nice-airport", "villefranche"],
    geom: [[43.6600, 7.2230], [43.6820, 7.2560], [43.6950, 7.2870], [43.7020, 7.3140]],
    rules: [
      { when: { windDir: [250, 292], swellDir: [222, 265], swellM: [0.5, 99] },
        effect: "hazard", severity: "high",
        text: { fr: "Même signature qu'entre Saint-Raphaël et Agay : vent d'ouest sur houle d'OSO, mer croisée et carrée. Ajoute la réflexion sur les enrochements de la Promenade et du port : c'est le clapot le plus sale de la côte.",
                en: "The same signature as Saint-Raphaël → Agay: west wind over WSW swell, crossed and square. Add the reflection off the Promenade and harbour rock armour and this is the dirtiest chop on the coast." } },
      { when: { windDir: [250, 300], windKn: [12, 99] },
        effect: "commit", severity: "warn",
        text: { fr: "Aucune sortie confortable sur ~8 km : digue de l'aéroport, galets en pente forte de la Promenade, puis port en activité. Décide AVANT l'aéroport si tu continues.",
                en: "No comfortable exit for ~8 km: airport sea wall, steep Promenade pebbles, then a working harbour. Decide BEFORE the airport whether you are continuing." } },
    ],
  },
  {
    id: "nice-port-ferries",
    kind: "traffic",
    name: { fr: "Port de Nice", en: "Port of Nice" },
    span: ["nice-port", "villefranche"],
    geom: [[43.6960, 7.2830], [43.6900, 7.2900], [43.6850, 7.3000]],
    rules: [
      { effect: "traffic", severity: "high",
        text: { fr: "Ferries Corse : gros navires, manœuvres rapides, ils ne te verront pas. Passe au large de l'entrée, jamais devant.",
                en: "Corsica ferries: big ships, fast manoeuvres, they will not see you. Pass well outside the entrance, never across it." } },
    ],
  },
  {
    id: "villefranche-trap",
    kind: "dead-end",
    name: { fr: "Rade de Villefranche", en: "Villefranche roadstead" },
    span: ["villefranche", "villefranche"],
    geom: [[43.7020, 7.3080], [43.7066, 7.3144], [43.7000, 7.3230]],
    rules: [
      { when: { windDir: [268, 345] }, scope: "finish",
        effect: "trap", severity: "high",
        text: { fr: "PIÈGE. Sur la carte la rade est bien orientée ; dans la réalité, par mistral, elle est ABSOLUMENT SANS VENT — le flux passe au-dessus du mont Boron et ne redescend pas. Et la houle, elle, y rentre. Tu finis à ramer dans du clapot, sans vent, sur les derniers 1,5 km. Ne planifie jamais une arrivée à Villefranche par mistral : arrête-toi à Nice, ou continue sur Beaulieu.",
                en: "TRAP. On a map the roadstead looks correctly oriented; in reality, in a Mistral, it has ABSOLUTELY NO WIND — the flow passes over Mont Boron and never comes back down. The swell, however, gets in. You end up paddling through chop with no wind for the last 1.5 km. Never plan a Villefranche finish in a Mistral: stop at Nice, or carry on to Beaulieu." } },
      { when: { swellDir: [170, 250], swellM: [0.8, 99] },
        effect: "hazard", severity: "warn",
        text: { fr: "La rade est ouverte plein sud : toute houle de secteur sud à sud-ouest y entre sans être filtrée.",
                en: "The roadstead opens due south: any S to SW swell enters unfiltered." } },
      { when: { windDir: [90, 200] },
        effect: "shelter", severity: "info",
        text: { fr: "Par secteur est à sud, en revanche, la rade fonctionne : c'est un vrai abri, sable et gare sur la plage.",
                en: "In an E to S flow, though, the roadstead works: genuine shelter, sand, and a station on the beach." } },
    ],
  },
  {
    id: "cap-ferrat",
    kind: "cape",
    name: { fr: "Cap Ferrat", en: "Cap Ferrat" },
    span: ["villefranche", "beaulieu"],
    geom: [[43.7000, 7.3230], [43.6900, 7.3350], [43.6862, 7.3390], [43.6980, 7.3400], [43.7070, 7.3340]],
    rules: [
      { when: { windDir: [250, 340] },
        effect: "shadow", severity: "warn",
        text: { fr: "Le cap est haut et boisé : sa face est est masquée par vent d'ouest. Passer au large de la pointe de Saint-Hospice si tu veux garder du vent jusqu'à Beaulieu.",
                en: "The cape is high and wooded: its east face is masked in a westerly. Round the Pointe de Saint-Hospice wide if you want wind all the way to Beaulieu." } },
    ],
  },

  /* ---------- Other regions ---------- */
  {
    id: "minquiers-tide",
    kind: "commitment",
    name: { fr: "Plateau des Minquiers", en: "Minquiers plateau" },
    span: ["saint-malo", "jersey-st-helier"],
    geom: [[48.8300, -2.0600], [48.9600, -2.0900]],
    rules: [
      { effect: "commit", severity: "high",
        text: { fr: "Traversée hauturière : 10 m de marnage, plateau qui découvre, rails de navigation. Bateau d'assistance obligatoire, pas optionnel.",
                en: "Open-sea crossing: 10 m tidal range, a plateau that dries, shipping lanes. A support boat is mandatory, not optional." } },
    ],
  },
  {
    id: "cap-sicie-zone",
    kind: "cape",
    name: { fr: "Cap Sicié", en: "Cap Sicié" },
    span: ["sanary", "toulon-rade"],
    geom: [[43.1000, 5.8100], [43.0400, 5.8400], [43.0300, 5.8700], [43.0380, 5.9100]],
    rules: [
      { effect: "commit", severity: "high",
        text: { fr: "Le point d'engagement du run : falaises, aucune sortie, et la mer la plus grosse du parcours. Contourne large.",
                en: "The commitment point of the run: cliffs, no exit, and the biggest sea of the route. Round it wide." } },
      { when: { windDir: [260, 340], windKn: [20, 99] },
        effect: "hazard", severity: "high",
        text: { fr: "Par mistral établi, vent et houle se compriment sur le cap : mer courte et très creuse, largement au-dessus de ce qu'annonce le modèle au large.",
                en: "In an established Mistral, wind and swell compress on the cape: short, very steep sea, well above what the offshore model shows." } },
    ],
  },
  {
    id: "toulon-naval",
    kind: "traffic",
    name: { fr: "Rade de Toulon", en: "Toulon roadstead" },
    span: ["toulon-rade", "almanarre"],
    geom: [[43.0400, 5.9300], [43.0350, 6.0000], [43.0450, 6.0800]],
    rules: [
      { effect: "traffic", severity: "high",
        text: { fr: "Base navale : bâtiments militaires prioritaires, zones interdites balisées. Reste au sud du chenal.",
                en: "Naval base: military vessels have right of way, restricted zones are buoyed. Stay south of the channel." } },
    ],
  },
  {
    id: "almanarre-shadow",
    kind: "bay",
    name: { fr: "Rade d'Hyères", en: "Hyères bay" },
    span: ["toulon-rade", "almanarre"],
    geom: [[43.0500, 6.1100], [43.0750, 6.1480]],
    rules: [
      { when: { windDir: [255, 290] },
        effect: "shadow", severity: "warn",
        text: { fr: "Par ouest franc, l'Almanarre est sous le vent de la presqu'île de Giens : molle sur le dernier kilomètre, garde de la vitesse.",
                en: "In a true westerly, L'Almanarre sits in the lee of the Giens peninsula: a lull over the last kilometre, carry your speed." } },
    ],
  },
];

const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
