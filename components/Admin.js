'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const money = (n) => (Math.round(Number(n || 0) * 10) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
const when = (d) => (d ? new Date(d).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const STATE = { pending: 'مستني موافقة', approved: 'منشور', rejected: 'مرفوض', sold: 'اتباع', hidden: 'مخفي' };
const REQ_STATE = { new: 'جديد', contacted: 'اتكلمنا', closed: 'اتقفل' };
const TABS = [
  ['pending', 'مستنية موافقتك'],
  ['approved', 'منشورة'],
  ['closed', 'مرفوضة ومتباعة'],
  ['requests', 'الطلبات'],
];
const tabOf = (x) => (x.state === 'pending' ? 'pending' : x.state === 'approved' ? 'approved' : 'closed');

function Phone({ value }) {
  if (!value) return <span>—</span>;
  return (
    <span className="adm-phone">
      <a className="num" href={`tel:${value}`}>{value}</a>
      <a href={`https://wa.me/2${value}`} target="_blank" rel="noopener noreferrer">واتساب</a>
    </span>
  );
}

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(undefined);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('pending');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([supabase.rpc('admin_listings'), supabase.rpc('admin_requests')]);
    if (l.error || r.error) { setMsg('مقدرناش نحمّل البيانات. حدّث الصفحة.'); return; }
    setListings(l.data); setRequests(r.data); setMsg('');
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(session === null ? false : undefined); return; }
    supabase.rpc('is_admin').then(({ data }) => { setIsAdmin(!!data); if (data) load(); });
  }, [session, load]);

  async function setState(id, state) {
    setBusy(id);
    const { data, error } = await supabase.rpc('admin_set_state', { p_id: id, p_state: state });
    setBusy(null);
    if (error) return setMsg('محصلش. جرب تاني.');
    setMsg(state === 'approved' ? `اتنشر بالكود ${data}` : `اتغيّرت الحالة لـ "${STATE[state]}"`);
    load();
  }
  async function setReq(id, state) {
    const { error } = await supabase.rpc('admin_set_request_state', { p_id: id, p_state: state });
    if (error) return setMsg('محصلش. جرب تاني.');
    load();
  }

  if (session === undefined || (session && isAdmin === undefined)) return <main className="adm"><p className="adm-state">بنحمّل...</p></main>;
  if (!session) return <Login />;
  if (!isAdmin) {
    return (
      <main className="adm">
        <div className="adm-state">
          <b>الحساب ده ({session.user.email}) مش مسجّل كأدمن.</b>
          <span>لازم يتضاف لجدول admins في Supabase.</span>
          <button className="pb" onClick={() => supabase.auth.signOut()}>خروج</button>
        </div>
      </main>
    );
  }

  const counts = {
    pending: listings.filter((x) => x.state === 'pending').length,
    approved: listings.filter((x) => x.state === 'approved').length,
    closed: listings.filter((x) => tabOf(x) === 'closed').length,
    requests: requests.filter((r) => r.state === 'new').length,
  };
  const shown = listings.filter((x) => tabOf(x) === tab);

  return (
    <main className="adm">
      <header className="adm-h">
        <b>لوحة الإدارة · تِلاد</b>
        <a className="pb sm" href="/">الموقع</a>
        <button className="pb sm" onClick={load}>تحديث</button>
        <button className="pb sm" onClick={() => supabase.auth.signOut()}>خروج</button>
      </header>
      <div className="adm-tabs" role="tablist">
        {TABS.map(([k, t]) => (
          <button key={k} role="tab" className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t}{counts[k] > 0 && <span className="num"> ({counts[k]})</span>}
          </button>
        ))}
      </div>
      {msg && <p className="adm-msg" role="status">{msg}</p>}

      {tab !== 'requests' && (shown.length === 0 ? <p className="adm-state">مفيش إعلانات هنا.</p> : (
        <div className="adm-list">
          {shown.map((x) => (
            <article key={x.id} className="adm-card">
              <div className="adm-top">
                <b>{x.zone} · الحي {x.district}{x.neighborhood ? ` · المجاورة ${x.neighborhood}` : ''}</b>
                <span className="num">{x.code || `#${x.id}`}</span>
                <span className={`adm-st ${x.state}`}>{STATE[x.state]}</span>
              </div>
              <dl className="adm-kv">
                <dt>صاحب الإعلان</dt><dd>{x.owner_name}</dd>
                <dt>التليفون</dt><dd><Phone value={x.phone} /></dd>
                <dt>البلوك / القطعة</dt><dd className="num">{x.block || '—'} / {x.plot_number || '—'}</dd>
                <dt>المساحة</dt><dd><span className="num">{Number(x.area_orig)}</span> ← <span className="num">{Number(x.area_final)}</span> م²</dd>
                <dt>السعر الكلي</dt><dd className="num">{money(x.price)} ج.م</dd>
                <dt>المطلوب دفعه</dt><dd className="num">{money(x.paid)} ج.م (منه أوفر {money(x.over_amount)})</dd>
                <dt>المتبقي</dt><dd className="num">{money(x.remaining)} ج.م · {x.inst_left} أقساط</dd>
                <dt>الخدمات</dt><dd>{[x.facade, x.view_type].filter(Boolean).join(' · ') || '—'}</dd>
                {x.description && (<><dt>الوصف</dt><dd>{x.description}</dd></>)}
                <dt>اتبعت</dt><dd>{when(x.created_at)}</dd>
                {Number(x.request_count) > 0 && (<><dt>طلبات عليها</dt><dd className="num">{x.request_count}</dd></>)}
              </dl>
              <div className="adm-acts">
                {x.state === 'pending' && (<>
                  <button className="pb sm ink" disabled={busy === x.id} onClick={() => setState(x.id, 'approved')}>وافق وانشر</button>
                  <button className="pb sm" disabled={busy === x.id} onClick={() => setState(x.id, 'rejected')}>ارفض</button>
                </>)}
                {x.state === 'approved' && (<>
                  <button className="pb sm" disabled={busy === x.id} onClick={() => setState(x.id, 'sold')}>اتباعت</button>
                  <button className="pb sm" disabled={busy === x.id} onClick={() => setState(x.id, 'hidden')}>إخفاء</button>
                </>)}
                {tabOf(x) === 'closed' && (
                  <button className="pb sm ink" disabled={busy === x.id} onClick={() => setState(x.id, 'approved')}>إعادة نشر</button>
                )}
              </div>
            </article>
          ))}
        </div>
      ))}

      {tab === 'requests' && (requests.length === 0 ? <p className="adm-state">مفيش طلبات لسه.</p> : (
        <div className="adm-list">
          {requests.map((r) => (
            <article key={r.id} className={`adm-card${r.state === 'new' ? '' : ' done'}`}>
              <div className="adm-top">
                <b>{r.name}</b>
                <span>{r.kind === 'unit' ? `طالب القطعة ${r.code || '#' + r.listing_id}` : 'بيدوّر على قطعة'}</span>
                <span className={`adm-st ${r.state === 'new' ? 'pending' : 'approved'}`}>{REQ_STATE[r.state]}</span>
              </div>
              <dl className="adm-kv">
                <dt>تليفونه</dt><dd><Phone value={r.phone} /></dd>
                {r.kind === 'unit' ? (<>
                  <dt>القطعة</dt><dd>الحي {r.l_district} · <span className="num">{Number(r.l_area)}</span> م² · <span className="num">{money(r.l_price)}</span> ج.م</dd>
                  <dt>صاحب القطعة</dt><dd>{r.owner_name} · <Phone value={r.owner_phone} /></dd>
                </>) : (<>
                  <dt>المكان</dt><dd>{[r.zone, r.district ? `الحي ${r.district}` : ''].filter(Boolean).join(' · ') || '—'}</dd>
                  <dt>الميزانية</dt><dd className="num">{r.budget ? `${money(r.budget)} ج.م` : '—'}</dd>
                </>)}
                <dt>وقت الطلب</dt><dd>{when(r.created_at)}</dd>
              </dl>
              <div className="adm-acts">
                {r.state !== 'contacted' && <button className="pb sm ink" onClick={() => setReq(r.id, 'contacted')}>اتكلمنا</button>}
                {r.state !== 'closed' && <button className="pb sm" onClick={() => setReq(r.id, 'closed')}>اتقفل</button>}
                {r.state !== 'new' && <button className="pb sm" onClick={() => setReq(r.id, 'new')}>رجّعه جديد</button>}
              </div>
            </article>
          ))}
        </div>
      ))}
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr('الإيميل أو الباسورد مش صح.');
  }
  return (
    <main className="adm">
      <form className="adm-login" onSubmit={submit}>
        <b>دخول الإدارة</b>
        <div className="field"><label htmlFor="ae">الإيميل</label><input id="ae" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="ap">الباسورد</label><input id="ap" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <p className="err">{err}</p>}
        <button className="pb ink" disabled={busy}>{busy ? 'استنى...' : 'دخول'}</button>
      </form>
    </main>
  );
}
