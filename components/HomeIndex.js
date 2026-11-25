// The home page's crawlable index (25/11): the site itself is built in the browser, so this server-rendered list of
// areas, districts and plots is what search engines and AI tools that don't run scripts read. The site hides it once
// its script runs (html.js-site), so visitors see the site exactly as before.
import Link from 'next/link';
import { getPlots, ZONES, SITE, WA, plotPath } from '@/lib/public-data';
import { PlotRow } from '@/components/PlotBits';
import { JsonLd } from '@/components/SeoShell';

export default async function HomeIndex() {
  const plots = await getPlots();
  return (
    <section id="seo-index" className="sx sx-index" aria-label="كل القطع">
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'تِلاد', alternateName: 'Telad', url: SITE, slogan: 'العقار قرارٌ لا صفقةٌ',
        description: 'منصة لعرض وبيع أراضي القادسية والأمل في مدينة العبور الجديدة، بالسعر الكلي والمطلوب دفعه والمتبقي للجهاز.',
        areaServed: 'مدينة العبور الجديدة', contactPoint: { '@type': 'ContactPoint', telephone: '+' + WA, contactType: 'sales', availableLanguage: 'ar' } }} />
      <h1 className="sx-h1">تِلاد · أراضي القادسية والأمل في العبور الجديدة</h1>
      <p className="sx-sub"><span className="num">{plots.length}</span> قطعة منشورة، بالسعر الكلي والمطلوب دفعه والمتبقي للجهاز.</p>
      {ZONES.map((z) => {
        const l = plots.filter((p) => p.zone === z.name);
        return (
          <section key={z.slug} className="sx-sec"><h2><Link href={`/${z.slug}`}>أراضي {z.name}</Link></h2>
            <div className="sx-fd">{z.districts.map((d) => <Link key={d} href={`/${z.slug}/${d}`}>الحي {d}</Link>)}<Link href={`/${z.slug}/unallocated`}>غير مخصصة</Link></div>
            <div className="sx-list">{l.map((p) => <PlotRow key={p.id} p={p} showWhere />)}</div></section>
        );
      })}
    </section>
  );
}
