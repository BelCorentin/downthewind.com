/* ============================================================
   DOWNTHEWIND SPOTS — add a spot = append one object, git push.
   track: [lat, lon] waypoints start → finish, KEEP THEM OFFSHORE
   wind:  dirMin/dirMax = direction sector (° FROM, clockwise),
          minKn = below this no-go, idealMin/idealMax = full-score band
   ============================================================ */

const SPOTS = [
  {
    id: "frejus-cannes",
    name: "Fréjus → Cannes",
    area: "Var / Alpes-Maritimes — Esterel coast",
    windName: "Mistral (W–NW)",
    wind: { dirMin: 250, dirMax: 330, minKn: 12, idealMin: 18, idealMax: 35 },
    distanceKm: 27,
    level: "Intermediate+ — long committed leg along the Esterel, few exits",
    track: [
      [43.410, 6.745],   // off Fréjus, Base Nature launch
      [43.402, 6.780],   // off Saint-Raphaël
      [43.398, 6.825],   // off Boulouris
      [43.402, 6.872],   // off Agay bay
      [43.408, 6.915],   // off Anthéor
      [43.435, 6.955],   // off Le Trayas
      [43.475, 6.965],   // Esterel cliffs, at sea
      [43.510, 6.960],   // off Théoule-sur-Mer
      [43.528, 6.975],   // La Napoule bay
      [43.542, 7.012],   // Cannes, La Croisette
    ],
    description:
      "The classic Mistral run. Launch at the Base Nature in Fréjus, ride the " +
      "W–NW swell train past Saint-Raphaël and along the red cliffs of the " +
      "Esterel, finish on the sand in Cannes. Wind is offshore-ish in the " +
      "bays and accelerates around the capes — bumps organise beautifully " +
      "after Agay.",
    tips: [
      "Best on an established Mistral, day 2+ — the sea state needs time to organise.",
      "Commit past Agay: between Anthéor and Théoule exits are rocky and rare.",
      "Landing: Plage du Midi (Cannes) is wide and forgiving; stay clear of the ferry lane off La Napoule.",
      "Logistics: park in Cannes, train back to Saint-Raphaël with the gear (TER, ~35 min).",
    ],
    photos: [],
  },

  {
    id: "saintmalo-jersey",
    name: "Saint-Malo → Jersey",
    area: "Ille-et-Vilaine → Channel Islands — open-sea crossing",
    windName: "S–SW flow",
    wind: { dirMin: 180, dirMax: 240, minKn: 14, idealMin: 18, idealMax: 30 },
    distanceKm: 60,
    level: "Expert — 60 km offshore crossing, support boat mandatory",
    track: [
      [48.655, -2.020],  // Saint-Malo, off the ramparts
      [48.720, -2.040],
      [48.830, -2.060],  // west of the Minquiers plateau
      [48.960, -2.090],
      [49.080, -2.100],
      [49.160, -2.115],
      [49.178, -2.110],  // Jersey, St Helier approach
    ],
    description:
      "The big one: a true open-sea downwind across the gulf of Saint-Malo, " +
      "past the Minquiers, landing in St Helier. On a solid S–SW flow the " +
      "fetch builds meter-scale rollers you can connect for an hour straight. " +
      "Tides here are among the strongest in Europe and completely reshape " +
      "the route — this is an expedition, not an after-work session.",
    tips: [
      "Support boat non-negotiable: shipping lanes, 10 m tidal range, and the Minquiers dry at low water.",
      "Plan the tide window so the current pushes north with you — against the flood it becomes a treadmill.",
      "Passport! You are landing in Jersey (UK) — check customs requirements for arrival by sea.",
      "Talk to the local downwind crews first; several have run it and know the seasonal windows.",
    ],
    photos: [],
  },

  {
    id: "laciotat-almanarre",
    name: "La Ciotat → Almanarre",
    area: "Bouches-du-Rhône → Var — around Cap Sicié",
    windName: "Mistral (W–NW)",
    wind: { dirMin: 260, dirMax: 340, minKn: 14, idealMin: 18, idealMax: 35 },
    distanceKm: 45,
    level: "Advanced — big mileage, serious sea state off Cap Sicié",
    track: [
      [43.165, 5.610],   // La Ciotat bay
      [43.140, 5.660],
      [43.118, 5.722],   // off Bandol
      [43.095, 5.790],   // off Sanary
      [43.030, 5.850],   // rounding Cap Sicié, wide
      [43.040, 5.930],   // off Toulon roadstead
      [43.030, 6.020],
      [43.045, 6.100],
      [43.075, 6.148],   // L'Almanarre, Giens
    ],
    description:
      "A Mistral marathon: out of La Ciotat bay, along Bandol and Sanary, " +
      "then the crux — rounding Cap Sicié, where wind and swell compress and " +
      "the sea turns properly big — before the long glide across the Toulon " +
      "roadstead to the flat-water finish at L'Almanarre.",
    tips: [
      "Cap Sicié is the commitment point: biggest seas of the run, round it wide.",
      "Stay clear of the naval traffic in and out of Toulon — it has right of way, always.",
      "The Almanarre finish is wind-shadowed near the beach on a true W Mistral; keep speed for the last kilometre.",
      "Split option: La Ciotat → Sanary (~18 km) is a great first taste of the same line.",
    ],
    photos: [],
  },
];
