import type { Locale } from "../../types";
import type { AdminSystemCheckKey } from "../../lib/admin-system-service";

const en = {
  title: "System",
  description: "Run current checks against selected admin data sources.",
  note: "These are one-time reads from this browser, not uptime monitoring or alerts. Response times include network and processing time.",
  checkedAt: "Checked",
  loading: "Checking data sources…",
  error: "The checks could not be completed. Try again.",
  ok: "Read succeeded",
  failed: "Read failed",
  duration: "Response time",
  unmonitoredTitle: "Not monitored",
  unmonitored:
    "Payments, payouts, email, deliveries, scheduled jobs and background errors have no connected monitoring here.",
  checks: {
    overview: "Admin overview",
    catalog: "GPU catalog admin search",
    marketing: "Admin announcements",
    audit: "First page of admin audit log",
  },
};

const fi: typeof en = {
  title: "Järjestelmä",
  description: "Tarkista valittujen ylläpidon tietolähteiden tämänhetkinen toiminta.",
  note: "Nämä ovat selaimesta tehtäviä kertaluonteisia hakuja, eivät käytettävyysvalvontaa tai hälytyksiä. Vasteaika sisältää verkkoyhteyden ja käsittelyn.",
  checkedAt: "Tarkistettu",
  loading: "Tarkistetaan tietolähteitä…",
  error: "Tarkistusta ei voitu tehdä loppuun. Yritä uudelleen.",
  ok: "Haku onnistui",
  failed: "Haku epäonnistui",
  duration: "Vasteaika",
  unmonitoredTitle: "Ei valvonnassa",
  unmonitored:
    "Maksuja, tilityksiä, sähköpostia, toimituksia, ajastettuja töitä ja taustavirheitä ei vielä valvota tässä näkymässä.",
  checks: {
    overview: "Ylläpidon yleiskatsaus",
    catalog: "GPU-katalogin ylläpitohaku",
    marketing: "Ylläpidon tiedotteet",
    audit: "Ylläpidon tapahtumalokin ensimmäinen sivu",
  },
};

const sv: typeof en = {
  title: "System",
  description: "Kontrollera utvalda administrativa datakällor just nu.",
  note: "Detta är engångsläsningar från webbläsaren, inte övervakning av drifttid eller larm. Svarstiden omfattar nätverk och behandling.",
  checkedAt: "Kontrollerat",
  loading: "Kontrollerar datakällor…",
  error: "Kontrollen kunde inte slutföras. Försök igen.",
  ok: "Läsningen lyckades",
  failed: "Läsningen misslyckades",
  duration: "Svarstid",
  unmonitoredTitle: "Övervakas inte",
  unmonitored:
    "Betalningar, utbetalningar, e-post, leveranser, schemalagda jobb och bakgrundsfel övervakas inte här ännu.",
  checks: {
    overview: "Administrativ översikt",
    catalog: "Administratörssökning i GPU-katalogen",
    marketing: "Administrativa meddelanden",
    audit: "Första sidan i administrativ händelselogg",
  },
};

export function systemCopy(locale: Locale): typeof en & { checks: Record<AdminSystemCheckKey, string> } {
  return locale === "fi" ? fi : locale === "sv" ? sv : en;
}
