import Link from 'next/link';
import SeoShell from '@/components/SeoShell';

export const metadata = { title: 'مش موجودة | تِلاد', robots: { index: false } };

export default function NotFound() {
  return (
    <SeoShell>
      <h1 className="sx-h1">الصفحة دي مش موجودة</h1>
      <p className="sx-sub">لو كانت قطعة، فغالبًا اتباعت أو اتشالت من الموقع. شوف القطع المتاحة دلوقتي.</p>
      <div className="sx-cta"><Link className="sx-btn pri" href="/">كل القطع على تِلاد</Link><Link className="sx-btn" href="/qadisiya">القادسية</Link><Link className="sx-btn" href="/amal">الأمل</Link></div>
    </SeoShell>
  );
}
