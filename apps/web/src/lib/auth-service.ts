import type { User } from "@supabase/supabase-js";
import { LAUNCH_MARKET, MARKETS } from "../config/markets";
import type { CountryCode, DemoUser, Locale } from "../types";
import { backendMode, supabase } from "./supabase";

const locales: Locale[] = ["fi", "sv", "da", "nb", "en"];
export const DEMO_ADMIN_EMAIL = "admin@pcmarket.fi";

function isLocale(value: unknown): value is Locale {
  return locales.includes(value as Locale);
}

async function mapUser(user: User): Promise<DemoUser> {
  const metadata = user.user_metadata;
  const countryCode = LAUNCH_MARKET;
  const locale = isLocale(metadata.locale) ? metadata.locale : MARKETS[countryCode].defaultLocale;
  const email = user.email ?? "";
  let role: DemoUser["role"] = "user";

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("is_current_user_admin");
      if (!error && data === true) role = "admin";
    } catch {
      role = "user";
    }
  }

  return {
    id: user.id,
    name:
      typeof metadata.display_name === "string" && metadata.display_name.trim().length >= 2
        ? metadata.display_name.trim()
        : email.split("@")[0] || "PC Market user",
    email,
    countryCode,
    locale,
    role,
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
          role: email === DEMO_ADMIN_EMAIL ? "admin" : "user",
        },
        confirmationRequired: false,
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return { user: await mapUser(data.user), confirmationRequired: false };
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
        user: { id: `demo-${Date.now()}`, name, email, countryCode, locale, role: "user" },
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
      user: data.session && data.user ? await mapUser(data.user) : null,
      confirmationRequired: !data.session,
    };
  },

  subscribe(listener: (user: DemoUser | null) => void, onLoading?: (loading: boolean) => void) {
    if (!supabase) return () => undefined;

    let requestId = 0;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentRequest = ++requestId;
      onLoading?.(true);
      if (!session?.user) {
        listener(null);
        onLoading?.(false);
        return;
      }

      window.setTimeout(() => {
        if (currentRequest !== requestId) return;
        void mapUser(session.user).then(
          (mappedUser) => {
            if (currentRequest !== requestId) return;
            listener(mappedUser);
            onLoading?.(false);
          },
          () => {
            if (currentRequest !== requestId) return;
            listener(null);
            onLoading?.(false);
          },
        );
      }, 0);
    });

    return () => {
      requestId++;
      data.subscription.unsubscribe();
    };
  },

  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
