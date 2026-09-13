import type { CountryCode, Locale, Market } from "../types";

export const MARKETS: Record<CountryCode, Market> = {
  FI: {
    countryCode: "FI",
    defaultLocale: "fi",
    currency: "EUR",
    flag: "🇫🇮",
    name: "Suomi",
    status: "live",
    feePercent: 1.5,
    shippingPartners: ["Posti", "Matkahuolto"],
  },
  SE: {
    countryCode: "SE",
    defaultLocale: "sv",
    currency: "SEK",
    flag: "🇸🇪",
    name: "Sverige",
    status: "beta",
    feePercent: 1.5,
    shippingPartners: ["PostNord", "DB Schenker"],
  },
  DK: {
    countryCode: "DK",
    defaultLocale: "da",
    currency: "DKK",
    flag: "🇩🇰",
    name: "Danmark",
    status: "soon",
    feePercent: 1.5,
    shippingPartners: ["PostNord", "DAO"],
  },
  NO: {
    countryCode: "NO",
    defaultLocale: "nb",
    currency: "NOK",
    flag: "🇳🇴",
    name: "Norge",
    status: "soon",
    feePercent: 1.5,
    shippingPartners: ["Posten", "Bring"],
  },
};

export const LOCALE_LABELS: Record<Locale, string> = {
  fi: "Suomi",
  sv: "Svenska",
  da: "Dansk",
  nb: "Norsk",
  en: "English",
};

export const COUNTRY_FLAGS: Record<CountryCode, string> = {
  FI: "🇫🇮",
  SE: "🇸🇪",
  DK: "🇩🇰",
  NO: "🇳🇴",
};

// The domain model remains Nordic-ready, while the public launch is deliberately Finland-only.
export const LAUNCH_MARKET = "FI" as const satisfies CountryCode;
export const PUBLIC_MARKETS: CountryCode[] = [LAUNCH_MARKET];
export const PUBLIC_LOCALES: Locale[] = ["fi", "sv", "en"];
