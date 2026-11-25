import Script from 'next/script';
import Market from '@/components/Market';

// Google Analytics 4 (25/11): on the public site only, never on /admin.
const GA = 'G-3HWDVQZTQB';

export default function Home() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
      <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA}');`}</Script>
      <Market />
    </>
  );
}
