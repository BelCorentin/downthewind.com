/* ============================================================
   DOWNTHEWIND SPOTS — add a spot = append one object, git push.
   track: [lat, lon] waypoints start → finish (approximate is fine)
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
      [43.415, 6.745],   // Fréjus, Base Nature launch
      [43.418, 6.775],   // Saint-Raphaël
      [43.410, 6.805],   // Boulouris
      [43.419, 6.858],   // Agay bay
      [43.417, 6.902],   // Anthéor
      [43.440, 6.930],   // Le Trayas
      [43.500, 6.942],   // Théoule-sur-Mer
      [43.520, 6.940],   // Mandelieu-La Napoule
      [43.543, 7.015],   // Cannes, La Croisette
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
];
