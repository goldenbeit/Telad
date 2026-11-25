// One page per published plot (25/11): a fixed link that can be shared and that search engines and AI tools can read.
// Same facts as the site's plot sheet, never the plot number, the block or the seller.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import SeoShell, { JsonLd, crumbsLd } from '@/components/SeoShell';
import { PlotCard, PlotRow } from '@/components/PlotBits';
import { getPlot, getPlots, getPlotSvg, SITE, fmt, areaOf, plotTitle, plotDesc, zoneSlugOf, districtPath, plotPath, waLink, STAGE_TXT } from '@/lib/public-data';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { code } = await params;
  const p = await getPlot(String(code || '').toUpperCase());
  if (!p) return { title: 'القطعة مش متاحة | تِلاد', robots: { index: false } };
  const t = plotTitle(p), d = plotDesc(p);
  return { title: `${t} | تِلاد`, description: d, alternates: { canonical: plotPath(p) },
    openGraph: { title: t, description: d, url: plotPath(p), siteName: 'تِلاد', locale: 'ar_EG', type: 'website' } };
}

export default async function PlotPage({ params }) {
  const { code } = await params;
  const c0 = String(code || '');
  if (c0 !== c0.toUpperCase()) redirect(`/plot/${c0.toUpperCase()}`);
  const p = await getPlot(c0);
  if (!p) notFound();
  const [svg, all] = await Promise.all([p.card ? getPlotSvg(p.id) : '', getPlots()]);
  const zs = zoneSlugOf(p), dPath = districtPath(zs, p.alloc ? p.district : null);
  const near = all.filter((x) => x.id !== p.id && x.zone === p.zone && (p.alloc ? x.district === p.district : !x.alloc)).sort((a, b) => a.paid - b.paid).slice(0, 6);
  const where = p.alloc && p.district ? `الحي ${p.district}` : 'غير مخصصة';
  const crumbs = [{ name: 'الرئيسية', href: '/' }, { name: p.zone, href: `/${zs}` }, { name: where, href: dPath }, { name: p.code, href: plotPath(p) }];
  const pct = p.price ? Math.round((p.paid / p.price) * 100) : 100;
  const title = plotTitle(p);
  const ld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: title, description: plotDesc(p), url: SITE + plotPath(p),
    datePosted: p.at ? String(p.at).slice(0, 10) : undefined,
    offers: { '@type': 'Offer', price: p.price || p.paid, priceCurrency: 'EGP', availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: 'تِلاد', url: SITE } },
    about: { '@type': 'Place', name: `${where} · ${p.zone} · العبور الجديدة`,
      address: { '@type': 'PostalAddress', addressLocality: 'مدينة العبور الجديدة', streetAddress: `${p.zone}${p.alloc && p.district ? ' · الحي ' + p.district : ''}`, addressCountry: 'EG' } } };
  const waText = `السلام عليكم، أنا مهتم بالقطعة ${p.code} (${where} · ${p.zone}، ${fmt(areaOf(p))} م²، المطلوب دفعه ${fmt(p.paid)} جنيه).`;
  return (
    <SeoShell crumbs={crumbs} close={`/?zone=${zs}&d=${p.alloc && p.district ? p.district : 'u'}`} closeLabel={`كل القطع ${p.alloc && p.district ? 'في الحي ' + p.district : 'غير المخصصة'} على الموقع`}>
      <JsonLd data={ld} /><JsonLd data={crumbsLd(crumbs)} />
      <h1 className="sx-h1">{title}</h1>
      <p className="sx-sub">الكود <span className="num">{p.code}</span> · منشورة على تِلاد</p>
      <PlotCard p={p} svg={svg} />
      <section className="sx-money">
        <span className="sx-l">السعر الكلي</span><b className="sx-big num">{p.price ? fmt(p.price) : fmt(p.paid)} <small>ج.م</small></b>
        <div className="sx-bar"><i style={{ width: pct + '%' }} /></div>
        <div className="sx-two"><span>المطلوب دفعه <small>(للبائع)</small><b className="num">{fmt(p.paid)}</b></span>{p.rem ? <span>المتبقي <small>(للجهاز)</small><b className="num">{fmt(p.rem)}</b></span> : null}</div>
      </section>
      <dl className="sx-facts">
        {p.af ? <div><dt>المساحة بعد التقنين</dt><dd><span className="num">{fmt(p.af)}</span> م²</dd></div> : null}
        {p.ao ? <div><dt>أصل المساحة</dt><dd><span className="num">{fmt(p.ao)}</span> م²</dd></div> : null}
        <div><dt>النوع</dt><dd>{p.alloc ? (STAGE_TXT[p.stage] || 'مخصصة') : 'غير مخصصة'}</dd></div>
        {p.inst != null && p.alloc ? <div><dt>الأقساط المتبقية</dt><dd className="num">{p.inst}</dd></div> : null}
        {p.facade ? <div><dt>الواجهة</dt><dd>{p.facade}</dd></div> : null}
        {p.view ? <div><dt>قدامها</dt><dd>{p.view}</dd></div> : null}
      </dl>
      <div className="sx-cta"><Link className="sx-btn pri" href={`/?req=${p.code}`}>اطلبها</Link><a className="sx-btn wa" href={waLink(waText)} target="_blank" rel="noopener">واتساب</a></div>
      <p className="sx-note">الأرقام من البائع، والنهائي في التقنين يحدده جهاز المدينة.</p>
      {near.length > 0 && (
        <section className="sx-sec"><h2>قطع تانية {p.alloc && p.district ? `في الحي ${p.district}` : `غير مخصصة في ${p.zone}`}</h2>
          <div className="sx-list">{near.map((x) => <PlotRow key={x.id} p={x} />)}</div>
          <Link href={dPath} className="sx-more">كل القطع {p.alloc && p.district ? `في الحي ${p.district}` : 'غير المخصصة'} ←</Link></section>
      )}
    </SeoShell>
  );
}
