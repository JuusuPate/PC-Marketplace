import type { Locale } from "../../types";
const en = {
  title: "Market Data",
  description: "Your marketplace in Finland · EUR · all time",
  category: "Category",
  active: "Active listings",
  asking: "Average asking price",
  completed: "Completed orders",
  sold: "Average sale price",
  empty: "No active listings or completed orders yet.",
  noSample: "No data",
  loading: "Loading market data…",
  error: "Market data could not be loaded.",
  note: "Asking prices describe currently active listings. Sale prices use the item amounts of orders currently completed, excluding shipping and fees. Refunds, cancellations and demo purchases are excluded. Categories use the listing’s current category. Averages are rounded to cents; sample counts are shown beside them. Different products and conditions are combined, so these figures are not model-specific valuations or external market prices.",
};
const fi: typeof en = {
  title: "Markkinatiedot",
  description: "Oman palvelun Suomen markkina · EUR · koko ajalta",
  category: "Tuoteryhmä",
  active: "Aktiiviset ilmoitukset",
  asking: "Keskimääräinen pyyntihinta",
  completed: "Valmiit kaupat",
  sold: "Keskimääräinen kauppahinta",
  empty: "Ei vielä aktiivisia ilmoituksia tai valmiita kauppoja.",
  noSample: "Ei tietoa",
  loading: "Ladataan markkinatietoja…",
  error: "Markkinatietoja ei voitu ladata.",
  note: "Pyyntihinnat kuvaavat tällä hetkellä aktiivisia ilmoituksia. Kauppahinnat ovat valmiiden tilausten tuotehintoja ilman toimitusta ja palvelumaksuja. Hyvitetyt, perutut ja demo-ostot eivät sisälly lukuihin. Ryhmittely perustuu ilmoituksen nykyiseen tuoteryhmään. Keskiarvot pyöristetään sentteihin ja havaintomäärät näkyvät niiden vieressä. Ryhmät sisältävät eri tuotteita ja kuntoluokkia, joten luvut eivät ole mallikohtaisia hinta-arvioita tai ulkoisen markkinan hintoja.",
};
const sv: typeof en = {
  title: "Marknadsdata",
  description: "Den egna marknadsplatsen i Finland · EUR · hela perioden",
  category: "Kategori",
  active: "Aktiva annonser",
  asking: "Genomsnittligt begärt pris",
  completed: "Slutförda affärer",
  sold: "Genomsnittligt försäljningspris",
  empty: "Inga aktiva annonser eller slutförda affärer ännu.",
  noSample: "Inga data",
  loading: "Laddar marknadsdata…",
  error: "Marknadsdata kunde inte laddas.",
  note: "Begärda priser gäller nu aktiva annonser. Försäljningspriser är varubeloppen för nu slutförda beställningar, utan frakt och avgifter. Återbetalade, avbrutna och demoköp utesluts. Grupperingen använder annonsens nuvarande kategori. Medelvärden avrundas till cent och antalet observationer visas bredvid. Olika produkter och skick blandas; siffrorna är inte modellspecifika värderingar eller externa marknadspriser.",
};
export function getAdminMarketDataCopy(locale: Locale) {
  return locale === "fi" ? fi : locale === "sv" ? sv : en;
}
