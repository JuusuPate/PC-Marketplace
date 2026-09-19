import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();
// Supabase removes the recovery tokens from the URL during client initialization.
// Remember this before createClient so a late auth subscriber can still recognize the redirect.
export const passwordRecoveryRedirect = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

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
