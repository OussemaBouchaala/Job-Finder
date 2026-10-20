import { createClient } from "@supabase/supabase-js";

// Publishable (public) key — safe in the browser; access is protected by RLS + login.
export const SUPABASE_URL = "https://sselbentysgmshrmqshd.supabase.co";
export const VITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_N90rxS-ZVoGW0aJd1l478g_FRD0L83y";

export const supabase = createClient(SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, flowType: "implicit", detectSessionInUrl: true },
});
