// One page per district (25/11): /amal/28, and /amal/unallocated for the plots with no district yet.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SeoShell, { JsonLd, crumbsLd } from '@/components/SeoShell';
import { PlotRow } from '@/components/PlotBits';
import { getPlots, zoneBySlug, ZONES, UNALLOC, SITE, plotPath, fmt, waLink } from '@/lib/public-data';

export const revalidate = 300;
export const dynamicParams = false;
export function generateStaticParams() { return ZONES.flatMap((z) => [...z.districts.map(String), UNALLOC].map((d) => ({ zone: z.slug, district: d }))); }

const parse = (zone, district) => { const z = zoneBySlug(zone); if (!z) return null; if (district === UNALLOC) return { z, d: null };
  const d = Number(district); return z.districts.includes(d) ? { z, d } : null; };
const label = (d) => (d ? `الحي ${d}` : 'غير مخصصة');

export async function generateMetadata({ params }) {
  const { zone, district } = await params; const k = parse(zone, district); if (!k) return {};
  const t = `أراضي ${k.d ? 'للبيع في الحي ' + k.d : 'غير مخصصة للبيع في'} ${k.d ? '· ' : ''}${k.z.name} · العبور الجديدة`;
  const d = `قطع ${k.d ? 'مخصصة في الحي ' + k.d + ' بـ' + k.z.name : 'غير مخصصة في ' + k.z.name} بالعبور الجديدة منشورة على تِلاد، بالمساحة والمطلوب دفعه والمتبقي للجهاز.`;
  const path = `/${k.z.slug}/${district}`;
  return { title: `${t} | تِلاد`, description: d, alternates: { canonical: path }, openGraph: { title: t, description: d, url: path, siteName: 'تِلاد', locale: 'ar_EG' } };
}

export default async function DistrictPage({ params }) {
  const { zone, district } = await params; const k = parse(zone, district); if (!k) notFound();
  const l = (await getPlots()).filter((p) => p.zone === k.z.name && (k.d ? p.alloc && p.district === k.d : !p.alloc)).sort((a, b) => a.paid - b.paid);
  const crumbs = [{ name: 'الرئيسية', href: '/' }, { name: k.z.name, href: `/${k.z.slug}` }, { name: label(k.d), href: `/${k.z.slug}/${district}` }];
  const areas = [...new Set(l.map((p) => p.af || p.ao).filter(Boolean))].sort((a, b) => a - b);
  return (
    <SeoShell crumbs={crumbs} close={`/?zone=${k.z.slug}&d=${k.d || 'u'}`} closeLabel={`افتح ${label(k.d)} على الموقع`}>
      <JsonLd data={crumbsLd(crumbs)} />
      {l.length > 0 && <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', name: `أراضي ${label(k.d)} · ${k.z.name}`, numberOfItems: l.length,
        itemListElement: l.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + plotPath(p) })) }} />}
      <h1 className="sx-h1">{k.d ? `أراضي للبيع في الحي ${k.d} · ${k.z.name}` : `أراضي غير مخصصة للبيع في ${k.z.name}`} · العبور الجديدة</h1>
      <p className="sx-sub">{l.length
        ? <><span className="num">{l.length}</span> قطعة منشورة على تِلاد{areas.length ? <>، بمساحات من <span className="num">{fmt(areas[0])}</span> لـ<span className="num">{fmt(areas[areas.length - 1])}</span> م²</> : null}، والمطلوب دفعه من <span className="num">{fmt(l[0].paid)}</span> ج.م.</>
        : 'مفيش قطع منشورة هنا دلوقتي. قولنا بتدوّر على إيه وإحنا ندوّرلك.'}</p>
      {l.length > 0 && <div className="sx-list">{l.map((p) => <PlotRow key={p.id} p={p} />)}</div>}
      <div className="sx-cta"><Link className="sx-btn pri" href={`/?zone=${k.z.slug}&d=${k.d || 'u'}`}>{l.length ? 'قارن وفلتر على الموقع' : 'دوّرلي على قطعة'}</Link>
        <a className="sx-btn wa" data-wl={`district||district_page|${k.z.name}|${k.d || ''}`} href={waLink(`السلام عليكم، بدوّر على أرض ${k.d ? 'في الحي ' + k.d + ' · ' : 'غير مخصصة في '}${k.z.name}.`)} target="_blank" rel="noopener">واتساب</a></div>
    </SeoShell>
  );
}
