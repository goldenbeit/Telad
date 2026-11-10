'use client';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SVC } from '@/lib/solutions';

/* ---------- constants & helpers ---------- */
const STAGE_TXT = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
const PAY_TXT = { check: 'شيك التقنين', waiver: 'التنازل', comp: 'الاستكمال', inst: 'الأقساط' };
const statusOf = (x) => (x.allocated === false ? `غير مخصصة · ${x.on_list ? 'على الكشف' : 'مش على الكشف'} · الشيك ${x.check_paid ? 'مدفوع' : 'مش مدفوع'}` : STAGE_TXT[x.stage] || 'مخصصة');
// Supabase returns at most 1000 rows per request: read an admin list in pages of 1000.
async function rpcAll(fn) {
  const PAGE = 1000, data = [];
  for (let from = 0; ; from += PAGE) {
    const r = await supabase.rpc(fn).range(from, from + PAGE - 1);
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || [])); if (!r.data || r.data.length < PAGE) return { data, error: null };
  }
}
const ZONES = { 'القادسية': [8, 9, 10, 12, 17, 20, 22, 23], 'الأمل': [28, 29, 30, 31, 32, 33, 35, 36] };
const FACADES = ['بحري', 'قبلي', 'شرقي', 'غربي', 'ناصية'];
const VIEWS = ['شارع رئيسي', 'حديقة', 'خدمات', 'داخلي'];
const STATE = { pending: 'مستني موافقة', approved: 'منشور', rejected: 'مرفوض', sold: 'اتباع', hidden: 'مخفي' };
const REQ_STATE = { new: 'جديد', contacted: 'اتكلمنا', closed: 'اتقفل' };
const TABS = [['pending', 'مستنية موافقتك'], ['approved', 'منشورة'], ['closed', 'مرفوضة ومتباعة'], ['requests', 'طلبات القطع'], ['solutions', 'طلبات الحلول']];
const tabOf = (x) => (x.state === 'pending' ? 'pending' : x.state === 'approved' ? 'approved' : 'closed');
const money = (n) => Math.round(Number(n || 0)).toLocaleString('en');
const when = (d) => (d ? new Date(d).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const toEn = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const num = (v) => { const s = toEn(v).replace(/[,\s]/g, ''); return s === '' || isNaN(Number(s)) ? null : Number(s); };
const area = (x) => (x.area_final != null ? Number(x.area_final) : x.area_orig != null ? Number(x.area_orig) : null);
// Admins sign in with their mobile number, stored in Supabase as 01xxxxxxxxx@admin.telad.app.
const ADMIN_DOMAIN = 'admin.telad.app';
const normPhone = (v) => { const d = toEn(v).replace(/\D/g, ''); return d.startsWith('20') && d.length === 12 ? '0' + d.slice(2) : d; };
const phoneOf = (email) => ((email || '').endsWith('@' + ADMIN_DOMAIN) ? email.split('@')[0] : email);

const Ico = {
  logo: <svg viewBox="0 0 210 200" aria-hidden="true"><defs><clipPath id="tlc"><rect x="0" y="0" width="210" height="196" /></clipPath></defs><g clipPath="url(#tlc)" fill="none" stroke="currentColor" strokeWidth="15"><path d="M12 212 L138 64 A42 42 0 0 1 192 102 L192 212" /><path d="M60 212 L158 97" /><path d="M108 212 L172 137" /></g><g fill="currentColor"><path d="M118 36 L130 22 H158 L146 36 Z" /><path d="M162 36 L174 22 H202 L190 36 Z" /></g></svg>,
  refresh: <svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>,
  out: <svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>,
  search: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>,
  copy: <svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  phone: <svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>,
  wa: <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>,
  edit: <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>,
  trash: <svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  chev: <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>,
  x: <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

function useToast() {
  const [t, setT] = useState('');
  useEffect(() => { if (!t) return undefined; const id = setTimeout(() => setT(''), 2200); return () => clearTimeout(id); }, [t]);
  return [t, setT];
}
function copyText(text, toast) {
  try { navigator.clipboard.writeText(text).then(() => toast('اتنسخ ' + text), () => toast('مقدرناش ننسخ. الكود: ' + text)); }
  catch (e) { toast('الكود: ' + text); }
}
function Contact({ phone, label }) {
  if (!phone) return null;
  return (
    <div className="ad-contact">
      {label && <span className="ad-contact-l">{label}</span>}
      <span className="num ad-contact-n">{phone}</span>
      <a className="ad-ic" href={`tel:${phone}`} aria-label={`اتصل بـ ${phone}`}>{Ico.phone}</a>
      <a className="ad-ic wa" href={`https://wa.me/2${phone}`} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${phone}`}>{Ico.wa}</a>
    </div>
  );
}

// The unit photo (public bucket) and the allocation letter (private bucket, opened with a short-lived signed link).
function Files({ x }) {
  const [letter, setLetter] = useState('');
  const [err, setErr] = useState('');
  const photo = x.photo_path ? supabase.storage.from('listing-photos').getPublicUrl(x.photo_path).data.publicUrl : '';
  async function openLetter() {
    setErr('');
    const { data, error } = await supabase.storage.from('allocation-letters').createSignedUrl(x.letter_path, 600);
    if (error || !data) { setErr('مقدرناش نفتح الصورة.'); return; }
    setLetter(data.signedUrl);
  }
  return (
    <div className="ad-files">
      {photo && <a href={photo} target="_blank" rel="noopener noreferrer" className="ad-thumb"><img src={photo} alt="صورة القطعة" loading="lazy" /><span>صورة القطعة</span></a>}
      {x.letter_path && (letter
        ? <a href={letter} target="_blank" rel="noopener noreferrer" className="ad-thumb"><img src={letter} alt="جواب التخصيص" /><span>جواب التخصيص</span></a>
        : <button className="ad-btn sm ghost" onClick={openLetter}>اعرض جواب التخصيص</button>)}
      {err && <span className="ad-when">{err}</span>}
    </div>
  );
}

/* ---------- main ---------- */
export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(undefined);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [svcReqs, setSvcReqs] = useState([]);
  const [tab, setTab] = useState('pending');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, r, s] = await Promise.all([rpcAll('admin_listings'), rpcAll('admin_requests'), rpcAll('admin_service_requests')]);
    setLoading(false);
    if (l.error || r.error || s.error) { setToast('مقدرناش نحمّل البيانات. حدّث الصفحة.'); return; }
    setListings(l.data); setRequests(r.data); setSvcReqs(s.data);
  }, [setToast]);

  useEffect(() => {
    if (!session) { setIsAdmin(session === null ? false : undefined); return; }
    supabase.rpc('is_admin').then(({ data }) => { setIsAdmin(!!data); if (data) load(); });
  }, [session, load]);

  const counts = useMemo(() => ({
    pending: listings.filter((x) => x.state === 'pending').length,
    approved: listings.filter((x) => x.state === 'approved').length,
    closed: listings.filter((x) => tabOf(x) === 'closed').length,
    requests: requests.filter((r) => r.state === 'new').length,
    solutions: svcReqs.filter((r) => r.state === 'new').length,
  }), [listings, requests, svcReqs]);

  const term = toEn(q).trim().toLowerCase();
  const match = (fields) => !term || fields.some((f) => String(f ?? '').toLowerCase().includes(term));
  const shownListings = listings.filter((x) => tabOf(x) === tab && match([x.code, x.id, x.district, x.owner_name, x.phone, x.zone]));
  const shownRequests = requests.filter((r) => match([r.name, r.phone, r.code, r.l_district, r.district, r.zone]));
  const shownSvc = svcReqs.filter((r) => match([r.name, r.phone, SVC[r.service]?.n, 'T-' + r.id, ...Object.values(r.answers || {})]));

  async function setState(x, state) {
    setBusy(x.id);
    const { data, error } = await supabase.rpc('admin_set_state', { p_id: x.id, p_state: state });
    setBusy(null);
    if (error) return setToast('محصلش. جرب تاني.');
    setToast(state === 'approved' ? `اتنشرت ${data || ''}` : `بقت "${STATE[state]}"`);
    load();
  }
  async function setReq(id, state) {
    const { error } = await supabase.rpc('admin_set_request_state', { p_id: id, p_state: state });
    if (error) return setToast('محصلش. جرب تاني.');
    load();
  }
  async function setSvc(id, state) {
    const { error } = await supabase.rpc('admin_set_service_request_state', { p_id: id, p_state: state });
    if (error) return setToast('محصلش. جرب تاني.');
    load();
  }
  async function remove(x) {
    setBusy(x.id);
    const { error } = await supabase.rpc('admin_delete_listing', { p_id: x.id });
    setBusy(null); setConfirmDel(null);
    if (error) return setToast('مقدرناش نحذفها. جرب تاني.');
    setToast(`اتحذفت ${x.code || '#' + x.id}`); setOpen(null); load();
  }
  function goToListing(id) {
    const x = listings.find((l) => l.id === id); if (!x) return;
    setQ(''); setTab(tabOf(x)); setOpen(id);
    setTimeout(() => document.getElementById('l-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  if (session === undefined || (session && isAdmin === undefined)) return <main className="ad"><p className="ad-empty">بنحمّل...</p></main>;
  if (!session) return <Login />;
  if (!isAdmin) {
    return (
      <main className="ad"><header className="ad-head login"><div className="ad-bar"><span className="ad-brand">{Ico.logo}<b>تِلاد</b></span></div><p>لوحة الإدارة</p></header><div className="ad-login">
        <b>الحساب ده (<span className="num">{phoneOf(session.user.email)}</span>) مش مسجّل كأدمن.</b>
        <button className="ad-btn" onClick={() => supabase.auth.signOut()}>خروج</button>
      </div></main>
    );
  }

  return (
    <main className="ad">
      <header className="ad-head">
        <div className="ad-bar">
          <span className="ad-brand">{Ico.logo}<b>لوحة الإدارة</b></span>
          <button className={`ad-ic dark${loading ? ' spin' : ''}`} onClick={load} aria-label="تحديث">{Ico.refresh}</button>
          <button className="ad-ic dark" onClick={() => supabase.auth.signOut()} aria-label="خروج">{Ico.out}</button>
        </div>
        <div className="ad-stats">
          {[['pending', 'مستنية موافقتك'], ['approved', 'منشورة'], ['requests', 'طلبات جديدة']].map(([k, t]) => (
            <button key={k} className={`ad-stat${tab === k ? ' on' : ''}`} onClick={() => { setTab(k); setOpen(null); }}>
              <b className="num">{counts[k]}</b><span>{t}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="ad-sticky">
        <div className="ad-tabs" role="tablist">
          {TABS.map(([k, t]) => (
            <button key={k} role="tab" aria-pressed={tab === k} onClick={() => { setTab(k); setOpen(null); }}>
              {t}{counts[k] > 0 && <small className="num">{counts[k]}</small>}
            </button>
          ))}
        </div>
        <label className="ad-search">
          {Ico.search}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالكود أو الحي أو الاسم أو التليفون" inputMode="search" />
          {q && <button onClick={() => setQ('')} aria-label="امسح البحث">{Ico.x}</button>}
        </label>
      </div>

      <section className="ad-list">
        {tab === 'solutions' && (shownSvc.length === 0
          ? <p className="ad-empty">{q ? 'مفيش نتايج للبحث ده.' : 'مفيش طلبات حلول لسه.'}</p>
          : shownSvc.map((r) => (
            <article key={r.id} className={`ad-card req${r.state === 'new' ? '' : ' done'}`}>
              <div className="ad-req-h">
                <b>{SVC[r.service]?.n || r.service}</b>
                <span className="num ad-when">T-{r.id}</span>
                <span className={`ad-pill ${r.state === 'new' ? 'pending' : 'approved'}`}>{REQ_STATE[r.state]}</span>
              </div>
              <Contact phone={r.phone} label={r.name} />
              <dl className="ad-kv">
                {Object.entries(r.answers || {}).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
                <dt>التواصل</dt><dd>{r.channel}{r.contact_time ? ' · ' + r.contact_time : ''}</dd>
              </dl>
              <div className="ad-req-f">
                <span className="ad-when">{when(r.created_at)}</span>
                {r.state !== 'contacted' && <button className="ad-btn sm ok" onClick={() => setSvc(r.id, 'contacted')}>اتكلمنا</button>}
                {r.state !== 'closed' && <button className="ad-btn sm" onClick={() => setSvc(r.id, 'closed')}>اتقفل</button>}
                {r.state !== 'new' && <button className="ad-btn sm ghost" onClick={() => setSvc(r.id, 'new')}>رجّعه جديد</button>}
              </div>
            </article>
          )))}

        {tab !== 'requests' && tab !== 'solutions' && (shownListings.length === 0
          ? <p className="ad-empty">{q ? 'مفيش نتايج للبحث ده.' : 'مفيش إعلانات هنا.'}</p>
          : shownListings.map((x) => {
            const isOpen = open === x.id;
            return (
              <article key={x.id} id={'l-' + x.id} className={`ad-card${isOpen ? ' open' : ''}`}>
                <button className="ad-sum" onClick={() => setOpen(isOpen ? null : x.id)} aria-expanded={isOpen}>
                  {x.district != null ? <span className="ad-dist"><small>الحي</small><b className="num">{x.district}</b></span> : <span className="ad-dist ua"><small>غير</small><b>مخصصة</b></span>}
                  <span className="ad-sum-m">
                    <span className="ad-sum-t"><span className="num">{money(x.price)}</span> <small>ج.م</small></span>
                    <span className="ad-sum-s">{x.zone} · {area(x) != null ? <><span className="num">{area(x)}</span> م²</> : '—'} · {x.owner_name}</span>
                  </span>
                  <span className={`ad-pill ${x.state}`}>{STATE[x.state]}</span>
                  <span className="ad-chev">{Ico.chev}</span>
                </button>
                {isOpen && (
                  <div className="ad-body">
                    <div className="ad-row">
                      {x.code && <button className="ad-code" onClick={() => copyText(x.code, setToast)}><span className="num">{x.code}</span>{Ico.copy}</button>}
                      <span className="ad-when">اتبعت {when(x.created_at)}</span>
                    </div>
                    <Contact phone={x.phone} label={x.owner_name} />
                    {(x.photo_path || x.letter_path) && <Files x={x} />}
                    <dl className="ad-kv">
                      <dt>الحالة</dt><dd>{statusOf(x)}</dd>
                      <dt>السعر الكلي</dt><dd className="num">{money(x.price)} ج.م</dd>
                      <dt>المطلوب دفعه (للبائع)</dt><dd className="num">{money(x.paid)} ج.م</dd>
                      <dt>المتبقي</dt><dd className="num r">{money(x.remaining)} ج.م</dd>
                      <dt>الأقساط</dt><dd className="num">{x.inst_left ?? '—'}</dd>
                      {(x.pay?.items || []).map((i) => <Fragment key={i.k}><dt>· {PAY_TXT[i.k] || i.k}</dt><dd className="num">{i.amt != null ? money(i.amt) + ' ج.م' : '—'}</dd></Fragment>)}
                      <dt>أصل المساحة</dt><dd>{x.area_orig != null ? <><span className="num">{Number(x.area_orig)}</span> م²</> : '—'}</dd>
                      <dt>بعد التقنين</dt><dd>{x.area_final != null ? <><span className="num">{Number(x.area_final)}</span> م²</> : '—'}</dd>
                      <dt>المجاورة / البلوك / القطعة</dt><dd className="num">{x.neighborhood || '—'} / {x.block || '—'} / {x.plot_number || '—'}</dd>
                      <dt>الخدمات</dt><dd>{[x.view_type, x.facade && 'واجهة ' + x.facade].filter(Boolean).join(' · ') || '—'}</dd>
                      {x.description && <><dt>الوصف</dt><dd>{x.description}</dd></>}
                      {Number(x.request_count) > 0 && <><dt>طلبات عليها</dt><dd className="num">{x.request_count}</dd></>}
                    </dl>
                    <div className="ad-acts">
                      {x.state === 'pending' && <>
                        <button className="ad-btn ok" disabled={busy === x.id} onClick={() => setState(x, 'approved')}>وافق وانشر</button>
                        <button className="ad-btn" disabled={busy === x.id} onClick={() => setState(x, 'rejected')}>ارفض</button>
                      </>}
                      {x.state === 'approved' && <>
                        <button className="ad-btn" disabled={busy === x.id} onClick={() => setState(x, 'sold')}>اتباعت</button>
                        <button className="ad-btn" disabled={busy === x.id} onClick={() => setState(x, 'hidden')}>إخفاء</button>
                      </>}
                      {tabOf(x) === 'closed' && <button className="ad-btn ok" disabled={busy === x.id} onClick={() => setState(x, 'approved')}>انشرها تاني</button>}
                      <button className="ad-btn ghost" onClick={() => setEdit(x)}>{Ico.edit}تعديل</button>
                      <button className="ad-btn danger" onClick={() => setConfirmDel(x.id)}>{Ico.trash}حذف</button>
                    </div>
                    {confirmDel === x.id && (
                      <div className="ad-confirm" role="alert">
                        <span>حذف <b className="num">{x.code || '#' + x.id}</b> نهائياً؟ مش هينفع ترجّعه.</span>
                        <button className="ad-btn danger" disabled={busy === x.id} onClick={() => remove(x)}>احذف</button>
                        <button className="ad-btn" onClick={() => setConfirmDel(null)}>إلغاء</button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          }))}

        {tab === 'requests' && (shownRequests.length === 0
          ? <p className="ad-empty">{q ? 'مفيش نتايج للبحث ده.' : 'مفيش طلبات لسه.'}</p>
          : shownRequests.map((r) => (
            <article key={r.id} className={`ad-card req${r.state === 'new' ? '' : ' done'}`}>
              <div className="ad-req-h">
                <b>{r.name}</b>
                <span className={`ad-pill ${r.state === 'new' ? 'pending' : 'approved'}`}>{REQ_STATE[r.state]}</span>
              </div>
              <Contact phone={r.phone} />
              {r.kind === 'unit' ? (
                <div className="ad-req-u">
                  <span>طالب</span>
                  {r.listing_id ? <button className="ad-code" onClick={() => goToListing(r.listing_id)}><span className="num">{r.code || '#' + r.listing_id}</span></button> : <span>قطعة اتحذفت</span>}
                  {r.l_district && <span>الحي <b className="num">{r.l_district}</b>{r.l_area ? <> · <span className="num">{Number(r.l_area)}</span> م²</> : ''} · <span className="num">{money(r.l_price)}</span> ج.م</span>}
                </div>
              ) : (
                <div className="ad-req-u"><span>بيدوّر على قطعة</span><span>{[r.zone, r.district ? `الحي ${r.district}` : ''].filter(Boolean).join(' · ') || '—'}</span>{r.budget ? <span>ميزانية <b className="num">{money(r.budget)}</b></span> : null}</div>
              )}
              {r.kind === 'unit' && r.owner_phone && <Contact phone={r.owner_phone} label={'صاحب القطعة: ' + (r.owner_name || '')} />}
              <div className="ad-req-f">
                <span className="ad-when">{when(r.created_at)}</span>
                {r.state !== 'contacted' && <button className="ad-btn sm ok" onClick={() => setReq(r.id, 'contacted')}>اتكلمنا</button>}
                {r.state !== 'closed' && <button className="ad-btn sm" onClick={() => setReq(r.id, 'closed')}>اتقفل</button>}
                {r.state !== 'new' && <button className="ad-btn sm ghost" onClick={() => setReq(r.id, 'new')}>رجّعه جديد</button>}
              </div>
            </article>
          )))}
      </section>

      {edit && <EditSheet x={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setToast('اتحفظت التعديلات'); load(); }} />}
      {toast && <div className="ad-toast" role="status"><span>{toast}</span></div>}
    </main>
  );
}

/* ---------- edit sheet ---------- */
function EditSheet({ x, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    zone: x.zone, district: x.district ?? '', neighborhood: x.neighborhood ?? '', block: x.block ?? '', plot_number: x.plot_number ?? '',
    area_orig: x.area_orig != null ? String(Number(x.area_orig)) : '', area_final: x.area_final != null ? String(Number(x.area_final)) : '',
    facade: x.facade ?? '', view_type: x.view_type ?? '', price: String(Number(x.price)), paid: String(Number(x.paid)),
    inst_left: x.inst_left ?? '', description: x.description ?? '', name: x.owner_name ?? '', phone: x.phone ?? '',
  }));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }));
  const rem = num(f.price) != null && num(f.paid) != null ? num(f.price) - num(f.paid) : null;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  async function save() {
    const price = num(f.price), paid = num(f.paid), ao = num(f.area_orig), af = num(f.area_final), phone = normPhone(f.phone);
    if (f.district !== '' && !ZONES[f.zone].includes(Number(f.district))) return setErr('اختار حي من أحياء ' + f.zone + '.');
    if (!(ao > 0) && !(af > 0)) return setErr('اكتب المساحة: أصل المساحة أو بعد التقنين.');
    if (!(price > 0)) return setErr('اكتب السعر الكلي.');
    if (paid == null || paid < 0) return setErr('اكتب المطلوب دفعه.');
    if (paid > price) return setErr('المطلوب دفعه أكبر من السعر الكلي.');
    if (f.name.trim().length < 2) return setErr('اكتب اسم صاحب القطعة.');
    if (!/^01[0125]\d{8}$/.test(phone)) return setErr('رقم صاحب القطعة مش صح.');
    setSaving(true); setErr('');
    const p = { ...f, district: f.district === '' ? '' : Number(f.district), inst_left: f.inst_left === '' ? '' : Number(f.inst_left), price, paid, area_orig: ao, area_final: af, phone, name: f.name.trim() };
    const { error } = await supabase.rpc('admin_update_listing', { p_id: x.id, p });
    setSaving(false);
    if (error) return setErr('مقدرناش نحفظ. راجع البيانات وجرب تاني.');
    onSaved();
  }

  return (
    <div className="ad-sheet" role="dialog" aria-modal="true" aria-label="تعديل الإعلان">
      <div className="ad-scrim" onClick={onClose} />
      <div className="ad-panel">
        <div className="ad-panel-h"><b>تعديل {x.code || '#' + x.id}</b><button className="ad-ic" onClick={onClose} aria-label="قفل">{Ico.x}</button></div>
        <div className="ad-panel-b">
          <div className="ad-seg">{Object.keys(ZONES).map((z) => <button key={z} aria-pressed={f.zone === z} onClick={() => setF((o) => ({ ...o, zone: z, district: o.zone === z || o.district === '' ? o.district : ZONES[z][0] }))}>{z}</button>)}</div>
          <div className="ad-dgrid"><button aria-pressed={f.district === ''} onClick={() => setF((o) => ({ ...o, district: '' }))}>غير مخصصة</button>{ZONES[f.zone].map((n) => <button key={n} className="num" aria-pressed={Number(f.district) === n} onClick={() => setF((o) => ({ ...o, district: n }))}>{n}</button>)}</div>
          <div className="ad-two">
            <label className="ad-f"><span>السعر الكلي</span><input className="num" inputMode="numeric" value={f.price} onChange={set('price')} /></label>
            <label className="ad-f"><span>المطلوب دفعه (للبائع)</span><input className="num" inputMode="numeric" value={f.paid} onChange={set('paid')} /></label>
          </div>
          <div className="ad-two">
            <div className="ad-f"><span>المتبقي (تلقائي)</span><div className={`ad-auto${rem != null && rem < 0 ? ' bad' : ''}`}><span className="num">{rem == null ? '—' : money(rem)}</span></div></div>
            <label className="ad-f"><span>الأقساط المتبقية</span><select value={f.inst_left} onChange={set('inst_left')}>{x.inst_left == null && <option value="">مش معروف</option>}{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          </div>
          <div className="ad-two">
            <label className="ad-f"><span>أصل المساحة (م²)</span><input className="num" inputMode="decimal" value={f.area_orig} onChange={set('area_orig')} /></label>
            <label className="ad-f"><span>بعد التقنين (م²)</span><input className="num" inputMode="decimal" value={f.area_final} onChange={set('area_final')} /></label>
          </div>
          <div className="ad-three">
            <label className="ad-f"><span>المجاورة</span><select value={f.neighborhood} onChange={set('neighborhood')}><option value="">—</option>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
            <label className="ad-f"><span>البلوك</span><input value={f.block} onChange={set('block')} /></label>
            <label className="ad-f"><span>رقم القطعة</span><input value={f.plot_number} onChange={set('plot_number')} /></label>
          </div>
          <div className="ad-f"><span>الواجهة</span><div className="ad-chips">{FACADES.map((v) => <button key={v} aria-pressed={f.facade === v} onClick={() => setF((o) => ({ ...o, facade: o.facade === v ? '' : v }))}>{v}</button>)}</div></div>
          <div className="ad-f"><span>القطعة قدامها</span><div className="ad-chips">{VIEWS.map((v) => <button key={v} aria-pressed={f.view_type === v} onClick={() => setF((o) => ({ ...o, view_type: o.view_type === v ? '' : v }))}>{v}</button>)}</div></div>
          <div className="ad-two">
            <label className="ad-f"><span>اسم صاحب القطعة</span><input value={f.name} onChange={set('name')} /></label>
            <label className="ad-f"><span>تليفونه</span><input className="num" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} /></label>
          </div>
          <label className="ad-f"><span>الوصف</span><textarea value={f.description} onChange={set('description')} maxLength={1000} /></label>
          {err && <p className="ad-err" role="alert">{err}</p>}
        </div>
        <div className="ad-panel-f">
          <button className="ad-btn ghost" onClick={onClose}>إلغاء</button>
          <button className="ad-btn ok" disabled={saving} onClick={save}>{saving ? 'بيتحفظ...' : 'احفظ التعديلات'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- login ---------- */
function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const p = normPhone(phone);
    if (!/^01[0125]\d{8}$/.test(p)) { setErr('اكتب رقم موبايل مصري صح، زي 01012345678.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: `${p}@${ADMIN_DOMAIN}`, password });
    setBusy(false);
    if (error) setErr('الرقم أو الباسورد مش صح.');
  }
  return (
    <main className="ad">
      <header className="ad-head login"><div className="ad-bar"><span className="ad-brand">{Ico.logo}<b>تِلاد</b></span></div><p>لوحة الإدارة</p></header>
      <form className="ad-login" onSubmit={submit}>
        <b>دخول الإدارة</b>
        <label className="ad-f"><span>رقم الموبايل</span><input className="num" type="tel" inputMode="tel" autoComplete="username" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
        <label className="ad-f"><span>الباسورد</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="ad-err">{err}</p>}
        <button className="ad-btn ok" disabled={busy}>{busy ? 'استنى...' : 'دخول'}</button>
      </form>
    </main>
  );
}
