import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { CloudError } from '@/lib/cloud/errors';
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new CloudError(
      'Brak konfiguracji Supabase. Skopiuj .env.example do .env i wklej URL oraz anon key z panelu.'
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
