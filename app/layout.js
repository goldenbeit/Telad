import { Noto_Kufi_Arabic, Readex_Pro } from 'next/font/google';
import './globals.css';

const display = Noto_Kufi_Arabic({ subsets: ['arabic'], weight: ['600', '800'], variable: '--font-display', display: 'swap' });
const body = Readex_Pro({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '600'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'تِلاد · أراضي القادسية والأمل',
  description: 'العقار قرارٌ لا صفقةٌ. أراضي القادسية والأمل في العبور الجديدة بالسعر الكلي والمطلوب دفعه والمتبقي.',
  openGraph: { title: 'تِلاد', description: 'أراضي القادسية والأمل في العبور الجديدة', locale: 'ar_EG' },
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FFFFFF' };

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
