// Activates a team member's account: the owner added them by phone and gave them a 6-digit code.
// The member sends phone + code + a password they choose; we create their login and link it.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const DOMAIN = 'admin.telad.app';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  let body: { phone?: string; code?: string; password?: string };
  try { body = await req.json(); } catch { return reply({ error: 'bad_request' }, 400); }
  const phone = String(body.phone || '').trim(), code = String(body.code || '').trim(), password = String(body.password || '');
  if (!/^01[0125][0-9]{8}$/.test(phone) || !/^[0-9]{6}$/.test(code)) return reply({ error: 'invalid' }, 400);
  if (password.length < 8 || password.length > 72) return reply({ error: 'weak_password' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: s } = await db.from('staff').select('id, user_id, active, code_hash, code_expires, code_tries').eq('phone', phone).maybeSingle();
  if (!s || s.user_id || !s.active || !s.code_hash || !s.code_expires || new Date(s.code_expires) < new Date()) return reply({ error: 'invalid' }, 400);
  if ((await sha256(code)) !== s.code_hash) {
    const tries = (s.code_tries || 0) + 1;
    await db.from('staff').update(tries >= 5 ? { code_tries: 0, code_hash: null, code_expires: null } : { code_tries: tries }).eq('id', s.id);
    return reply({ error: tries >= 5 ? 'locked' : 'invalid' }, 400);
  }
  const email = `${phone}@${DOMAIN}`;
  let userId: string | null = null;
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error && u?.user) userId = u.user.id;
  else {
    // A member who was deleted and added again still has their old login. If it is not linked to anyone
    // (and is not the owner's), the valid invite code lets them set a new password on it.
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const old = list?.users?.find((x) => x.email === email);
    if (!old) return reply({ error: 'exists' }, 409);
    const { data: linked } = await db.from('staff').select('id').eq('user_id', old.id).maybeSingle();
    const { data: owner } = await db.from('admins').select('user_id').eq('user_id', old.id).maybeSingle();
    if (linked || owner) return reply({ error: 'exists' }, 409);
    const { error: upErr } = await db.auth.admin.updateUserById(old.id, { password });
    if (upErr) return reply({ error: 'exists' }, 409);
    userId = old.id;
  }
  await db.from('staff').update({ user_id: userId, code_hash: null, code_expires: null, code_tries: 0 }).eq('id', s.id);
  return reply({ ok: true });
});
