// Team desk for buyer requests: inbox, stacked popups, mirror, reports, team tree and alerts.
// Vanilla UI mounted into a shadow root (styles in desk-css.js). All data goes through the desk_* RPCs.
import { DESK_CSS } from './desk-css';

const ROLES = { junior: 'جونيور', senior: 'سينيور', sup: 'مشرف', tl: 'تيم ليدر', sadmin: 'سيلز أدمن', web: 'ويب أدمن', gm: 'GM', owner: 'الأدمن' };
const SALES = ['junior', 'senior'];
const PARENT_ROLE = { junior: 'senior', senior: 'sup', sup: 'tl', tl: 'sadmin', sadmin: 'gm', web: 'gm', gm: null };
const M = 60000, H = 60 * M, D = 24 * H;
const MINS = [['30 د', 30], ['ساعة', 60], ['3 ساعات', 180], ['8 ساعات', 480], ['بكرة', 1440]];
const STAGE = { new: 'الإدارة', tl: 'التيم ليدر', sup: 'المشرف', sales: 'السيلز', up_sup: 'راجع للمشرف', up_tl: 'راجع للتيم ليدر', up_sa: 'راجع للسيلز أدمن', closed: 'اتقفل' };
const TRK = { new: 1, tl: 2, sup: 3, sales: 4, up_sup: 5, up_tl: 5, up_sa: 5, closed: 6 };
const STS = [['call_buyer', 'تواصلنا مع المشتري', 180], ['no_answer', 'المشتري مش بيرد', 180], ['confirmed', 'اتأكدنا من الطلب والميزانية', 480], ['call_seller', 'تواصلنا مع البائع', 480], ['available', 'البائع أكّد إن القطعة متاحة', 480], ['options', 'بعتنا اختيارات للمشتري', 1440], ['visit_set', 'اتحدد معاد معاينة', 1440], ['visited', 'المعاينة تمت', 1440], ['nego', 'بنتفاوض على السعر', 1440], ['deposit', 'اتدفع عربون', 2880], ['contract', 'اتمضى العقد', 2880], ['later', 'المشتري طلب نأجّل', 4320]];
const OUT = [['sold', 'اتباع'], ['deposit', 'اتدفع عربون'], ['follow', 'محتاج متابعة'], ['lost', 'اتقفل من غير بيع']];
const LOST = ['الميزانية مش مناسبة', 'القطعة اتباعت لحد تاني', 'المشتري مش جاد', 'اشترى من برّه', 'مش بيرد خالص', 'البائع رجع في كلامه', 'ماكلمناش على واتساب'];
const ERR = { phone_required: 'اكتب رقم العميل من محادثة الواتساب الأول.', invalid_phone: 'اكتب رقم موبايل مصري صح.', mins_required: 'اختار المهلة.', note_required: 'اكتب الملحوظة.', reason_required: 'اختار السبب.', summary_required: 'اكتب ملخص.', invalid_sup: 'اختار المشرف.', invalid_sales: 'اختار السيلز.', not_allowed: 'مش مسموح لك بالخطوة دي، أو الطلب اتحرّك. حدّث الصفحة.', invalid_parent: 'اختار مين فوقه صح.', phone_taken: 'الرقم ده متسجل قبل كده.', staff_phone_key: 'الرقم ده متسجل قبل كده.', invalid_outcome: 'اختار النتيجة.' };
const IC = {
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>',
  ref: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 14h5l1 2h4l1-2h5"/></svg>',
  mirror: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 4a3 3 0 0 1 0 6M18 15c2 .5 3 2.5 3 5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  team: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 8v4M12 12H5v3.5M12 12h7v3.5"/></svg>',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Math.round(Number(n)).toLocaleString('en-US'));
const T = (v) => (v ? Date.parse(v) : null);
const now = () => Date.now();
function when(t) { if (!t) return ''; const d = new Date(t); let h = d.getHours(); const m = d.getMinutes(), ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap; }
function dur(ms) { ms = Math.abs(ms); const m = ms / M; if (m < 60) return Math.max(1, Math.round(m)) + ' د'; const h = m / 60; if (h < 48) return Math.round(h * 10) / 10 + ' س'; return Math.round(h / 24) + ' يوم'; }
const ago = (t) => (now() - t < M ? 'دلوقتي' : 'من ' + dur(now() - t));
const stName = (k) => (STS.find((s) => s[0] === k) || [])[1] || '';
const outName = (k) => (OUT.find((s) => s[0] === k) || [])[1] || '';

export function mountDesk(sb, host, me, onSignOut) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${DESK_CSS}</style><div class="dkr"><div class="app" id="app"></div>
  <div class="sheet" id="sheet" hidden><div class="sc" data-a="close"></div><div class="panel" id="panel" role="dialog" aria-modal="true" aria-labelledby="pT"><div class="p-h"><button class="pback" data-a="back" id="pBack"></button><b id="pT"></b><span class="crumb" id="pC"></span></div><div class="p-b" id="pB"></div><div class="p-f" id="pF" hidden></div></div></div></div>`;
  const $ = (id) => root.getElementById(id);
  const R = me.owner ? 'owner' : me.role;
  const isSA = R === 'owner' || R === 'sadmin', isWeb = R === 'owner' || R === 'web';
  const S = { staff: [], reqs: [], notes: [], loaded: false, err: false };
  const UI = { tab: 'inbox', f: 'mine', per: 7, stack: [] };
  const DETAIL = {};
  let SH = { t: '', f: '' }, lastL = null, busy = false, dead = false;

  const P = (id) => S.staff.find((p) => p.id === id) || { name: '—', role: 'gm' };
  const kids = (id) => S.staff.filter((p) => p.parent_id === id);
  const desc = (id) => { let o = []; kids(id).forEach((k) => { o.push(k); o = o.concat(desc(k.id)); }); return o; };
  const salesOf = (id) => desc(id).filter((p) => SALES.includes(p.role) && p.active);
  // salespeople a supervisor can pick: the ones under them, plus anyone with no manager yet
  const looseSales = () => S.staff.filter((p) => SALES.includes(p.role) && p.active && !p.parent_id);
  const teamOf = (id) => salesOf(id).concat(looseSales().filter((p) => !desc(id).some((x) => x.id === p.id)));
  const byRole = (r) => S.staff.filter((p) => p.role === r && p.active);
  const Rq = (id) => S.reqs.find((r) => r.id === id);

  // ---------- data ----------
  function norm(r) { r.legs = (r.legs || []).map((l) => ({ ...l, start: T(l.start), due: T(l.due), end: T(l.end) })); r.at = T(r.created_at); r.st_due_t = T(r.st_due); r.first_t = T(r.first_at); r.closed_t = T(r.closed_at); return r; }
  async function load() {
    const [st, rq, nt] = await Promise.all([sb.rpc('desk_staff'), rpcAll('desk_requests'), sb.rpc('desk_notifications')]);
    if (dead) return;
    if (st.error || rq.error) { S.err = true; render(); return; }
    S.staff = st.data || []; S.reqs = (rq.data || []).map(norm); S.notes = nt.data || []; S.loaded = true; S.err = false; render();
  }
  async function rpcAll(fn) {
    const out = [];
    for (let from = 0; ; from += 1000) { const r = await sb.rpc(fn).range(from, from + 999); if (r.error) return r; out.push(...(r.data || [])); if (!r.data || r.data.length < 1000) return { data: out }; }
  }
  async function loadDetail(id) { const { data } = await sb.rpc('desk_request', { p_id: id }); if (data) { DETAIL[id] = data; const L = top(); if (L && L.id === id) render(); } }
  async function act(id, p, okMsg, pops) {
    if (busy) return; busy = true; render();
    const { error } = await sb.rpc('desk_act', { p_id: id, p });
    busy = false;
    if (error) { const k = Object.keys(ERR).find((e) => (error.message || '').includes(e)); toast(k ? ERR[k] : 'محصلش. جرب تاني.'); render(); return; }
    for (let i = 0; i < (pops || 0); i++) UI.stack.pop();
    delete DETAIL[id]; toast(okMsg); await load();
  }

  // ---------- rules on the client (the database checks them again) ----------
  function holderLeg(r) { for (let i = r.legs.length - 1; i >= 0; i--) if (r.legs[i].kind === 't' && !r.legs[i].end) return r.legs[i]; return null; }
  const curDue = (r) => { const l = holderLeg(r); return l ? l.due : null; };
  function isMine(r) {
    if (r.stage === 'closed') return false;
    if (r.via === 'ask') return isSA;
    if (r.stage === 'new') return isSA || isWeb;
    if (r.stage === 'up_sa') return isSA;
    if (r.stage === 'tl' || r.stage === 'up_tl') return R === 'tl' && r.tl_id === me.id;
    if (r.stage === 'sup' || r.stage === 'up_sup') return R === 'sup' && r.sup_id === me.id;
    if (r.stage === 'sales') return SALES.includes(R) && r.sales_id === me.id;
    return false;
  }
  function holderName(r) {
    if (r.stage === 'new') return r.via === 'ask' ? 'السيلز أدمن' : 'السيلز أدمن والويب أدمن';
    if (r.stage === 'up_sa') return 'السيلز أدمن';
    const id = { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage];
    return id ? P(id).name : '—';
  }
  const isLate = (r) => { const d = curDue(r); return (d && d < now()) || (r.stage === 'sales' && r.st_due_t && r.st_due_t < now()); };
  function dueTag(due) { if (!due) return ''; const d = due - now(); return d >= 0 ? `<span class="dl ${d < 20 * M ? 'y' : 'g'}">باقي ${dur(d)}</span>` : `<span class="dl r">متأخر ${dur(d)}</span>`; }
  function title(r) { if (r.via === 'ask') return 'بيدوّر على قطعة · R-' + r.id; return (r.via === 'wa' ? 'واتساب على ' : 'طلب ') + (r.code || 'قطعة'); }
  function sub(r) { if (r.via === 'ask') return [r.zone, r.district ? 'الحي ' + r.district : '', r.budget ? 'ميزانية ' + fmt(r.budget) : ''].filter(Boolean).join(' · '); return (r.l_district ? 'الحي ' + r.l_district : r.l_zone || '') + (r.l_area ? ' · ' + fmt(r.l_area) + ' م²' : '') + (r.l_price ? ' · ' + fmt(r.l_price) + ' ج.م' : ''); }
  const viaName = (r) => (r.via === 'wa' ? 'واتساب من صفحة القطعة' : r.via === 'ask' ? 'طلب "بيدوّر على قطعة"' : '"اطلبها" من صفحة القطعة');

  function sm(pid, days) {
    const since = now() - (days || 30) * D, all = S.reqs.filter((r) => r.sales_id === pid), recent = all.filter((r) => r.at >= since);
    const open = all.filter((r) => r.stage === 'sales'), late = open.filter(isLate);
    const fr = all.filter((r) => r.first_t).map((r) => { const l = r.legs.find((x) => x.staff_id === pid && x.kind === 't'); return l ? r.first_t - l.start : null; }).filter((v) => v != null);
    const legs = []; S.reqs.forEach((r) => r.legs.forEach((l) => { if (l.staff_id === pid && l.due && l.end && l.start >= since) legs.push(l); }));
    const onTime = legs.length ? Math.round(legs.filter((l) => l.end <= l.due).length / legs.length * 100) : null;
    const closed = recent.filter((r) => r.stage === 'closed'), sold = closed.filter((r) => r.outcome === 'sold').length;
    let last = 0; S.reqs.forEach((r) => r.legs.forEach((l) => { if (l.staff_id === pid) last = Math.max(last, l.end || l.start); }));
    return { open: open.length, late: late.length, resp: fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null, onTime, got: recent.length, closed: closed.length, sold, conv: closed.length ? Math.round(sold / closed.length * 100) : null, last };
  }
  function hm(pid, days) {
    const since = now() - (days || 30) * D, legs = []; S.reqs.forEach((r) => r.legs.forEach((l) => { if (l.staff_id === pid && l.kind === 't' && l.start >= since) legs.push(l); }));
    const done = legs.filter((l) => l.end), avg = done.length ? done.reduce((a, l) => a + (l.end - l.start), 0) / done.length : null;
    const wd = done.filter((l) => l.due), on = wd.length ? Math.round(wd.filter((l) => l.end <= l.due).length / wd.length * 100) : null;
    const open = legs.filter((l) => !l.end);
    return { handled: done.length, avg, onTime: on, open: open.length, late: open.filter((l) => l.due && l.due < now()).length };
  }
  function suggest(supId) {
    const team = teamOf(supId).map((p) => { const m = sm(p.id, 30); return { p, m, score: (p.avail ? 0 : 100) + m.open * 10 + m.late * 25 + (m.resp ? m.resp / M / 10 : 5) - (m.conv || 0) / 10 }; });
    return team.sort((a, b) => a.score - b.score);
  }
  function why(x, all) {
    if (!x.p.avail) return 'مش متاح دلوقتي'; const w = ['متاح', x.m.open ? 'عنده ' + x.m.open + ' مفتوح' : 'مفيش عنده طلبات مفتوحة'];
    const rs = all.filter((y) => y.m.resp).map((y) => y.m.resp); if (x.m.resp && rs.length > 1 && x.m.resp <= Math.min(...rs)) w.push('أسرع رد في الفريق'); if (x.m.late) w.push(x.m.late + ' متأخر'); return w.join(' · ');
  }

  // ---------- navigation ----------
  const top = () => UI.stack[UI.stack.length - 1];
  function go(v, id, extra) { UI.stack.push({ v, id: id || null, ...(extra || {}) }); render(); }
  function back() { UI.stack.pop(); render(); }
  let tt; function toast(m) { const o = root.querySelector('.toast'); if (o) o.remove(); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = m; root.querySelector('.dkr').appendChild(d); clearTimeout(tt); tt = setTimeout(() => d.remove(), 2800); }

  // ---------- pieces ----------
  function trk(r) { const i = TRK[r.stage]; let s = ''; for (let k = 1; k <= 6; k++) s += `<i class="${k < i ? 'd' : k === i ? (r.stage.startsWith('up_') ? 'b' : 'n') : ''}"></i>`; return `<div class="trk" aria-label="${esc(STAGE[r.stage])}">${s}</div>`; }
  function card(r) {
    const late = r.stage !== 'closed' && isLate(r);
    return `<button class="card click${late ? ' late' : ''}" data-a="open" data-id="${r.id}"><div class="row"><h2>${esc(title(r))}</h2><span class="lbl num end">R-${r.id}</span></div>
    <span class="lbl">${esc(sub(r))}${r.name ? ' · ' + esc(r.name) : ''}</span>${r.via === 'ask' ? '' : trk(r)}
    <div class="row">${r.stage === 'closed' ? `<span class="tag ${r.outcome === 'sold' ? 't-g' : 't-s'}">اتقفل: ${esc(outName(r.outcome))}</span>` : `<span class="tag t-n">عند ${esc(holderName(r))}</span>${dueTag(curDue(r))}`}
    ${r.st_key && r.stage !== 'closed' ? `<span class="tag t-y">${esc(stName(r.st_key))}</span>${r.stage === 'sales' && r.st_due_t ? dueTag(r.st_due_t) : ''}` : ''}
    ${r.stage === 'tl' ? '<span class="tag t-s">مستني تأكيد التيم ليدر</span>' : ''}${r.tl_mode === 'info' && !r.tl_ack && r.tl_id === me.id && R === 'tl' ? '<span class="tag t-s">للعلم</span>' : ''}
    ${r.via === 'wa' ? '<span class="tag" style="background:#E9FBF0;color:#146C3A">واتساب</span>' : ''}${r.via === 'wa' && !r.phone ? '<span class="tag t-r">محتاج رقم العميل</span>' : ''}${r.web_task ? '<span class="tag t-r">شيلها من الموقع</span>' : ''}
    ${r.notes ? `<span class="tag t-s">${r.notes} ملحوظة</span>` : ''}</div></button>`;
  }
  const minsPick = (L) => '<div class="mins">' + MINS.map((m) => `<button data-a="mins" data-v="${m[1]}" class="${L.mins === m[1] ? 'on' : ''}">${m[0]}</button>`).join('') + '</div>';
  const noteBox = (L, label) => `<label class="f">${label || 'ملحوظة أو تعليمات (اختياري)'}<textarea data-ln="note" maxlength="1000">${esc(L.note || '')}</textarea></label>`;

  // ---------- main tabs ----------
  function topBar() {
    const unread = S.notes.filter((n) => !n.read).length;
    return `<header class="top"><span class="brand">تِلاد</span><span style="display:grid;flex:1;min-width:0"><b style="font-size:14px">${esc(me.name)}</b><span class="lbl">${ROLES[R]}</span></span>
    ${me.owner ? '<a class="icbtn" href="/admin" aria-label="لوحة الإدارة" style="font-size:12px;font-weight:700;color:var(--ink);text-decoration:none;padding:0 8px">الإعلانات</a>' : ''}
    <button class="icbtn" data-a="reload" aria-label="تحديث">${IC.ref}</button>
    <button class="icbtn" data-a="bell" aria-label="التنبيهات${unread ? '، ' + unread + ' جديدة' : ''}">${IC.bell}${unread ? `<b class="num">${unread}</b>` : ''}</button>
    <button class="icbtn" data-a="signout" aria-label="خروج">${IC.out}</button></header>`;
  }
  function nav() {
    const mine = S.reqs.filter(isMine).length;
    const t = [['inbox', 'الطلبات', IC.inbox, mine], ['mirror', 'المراية', IC.mirror, 0], ['reports', 'التقارير', IC.chart, 0], ['team', 'الفريق', IC.team, 0]];
    return '<nav class="nav" aria-label="الأقسام">' + t.map((b) => `<button data-a="tab" data-t="${b[0]}" class="${UI.tab === b[0] ? 'on' : ''}">${b[2]}${b[1]}${b[3] ? `<b class="num">${b[3]}</b>` : ''}</button>`).join('') + '</nav>';
  }
  function vInbox() {
    if (S.err) return '<div class="empty">مقدرناش نحمّل الطلبات. اضغط تحديث.</div>';
    if (!S.loaded) return '<div class="empty">بنحمّل الطلبات...</div>';
    const mine = S.reqs.filter(isMine).sort((a, b) => (curDue(a) || 9e15) - (curDue(b) || 9e15));
    const info = S.reqs.filter((r) => R === 'tl' && r.tl_id === me.id && r.tl_mode === 'info' && !r.tl_ack && r.stage !== 'closed' && !isMine(r));
    const team = S.reqs.filter((r) => r.stage !== 'closed' && !isMine(r));
    const closed = S.reqs.filter((r) => r.stage === 'closed');
    const web = isWeb ? S.reqs.filter((r) => r.web_task) : [];
    let h = `<div style="display:grid;gap:2px"><span class="lbl">أهلًا يا ${esc(me.name)} · ${ROLES[R]}</span><h1>${R === 'gm' ? 'كل الطلبات' : 'محتاج منك'} <span class="num" style="color:var(--hot)">${R === 'gm' ? team.length : mine.length + info.length + web.length}</span></h1></div>`;
    h += `<div class="stats"><div class="st hot"><b class="num">${mine.length}</b><span class="lbl">عندي</span></div><div class="st"><b class="num" style="color:var(--bad)">${mine.concat(team).filter(isLate).length}</b><span class="lbl">متأخر</span></div><div class="st"><b class="num">${team.length}</b><span class="lbl">${['owner', 'sadmin', 'web', 'gm'].includes(R) ? 'عند الفريق' : 'عند فريقي'}</span></div></div>`;
    if (SALES.includes(R)) h += `<div class="card" style="grid-template-columns:1fr auto;align-items:center"><span><b>حالتك:</b> ${me.avail ? 'متاح لطلبات جديدة' : 'مش متاح دلوقتي'}<br><span class="lbl">المشرف بيشوف ده في المراية.</span></span><button class="btn sm ${me.avail ? '' : 'dark'}" data-a="avail">${me.avail ? 'خليني مش متاح' : 'خليني متاح'}</button></div>`;
    h += '<div class="chips">' + [['mine', 'محتاج منك'], ['team', ['owner', 'sadmin', 'web', 'gm'].includes(R) ? 'عند الفريق' : 'عند فريقي'], ['closed', 'اتقفل']].map((f) => `<button class="chip${UI.f === f[0] ? ' on' : ''}" data-a="f" data-v="${f[0]}">${f[1]}</button>`).join('') + '</div>';
    if (UI.f === 'mine') {
      if (web.length) h += '<h2>القطع اللي اتباعت (شيلها من الموقع)</h2>' + web.map((r) => `<div class="card"><b>${esc(r.code || '')}${r.l_district ? ' · الحي ' + esc(r.l_district) : ''}</b><span class="lbl">اتباعت من الطلب R-${r.id}. علّمها إنها اتباعت في لوحة الإعلانات، وبعدين دوس هنا.</span><button class="btn sm dark" data-a="webdone" data-id="${r.id}">شيلتها من الموقع</button></div>`).join('');
      if (info.length) h += '<h2>للعلم (من غير ما تأكد)</h2>' + info.map(card).join('');
      h += R === 'gm' ? team.map(card).join('') || '<div class="empty">مفيش طلبات مفتوحة.</div>' : mine.length ? mine.map(card).join('') : '<div class="empty">مفيش طلبات مستنياك.</div>';
    } else if (UI.f === 'team') h += team.length ? team.map(card).join('') : '<div class="empty">مفيش.</div>';
    else h += closed.length ? closed.map(card).join('') : '<div class="empty">مفيش.</div>';
    return h;
  }
  function mirrorCard(x, opt) {
    const p = x.p, m = x.m, tag = opt ? 'button' : 'div';
    return `<${tag} ${opt ? `data-a="pick" data-v="${p.id}"` : ''} class="mir${opt && opt.on ? ' on' : ''}${opt && opt.sug ? ' sug' : ''}">
    <div class="row"><span class="av2">${esc(p.name.slice(0, 1))}</span><span style="display:grid;flex:1;min-width:0"><b>${esc(p.name)}${opt && opt.sug ? ' <span class="tag t-a">مقترح</span>' : ''}</b><span class="lbl">${ROLES[p.role]} · ${m.last ? 'آخر نشاط ' + ago(m.last) : 'مفيش نشاط لسه'}${p.activated ? '' : ' · لسه ما فعّلش حسابه'}</span></span><span class="tag ${p.avail ? 't-g' : 't-s'}"><span class="dotav" style="background:${p.avail ? 'var(--ok-s)' : '#A99E88'}"></span>&nbsp;${p.avail ? 'متاح' : 'مش متاح'}</span></div>
    <div class="kp"><span><b class="num">${m.open}</b>مفتوح</span><span><b class="num${m.late ? ' r' : ''}">${m.late}</b>متأخر</span><span><b class="num">${m.resp ? dur(m.resp) : '—'}</b>أول رد</span><span><b class="num">${m.onTime == null ? '—' : m.onTime + '%'}</b>في الميعاد</span></div>
    <div class="load" aria-hidden="true"><i style="width:${Math.min(100, m.open / 4 * 100)}%;${m.open >= 4 ? 'background:var(--hot)' : ''}"></i></div>${opt ? `<span class="lbl">${esc(opt.why)}</span>` : ''}</${tag}>`;
  }
  function vMirror() {
    let h = '<h1>المراية</h1>';
    const sups = R === 'sup' ? [P(me.id)] : R === 'tl' ? kids(me.id).filter((p) => p.role === 'sup') : ['owner', 'sadmin', 'gm', 'web'].includes(R) ? byRole('sup') : [];
    if (!sups.length) return h + (SALES.includes(R) ? '<span class="lbl">المراية للمشرف والتيم ليدر. ده شكلك فيها:</span>' + mirrorCard({ p: P(me.id), m: sm(me.id, 30) }) : '<div class="empty">مفيش مشرفين متسجلين لسه. ضيفهم من "الفريق".</div>');
    h += '<span class="lbl">كل فرد: المفتوح، والمتأخر، ومتوسط أول رد، ونسبة الالتزام بالمهلة. الشريط = الضغط (4 طلبات = مليان). الأرقام من آخر 30 يوم.</span>';
    sups.forEach((s) => { const team = salesOf(s.id).map((p) => ({ p, m: sm(p.id, 30) })); h += `<h2>فريق ${esc(s.name)}${R !== 'sup' && s.parent_id ? ' · ' + esc(P(s.parent_id).name) : ''}</h2>` + (team.length ? team.map((x) => mirrorCard(x)).join('') : '<div class="empty">مفيش سيلز تابعين للمشرف ده.</div>'); });
    const loose = looseSales().map((p) => ({ p, m: sm(p.id, 30) }));
    if (loose.length) h += '<h2>سيلز مش تابعين لمشرف</h2><span class="lbl">أي مشرف يقدر يديهم طلبات.</span>' + loose.map((x) => mirrorCard(x)).join('');
    return h;
  }
  function vReports() {
    let h = '<h1>التقارير</h1><div class="chips">' + [[7, 'آخر 7 أيام'], [30, 'آخر 30 يوم']].map((o) => `<button class="chip${UI.per === o[0] ? ' on' : ''}" data-a="per" data-v="${o[0]}">${o[1]}</button>`).join('') + '</div>';
    let people = S.staff.filter((p) => p.active && !['gm', 'web'].includes(p.role));
    if (R === 'tl' || R === 'sup') people = [P(me.id), ...desc(me.id)]; else if (SALES.includes(R)) people = [P(me.id)];
    const sales = people.filter((p) => SALES.includes(p.role)), hand = people.filter((p) => !SALES.includes(p.role));
    if (!people.length) return h + '<div class="empty">مفيش فريق متسجل لسه.</div>';
    if (sales.length) h += '<h2>السيلز</h2><span class="lbl">اضغط على أي اسم للتفاصيل.</span>' + sales.map((p) => { const m = sm(p.id, UI.per); const c = (m.onTime || 0) >= 80 ? 'var(--ok-s)' : (m.onTime || 0) >= 50 ? 'var(--gold)' : 'var(--hot)';
      return `<button class="rrow" data-a="person" data-id="${p.id}"><span class="av2">${esc(p.name.slice(0, 1))}</span><span style="display:grid;gap:4px;min-width:0"><b>${esc(p.name)}</b><span class="lbl">${m.got} طلب · أول رد ${m.resp ? dur(m.resp) : '—'} · ${m.sold} اتباع</span><div class="load"><i style="width:${m.onTime || 0}%;background:${c}"></i></div></span><span style="display:grid;justify-items:end"><b class="num">${m.onTime == null ? '—' : m.onTime + '%'}</b><span class="lbl">في الميعاد</span></span></button>`; }).join('');
    if (hand.length) h += '<h2>اللي بيحوّلوا</h2>' + hand.map((p) => { const m = hm(p.id, UI.per);
      return `<button class="rrow" data-a="person" data-id="${p.id}"><span class="av2">${esc(p.name.slice(0, 1))}</span><span style="display:grid;gap:4px;min-width:0"><b>${esc(p.name)} <span class="lbl">${ROLES[p.role]}</span></b><span class="lbl">حوّل ${m.handled} · متوسط ${m.avg ? dur(m.avg) : '—'}${m.late ? ` · <b style="color:var(--bad)">${m.late} متأخر دلوقتي</b>` : ''}</span></span><span style="display:grid;justify-items:end"><b class="num">${m.onTime == null ? '—' : m.onTime + '%'}</b><span class="lbl">في الميعاد</span></span></button>`; }).join('');
    return h;
  }
  function vTeam() {
    let h = '<h1>الفريق</h1>';
    if (me.owner) h += '<button class="btn pri" data-a="addmember">+ ضيف عضو</button>';
    h += '<span class="lbl">كل واحد تابع للي فوقه. الطلب بيمشي على فرع المشرف اللي اتحوّل له، والتنبيه بيروح للشخص بالظبط.</span>';
    const node = (p, dep) => { const ks = kids(p.id), n = desc(p.id).length;
      return `<div class="tn${dep ? ' sub' : ''}"><button class="mem" data-a="${me.owner ? 'member' : 'noop'}" data-id="${p.id}" style="width:100%;background:none;border:0;border-bottom:1px dashed var(--line);text-align:right;${p.active ? '' : 'opacity:.55'}"><span class="av">${esc(p.name.slice(0, 1))}</span><span style="display:grid;flex:1;min-width:0"><b>${esc(p.name)}${p.id === me.id ? ' <span class="tag t-g">إنت</span>' : ''}</b><span class="lbl">${ROLES[p.role]}${n ? ' · تحته ' + n : ''}${p.active ? '' : ' · موقوف'}${p.activated ? '' : ' · لسه ما فعّلش'}</span></span></button>${ks.map((c) => node(c, dep + 1)).join('')}</div>`; };
    const roots = S.staff.filter((p) => !p.parent_id || !S.staff.some((x) => x.id === p.parent_id));
    h += roots.length ? `<div class="card">${roots.map((p) => node(p, 0)).join('')}</div>` : '<div class="empty">مفيش أعضاء لسه.' + (me.owner ? ' ابدأ بالسيلز أدمن، وبعدين التيم ليدرز، ثم المشرفين، ثم السيلز.' : '') + '</div>';
    return h;
  }

  // ---------- popups ----------
  function vReq() {
    const r = Rq(UI.id); if (!r) { SH.t = 'الطلب'; return '<div class="empty">الطلب ده مش ظاهر لك دلوقتي.</div>'; }
    SH.t = 'R-' + r.id + ' · ' + (r.via === 'wa' ? 'واتساب' : r.via === 'ask' ? 'بيدوّر على قطعة' : 'طلب قطعة');
    const mine = isMine(r), d = DETAIL[r.id]; if (!d) loadDetail(r.id);
    let h = '';
    if (r.via === 'wa' && !r.phone && r.stage === 'new') h += `<div class="card" style="background:#FFFBF3;border-color:#E9B26A"><b style="color:var(--warn)">العميل كلّمنا واتساب ولسه رقمه مش متسجل.</b><span class="lbl">اكتب رقمه واسمه من المحادثة علشان الطلب يتحوّل. لو ماكلمش خالص، اقفل الطلب.</span>${isSA || isWeb ? `<button class="btn sm dark" data-a="act" data-k="phone" data-id="${r.id}">اكتب رقم العميل</button>` : ''}</div>`;
    h += `<div class="card"><span class="lbl">${esc(viaName(r))} · وصل ${when(r.at)}</span><h2>${esc(title(r))}</h2><span class="lbl">${esc(sub(r))}</span>${r.via === 'ask' ? '' : trk(r) + '<div class="trkl"><span>العميل</span><span>الإدارة</span><span>تيم ليدر</span><span>مشرف</span><span>سيلز</span><span>راجع</span></div>'}</div>`;
    if (r.stage !== 'closed') { const due = curDue(r);
      h += `<div class="card" style="${isLate(r) ? 'border-color:#F2C4B0' : ''}"><span class="lbl">دلوقتي عند</span><div class="row"><span class="big">${esc(holderName(r))}</span><span class="end">${dueTag(due)}</span></div>${due ? `<span class="lbl num">المهلة لحد ${when(due)}</span>` : ''}
      ${r.tl_id ? `<span class="lbl">التيم ليدر: ${esc(P(r.tl_id).name)} · ${r.tl_mode === 'confirm' ? (r.tl_ack ? 'أكّد' : 'لازم يأكد') : (r.tl_ack ? 'اطّلع' : 'للعلم، لسه ماطّلعش')}${r.sup_id ? ' · المشرف: ' + esc(P(r.sup_id).name) : ''}${r.sales_id ? ' · السيلز: ' + esc(P(r.sales_id).name) : ''}</span>` : ''}</div>`;
    } else h += `<div class="card"><span class="lbl">اتقفل ${when(r.closed_t)}</span><span class="big">${esc(outName(r.outcome))}</span>${r.outcome_reason ? `<span class="lbl">السبب: ${esc(r.outcome_reason)}</span>` : ''}</div>`;
    if (r.st_key) h += `<div class="card"><div class="row"><h2>الحالة</h2><span class="end">${r.stage === 'sales' && r.st_due_t ? dueTag(r.st_due_t) : ''}</span></div><span class="tag t-y" style="justify-self:start">${esc(stName(r.st_key))}</span>${r.st_due_t ? `<span class="lbl num">المهلة لحد ${when(r.st_due_t)}</span>` : ''}</div>`;
    if (r.outcome && r.stage !== 'closed') h += `<div class="card" style="background:#F6F8FC;border-color:#C9D2E3"><h2>التحويلة الراجعة${r.sales_id ? ' من ' + esc(P(r.sales_id).name) : ''}</h2><span class="tag t-n" style="justify-self:start">${esc(outName(r.outcome))}</span>${r.outcome_reason ? `<span class="lbl">السبب: ${esc(r.outcome_reason)}</span>` : ''}${r.outcome_summary ? `<div class="note">${esc(r.outcome_summary)}</div>` : ''}</div>`;
    h += `<div class="card"><h2>المشتري</h2><div class="row"><b>${esc(r.name || '—')}</b><span class="lbl num end" style="direction:ltr">${esc(r.phone || 'لسه مش متسجل')}</span></div>${r.phone ? `<div class="g2"><a class="btn" href="tel:${esc(r.phone)}">اتصال</a><a class="btn wa" href="https://wa.me/2${esc(r.phone)}" target="_blank" rel="noopener">واتساب</a></div>` : ''}</div>`;
    h += `<div class="card"><h2>ملحوظات وتعليمات (${d ? d.notes.length : r.notes})</h2>${d ? (d.notes.length ? d.notes.map((n) => `<div class="note${n.kind === 'instr' ? ' instr' : ''}"><b>${esc(n.who)}</b> <span class="lbl">${n.role ? ROLES[n.role] + ' · ' : ''}${when(T(n.at))}${n.kind === 'instr' ? ' · تعليمات' : ''}</span><br>${esc(n.body)}</div>`).join('') : '<span class="lbl">مفيش.</span>') : '<span class="lbl">بنحمّل...</span>'}${R !== 'gm' ? `<button class="btn sm" data-a="act" data-k="note" data-id="${r.id}">+ ضيف ملحوظة أو تعليمات</button>` : ''}</div>`;
    h += `<button class="btn" data-a="trail" data-id="${r.id}">التحويلات والمهل والسجل</button>`;
    let f = '';
    const btn = (k, lab, cls) => `<button class="btn ${cls || ''}" data-a="act" data-k="${k}" data-id="${r.id}"${busy ? ' disabled' : ''}>${lab}</button>`;
    if (R === 'gm' || r.stage === 'closed') f = '';
    else if (r.via === 'ask' && isSA) f = `<div class="g2">${btn('status', 'حدّث الحالة')}${btn('close', 'اقفل الطلب', 'pri')}</div>`;
    else if (r.stage === 'new' && isSA) f = r.via === 'wa' && !r.phone ? btn('close', 'اقفل (ماكلمش)') : `<div class="g2" style="grid-template-columns:1fr 2fr">${r.via === 'wa' ? btn('close', 'اقفل') : '<span></span>'}${btn('fwd', 'حوّل للمشرف والتيم ليدر', 'pri')}</div>`;
    else if (r.stage === 'new' && isWeb) f = '<span class="lbl" style="text-align:center">السيلز أدمن هو اللي بيحوّل. تقدر تضيف ملحوظة.</span>';
    else if (mine && r.stage === 'tl') f = btn('confirm', 'أكّد وابعته لـ' + esc(P(r.sup_id).name), 'pri');
    else if (mine && r.stage === 'sup') f = btn('assign', 'اختار السيلز', 'pri');
    else if (mine && r.stage === 'sales') f = `<div class="g2">${btn('status', 'حدّث الحالة')}${btn('ret', 'ابعت تحويلة راجعة', 'pri')}</div>`;
    else if (mine && r.stage === 'up_sup') f = `<div class="g2">${btn('down', 'رجّعها للسيلز')}${btn('up', r.tl_id ? 'تمام، للتيم ليدر' : 'تمام، للسيلز أدمن', 'pri')}</div>`;
    else if (mine && r.stage === 'up_tl') f = `<div class="g2">${btn('down', 'رجّعها للمشرف')}${btn('up', 'تمام، للسيلز أدمن', 'pri')}</div>`;
    else if (mine && r.stage === 'up_sa') f = `<div class="g2">${btn('down', r.tl_id ? 'رجّعها للتيم ليدر' : 'رجّعها للمشرف')}${btn('close', 'اقفل الطلب', 'pri')}</div>`;
    if (!f && R === 'tl' && r.tl_id === me.id && r.tl_mode === 'info' && !r.tl_ack && r.stage !== 'closed') f = `<button class="btn dark" data-a="ack" data-id="${r.id}">اطّلعت</button>`;
    SH.f = f; return h;
  }
  function vTrail() {
    const r = Rq(UI.id); SH.t = 'التحويلات والمهل'; const d = DETAIL[r.id]; if (!d) loadDetail(r.id);
    const who = (l) => (l.staff_id ? P(l.staff_id).name : l.role === 'sadmin' ? 'السيلز أدمن' : ROLES[l.role] || '—');
    let h = '<span class="lbl">كل تحويلة ومهلتها: بدأت إمتى، وكان لازم ترد لحد إمتى، ورديت إمتى.</span><div class="card" style="gap:0">' + r.legs.map((l) => { const late = l.due && (l.end || now()) > l.due;
      return `<div class="leg"><span><b>${esc(who(l))}</b> · ${l.kind === 's' ? 'حالة: ' + esc(l.label) : 'تحويلة'}</span><span class="dl ${l.end ? (late ? 'r' : 'g') : (late ? 'r' : 'n')}">${l.end ? (late ? 'اتأخر ' + dur(l.end - l.due) : l.due ? 'في الميعاد' : 'خلصت') : (late ? 'متأخر ' + dur(now() - l.due) : 'لسه')}</span><span class="lbl num" style="grid-column:span 2">بدأت ${when(l.start)}${l.due ? ' · المهلة ' + when(l.due) : ''}${l.end ? ' · خلصت ' + when(l.end) + ' (أخدت ' + dur(l.end - l.start) + ')' : ''}</span></div>`; }).join('') + '</div>';
    h += '<h2>السجل</h2>' + (d ? '<div class="card" style="gap:0">' + d.events.map((e) => `<div class="leg"><span>${e.who ? '<b>' + esc(e.who) + '</b> — ' : ''}${esc(e.body)}</span><span></span><span class="lbl num" style="grid-column:span 2">${when(T(e.at))}</span></div>`).join('') + '</div>' : '<span class="lbl">بنحمّل...</span>');
    return h;
  }
  function vAct() {
    const L = top(), r = Rq(L.id), k = L.k; let h = '';
    if (!r) return '';
    const go2 = (lab, cls, dis) => `<button class="btn ${cls || 'pri'}" data-a="go2"${dis || busy ? ' disabled' : ''}>${busy ? 'استنى...' : lab}</button>`;
    if (k === 'phone') { SH.t = 'رقم العميل من واتساب'; h += `<span class="lbl">من محادثة الواتساب على ${esc(title(r))}.</span><label class="f">اسم العميل<input type="text" data-ln="name" value="${esc(L.name || '')}"></label><label class="f">رقمه<input type="tel" inputmode="tel" data-ln="phone" value="${esc(L.phone || '')}" style="direction:ltr;text-align:right"></label>` + noteBox(L); SH.f = go2('احفظ'); }
    if (k === 'note') { SH.t = 'ملحوظة أو تعليمات'; h += `<div class="seg"><button data-a="lset" data-k="nk" data-v="note" class="${L.nk !== 'instr' ? 'on' : ''}">ملحوظة</button><button data-a="lset" data-k="nk" data-v="instr" class="${L.nk === 'instr' ? 'on' : ''}">تعليمات</button></div>` + noteBox(L, 'النص') + '<span class="lbl">بتظهر لكل اللي ماسكين الطلب، واللي الطلب عنده دلوقتي بيتبلّغ.</span>'; SH.f = go2('ضيف'); }
    if (k === 'fwd') { SH.t = 'تحويل الطلب';
      const sups = byRole('sup'), tlOf = (s) => { const p = s.parent_id && P(s.parent_id); return p && p.role === 'tl' ? p : null; };
      const groups = []; byRole('tl').forEach((t) => { const ss = sups.filter((s) => s.parent_id === t.id); if (ss.length) groups.push([t.name, ss]); });
      const loose = sups.filter((s) => !tlOf(s)); if (loose.length) groups.push(['مشرفين مش تابعين لتيم ليدر', loose]);
      const supOpt = (s) => { const mm = teamOf(s.id), open = mm.reduce((a, p) => a + sm(p.id).open, 0);
        return `<button class="opt${L.sup === s.id ? ' on' : ''}" data-a="lset" data-k="sup" data-v="${s.id}" data-num="1"><span class="rad" aria-hidden="true"></span><span style="display:grid;gap:2px"><b style="font-size:14px">${esc(s.name)}</b><span class="lbl">${mm.length} سيلز · ${open} طلب مفتوح · ${mm.filter((p) => p.avail).length} متاح</span></span></button>`; };
      h += '<span class="lbl">اختار المشرف. لو تابع لتيم ليدر، التيم ليدر بيتحدد لوحده.</span>' + (groups.length ? groups.map((g) => `<h2>${esc(g[0])}</h2>` + g[1].map(supOpt).join('')).join('') : '<div class="empty">مفيش مشرفين متسجلين. ضيفهم من "الفريق".</div>');
      const selTl = L.sup ? tlOf(P(L.sup)) : null, noTl = L.sup && !selTl;
      if (noTl) h += '<span class="lbl">المشرف ده مش تابع لتيم ليدر، فالطلب هيروح له على طول.</span>';
      else h += `<span class="lbl">التيم ليدر${selTl ? ' (' + esc(selTl.name) + ')' : ''}</span><div class="seg"><button data-a="lset" data-k="mode" data-v="confirm" class="${L.mode !== 'info' ? 'on' : ''}">يأكد الأول</button><button data-a="lset" data-k="mode" data-v="info" class="${L.mode === 'info' ? 'on' : ''}">للعلم بس</button></div><span class="lbl">${L.mode === 'info' ? 'الطلب هيروح للمشرف على طول، والتيم ليدر يوصله تنبيه.' : 'الطلب مش هيوصل للمشرف غير لما التيم ليدر يأكد.'}</span>`;
      h += `<span class="lbl">مهلة الرد (${L.mode === 'info' || noTl ? 'المشرف' : 'التيم ليدر'})</span>` + minsPick(L) + noteBox(L); SH.f = go2('حوّل', 'pri', !L.sup); }
    if (k === 'confirm') { SH.t = 'تأكيد التيم ليدر'; h += `<span class="lbl">الطلب هيروح لـ${esc(P(r.sup_id).name)} يختار السيلز.</span><span class="lbl">مهلة المشرف</span>` + minsPick(L) + noteBox(L); SH.f = go2('أكّد وابعت'); }
    if (k === 'assign') { SH.t = 'اختار السيلز'; const list = suggest(r.sup_id);
      h += '<span class="lbl">الاقتراح من الواجهة: متاح، وأقل ضغط، وأسرع رد، وأحسن تحويل. الاختيار في الآخر ليك.</span>' + (list.length ? list.map((x, i) => mirrorCard(x, { on: L.sales === x.p.id, sug: i === 0 && x.p.avail, why: why(x, list) })).join('') : '<div class="empty">مفيش سيلز تحتك. اطلب من الأدمن يضيفهم.</div>');
      h += '<span class="lbl">مهلة أول رد من السيلز</span>' + minsPick(L) + noteBox(L); SH.f = go2(L.sales ? 'ابعته لـ' + esc(P(L.sales).name) : 'اختار حد الأول', 'pri', !L.sales); }
    if (k === 'status') { SH.t = 'حدّث الحالة'; h += '<div class="stl">' + STS.map((s) => `<button class="${L.st === s[0] ? 'on' : ''}" data-a="lset" data-k="st" data-v="${s[0]}"><i></i>${s[1]}</button>`).join('') + '</div><span class="lbl">المهلة للخطوة الجاية</span>' + minsPick(L) + noteBox(L); SH.f = go2('احفظ الحالة', 'pri', !L.st); }
    if (k === 'ret') { SH.t = 'تحويلة راجعة';
      h += '<span class="lbl">النتيجة</span><div class="stl">' + OUT.map((o) => `<button class="${L.out === o[0] ? 'on' : ''}" data-a="lset" data-k="out" data-v="${o[0]}"><i></i>${o[1]}</button>`).join('') + '</div>';
      if (L.out === 'lost') h += '<span class="lbl">السبب</span><div class="rch">' + LOST.map((t) => `<button data-a="lset" data-k="reason" data-v="${esc(t)}" class="${L.reason === t ? 'on' : ''}">${esc(t)}</button>`).join('') + '</div>';
      h += `<label class="f">ملخص (إجباري)<textarea data-ln="sum" maxlength="1000">${esc(L.sum || '')}</textarea></label><span class="lbl">مهلة رد المشرف</span>` + minsPick(L); SH.f = go2('ابعت لـ' + esc(P(r.sup_id).name)); }
    if (k === 'up') { SH.t = 'ابعتها لفوق'; h += `<span class="lbl">هتروح لـ${r.stage === 'up_sup' && r.tl_id ? esc(P(r.tl_id).name) : 'السيلز أدمن'}.</span><span class="lbl">مهلة الرد</span>` + minsPick(L) + noteBox(L); SH.f = go2('ابعت'); }
    if (k === 'down') { const tn = { up_sup: P(r.sales_id).name, up_tl: P(r.sup_id).name, up_sa: r.tl_id ? P(r.tl_id).name : P(r.sup_id).name }[r.stage]; SH.t = 'رجّعها لـ' + tn; h += '<span class="lbl">اكتب المطلوب منه.</span>' + noteBox(L, 'التعليمات (إجباري)') + '<span class="lbl">المهلة</span>' + minsPick(L); SH.f = go2('رجّعها', 'dark'); }
    if (k === 'close') { SH.t = 'اقفل الطلب'; const v = L.out || r.outcome;
      h += (r.outcome ? `<span class="lbl">النتيجة من السيلز: <b>${esc(outName(r.outcome))}</b>. تقدر تغيّرها.</span>` : '<span class="lbl">اختار النتيجة.</span>') + '<div class="stl">' + OUT.map((o) => `<button class="${v === o[0] ? 'on' : ''}" data-a="lset" data-k="out" data-v="${o[0]}"><i></i>${o[1]}</button>`).join('') + '</div>';
      if (v === 'lost') h += '<span class="lbl">السبب</span><div class="rch">' + LOST.map((t) => `<button data-a="lset" data-k="reason" data-v="${esc(t)}" class="${L.reason === t ? 'on' : ''}">${esc(t)}</button>`).join('') + '</div>';
      h += noteBox(L); SH.f = go2('اقفل', 'dark', !v); }
    return h;
  }
  function doAct() {
    const L = top(), r = Rq(L.id), k = L.k, note = (L.note || '').trim();
    if (k === 'phone') return act(r.id, { a: 'phone', phone: (L.phone || '').trim(), name: L.name || '', note }, 'اتسجل رقم العميل', 1);
    if (k === 'note') { if (!note) return toast('اكتب الملحوظة.'); return act(r.id, { a: 'note', kind: L.nk === 'instr' ? 'instr' : 'note', note }, 'اتضافت', 1); }
    if (['fwd', 'confirm', 'assign', 'ret', 'up', 'down'].includes(k) && !L.mins) return toast('اختار المهلة.');
    if (k === 'fwd') return act(r.id, { a: 'forward', sup_id: L.sup, mode: L.mode === 'info' ? 'info' : 'confirm', mins: L.mins, note }, 'اتحوّل', 2);
    if (k === 'confirm') return act(r.id, { a: 'confirm', mins: L.mins, note }, 'اتبعت للمشرف', 2);
    if (k === 'assign') return act(r.id, { a: 'assign', sales_id: L.sales, mins: L.mins, note }, 'اتبعت لـ' + P(L.sales).name, 2);
    if (k === 'status') return act(r.id, { a: 'status', key: L.st, mins: L.mins, note }, 'اتحفظت الحالة', 1);
    if (k === 'ret') { if (!L.out) return toast('اختار النتيجة.'); if (L.out === 'lost' && !L.reason) return toast('اختار السبب.'); if (!(L.sum || '').trim()) return toast('اكتب ملخص.'); return act(r.id, { a: 'return', outcome: L.out, reason: L.reason || '', summary: L.sum, mins: L.mins }, 'اتبعتت للمشرف', 2); }
    if (k === 'up') return act(r.id, { a: 'up', mins: L.mins, note }, 'اتبعتت', 2);
    if (k === 'down') { if (!note) return toast('اكتب التعليمات.'); return act(r.id, { a: 'down', note, mins: L.mins }, 'رجعت', 2); }
    if (k === 'close') { const o = L.out || r.outcome; if (o === 'lost' && !L.reason && !r.outcome_reason) return toast('اختار السبب.'); return act(r.id, { a: 'close', outcome: o, reason: L.reason || '', note }, 'الطلب اتقفل', 2); }
    return undefined;
  }
  function vPerson() {
    const p = P(UI.id); SH.t = p.name; const isS = SALES.includes(p.role); let h = `<span class="lbl">${ROLES[p.role]}${p.parent_id ? ' · تابع لـ' + esc(P(p.parent_id).name) : ''} · آخر ${UI.per} يوم</span>`;
    if (isS) { const m = sm(p.id, UI.per);
      h += `<div class="kp"><span><b class="num">${m.got}</b>استلم</span><span><b class="num">${m.open}</b>مفتوح</span><span><b class="num${m.late ? ' r' : ''}">${m.late}</b>متأخر</span><span><b class="num">${m.sold}</b>اتباع</span></div><div class="kp"><span><b class="num">${m.resp ? dur(m.resp) : '—'}</b>متوسط أول رد</span><span><b class="num">${m.onTime == null ? '—' : m.onTime + '%'}</b>في الميعاد</span><span><b class="num">${m.conv == null ? '—' : m.conv + '%'}</b>تحويل لبيع</span><span><b class="num">${m.closed}</b>اتقفل</span></div>`;
      const cnt = {}; S.reqs.forEach((r) => { if (r.sales_id === p.id && r.at >= now() - UI.per * D) r.legs.forEach((l) => { if (l.kind === 's' && l.staff_id === p.id) cnt[l.label] = (cnt[l.label] || 0) + 1; }); }); const ks = Object.keys(cnt), mx = Math.max(1, ...ks.map((x) => cnt[x]));
      h += '<div class="card"><h2>الحالات اللي حطها</h2>' + (ks.length ? '<div class="bars">' + ks.map((x) => `<div><span>${esc(x)}</span><i style="width:${cnt[x] / mx * 100}%"></i><span class="num lbl">${cnt[x]}</span></div>`).join('') + '</div>' : '<span class="lbl">مفيش.</span>') + '</div>';
      const lost = {}; S.reqs.forEach((r) => { if (r.sales_id === p.id && r.outcome === 'lost' && r.outcome_reason) lost[r.outcome_reason] = (lost[r.outcome_reason] || 0) + 1; });
      if (Object.keys(lost).length) h += '<div class="card"><h2>أسباب القفل من غير بيع</h2>' + Object.keys(lost).map((x) => `<div class="row"><span>${esc(x)}</span><b class="num end">${lost[x]}</b></div>`).join('') + '</div>';
      const op = S.reqs.filter((r) => r.sales_id === p.id && r.stage !== 'closed'); if (op.length) h += '<h2>طلباته المفتوحة</h2>' + op.map(card).join('');
    } else { const m = hm(p.id, UI.per);
      h += `<div class="kp"><span><b class="num">${m.handled}</b>حوّل</span><span><b class="num">${m.avg ? dur(m.avg) : '—'}</b>متوسط</span><span><b class="num">${m.onTime == null ? '—' : m.onTime + '%'}</b>في الميعاد</span><span><b class="num${m.late ? ' r' : ''}">${m.late}</b>متأخر دلوقتي</span></div>`; }
    return h;
  }
  function vBell() {
    SH.t = 'التنبيهات';
    return '<button class="btn sm" data-a="readall" style="align-self:flex-start">علّم الكل اتقرا</button>' + (S.notes.length ? S.notes.map((n) => `<button class="nt${n.read ? '' : ' new'}" data-a="note" data-id="${n.id}"><span class="ic t-n" aria-hidden="true">!</span><span style="display:grid;gap:2px;font-size:13.5px;line-height:1.6">${esc(n.body)}<span class="lbl num">${when(T(n.at))}</span></span></button>`).join('') : '<div class="empty">مفيش تنبيهات.</div>');
  }
  // team management (owner only)
  function vAdd() {
    const L = top(); SH.t = 'ضيف عضو'; const pr = PARENT_ROLE[L.role || 'junior'], cands = pr ? S.staff.filter((p) => p.role === pr && p.active) : [];
    let h = `<label class="f">الاسم<input type="text" data-ln="name" value="${esc(L.name || '')}"></label><label class="f">رقم الموبايل (بيدخل بيه)<input type="tel" inputmode="tel" data-ln="phone" value="${esc(L.phone || '')}" placeholder="01xxxxxxxxx" style="direction:ltr;text-align:right"></label>`;
    h += '<span class="lbl">الدور</span><div class="rch">' + Object.keys(PARENT_ROLE).map((x) => `<button data-a="lset" data-k="role" data-v="${x}" class="${(L.role || 'junior') === x ? 'on' : ''}">${ROLES[x]}</button>`).join('') + '</div>';
    if (pr && cands.length) h += `<span class="lbl">تابع لمين (${ROLES[pr]}) · اختياري، تقدر تسيبه وتحدده بعدين</span><button class="opt${!L.parent ? ' on' : ''}" data-a="lset" data-k="parent" data-v=""><span class="rad" aria-hidden="true"></span><b style="font-size:14px">مش تابع لحد دلوقتي</b></button>` + cands.map((p) => `<button class="opt${L.parent === p.id ? ' on' : ''}" data-a="lset" data-k="parent" data-v="${p.id}" data-num="1"><span class="rad" aria-hidden="true"></span><b style="font-size:14px">${esc(p.name)}</b></button>`).join('');
    SH.f = `<button class="btn pri" data-a="addgo"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'ضيف واطلع كود التفعيل'}</button>`; return h;
  }
  function vCode() { const L = top(); SH.t = 'كود التفعيل'; return `<div class="card" style="text-align:center;gap:6px"><span class="lbl">ابعت الكود ده لـ${esc(L.name)} (صالح 7 أيام):</span><b class="num" style="font-family:var(--fd);font-size:40px;letter-spacing:6px;direction:ltr">${esc(L.code)}</b><button class="btn sm" data-a="copy" data-v="${esc(L.code)}">انسخ الكود</button></div><div class="note">العضو يفتح <b>telad.vercel.app/desk</b> ويدوس "تفعيل حساب جديد"، ويكتب رقمه والكود ده، ويختار باسورد لنفسه.</div><span class="lbl">الكود بيتقفل بعد 5 محاولات غلط، وتقدر تطلع كود جديد من صفحة العضو.</span>`; }
  function vMember() {
    const p = P(UI.id); SH.t = p.name; const pr = PARENT_ROLE[p.role], cands = pr ? S.staff.filter((x) => x.role === pr && x.active) : [];
    let h = `<div class="card"><div class="row"><b>${ROLES[p.role]}</b><span class="lbl num end" style="direction:ltr">${esc(p.phone || '')}</span></div><span class="lbl">${p.activated ? 'فعّل حسابه.' : 'لسه ما فعّلش حسابه.'} ${p.active ? '' : 'موقوف.'}</span></div>`;
    if (cands.length) h += `<span class="lbl">تابع لـ (اختياري، والتغيير بيأثر على الطلبات الجديدة بس)</span><button class="opt${!p.parent_id ? ' on' : ''}" data-a="setparent" data-id="${p.id}" data-v=""><span class="rad" aria-hidden="true"></span><b style="font-size:14px">مش تابع لحد</b></button>` + cands.map((c) => `<button class="opt${p.parent_id === c.id ? ' on' : ''}" data-a="setparent" data-id="${p.id}" data-v="${c.id}"><span class="rad" aria-hidden="true"></span><b style="font-size:14px">${esc(c.name)}</b></button>`).join('');
    SH.f = `<div class="g2">${p.activated ? '<span></span>' : `<button class="btn" data-a="newcode" data-id="${p.id}">كود تفعيل جديد</button>`}<button class="btn ${p.active ? 'red' : 'dark'}" data-a="toggle" data-id="${p.id}">${p.active ? 'وقّفه' : 'رجّعه'}</button></div>`;
    return h;
  }

  // ---------- render ----------
  const VIEWS = { req: vReq, trail: vTrail, act: vAct, person: vPerson, bell: vBell, add: vAdd, code: vCode, member: vMember };
  function render() {
    if (dead) return;
    const L = top(); UI.id = L ? L.id : null; const y = window.scrollY;
    $('app').innerHTML = topBar() + '<main class="wrap">' + ({ inbox: vInbox, mirror: vMirror, reports: vReports, team: vTeam }[UI.tab])() + '</main>' + nav();
    window.scrollTo(0, y);
    const sh = $('sheet'), pB = $('pB'), pF = $('pF'), pBk = $('pBack');
    if (!L) { lastL = null; if (!sh.hidden && sh.classList.contains('open')) { sh.classList.remove('open'); document.body.style.overflow = ''; setTimeout(() => { if (!top()) sh.hidden = true; }, 340); } return; }
    SH = { t: '', f: '' }; const body = VIEWS[L.v](); const same = L === lastL, st = pB.scrollTop, deep = UI.stack.length > 1;
    $('pT').textContent = SH.t; pB.innerHTML = body; pF.innerHTML = SH.f; pF.hidden = !SH.f;
    pBk.innerHTML = deep ? IC.back + 'رجوع' : IC.x; pBk.setAttribute('aria-label', deep ? 'رجوع' : 'قفل');
    L.title = SH.t; const par = deep ? UI.stack[UI.stack.length - 2] : null; $('pC').textContent = par && par.title ? 'من: ' + (par.title.length > 18 ? par.title.slice(0, 18) + '…' : par.title) : '';
    $('panel').setAttribute('data-depth', String(Math.min(UI.stack.length, 3)));
    if (same) pB.scrollTop = st; else { pB.scrollTop = 0; pB.classList.remove('swap'); void pB.offsetWidth; pB.classList.add('swap'); }
    lastL = L; if (sh.hidden || !sh.classList.contains('open')) { sh.hidden = false; document.body.style.overflow = 'hidden'; void sh.offsetWidth; sh.classList.add('open'); }
  }

  // ---------- events ----------
  async function rpcToast(fn, args, ok) { if (busy) return null; busy = true; render(); const { data, error } = await sb.rpc(fn, args); busy = false; if (error) { const k = Object.keys(ERR).find((e) => (error.message || '').includes(e)); toast(k ? ERR[k] : 'محصلش. جرب تاني.'); render(); return null; } if (ok) toast(ok); return data ?? true; }
  // Listeners are removed when this desk is unmounted, so a remount never answers one tap twice.
  const ac = new AbortController();
  root.addEventListener('click', async (ev) => {
    if (dead) return;
    const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id ? Number(b.dataset.id) : null, L = top();
    switch (a) {
      case 'tab': UI.stack = []; UI.tab = b.dataset.t; render(); window.scrollTo(0, 0); break;
      case 'back': back(); break;
      case 'close': UI.stack = []; render(); break;
      case 'open': go('req', id); break;
      case 'trail': go('trail', id); break;
      case 'bell': go('bell'); break;
      case 'reload': load(); toast('بنحدّث...'); break;
      case 'signout': onSignOut(); break;
      case 'person': go('person', id); break;
      case 'f': UI.f = b.dataset.v; render(); break;
      case 'per': UI.per = Number(b.dataset.v); render(); break;
      case 'act': go('act', id, { k: b.dataset.k, mins: { fwd: 60, confirm: 60, assign: 60, ret: 180, up: 180, down: 180 }[b.dataset.k] || null, mode: 'confirm', note: '', nk: 'note' }); break;
      case 'lset': L[b.dataset.k] = b.dataset.num ? Number(b.dataset.v) : b.dataset.v; if (b.dataset.k === 'st') L.mins = (STS.find((x) => x[0] === b.dataset.v) || [])[2]; if (b.dataset.k === 'role') L.parent = null; render(); break;
      case 'pick': L.sales = Number(b.dataset.v); render(); break;
      case 'mins': L.mins = Number(b.dataset.v); render(); break;
      case 'go2': doAct(); break;
      case 'ack': { const r = Rq(id); await act(r.id, { a: 'ack' }, 'اتسجل إنك اطّلعت', 0); break; }
      case 'webdone': await act(id, { a: 'webdone' }, 'اتسجل', 0); break;
      case 'avail': { const v = !me.avail; if (await rpcToast('staff_set_avail', { p_avail: v }, v ? 'إنت متاح دلوقتي' : 'إنت مش متاح دلوقتي')) { me.avail = v; await load(); } break; }
      case 'readall': await sb.rpc('desk_notifications_read', { p_id: null }); S.notes.forEach((n) => { n.read = true; }); render(); break;
      case 'note': { const n = S.notes.find((o) => o.id === id); if (!n.read) { n.read = true; sb.rpc('desk_notifications_read', { p_id: n.id }); } if (n.request_id && Rq(n.request_id)) go('req', n.request_id); else render(); break; }
      case 'addmember': go('add', null, { role: 'junior' }); break;
      case 'addgo': { const role = L.role || 'junior', phone = (L.phone || '').trim(); if ((L.name || '').trim().length < 2) return toast('اكتب الاسم.'); if (!/^01[0125][0-9]{8}$/.test(phone)) return toast('اكتب رقم موبايل مصري صح، زي 01012345678.');
        const d = await rpcToast('staff_add', { p: { name: L.name.trim(), phone, role, parent_id: L.parent || null } }); if (d) { UI.stack.pop(); await load(); go('code', null, { code: d.code, name: L.name.trim() }); } break; }
      case 'member': go('member', id); break;
      case 'setparent': if (await rpcToast('staff_update', { p_id: id, p: { parent_id: b.dataset.v ? Number(b.dataset.v) : null } }, 'اتغيّر')) await load(); break;
      case 'toggle': { const p = P(id); if (await rpcToast('staff_update', { p_id: id, p: { active: !p.active } }, p.active ? 'اتوقف' : 'رجع')) await load(); break; }
      case 'newcode': { const c = await rpcToast('staff_new_code', { p_id: id }); if (c) go('code', null, { code: c, name: P(id).name }); break; }
      case 'copy': try { await navigator.clipboard.writeText(b.dataset.v); toast('اتنسخ'); } catch (e) { toast('الكود: ' + b.dataset.v); } break;
      case 'noop': break;
      default: break;
    }
  }, { signal: ac.signal });
  root.addEventListener('input', (ev) => { const t = ev.target, L = top(); if (t.dataset.ln && L) L[t.dataset.ln] = t.value; }, { signal: ac.signal });
  const onKey = (e) => { if (e.key === 'Escape' && top()) back(); };
  document.addEventListener('keydown', onKey);
  const timer = setInterval(() => { if (!top()) load(); else sb.rpc('desk_notifications').then(({ data }) => { if (data) { S.notes = data; } }); }, 60000);
  render(); load();
  return () => { dead = true; ac.abort(); clearInterval(timer); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
}
