import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim();

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
