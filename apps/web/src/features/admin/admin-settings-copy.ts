import type { Locale } from "../../types";

const en = {
  title: "Settings",
  description: "Control whether sellers can create and publish new listings.",
  listingCreation: "New listings",
  enabled: "Allowed",
  paused: "Paused",
  toggle: "Allow creation of new listings",
  impact:
    "Pausing blocks new drafts and publishing existing drafts. Editing published listings and admin restoration still work. Demo mode is unaffected.",
  current: "Current state",
  changed: "Last changed",
  save: "Save setting",
  saving: "Saving…",
  saved: "Setting saved.",
  loading: "Loading setting…",
  error: "Setting could not be loaded or saved.",
  conflict: "This setting changed elsewhere. Refresh before saving.",
};

const fi: typeof en = {
  title: "Asetukset",
  description: "Salli tai keskeytä uusien ilmoitusten luonti ja julkaisu.",
  listingCreation: "Uudet ilmoitukset",
  enabled: "Sallittu",
  paused: "Keskeytetty",
  toggle: "Salli uusien ilmoitusten luonti",
  impact:
    "Keskeytys estää uusien luonnosten luonnin ja olemassa olevien luonnosten julkaisun. Julkaistuja ilmoituksia voi edelleen muokata ja ylläpito voi palauttaa piilotetun ilmoituksen. Demo ei muutu.",
  current: "Nykytila",
  changed: "Viimeksi muutettu",
  save: "Tallenna asetus",
  saving: "Tallennetaan…",
  saved: "Asetus tallennettu.",
  loading: "Ladataan asetusta…",
  error: "Asetusta ei voitu ladata tai tallentaa.",
  conflict: "Asetusta muutettiin muualla. Päivitä ennen tallentamista.",
};

const sv: typeof en = {
  title: "Inställningar",
  description: "Tillåt eller pausa skapande och publicering av nya annonser.",
  listingCreation: "Nya annonser",
  enabled: "Tillåtet",
  paused: "Pausat",
  toggle: "Tillåt nya annonser",
  impact:
    "Pausen blockerar nya utkast och publicering av befintliga utkast. Publicerade annonser kan fortfarande redigeras och administratörer kan återställa dolda annonser. Demoläget påverkas inte.",
  current: "Nuvarande läge",
  changed: "Senast ändrat",
  save: "Spara inställning",
  saving: "Sparar…",
  saved: "Inställningen sparades.",
  loading: "Laddar inställningen…",
  error: "Inställningen kunde inte laddas eller sparas.",
  conflict: "Inställningen ändrades någon annanstans. Uppdatera före du sparar.",
};

export function settingsCopy(locale: Locale) {
  return locale === "fi" ? fi : locale === "sv" ? sv : en;
}
