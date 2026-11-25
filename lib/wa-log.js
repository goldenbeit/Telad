// تبويب "واتساب" في الداشبورد (25/11): كل دوسة على زرار واتساب بتتسجّل سطر (للعلم بس، من غير اسم ولا رقم).
// keepalive عشان الطلب يكمّل حتى لو الموبايل فتح واتساب وساب الصفحة. أي خطأ بيتجاهل.
const URL0 = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IvPIAv7VG6W-dN31SIhTBw_yLn_hqIe';
export function waLog(p) {
  try {
    fetch(`${URL0}/rest/v1/rpc/wa_log`, { method: 'POST', keepalive: true,
      headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p }) }).catch(() => {});
  } catch (e) { /* never in the visitor's way */ }
}
// data-wl="kind|code|place|zone|district" on a wa.me link
export const wlAttr = (o) => ` data-wl="${[o.k, o.c || '', o.p || '', o.z || '', o.d || ''].join('|').replace(/"/g, '')}"`;
export function waFromLink(a) {
  const v = a && a.getAttribute('data-wl'); if (!v) return;
  const [kind, code, place, zone, district] = v.split('|');
  waLog({ kind, code: code || null, place: place || null, zone: zone || null, district: district || null });
}
