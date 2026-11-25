import { Changa, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const display = Changa({ subsets: ['arabic', 'latin'], weight: ['500', '700', '800'], variable: '--font-display', display: 'swap' });
const body = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata = {
  metadataBase: new URL('https://www.telad-group.com'),
  title: 'تِلاد · أراضي القادسية والأمل في العبور الجديدة',
  description: 'العقار قرارٌ لا صفقةٌ. أراضي القادسية والأمل في العبور الجديدة بالسعر الكلي والمطلوب دفعه والمتبقي للجهاز، وبطاقة لكل قطعة من مخطط المدينة.',
  openGraph: { title: 'تِلاد · أراضي القادسية والأمل', description: 'أراضي القادسية والأمل في العبور الجديدة بالسعر الكلي والمطلوب دفعه والمتبقي.', locale: 'ar_EG', siteName: 'تِلاد', type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'تِلاد · العقار قرارٌ لا صفقةٌ' }] },
  twitter: { card: 'summary_large_image' },
};

// Pinch-zoom stays on (some in-app browsers block it unless it is stated).
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true, viewportFit: 'cover', themeColor: '#FFFFFF' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
