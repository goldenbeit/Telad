'use client';
// صفحات SEO (25/11): أي دوسة على لينك واتساب عليه data-wl بتتسجّل في تبويب "واتساب" في الداشبورد.
import { useEffect } from 'react';
import { waFromLink } from '@/lib/wa-log';
export default function WaTrack() {
  useEffect(() => {
    const h = (e) => { const a = e.target.closest && e.target.closest('a[data-wl]'); if (a) waFromLink(a); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);
  return null;
}
