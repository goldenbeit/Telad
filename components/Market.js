'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// The page shell; lib/market-ui.js fills #app, #dock, #stack and #toast and handles every interaction.
let mounted = false;

export default function Market() {
  useEffect(() => {
    if (mounted) return;
    mounted = true;
    import('@/lib/market-ui').then((m) => m.mount(supabase));
  }, []);
  return (
    <>
      <div className="app" id="app" />
      <div className="dock" id="dock"><div /></div>
      <div className="stack" id="stack"><div className="scrim" data-a="scrim" /></div>
      <div className="toast" id="toast" hidden><span /></div>
    </>
  );
}
