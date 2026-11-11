'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { mountDesk } from '@/lib/desk-ui';

// Team members sign in with their mobile number, stored in Supabase as 01xxxxxxxxx@admin.telad.app (same as the owner).
const DOMAIN = 'admin.telad.app';
const FN_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xvxwvkxashwizafetltl.supabase.co') + '/functions/v1/staff-activate';
const toEn = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const normPhone = (v) => { const d = toEn(v).replace(/\D/g, ''); return d.startsWith('20') && d.length === 12 ? '0' + d.slice(2) : d; };

export default function Desk() {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const host = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setMe(session === null ? null : undefined); return; }
    supabase.rpc('desk_me').then(({ data, error }) => setMe(error ? null : data || null));
  }, [session]);
  useEffect(() => {
    if (!me || !host.current) return undefined;
    return mountDesk(supabase, host.current, { ...me }, () => supabase.auth.signOut());
  }, [me]);

  if (session === undefined || (session && me === undefined)) return <main className="ad"><p className="ad-empty">بنحمّل...</p></main>;
  if (!session) return <Login />;
  if (!me) {
    return (
      <main className="ad"><header className="ad-head login"><div className="ad-bar"><span className="ad-brand"><b>تِلاد</b></span></div><p>طلبات المشترين</p></header>
        <div className="ad-login"><b>الحساب ده مش متسجل في الفريق، أو اتوقف.</b><button className="ad-btn" onClick={() => supabase.auth.signOut()}>خروج</button></div></main>
    );
  }
  return <div ref={host} />;
}

function Login() {
  const [mode, setMode] = useState('in');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const p = normPhone(phone);
    if (!/^01[0125]\d{8}$/.test(p)) { setErr('اكتب رقم موبايل مصري صح، زي 01012345678.'); return; }
    setErr('');
    if (mode === 'act') {
      const c = toEn(code).replace(/\D/g, '');
      if (c.length !== 6) { setErr('الكود 6 أرقام.'); return; }
      if (password.length < 8) { setErr('الباسورد لازم يكون 8 حروف أو أرقام على الأقل.'); return; }
      if (password !== password2) { setErr('الباسورد مش زي بعضه في الخانتين.'); return; }
      setBusy(true);
      let res = null;
      try { const r = await fetch(FN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: p, code: c, password }) }); res = await r.json(); } catch (x) { res = { error: 'net' }; }
      if (!res || !res.ok) {
        setBusy(false);
        setErr({ invalid: 'الرقم أو الكود مش صح، أو الكود خلص. اطلب كود جديد من الأدمن.', locked: 'الكود اتقفل بعد محاولات كتير غلط. اطلب كود جديد من الأدمن.', exists: 'الرقم ده عليه حساب قبل كده. ادخل من "دخول".', weak_password: 'الباسورد لازم يكون 8 حروف أو أرقام على الأقل.', net: 'مفيش اتصال. جرب تاني.' }[res && res.error] || 'محصلش. جرب تاني.');
        return;
      }
    } else setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: `${p}@${DOMAIN}`, password });
    setBusy(false);
    if (error) setErr('الرقم أو الباسورد مش صح.');
  }
  return (
    <main className="ad">
      <header className="ad-head login"><div className="ad-bar"><span className="ad-brand"><b>تِلاد</b></span></div><p>طلبات المشترين · الفريق</p></header>
      <form className="ad-login" onSubmit={submit}>
        <div className="ad-chips" role="tablist">
          <button type="button" aria-pressed={mode === 'in'} onClick={() => { setMode('in'); setErr(''); }}>دخول</button>
          <button type="button" aria-pressed={mode === 'act'} onClick={() => { setMode('act'); setErr(''); }}>تفعيل حساب جديد</button>
        </div>
        <label className="ad-f"><span>رقم الموبايل</span><input className="num" type="tel" inputMode="tel" autoComplete="username" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
        {mode === 'act' && <label className="ad-f"><span>كود التفعيل (من الأدمن)</span><input className="num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></label>}
        <label className="ad-f"><span>{mode === 'act' ? 'اختار باسورد' : 'الباسورد'}</span><input type="password" autoComplete={mode === 'act' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {mode === 'act' && <label className="ad-f"><span>اكتب الباسورد تاني</span><input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required /></label>}
        {err && <p className="ad-err" role="alert">{err}</p>}
        <button className="ad-btn ok" disabled={busy}>{busy ? 'استنى...' : mode === 'act' ? 'فعّل وادخل' : 'دخول'}</button>
      </form>
    </main>
  );
}
