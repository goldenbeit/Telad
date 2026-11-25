// The frame of the SEO pages (25/11): header, breadcrumb, footer with every area. Server-rendered, no script.
import Link from 'next/link';
import { ZONES, SITE, WA, waLink } from '@/lib/public-data';
import WaTrack from './WaTrack';

export function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export function crumbsLd(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + (c.href || '') })) };
}

export default function SeoShell({ crumbs = [], close, closeLabel, children }) {
  return (
    <div className="sx">
      <header className="sx-top"><Link href="/" className="sx-brand">تِلاد</Link><span className="sx-tag">العقار قرارٌ لا صفقةٌ</span></header>
      {close && (
        // 25/11: a shared plot link opened on its own still feels part of the site: ✕ goes back to the site itself
        <div className="sx-close"><Link href={close} className="sx-x" aria-label="اقفل وارجع للموقع">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
          <Link href={close} className="sx-xl">{closeLabel || 'كل القطع على تِلاد'}</Link></div>
      )}
      {crumbs.length > 0 && (
        <nav className="sx-bc" aria-label="مكانك">
          {crumbs.map((c, i) => (
            <span key={i}>{i > 0 && <span className="sx-sep">›</span>}{c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span>{c.name}</span>}</span>
          ))}
        </nav>
      )}
      <main className="sx-main">{children}</main>
      <WaTrack />
      <footer className="sx-foot">
        {ZONES.map((z) => (
          <div key={z.slug}>
            <Link href={`/${z.slug}`} className="sx-fz">أراضي {z.name}</Link>
            <div className="sx-fd">{z.districts.map((d) => <Link key={d} href={`/${z.slug}/${d}`}>الحي {d}</Link>)}<Link href={`/${z.slug}/unallocated`}>غير مخصصة</Link></div>
          </div>
        ))}
        <div className="sx-fl"><Link href="/">كل القطع على تِلاد</Link><a data-wl="general||seo_footer||" href={waLink('السلام عليكم، عايز أسأل عن أراضي على تِلاد.')} target="_blank" rel="noopener">واتساب <span dir="ltr">+{WA}</span></a></div>
      </footer>
    </div>
  );
}
