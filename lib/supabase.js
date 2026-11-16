import { createClient } from '@supabase/supabase-js';

// The URL and publishable key are public by design; env vars can override them per environment.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IvPIAv7VG6W-dN31SIhTBw_yLn_hqIe';

// The sign-in lock stays inside this tab. The default lock is shared by every tab of the site, and a phone that
// freezes a background tab while it holds it leaves a new tab stuck on "بنحمّل" forever (16/11).
const chains = {};
function tabLock(name, _timeout, fn) {
  const run = (chains[name] || Promise.resolve()).then(fn, fn);
  chains[name] = run.catch(() => {});
  return run;
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'telad-auth', lock: tabLock },
});
