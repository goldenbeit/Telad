// One page per area (25/11): /qadisiya and /amal. The districts with how many plots each, and the cheapest plots.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SeoShell, { JsonLd, crumbsLd } from '@/components/SeoShell';
import { PlotRow } from '@/components/PlotBits';
import { getPlots, zoneBySlug, ZONES, fmt, SITE, plotPath } from '@/lib/public-data';

export const revalidate = 300;
export const dynamicParams = false;
export function generateStaticParams() { return ZONES.map((z) => ({ zone: z.slug })); }

export async function generateMetadata({ params }) {
  const { zone } = await params; const z = zoneBySlug(zone); if (!z) return {};
  const t = `أراضي للبيع في ${z.name} · العبور الجديدة`;
  const d = `قطع أراضي مخصصة وغير مخصصة منشورة في ${z.name} بالعبور الجديدة، بالمطلوب دفعه والمتبقي للجهاز والسعر الكلي، مقسمة بالحي.`;
  return { title: `${t} | تِلاد`, description: d, alternates: { canonical: `/${z.slug}` }, openGraph: { title: t, description: d, url: `/${z.slug}`, siteName: 'تِلاد', locale: 'ar_EG' } };
}

export default async function ZonePage({ params }) {
  const { zone } = await params; const z = zoneBySlug(zone); if (!z) notFound();
  const all = (await getPlots()).filter((p) => p.zone === z.name);
  const by = (d) => all.filter((p) => (d ? p.alloc && p.district === d : !p.alloc));
  const min = (l) => (l.length ? Math.min(...l.map((p) => p.paid)) : null);
  const crumbs = [{ name: 'الرئيسية', href: '/' }, { name: z.name, href: `/${z.slug}` }];
  const cheap = all.slice().sort((a, b) => a.paid - b.paid).slice(0, 12);
  return (
    <SeoShell crumbs={crumbs}>
      <JsonLd data={crumbsLd(crumbs)} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', name: `أراضي ${z.name}`, numberOfItems: all.length,
        itemListElement: cheap.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + plotPath(p) })) }} />
      <h1 className="sx-h1">أراضي للبيع في {z.name} · العبور الجديدة</h1>
      <p className="sx-sub">{all.length ? <><span className="num">{all.length}</span> قطعة منشورة على تِلاد، مخصصة وغير مخصصة، بالمطلوب دفعه والمتبقي للجهاز.</> : 'مفيش قطع منشورة هنا دلوقتي.'}</p>
      <section className="sx-sec"><h2>الأحياء</h2>
        <div className="sx-grid">
          {[...z.districts, null].map((d) => { const l = by(d), m = min(l);
            return (<Link key={d || 'u'} href={`/${z.slug}/${d || 'unallocated'}`} className="sx-dist"><b>{d ? `الحي ${d}` : 'غير مخصصة'}</b>
              <small>{l.length ? <><span className="num">{l.length}</span> قطعة · من <span className="num">{fmt(m)}</span></> : 'مفيش دلوقتي'}</small></Link>); })}
        </div></section>
      {cheap.length > 0 && <section className="sx-sec"><h2>الأقل في المطلوب دفعه</h2><div className="sx-list">{cheap.map((p) => <PlotRow key={p.id} p={p} showWhere />)}</div></section>}
      <div className="sx-cta"><Link className="sx-btn pri" href={`/?zone=${z.slug}`}>افتح {z.name} على الموقع</Link></div>
    </SeoShell>
  );
}
