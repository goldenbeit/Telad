'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DeskView, Login } from '@/components/Desk';

// /admin: everyone signs in here and lands on the desk (lib/desk-ui.js). The plots, offers, services and
// requests all live in the desk; the old listings dashboard was removed on 15/11.
const ADMIN_DOMAIN = 'admin.telad.app';
const phoneOf = (email) => ((email || '').endsWith('@' + ADMIN_DOMAIN) ? email.split('@')[0] : email);

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Who is signed in. The owner can act as any team member (test mode); desk_me says who they are acting as.
  const loadMe = useCallback(async () => {
    const [{ data: adm }, { data: m, error }] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('desk_me')]);
    if (adm) setMe(error || !m ? { owner: true, role: 'owner', name: 'الأدمن', id: null, can_act: true } : m);
    else setMe(error ? null : m || null);
  }, []);
  const uid = session ? session.user.id : session;
  useEffect(() => { if (uid) loadMe(); else setMe(uid === null ? null : undefined); }, [uid, loadMe]);

  if (session === undefined || (session && me === undefined)) return <main className="ad"><p className="ad-empty">بنحمّل...</p></main>;
  if (!session) return <Login />;
  if (me) return <DeskView me={me} onActAs={me.can_act ? loadMe : undefined} />;
  return (
    <main className="ad"><header className="ad-head login"><div className="ad-bar"><span className="ad-brand"><b>تِلاد</b></span></div><p>لوحة الإدارة</p></header><div className="ad-login">
      <b>الحساب ده (<span className="num">{phoneOf(session.user.email)}</span>) مش متسجل في الفريق، أو اتوقف.</b>
      <button className="ad-btn" onClick={() => supabase.auth.signOut()}>خروج</button>
    </div></main>
  );
}
