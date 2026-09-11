export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Anon JWT albo nowy klucz `sb_publishable_…` z panelu Supabase. */
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
}
