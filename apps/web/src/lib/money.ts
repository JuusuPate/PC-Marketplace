import type { Currency, Locale } from "../types";

const intlLocales: Record<Locale, string> = {
  fi: "fi-FI",
  sv: "sv-SE",
  da: "da-DK",
  nb: "nb-NO",
  en: "en-GB",
};

export function formatMoney(amountMinor: number, currency: Currency, locale: Locale) {
  return new Intl.NumberFormat(intlLocales[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
