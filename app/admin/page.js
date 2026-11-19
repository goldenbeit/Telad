import Admin from '@/components/Admin';

// The dashboard can be added to the phone's home screen (it is then its own app, which iPhones need for notifications).
export const metadata = {
  title: 'لوحة الإدارة · تِلاد', robots: { index: false }, manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'تِلاد', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
};

export default function AdminPage() {
  return <Admin />;
}
