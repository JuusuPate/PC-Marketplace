import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_KEY,
  LANGUAGE_PREFERENCE_KEY,
  parseCookieConsent,
  persistPreferredLocale,
  readCookieConsent,
  readPreferredLocale,
  saveCookieConsent,
} from "../apps/web/src/lib/cookie-consent";
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("starts without permission and does not read language preferences before consent", () => {
  values.set(LANGUAGE_PREFERENCE_KEY, "en");
  expect(readCookieConsent()).toBeNull();
  expect(readPreferredLocale()).toBe("fi");
  persistPreferredLocale("en", false);
  expect(values.has(LANGUAGE_PREFERENCE_KEY)).toBe(false);
});
it("remembers the explicitly accepted language and revokes only that preference", () => {
  values.set("sb-auth-token", "session");
  values.set("pc-marketplace.demo-listings", "listings");
  expect(saveCookieConsent(true).saved).toBe(true);
  persistPreferredLocale("sv", true);
  expect(readPreferredLocale()).toBe("sv");
  expect(saveCookieConsent(false).consent.preferences).toBe(false);
  expect(readPreferredLocale()).toBe("fi");
  expect(values.has(LANGUAGE_PREFERENCE_KEY)).toBe(false);
  expect(values.get("sb-auth-token")).toBe("session");
  expect(values.get("pc-marketplace.demo-listings")).toBe("listings");
});
it.each([
  null,
  {},
  { version: 2, necessary: true, preferences: true, savedAt: 1000 },
  { version: 1, necessary: false, preferences: true, savedAt: 1000 },
  { version: 1, necessary: true, preferences: "true", savedAt: 1000 },
  { version: 1, necessary: true, preferences: true, savedAt: NaN },
  { version: 1, necessary: true, preferences: true, savedAt: 2001 },
])("does not grant optional storage for malformed or future consent: %j", (value) => {
  expect(parseCookieConsent(value, 2000)).toBeNull();
});
it("expires the choice after 180 days and ignores broken stored JSON", () => {
  expect(
    parseCookieConsent({ version: 1, necessary: true, preferences: true, savedAt: 1000 }, 1000 + 180 * 86400000),
  ).toBeNull();
  values.set(COOKIE_CONSENT_KEY, "broken");
  expect(readCookieConsent()).toBeNull();
});
it("handles unavailable storage without blocking the current visit", () => {
  vi.stubGlobal("window", {
    get localStorage() {
      throw new Error("blocked");
    },
  });
  expect(readCookieConsent()).toBeNull();
  expect(readPreferredLocale()).toBe("fi");
  expect(saveCookieConsent(false)).toMatchObject({ saved: false, consent: { preferences: false } });
  expect(() => persistPreferredLocale("en", true)).not.toThrow();
});
