import { createClient } from '@supabase/supabase-js';

// The URL and publishable key are public by design; env vars can override them per environment.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IvPIAv7VG6W-dN31SIhTBw_yLn_hqIe';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'telad-auth' },
});
