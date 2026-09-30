import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://adajsqmrzwlquvuqzsuw.supabase.co";
const SUPABASE_KEY = "sb_publishable_ffnB-v8ba3VdOwzg9lRJrQ_DCgGdkZT";

export function getSupabaseCredentials() {
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
