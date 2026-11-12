import { redirect } from 'next/navigation';

// Everything lives in the one dashboard now.
export default function DeskPage() {
  redirect('/admin');
}
