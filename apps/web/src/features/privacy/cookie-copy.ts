import type { Locale } from "../../types";

const fi = {
  title: "Evästeet ja selaintallennus",
  body: "Käytämme välttämätöntä selaintallennusta kirjautumiseen ja palvelun toimintaan. Halutessasi muistamme myös kielivalintasi.",
  privacy: "Lue tietosuojasta",
  noTracking: "Analytiikka- ja markkinointievästeitä ei tällä hetkellä käytetä.",
  accept: "Hyväksy kaikki",
  necessaryOnly: "Vain välttämättömät",
  settings: "Muokkaa asetuksia",
  save: "Tallenna valinnat",
  reopen: "Evästeasetukset",
  close: "Sulje asetukset",
  necessary: "Välttämättömät",
  always: "Aina käytössä",
  necessaryBody: "Mahdollistavat kirjautumisen, palvelun perustoiminnot ja tämän valinnan muistamisen.",
  preferences: "Kielivalinnan muistaminen",
  preferencesBody:
    "Muistaa valitsemasi kielen seuraavilla käynneillä. Voit käyttää kielivalintaa myös ilman tallennusta.",
  storageError: "Selain esti valinnan tallentamisen. Valinta on voimassa tähän sivun päivitykseen asti.",
};
const en: typeof fi = {
  title: "Cookies and browser storage",
  body: "We use essential browser storage for sign-in and the service to work. With your permission, we also remember your language.",
  privacy: "Read about privacy",
  noTracking: "No analytics or marketing cookies are currently used.",
  accept: "Accept all",
  necessaryOnly: "Essential only",
  settings: "Customise settings",
  save: "Save choices",
  reopen: "Cookie settings",
  close: "Close settings",
  necessary: "Essential",
  always: "Always on",
  necessaryBody: "Enable sign-in, core service features and remembering this choice.",
  preferences: "Remember language",
  preferencesBody: "Remembers your chosen language on future visits. You can change language without saving it.",
  storageError: "Your browser blocked saving this choice. It applies until this page is reloaded.",
};
const sv: typeof fi = {
  title: "Kakor och webbläsarlagring",
  body: "Vi använder nödvändig webbläsarlagring för inloggning och tjänstens funktion. Med ditt tillstånd sparar vi även ditt språkval.",
  privacy: "Läs om integritet",
  noTracking: "Inga analys- eller marknadsföringskakor används för närvarande.",
  accept: "Godkänn alla",
  necessaryOnly: "Endast nödvändiga",
  settings: "Anpassa inställningar",
  save: "Spara val",
  reopen: "Inställningar för kakor",
  close: "Stäng inställningar",
  necessary: "Nödvändiga",
  always: "Alltid aktiva",
  necessaryBody: "Möjliggör inloggning, tjänstens grundfunktioner och att komma ihåg detta val.",
  preferences: "Kom ihåg språkval",
  preferencesBody: "Sparar ditt valda språk för framtida besök. Du kan byta språk utan att spara det.",
  storageError: "Webbläsaren blockerade lagring av valet. Det gäller tills sidan laddas om.",
};
export function getCookieCopy(locale: Locale) {
  return locale === "fi" ? fi : locale === "sv" ? sv : en;
}
