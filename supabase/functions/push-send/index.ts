// Sends the phone notifications waiting in public.push_out to every device the person registered (public.push_subs).
// Called by the database (pg_net) right after a new request and every 2 minutes by pg_cron (push_tick). Anyone may call
// it: it only sends what is already queued, and each message is claimed once, so a second call sends nothing twice.
// The signing keys (VAPID) are made here on the first run and kept in private.push_keys; they are never in the code.
import postgres from 'npm:postgres@3.4.4';
import webpush from 'npm:web-push@3.6.7';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
const b64u = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function keys() {
  const [k] = await sql`select public_key, private_key from private.push_keys where id = 1`;
  if (k) return k;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  await sql`insert into private.push_keys (id, public_key, private_key) values (1, ${pub}, ${jwk.d!}) on conflict (id) do nothing`;
  const [k2] = await sql`select public_key, private_key from private.push_keys where id = 1`;
  return k2;
}

Deno.serve(async () => {
  try {
    const k = await keys();
    webpush.setVapidDetails('https://telad.vercel.app', k.public_key, k.private_key);
    // claim the waiting messages (at most 300 a call), so two calls never send the same one
    const rows = await sql`
      update public.push_out o set sent_at = now()
      where o.id in (select id from public.push_out where sent_at is null order by id limit 300 for update skip locked)
      returning o.id, o.user_id, o.title, o.body, o.url, o.tag`;
    let sent = 0, gone = 0, failed = 0;
    for (const m of rows) {
      const subs = await sql`select id, endpoint, p256dh, auth from public.push_subs where user_id = ${m.user_id}`;
      const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag });
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' });
          sent++;
          if (s.fails) await sql`update public.push_subs set fails = 0 where id = ${s.id}`;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) { gone++; await sql`delete from public.push_subs where id = ${s.id}`; }
          else { failed++; await sql`update public.push_subs set fails = fails + 1 where id = ${s.id}`;
            await sql`delete from public.push_subs where id = ${s.id} and fails >= 20`; }
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, messages: rows.length, sent, gone, failed }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
