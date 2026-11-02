import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
// Supabase removes the recovery tokens from the URL during client initialization.
// Remember this before createClient so a late auth subscriber can still recognize the redirect.
export const passwordRecoveryRedirect = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

/**
 * Valitsee Supabasen vain, jos sekä URL että julkinen selainavain on määritelty.
 * Muussa tapauksessa palvelut käyttävät paikallista demoa. Salaisia palvelinavaimia ei kuulu VITE-asetuksiin.
 */
export const backendMode = supabaseUrl && supabaseKey ? "supabase" : "demo";

export const supabase =
  backendMode === "supabase"
    ? createClient(supabaseUrl!, supabaseKey!, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

export type BackendMode = typeof backendMode;

/** Lue vain julkinen providerin käyttötila ennen OAuth-ohjausta.
 * Pois käytöstä oleva Google ei näin vie käyttäjää palvelun JSON-virhesivulle. */
export async function googleAuthEnabled(): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) return false;
  const response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
    headers: { apikey: supabaseKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not check sign-in availability");
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("external" in data) ||
    !data.external ||
    typeof data.external !== "object" ||
    !("google" in data.external) ||
    typeof data.external.google !== "boolean"
  )
    throw new Error("Invalid sign-in settings");
  return data.external.google;
}
