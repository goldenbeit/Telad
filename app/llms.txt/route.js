// llms.txt (25/11): a plain summary of the site for AI assistants, at /llms.txt. Linked from nowhere on the site.
// Only what the public site already says; the counts and areas come from the published plots and refresh every 5 minutes.
import { getPlots, ZONES, SITE, WA, fmt } from '@/lib/public-data';

export const revalidate = 300;

export async function GET() {
  const plots = await getPlots();
  const n = (z, d) => plots.filter((p) => p.zone === z.name && (d === undefined || (d ? p.alloc && p.district === d : !p.alloc))).length;
  const lines = [
    '# تِلاد (Telad)',
    '',
    '> منصة لعرض وبيع أراضي منطقتي القادسية والأمل في مدينة العبور الجديدة (مصر). كل قطعة معروضة بالسعر الكلي، والمطلوب دفعه للبائع، والمتبقي للجهاز. الشعار: "العقار قرارٌ لا صفقةٌ".',
    '> Telad is a marketplace for land plots in the Al-Qadisiya and Al-Amal areas of New Obour City, Egypt. Every plot shows its total price, the amount paid to the seller, and the amount still due to the city authority. All prices are in Egyptian pounds (EGP).',
    '',
    '## إزاي الأسعار معروضة',
    '- السعر الكلي = المطلوب دفعه + المتبقي.',
    '- المطلوب دفعه: اللي بيتدفع للبائع.',
    '- المتبقي: اللي بيتدفع لجهاز المدينة (أقساط واستكمال وشيك التقنين حسب حالة القطعة).',
    '- القطع مخصصة (ليها حي) أو غير مخصصة. والمخصصة بتتقسم: غير مستكملة، أو مستكملة غير مستلمة، أو مستلمة.',
    '- بعض القطع ليها "بطاقة القطعة" من مخطط مدينة العبور الجديدة: الواجهة، والمميزات، والأبعاد التقريبية، وخريطة صغيرة.',
    '- الأرقام من البائعين، والنهائي في التقنين يحدده جهاز المدينة.',
    '',
    `## القطع المنشورة دلوقتي (${plots.length} قطعة)`,
    ...ZONES.flatMap((z) => [
      `- [أراضي ${z.name}](${SITE}/${z.slug}): ${n(z)} قطعة`,
      ...z.districts.filter((d) => n(z, d)).map((d) => `  - [الحي ${d} · ${z.name}](${SITE}/${z.slug}/${d}): ${n(z, d)} قطعة`),
      ...(n(z, null) ? [`  - [غير مخصصة · ${z.name}](${SITE}/${z.slug}/unallocated): ${n(z, null)} قطعة`] : []),
    ]),
    '',
    plots.length ? `- كل قطعة ليها صفحة بالكود بتاعها، مثلًا ${SITE}/plot/${plots[0].code}` : '',
    `- كل الصفحات: ${SITE}/sitemap.xml`,
    plots.length ? `- المطلوب دفعه في القطع المنشورة من ${fmt(Math.min(...plots.map((p) => p.paid)))} لـ${fmt(Math.max(...plots.map((p) => p.paid)))} ج.م.` : '',
    '',
    '## التواصل',
    `- الموقع: ${SITE}`,
    `- واتساب: +${WA}`,
    '- المشتري يطلب أي قطعة من صفحتها ("اطلبها")، وفريق تِلاد بيكلّمه.',
    '- البائع يعرض قطعته من الموقع ("اعرض قطعتك")، وبتتراجع قبل ما تتنشر.',
    '',
    '## حلول تِلاد',
    '- الاستثمار العقاري، والتطوير العقاري، والشراكة العقارية، وإدارة الأصول، والتقييم العقاري، والاستشارات العقارية. يُطلب أيٌّ منها من الصفحة الرئيسية للموقع.',
    '',
  ].filter((l) => l !== null);
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
