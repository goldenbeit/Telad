// Server-side reads of the published plots for the SEO pages (25/11): /plot/[code], /[zone], /[zone]/[district],
// the sitemap and the home page's crawlable list. Only what the public site already shows, through the public
// (anon) key and its row rules: approved listings only. Never the plot number, the block or anything of the seller.
const URL0 = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IvPIAv7VG6W-dN31SIhTBw_yLn_hqIe';
export const SITE = 'https://www.telad-group.com';
export const WA = '201024151524';
const REVALIDATE = 300; // a new or sold plot shows up on these pages within 5 minutes

export const ZONES = [
  { slug: 'qadisiya', name: 'القادسية', districts: [8, 9, 10, 12, 17, 20, 22, 23] },
  { slug: 'amal', name: 'الأمل', districts: [28, 29, 30, 31, 32, 33, 35, 36] },
];
export const zoneBySlug = (s) => ZONES.find((z) => z.slug === s) || null;
export const zoneByName = (n) => ZONES.find((z) => z.name === n) || null;
export const UNALLOC = 'unallocated';

const COLS = 'id,code,zone,district,neighborhood,area_orig,area_final,facade,view_type,price,paid,remaining,inst_left,allocated,stage,published_at,created_at,map_card';

async function rest(path) {
  try {
    const r = await fetch(`${URL0}/rest/v1/${path}`, { headers: { apikey: KEY }, next: { revalidate: REVALIDATE } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

const toPlot = (r) => ({
  id: r.id, code: r.code, zone: r.zone || '', district: r.district || null, nb: r.neighborhood || '',
  ao: r.area_orig == null ? null : Number(r.area_orig), af: r.area_final == null ? null : Number(r.area_final),
  facade: r.facade || '', view: r.view_type || '', price: r.price == null ? null : Number(r.price), paid: r.paid == null ? null : Number(r.paid),
  rem: r.remaining == null ? null : Number(r.remaining), inst: r.inst_left, alloc: r.allocated !== false, stage: r.stage || '',
  card: r.map_card && r.map_card.facade ? r.map_card : null, at: r.published_at || r.created_at,
});

export async function getPlots() {
  const rows = await rest(`listings?select=${COLS}&state=eq.approved&code=not.is.null&order=published_at.desc.nullslast,id.desc&limit=1000`);
  return (rows || []).map(toPlot).filter((p) => p.code && p.paid != null);
}
export async function getPlot(code) {
  if (!/^[A-Z]\d{4}-\d{1,7}$/.test(code)) return null;
  const rows = await rest(`listings?select=${COLS}&state=eq.approved&code=eq.${encodeURIComponent(code)}&limit=1`);
  const p = rows && rows[0] ? toPlot(rows[0]) : null;
  return p && p.paid != null ? p : null;
}
export async function getPlotSvg(id) {
  const rows = await rest(`listing_map_svg?select=svg&listing_id=eq.${Number(id)}&limit=1`);
  return (rows && rows[0] && rows[0].svg) || '';
}

// ---------- wording shared by the pages, the metadata and the structured data ----------
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const areaOf = (p) => p.af || p.ao;
export const zoneSlugOf = (p) => (zoneByName(p.zone) || {}).slug || '';
export const plotWhere = (p) => (p.alloc && p.district ? `الحي ${p.district} · ${p.zone}` : `غير مخصصة · ${p.zone}`);
export const plotTitle = (p) => `أرض ${p.alloc ? 'مخصصة' : 'غير مخصصة'} ${fmt(areaOf(p))} م² ${p.alloc && p.district ? `في الحي ${p.district} · ` : 'في '}${p.zone} · العبور الجديدة`;
export function plotDesc(p) {
  const bits = [];
  if (p.card) bits.push(p.card.facade, ...(p.card.feats || []).slice(0, 1));
  bits.push(`المطلوب دفعه ${fmt(p.paid)} ج.م`);
  if (p.rem) bits.push(`والمتبقي للجهاز ${fmt(p.rem)} ج.م`);
  return bits.filter(Boolean).join('، ') + '.';
}
export const STAGE_TXT = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
export const plotPath = (p) => `/plot/${p.code}`;
export const districtPath = (zoneSlug, d) => `/${zoneSlug}/${d || UNALLOC}`;
export const waLink = (text) => `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
