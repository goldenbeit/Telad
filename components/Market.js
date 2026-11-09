'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// lib/market-ui.js builds the whole public page inside #telad-root and handles every interaction.
let mounted = false;

export default function Market() {
  useEffect(() => {
    if (mounted) return;
    mounted = true;
    import('@/lib/market-ui').then((m) => m.mount(supabase, document.getElementById('telad-root')));
  }, []);
  return <div id="telad-root" />;
}
