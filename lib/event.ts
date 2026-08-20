/**
 * Alt om arrangementet samlet ett sted – brukes på billettsiden og takk-siden.
 * Endres teksten her, endres den overalt.
 *
 * Priser står IKKE her. De hentes fra backend (GET /ticket-types) og settes med
 * backend/update_ticket_types.py, slik at ingen kan endre prisen fra nettleseren.
 */
export const EVENT = {
  /** Arrangør */
  organizer: "Innocents Norge",

  /** Tittelen på arrangementet */
  title: "En kveld med Sami Hamdi",

  /** Kort undertittel, vises under tittelen i header */
  tagline: "Sami Hamdi i Norge",

  /** Datoen slik den skal vises */
  date: "Søndag 29. november 2026",

  /**
   * Klokkeslett og sted. Sett til null så lenge det ikke er bestemt –
   * da vises linjen rett og slett ikke, i stedet for «kommer senere».
   */
  time: null as string | null,
  venue: null as string | null,

  /** Om Sami Hamdi – vises i egen seksjon på billettsiden */
  about: [
    "Sami Hamdi er administrerende direktør i International Interest, et globalt selskap innen risikoanalyse og etterretning. Han rådgir offentlige institusjoner, internasjonale selskaper og ideelle organisasjoner (NGO-er) om geopolitiske forhold og utviklingstrekk i Europa og MENA-regionen (Midtøsten og Nord-Afrika).",
    "Han har omfattende ekspertise i å rådgive organisasjoner om kommersielle utfordringer i politisk ustabile områder, særlig knyttet til markedsinngang, markedsekspansjon, interessenthåndtering og hvordan geopolitiske utviklinger påvirker virksomheter.",
    "Sami er også en hyppig kommentator på internasjonale spørsmål og opptrer jevnlig i store internasjonale medier, blant annet Al Jazeera Arabic og English, Sky News og BBC.",
  ],
} as const
