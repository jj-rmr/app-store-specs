import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton Supabase client. Only constructed when VITE_DATA_SOURCE=supabase,
// so the localStorage prototype never touches the network.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }
  client = createClient(url, anonKey);
  return client;
}
