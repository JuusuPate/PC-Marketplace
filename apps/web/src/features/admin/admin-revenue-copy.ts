import type { Locale } from "../../types";
const en = {
  title: "Revenue",
  description: "Completed Finnish EUR orders, grouped by the year and month the order was created.",
  year: "Year",
  apply: "Show year",
  completed: "Completed orders",
  value: "Item value",
  fees: "Marketplace fees",
  monthly: "Monthly breakdown",
  month: "Month",
  total: "Year total",
  empty: "No completed orders in this period.",
  loading: "Loading revenue…",
  error: "Revenue could not be loaded.",
  note: "Months follow order creation time in Europe/Helsinki, not completion or payout time. Only orders currently completed are included; refunds, cancellations and demo purchases are excluded. Marketplace fees are not net profit or accounting revenue. Shipping and payment processing are excluded from these amounts.",
};
const fi: typeof en = {
  title: "Tuotot",
  description: "Suomen valmiit euromääräiset kaupat tilauksen luontivuoden ja -kuukauden mukaan.",
  year: "Vuosi",
  apply: "Näytä vuosi",
  completed: "Valmiit kaupat",
  value: "Tuotteiden arvo",
  fees: "Palvelumaksut",
  monthly: "Kuukausittainen erittely",
  month: "Kuukausi",
  total: "Vuosi yhteensä",
  empty: "Ajanjaksolla ei ole valmiita kauppoja.",
  loading: "Ladataan tuottoja…",
  error: "Tuottoja ei voitu ladata.",
  note: "Kuukaudet perustuvat tilauksen luontiaikaan Suomen ajassa, eivät valmistumis- tai tilitysaikaan. Mukana ovat vain tällä hetkellä valmiit kaupat; hyvitetyt, perutut ja demo-ostot on rajattu pois. Palvelumaksut eivät ole nettovoittoa tai kirjanpidon liikevaihtoa. Toimitus ja maksunkäsittely eivät sisälly näihin summiin.",
};
const sv: typeof en = {
  title: "Intäkter",
  description: "Slutförda finska EUR-affärer efter året och månaden då beställningen skapades.",
  year: "År",
  apply: "Visa år",
  completed: "Slutförda affärer",
  value: "Varuvärde",
  fees: "Serviceavgifter",
  monthly: "Månadsöversikt",
  month: "Månad",
  total: "Året totalt",
  empty: "Inga slutförda affärer under perioden.",
  loading: "Laddar intäkter…",
  error: "Intäkterna kunde inte laddas.",
  note: "Månaderna baseras på beställningens skapandetid i Europe/Helsinki, inte slutförande eller utbetalning. Endast affärer som nu är slutförda ingår; återbetalade, avbrutna och demoköp utesluts. Serviceavgifter är inte nettovinst eller bokföringsintäkter. Frakt och betalningshantering ingår inte i beloppen.",
};
export function getAdminRevenueCopy(locale: Locale) {
  return locale === "fi" ? fi : locale === "sv" ? sv : en;
}
