import type { User } from "@supabase/supabase-js";
import { MARKETS } from "../config/markets";
import type { CountryCode, DemoUser, Locale } from "../types";
import { backendMode, supabase } from "./supabase";

const countries: CountryCode[] = ["FI", "SE", "DK", "NO"];
const locales: Locale[] = ["fi", "sv", "da", "nb", "en"];

function isCountryCode(value: unknown): value is CountryCode {
  return countries.includes(value as CountryCode);
}

function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

function mapUser(user: User): DemoUser {
  const metadata = user.user_metadata;
  const countryCode = isCountryCode(metadata.country_code) ? metadata.country_code : "FI";
  const locale = isLocale(metadata.locale) ? metadata.locale : MARKETS[countryCode].defaultLocale;
  const email = user.email ?? "";

  return {
    id: user.id,
    name:
      typeof metadata.display_name === "string" && metadata.display_name.trim().length >= 2
        ? metadata.display_name.trim()
        : email.split("@")[0] || "PC Market user",
    email,
    countryCode,
    locale,
  };
}

export interface AuthResult {
  user: DemoUser | null;
  confirmationRequired: boolean;
}

export const authService = {
  mode: backendMode,

  async signIn(email: string, password: string, countryCode: CountryCode, locale: Locale): Promise<AuthResult> {
    if (!supabase) {
      return {
        user: {
          id: `demo-${Date.now()}`,
          name: email.split("@")[0],
          email,
          countryCode,
          locale,
        },
        confirmationRequired: false,
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return { user: mapUser(data.user), confirmationRequired: false };
  },

  async signUp(
    name: string,
    email: string,
    password: string,
    countryCode: CountryCode,
    locale: Locale,
  ): Promise<AuthResult> {
    if (!supabase) {
      return {
        user: { id: `demo-${Date.now()}`, name, email, countryCode, locale },
        confirmationRequired: false,
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: name,
          country_code: countryCode,
          locale,
          preferred_currency: MARKETS[countryCode].currency,
        },
      },
    });
    if (error) throw error;

    return {
      user: data.session && data.user ? mapUser(data.user) : null,
      confirmationRequired: !data.session,
    };
  },

  subscribe(listener: (user: DemoUser | null) => void) {
    if (!supabase) return () => undefined;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      listener(session?.user ? mapUser(session.user) : null);
    });

    return () => data.subscription.unsubscribe();
  },

  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
