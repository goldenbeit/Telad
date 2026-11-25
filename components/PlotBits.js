// Pieces of the plot page shared with the area pages (25/11). Same look as the site: the plot card and the money box.
import Link from 'next/link';
import { fmt, areaOf, plotPath, plotWhere } from '@/lib/public-data';

const IC = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  face: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M4 20h16"/><path d="M9 20v-6h6v6"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/></svg>',
  dim: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 7l3-3M4 7l3 3M20 17H4M20 17l-3-3M20 17l-3 3"/></svg>',
};
const Row = ({ ic, k, v }) => (
  <div className="pc-row"><i dangerouslySetInnerHTML={{ __html: IC[ic] }} /><span><small>{k}</small><b>{v}</b></span></div>
);

export function PlotCard({ p, svg }) {
  const c = p.card; if (!c) return null;
  const place = [p.zone, p.alloc && p.district ? `الحي ${p.district}` : '', p.nb ? `المجاورة ${p.nb}` : ''].filter(Boolean).join(' · ');
  return (
    <section className="pcard" aria-label="بطاقة القطعة">
      <div className="pc-h"><span className="pc-brand">تِلاد</span><span className="pc-t">بطاقة القطعة</span></div>
      {svg ? (
        <div className="pc-map"><div className="mapw" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="pc-leg"><span><i style={{ background: '#F0A63A' }} />القطعة</span><span><i style={{ background: '#D5E6C8' }} />حديقة / مساحة خضراء</span><span><i style={{ background: '#E6E9F2' }} />خدمات</span></div></div>
      ) : null}
      <Row ic="pin" k="المكان" v={place} /><Row ic="face" k="الواجهة" v={c.facade} />
      {(c.feats || []).slice(0, 2).map((f, i) => <Row key={i} ic="star" k="ميزة" v={f} />)}
      {c.dims ? <Row ic="dim" k="الأبعاد" v={String(c.dims).replace(/^الأبعاد\s*/, '')} /> : null}
      <p className="pc-src">من مخطط مدينة العبور الجديدة. المساحات تقريبية.</p>
    </section>
  );
}

export function PlotRow({ p, showWhere }) {
  return (
    <Link href={plotPath(p)} className="sx-row">
      <span className="sx-rt"><b>{showWhere ? plotWhere(p) : `${p.alloc ? 'مخصصة' : 'غير مخصصة'}`} · <span className="num">{fmt(areaOf(p))}</span> م²</b>
        <small>{p.code}{p.card ? <span className="sx-badge">بطاقة القطعة</span> : null}</small></span>
      <span className="sx-rp"><b className="num">{fmt(p.paid)}</b><small>المطلوب دفعه · ج.م</small></span>
    </Link>
  );
}
