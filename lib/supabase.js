import { createClient } from '@supabase/supabase-js';

// The URL and publishable key are public by design; env vars can override them per environment.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IvPIAv7VG6W-dN31SIhTBw_yLn_hqIe';

// The sign-in lock stays inside this tab. The default lock is shared by every tab of the site, and a phone that
// freezes a background tab while it holds it leaves a new tab stuck on "بنحمّل" forever (16/11).
// A phone can also freeze the page in the middle of a token refresh; the request never answers and every later call
// waits behind it (the desk sat on "بنحمّل" after coming back from WhatsApp, 18/11). So nobody waits on the lock more
// than 8 seconds, and no request to Supabase waits more than 20.
const chains = {};
function tabLock(name, _timeout, fn) {
  const prev = chains[name] || Promise.resolve();
  const waited = Promise.race([prev.catch(() => {}), new Promise((r) => setTimeout(r, 8000))]);
  const run = waited.then(() => fn());
  chains[name] = run.catch(() => {});
  return run;
}
const fetchT = (input, init = {}) => {
  // Photo and letter uploads can take longer on a weak signal, so they keep no limit.
  if (init.signal || typeof AbortController === 'undefined' || String(input.url || input).includes('/storage/v1/')) return fetch(input, init);
  const c = new AbortController(), t = setTimeout(() => c.abort(), 20000);
  return fetch(input, { ...init, signal: c.signal }).finally(() => clearTimeout(t));
};

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'telad-auth', lock: tabLock },
  global: { fetch: fetchT },
});
