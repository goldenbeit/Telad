// sitemap.xml (25/11): the home page, the areas, the districts that have plots, and every published plot.
import { getPlots, ZONES, SITE, plotPath } from '@/lib/public-data';

export const revalidate = 300;

export default async function sitemap() {
  const plots = await getPlots(), now = new Date();
  const has = (z, d) => plots.some((p) => p.zone === z.name && (d ? p.alloc && p.district === d : !p.alloc));
  const out = [{ url: SITE + '/', lastModified: now, changeFrequency: 'daily', priority: 1 }];
  ZONES.forEach((z) => {
    out.push({ url: `${SITE}/${z.slug}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 });
    [...z.districts, null].forEach((d) => { if (has(z, d)) out.push({ url: `${SITE}/${z.slug}/${d || 'unallocated'}`, lastModified: now, changeFrequency: 'daily', priority: 0.7 }); });
  });
  plots.forEach((p) => out.push({ url: SITE + plotPath(p), lastModified: p.at ? new Date(p.at) : now, changeFrequency: 'weekly', priority: 0.6 }));
  return out;
}
