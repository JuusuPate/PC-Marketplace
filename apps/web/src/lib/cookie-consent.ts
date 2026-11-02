import type { Locale } from "../types";

export const COOKIE_CONSENT_KEY = "pc-marketplace.cookie-consent";
export const LANGUAGE_PREFERENCE_KEY = "pc-marketplace.language";
const CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
const locales: readonly Locale[] = ["fi", "sv", "en", "da", "nb"];

export interface CookieConsent {
  version: 1;
  necessary: true;
  preferences: boolean;
  savedAt: number;
}

/** Vanhentunut, tuntematon tai vioittunut valinta ei anna lupaa valinnaiseen tallennukseen. */
export function parseCookieConsent(value: unknown, now = Date.now()): CookieConsent | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (
    item.version !== 1 ||
    item.necessary !== true ||
    typeof item.preferences !== "boolean" ||
    typeof item.savedAt !== "number" ||
    !Number.isSafeInteger(item.savedAt) ||
    item.savedAt < 0 ||
    item.savedAt > now ||
    now - item.savedAt >= CONSENT_LIFETIME_MS
  )
    return null;
  return { version: 1, necessary: true, preferences: item.preferences, savedAt: item.savedAt };
}

export function readCookieConsent(): CookieConsent | null {
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value ? parseCookieConsent(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

/** Valinnan tallennus ei muuta kirjautumisistuntoa tai muita palvelun välttämättömiä tietoja. */
export function saveCookieConsent(preferences: boolean) {
  const consent: CookieConsent = { version: 1, necessary: true, preferences, savedAt: Date.now() };
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    if (!preferences) window.localStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
    return { consent, saved: true };
  } catch {
    return { consent, saved: false };
  }
}

export function readPreferredLocale(): Locale {
  if (!readCookieConsent()?.preferences) return "fi";
  try {
    const locale = window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    return locales.includes(locale as Locale) ? (locale as Locale) : "fi";
  } catch {
    return "fi";
  }
}

/** Kielivalinta muistetaan vain luvalla; luvan poistaminen poistaa ainoastaan tämän asetuksen. */
export function persistPreferredLocale(locale: Locale, allowed: boolean) {
  try {
    if (allowed) window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, locale);
    else window.localStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
  } catch {
    /* Tallennuksen esto ei estä sivuston käyttöä. */
  }
}
