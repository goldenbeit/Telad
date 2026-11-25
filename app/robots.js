// robots.txt (25/11): search engines and AI assistants are welcome everywhere except the team dashboard.
import { SITE } from '@/lib/public-data';

export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/desk'] }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}
