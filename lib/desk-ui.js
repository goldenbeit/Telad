// Team desk for buyer requests: each role sees its own tabs, a request opens in a bottom sheet,
// and every step (forward, confirm, assign, statuses, return, close) opens a second sheet on top.
// Vanilla UI mounted into a shadow root (styles in desk-css.js). All data goes through the desk_* RPCs.
import { DESK_CSS } from './desk-css';

const ROLES = { junior: 'جونيور', senior: 'سينيور', sup: 'مشرف', tl: 'تيم ليدر', sadmin: 'سيلز أدمن', web: 'ويب أدمن', gm: 'GM', owner: 'الأدمن' };
const ROLE_ORDER = ['gm', 'sadmin', 'web', 'tl', 'sup', 'senior', 'junior'];
const SALES = ['junior', 'senior'];
const M = 60000, H = 60 * M, D = 24 * H;
const MINS = [['ساعة', 60], ['ساعتين', 120], ['4 ساعات', 240], ['يوم', 1440]];
// [key, label on screen, label the database stores on the status step]
const STS = [['call_buyer', 'اتواصلت مع المشتري', 'تواصلنا مع المشتري'], ['call_seller', 'اتواصلت مع البائع', 'تواصلنا مع البائع'], ['visit_set', 'المعاينة اتحددت', 'اتحدد معاد معاينة'],
  ['visited', 'المعاينة تمت', 'المعاينة تمت'], ['nego', 'بنتفاوض على السعر', 'بنتفاوض على السعر'], ['deposit', 'العربون اتدفع', 'اتدفع عربون']];
const ST_MINS = 120;
const LOST = ['السعر عالي عليه', 'لقى قطعة تانية', 'العميل مبيردّش', 'البائع رجع في كلامه', 'سبب تاني'];
const OUT = { sold: 'اتباع', lost: 'ما اتباعش', deposit: 'اتدفع عربون', follow: 'محتاج متابعة' };
const STAGE_ROLE = { new: 'سيلز أدمن', up_sa: 'سيلز أدمن', tl: 'تيم ليدر', up_tl: 'تيم ليدر', sup: 'مشرف', up_sup: 'مشرف', sales: 'سيلز' };
const LEG_ROLE = { sadmin: 'سيلز أدمن', tl: 'تيم ليدر', sup: 'مشرف', junior: 'سيلز', senior: 'سيلز' };
const PAY_TXT = { check: 'شيك التقنين', waiver: 'التنازل', comp: 'الاستكمال', inst: 'الأقساط' };
const LSTAGE = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
const ERR = { phone_required: 'رقم العميل مش متسجل.', invalid_phone: 'اكتب رقم موبايل مصري صح.', mins_required: 'اختار المهلة.', note_required: 'اكتب السبب.', reason_required: 'اختار السبب.', invalid_sup: 'اختار المشرف.', invalid_sales: 'اختار السيلز.', not_allowed: 'مش مسموح لك بالخطوة دي، أو الطلب اتحرّك. حدّث الصفحة.', invalid_parent: 'اختار صح.', phone_taken: 'الرقم ده متسجل قبل كده.', has_open: 'العضو ده عنده طلبات مفتوحة دلوقتي. لازم تتحوّل الأول.', not_self: 'مينفعش تغيّر أو تمسح حسابك إنت.', not_owner: 'الصلاحية دي للأدمن والـ GM بس.', staff_phone_key: 'الرقم ده متسجل قبل كده.', invalid_outcome: 'اختار النتيجة.', invalid_status: 'الحالة دي مش موجودة.' };
const IC = {
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  ref: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Math.round(Number(n)).toLocaleString('en-US'));
const T = (v) => (v ? Date.parse(v) : null);
const now = () => Date.now();
function when(t) { if (!t) return ''; const d = new Date(t); const h = d.getHours(), m = d.getMinutes(); return d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' ص' : ' م'); }
function dur(ms) { ms = Math.max(0, ms); const m = Math.round(ms / M); if (m < 60) return Math.max(1, m) + ' د'; const h = Math.floor(m / 60), r = m % 60; if (h < 24) return h + ' س' + (r ? ' ' + r + ' د' : ''); return Math.round(h / 24 * 10) / 10 + ' يوم'; }
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function mountDesk(sb, host, me, onSignOut, opts = {}) {
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${DESK_CSS}</style><div class="dkr"><div class="app" id="app"></div>
  <div class="ov" id="ov" hidden><div class="scrim" data-a="close"></div><div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="shT"><div class="peek" id="peek" hidden></div>
  <div class="sh-h"><button class="x" data-a="back" id="shBack" aria-label="رجوع">→</button><h2 id="shT"></h2><button class="x" data-a="close" aria-label="قفل">✕</button></div>
  <div class="sh-b" id="shB"></div><div class="sh-f" id="shF"></div></div></div></div>`;
  const $ = (id) => root.getElementById(id);
  const R = me.owner ? 'owner' : me.role;
  const canManage = R === 'owner' || R === 'gm';
  const isSA = R === 'owner' || R === 'sadmin', isWeb = R === 'owner' || R === 'web', isSales = SALES.includes(R);
  const S = { staff: [], reqs: [], notes: [], loaded: false, err: false };
  const UI = { tab: null, flt: 'open', per: 30, stack: [] };
  const DETAIL = {};
  let busy = false, dead = false;

  const P = (id) => S.staff.find((p) => p.id === id) || { name: '—', role: '' };
  const byRole = (r) => S.staff.filter((p) => p.role === r && p.active);
  const allSales = () => S.staff.filter((p) => SALES.includes(p.role) && p.active);
  const Rq = (id) => S.reqs.find((r) => r.id === id);
  const photoUrl = (path) => (path ? sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl : '');

  // ---------- data ----------
  function norm(r) { r.legs = (r.legs || []).map((l) => ({ ...l, start: T(l.start), due: T(l.due), end: T(l.end) })); r.at = T(r.created_at); r.st_due_t = T(r.st_due); r.first_t = T(r.first_at); r.closed_t = T(r.closed_at); return r; }
  async function rpcAll(fn) {
    const out = [];
    for (let from = 0; ; from += 1000) { const r = await sb.rpc(fn).range(from, from + 999); if (r.error) return r; out.push(...(r.data || [])); if (!r.data || r.data.length < 1000) return { data: out }; }
  }
  async function load() {
    const [st, rq, nt] = await Promise.all([sb.rpc('desk_staff'), rpcAll('desk_requests'), sb.rpc('desk_notifications')]);
    if (dead) return;
    if (st.error || rq.error) { S.err = true; render(); return; }
    S.staff = st.data || []; S.reqs = (rq.data || []).map(norm); S.notes = nt.data || []; S.loaded = true; S.err = false;
    const meRow = S.staff.find((p) => p.id === me.id); if (meRow) me.avail = meRow.avail;
    render();
  }
  async function loadDetail(id) { const { data } = await sb.rpc('desk_request', { p_id: id }); if (data && !dead) { DETAIL[id] = data; if (UI.stack.some((L) => L.id === id)) renderSheet(); } }
  function errMsg(error) { const k = Object.keys(ERR).find((e) => (error.message || '').includes(e)); return k ? ERR[k] : 'محصلش. جرب تاني.'; }
  async function act(id, p, okMsg, pops) {
    if (busy) return; busy = true; renderSheet();
    const { error } = await sb.rpc('desk_act', { p_id: id, p });
    busy = false;
    if (error) { toast(errMsg(error)); renderSheet(); return; }
    UI.stack.splice(Math.max(0, UI.stack.length - (pops || 0)));
    delete DETAIL[id]; toast(okMsg); await load();
  }
  async function rpcToast(fn, args, ok) { if (busy) return null; busy = true; renderSheet(); const { data, error } = await sb.rpc(fn, args); busy = false; if (error) { toast(errMsg(error)); renderSheet(); return null; } if (ok) toast(ok); return data ?? true; }

  // ---------- rules on the client (the database checks them again) ----------
  function holderLeg(r) { for (let i = r.legs.length - 1; i >= 0; i--) if (r.legs[i].kind === 't' && !r.legs[i].end) return r.legs[i]; return null; }
  function curDue(r) { if (r.stage === 'closed') return null; if (r.stage === 'sales' && r.st_due_t) return r.st_due_t; const l = holderLeg(r); return l ? l.due : null; }
  const isLate = (r) => { const d = curDue(r); return !!(d && d < now()); };
  function isMine(r) {
    if (r.stage === 'closed') return false;
    if (r.via === 'ask') return isSA;
    if (r.stage === 'new' || r.stage === 'up_sa') return isSA;
    if (r.stage === 'tl' || r.stage === 'up_tl') return R === 'tl' && r.tl_id === me.id;
    if (r.stage === 'sup' || r.stage === 'up_sup') return R === 'sup' && r.sup_id === me.id;
    if (r.stage === 'sales') return isSales && r.sales_id === me.id;
    return false;
  }
  function holderName(r) {
    if (r.stage === 'new' || r.stage === 'up_sa' || r.via === 'ask') return 'السيلز أدمن';
    const id = { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage];
    return id ? P(id).name : '—';
  }
  const informed = (r) => r.tl_mode === 'info';
  // statuses done on this request, from the status steps the database keeps
  function stDone(r) {
    const out = {}; let prevDue = null;
    const tr = r.legs.filter((l) => l.kind === 't' && SALES.includes(l.role)); if (tr.length) prevDue = tr[tr.length - 1].due;
    r.legs.filter((l) => l.kind === 's').forEach((l) => { const s = STS.find((x) => x[2] === l.label); if (s && !out[s[0]]) out[s[0]] = { at: l.start, late: !!(prevDue && l.start > prevDue) }; prevDue = l.due; });
    return out;
  }
  function unitTitle(r) { if (r.via === 'ask') return 'بيدوّر على قطعة'; return [r.l_district ? 'الحي ' + r.l_district : r.l_zone, r.l_area ? fmt(r.l_area) + ' م²' : ''].filter(Boolean).join(' · ') || (r.code || 'قطعة'); }

  // ---------- navigation ----------
  const top = () => UI.stack[UI.stack.length - 1];
  function push(o) { UI.stack.push(o); renderSheet(); $('shB').scrollTop = 0; }
  function closeAll() { UI.stack = []; renderSheet(); }
  let tt; function toast(m) { const o = root.querySelector('.toast'); if (o) o.remove(); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = m; root.querySelector('.dkr').appendChild(d); clearTimeout(tt); tt = setTimeout(() => d.remove(), 3200); }

  // ---------- pieces ----------
  function timerChip(r) { const due = curDue(r); if (!due) return ''; const d = due - now(); return d < 0 ? `<span class="chip c-bad num">متأخر ${dur(-d)}</span>` : `<span class="chip ${d < 30 * M ? 'c-warn' : 'c-ok'} num">فاضل ${dur(d)}</span>`; }
  function whereChip(r) {
    if (r.stage === 'closed') return r.outcome === 'sold' ? '<span class="chip c-ok">اتباع ✓</span>' : `<span class="chip">${esc(OUT[r.outcome] || 'اتقفل')}</span>`;
    const up = r.stage.startsWith('up_');
    if (isMine(r)) return `<span class="chip c-me">${up ? '↑ ' : ''}عندك</span>`;
    return `<span class="chip c-blue">${up ? '↑ ' : ''}عند ${esc(holderName(r))}${r.stage !== 'new' && r.stage !== 'up_sa' ? ' · ' + STAGE_ROLE[r.stage] : ''}</span>`;
  }
  function card(r) {
    const done = stDone(r), last = STS.filter((s) => done[s[0]]).pop();
    return `<button class="rc${isLate(r) ? ' late' : ''}" data-a="open" data-id="${r.id}"><div class="rc-top"><b>${esc(unitTitle(r))}</b><span class="code">R-${r.id}${r.code ? ' · ' + esc(r.code) : ''}</span></div>
    <div class="sub">${esc(r.name || '—')}${informed(r) && r.stage !== 'new' ? ' · التيم ليدر للعلم' : ''}</div>
    <div class="chips">${whereChip(r)}${timerChip(r)}${r.stage === 'sales' && last ? `<span class="chip">${last[1]}</span>` : ''}${r.outcome && r.stage !== 'closed' ? `<span class="chip ${r.outcome === 'sold' ? 'c-ok' : ''}">${esc(OUT[r.outcome])}</span>` : ''}${r.notes ? `<span class="chip">${r.notes} ملاحظة</span>` : ''}</div></button>`;
  }
  const list = (l, emp) => (l.length ? l.map(card).join('') : `<div class="empty">${emp}</div>`);
  const counts = (pid) => { const open = S.reqs.filter((r) => r.stage !== 'closed' && holderIdOf(r) === pid); return { open: open.length, late: open.filter(isLate).length }; };
  function holderIdOf(r) { return { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage] || null; }

  // ---------- main views ----------
  function tabsFor() {
    if (R === 'owner' || R === 'sadmin') return [['mine', 'عندي'], ['all', 'كل الطلبات'], ['mirror', 'المراية'], ['rep', 'التقارير']].concat(canManage ? [['team', 'الفريق']] : []);
    if (R === 'gm') return [['all', 'كل الطلبات'], ['mirror', 'المراية'], ['rep', 'التقارير'], ['team', 'الفريق']];
    if (R === 'web') return [['all', 'الطلبات'], ['rep', 'التقارير']];
    if (R === 'tl') return [['mine', 'عندي'], ['info', 'للعلم'], ['mirror', 'المراية'], ['rep', 'التقارير']];
    if (R === 'sup') return [['mine', 'عندي'], ['mirror', 'فريقي'], ['rep', 'التقارير']];
    return [['mine', 'عندي'], ['done', 'خلصت'], ['rep', 'أدائي']];
  }
  const infoList = () => S.reqs.filter((r) => R === 'tl' && r.tl_id === me.id && informed(r));
  function header() {
    const un = S.notes.filter((n) => !n.read).length, tabs = tabsFor();
    if (!tabs.some((t) => t[0] === UI.tab)) UI.tab = tabs[0][0];
    const badge = (t) => (t === 'mine' ? S.reqs.filter(isMine).length : t === 'info' ? infoList().filter((r) => !r.tl_ack && r.stage !== 'closed').length : 0);
    return `<header class="hd"><div class="hd-in"><span class="brand">تِلاد</span><span class="me"><b>${esc(me.name || '')}</b><span>${ROLES[R]}</span></span>
    ${opts.onListings ? '<button class="ib" data-a="listings">الإعلانات</button>' : ''}<button class="ib" data-a="reload" aria-label="تحديث">${IC.ref}</button>
    <button class="ib" data-a="bell" aria-label="التنبيهات${un ? '، ' + un + ' جديدة' : ''}">${IC.bell}${un ? `<b class="num">${un}</b>` : ''}</button><button class="ib" data-a="signout" aria-label="خروج">${IC.out}</button></div>
    <nav class="tabs">${tabs.map((t) => { const c = badge(t[0]); return `<button class="tab${UI.tab === t[0] ? ' on' : ''}" data-a="tab" data-v="${t[0]}">${t[1]}${c ? `<i class="num">${c}</i>` : ''}</button>`; }).join('')}</nav></header>`;
  }
  function vMain() {
    if (S.err) return '<div class="empty">مقدرناش نحمّل الطلبات. دوس تحديث.</div>';
    if (!S.loaded) return '<div class="empty">بنحمّل...</div>';
    const t = UI.tab;
    if (t === 'mine') {
      const mine = S.reqs.filter(isMine).sort((a, b) => (curDue(a) || 9e15) - (curDue(b) || 9e15));
      return (isSales ? availSwitch() : '') + list(mine, 'مفيش طلبات عندك دلوقتي.');
    }
    if (t === 'info') return list(infoList(), 'مفيش طلبات للعلم.');
    if (t === 'done') return list(S.reqs.filter((r) => !isMine(r)), 'لسه مخلصتش طلبات.');
    if (t === 'all') {
      const tasks = isWeb ? S.reqs.filter((r) => r.web_task) : [];
      let l = S.reqs;
      if (UI.flt === 'open') l = l.filter((r) => r.stage !== 'closed'); else if (UI.flt === 'late') l = l.filter(isLate); else if (UI.flt === 'closed') l = l.filter((r) => r.stage === 'closed');
      return tasks.map((r) => `<div class="task"><b>اتباعت ${esc(r.code || '')}${r.l_district ? ' · الحي ' + esc(r.l_district) : ''}</b><span class="sub">علّمها إنها اتباعت في لوحة الإعلانات، وبعدين دوس هنا.</span><button class="btn sm dark" data-a="webdone" data-id="${r.id}">شيلتها من الموقع</button></div>`).join('')
        + `<div class="flt">${[['open', 'مفتوح'], ['late', 'متأخر'], ['closed', 'اتقفل'], ['any', 'الكل']].map((f) => `<button class="fc${UI.flt === f[0] ? ' on' : ''}" data-a="flt" data-v="${f[0]}">${f[1]}</button>`).join('')}</div>` + list(l, 'مفيش طلبات هنا.');
    }
    if (t === 'mirror') return vMirror();
    if (t === 'rep') return vReports();
    if (t === 'team') return vTeam();
    return '';
  }
  function availSwitch() { const on = me.avail !== false; return `<button class="sw" data-a="avail"><span class="tg${on ? ' on' : ''}" aria-hidden="true"></span><span>${on ? 'متاح لطلبات جديدة' : 'مش متاح دلوقتي'}</span></button>`; }

  function mrow(p) {
    const c = counts(p.id), sales = SALES.includes(p.role), av = sales ? (p.avail !== false ? ' on' : ' off') : '';
    return `<button class="mr" data-a="person" data-id="${p.id}"><span class="av${av}">${esc(p.name.slice(0, 1))}</span><span class="nm"><b>${esc(p.name)}</b><span>${ROLES[p.role]}${sales ? (p.avail !== false ? ' · متاح' : ' · مش متاح') : ''}${p.activated ? '' : ' · لسه ما فعّلش'}</span></span><span class="ct"><span class="chip num">${c.open} في إيده</span>${c.late ? `<span class="chip c-bad num">${c.late} متأخر</span>` : ''}</span></button>`;
  }
  function vMirror() {
    const sups = byRole('sup'), sales = allSales();
    let h = '';
    if (R !== 'sup' && sups.length) h += `<section class="team"><header><b>المشرفين</b></header>${sups.map(mrow).join('')}</section>`;
    h += sales.length ? `<section class="team"><header><b>السيلز</b><span class="sub">أي مشرف يقدر يدي أي سيلز</span></header>${sales.map(mrow).join('')}</section>` : '<div class="empty">مفيش سيلز متسجلين لسه.</div>';
    return h;
  }

  // ---------- reports ----------
  const since = () => (UI.per ? now() - UI.per * D : 0);
  const legMatch = (l, p) => l.staff_id === p.id || (l.staff_id == null && l.role === p.role);
  function metrics(pid) {
    const p = P(pid), s0 = since(), t = now(), legs = [];
    S.reqs.forEach((r) => r.legs.forEach((l) => { if (l.kind === 't' && legMatch(l, p) && l.start >= s0) legs.push(l); }));
    const done = legs.filter((l) => l.end), late = legs.filter((l) => l.due && (l.end || t) > l.due);
    const m = { recv: legs.length, done: done.length, late: late.length, open: counts(pid).open, lateNow: counts(pid).late,
      avg: avg(done.map((l) => l.end - l.start)), onTime: legs.length ? Math.round(100 * (legs.length - late.length) / legs.length) : null };
    if (SALES.includes(p.role)) {
      const mine = S.reqs.filter((r) => r.sales_id === pid && r.at >= s0), res = mine.filter((r) => r.outcome === 'sold' || r.outcome === 'lost');
      m.sold = res.filter((r) => r.outcome === 'sold').length; m.lost = res.length - m.sold; m.conv = res.length ? Math.round(100 * m.sold / res.length) : null;
      let stAll = 0, stLate = 0; mine.forEach((r) => { const d = stDone(r); Object.values(d).forEach((x) => { stAll++; if (x.late) stLate++; }); });
      m.stAll = stAll; m.stLate = stLate;
    }
    return m;
  }
  function scopeIds() {
    if (isSales) return [me.id];
    let people = S.staff.filter((p) => p.active && !['gm', 'web'].includes(p.role));
    if (R === 'sup') people = [P(me.id), ...allSales()];
    return people.map((p) => p.id);
  }
  function vReports() {
    const per = `<div class="flt">${[[7, 'آخر 7 أيام'], [30, 'آخر 30 يوم'], [0, 'كل الفترة']].map((o) => `<button class="fc${UI.per === o[0] ? ' on' : ''}" data-a="per" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    if (isSales) return per + personDetail(me.id);
    const s0 = since(), rs = S.reqs.filter((r) => r.at >= s0 && (R !== 'sup' || r.sup_id === me.id));
    const closed = rs.filter((r) => r.stage === 'closed'), res = closed.filter((r) => r.outcome === 'sold' || r.outcome === 'lost'), sold = res.filter((r) => r.outcome === 'sold').length;
    let h = per + `<div class="tiles"><div class="tl"><b>${rs.length}</b><span>طلب</span></div><div class="tl"><b>${rs.filter((r) => r.stage !== 'closed').length}</b><span>مفتوح</span></div><div class="tl bad"><b>${rs.filter(isLate).length}</b><span>متأخر دلوقتي</span></div><div class="tl ok"><b>${sold}</b><span>اتباع</span></div><div class="tl"><b>${res.length - sold}</b><span>ما اتباعش</span></div><div class="tl"><b>${res.length ? Math.round(100 * sold / res.length) + '%' : '—'}</b><span>نسبة البيع</span></div></div>`;
    const st = { 'سيلز أدمن': [], 'تيم ليدر': [], 'مشرف': [], 'سيلز': [] };
    rs.forEach((r) => r.legs.forEach((l) => { if (l.kind === 't' && l.end && LEG_ROLE[l.role]) st[LEG_ROLE[l.role]].push(l.end - l.start); }));
    const av = Object.entries(st).map(([k, a]) => [k, avg(a) || 0]), mx = Math.max(1, ...av.map((a) => a[1]));
    const avgClose = avg(closed.filter((r) => r.closed_t).map((r) => r.closed_t - r.at));
    h += `<section class="card"><h3>متوسط الوقت في كل خطوة</h3>${av.map(([k, v]) => `<div class="bar"><span>${k}</span><div><i style="width:${Math.round(100 * v / mx)}%"></i></div><b>${v ? dur(v) : '—'}</b></div>`).join('')}<span class="sub">متوسط مدة الطلب من أوله لحد ما يتقفل: <b class="num">${avgClose ? dur(avgClose) : '—'}</b></span></section>`;
    const why = {}; res.filter((r) => r.outcome === 'lost').forEach((r) => { const k = r.outcome_reason || 'من غير سبب'; why[k] = (why[k] || 0) + 1; });
    h += `<section class="card"><h3>أسباب ما اتباعش</h3>${Object.keys(why).length ? `<div class="kv">${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    const ids = scopeIds();
    h += `<section class="card"><h3>الأفراد</h3>${ids.length ? `<div class="tbl"><table><thead><tr><th>الاسم</th><th>في إيده</th><th>خلّص</th><th>متأخر</th><th>في الوقت</th></tr></thead><tbody>${ids.map((id) => { const p = P(id), m = metrics(id);
      return `<tr data-a="person" data-id="${id}"><td><b>${esc(p.name)}</b><span class="r">${ROLES[p.role] || ''}</span></td><td>${m.open}</td><td>${m.done}</td><td${m.late ? ' style="color:var(--bad)"' : ''}>${m.late}</td><td>${m.onTime == null ? '—' : m.onTime + '%'}</td></tr>`; }).join('')}</tbody></table></div><span class="sub">دوس على أي اسم يطلعلك التفاصيل.</span>` : '<span class="sub">مفيش فريق متسجل لسه.</span>'}</section>`;
    return h;
  }
  function personDetail(pid) {
    const p = P(pid), m = metrics(pid), sales = SALES.includes(p.role);
    const rows = [['في إيده دلوقتي', m.open], ['متأخر دلوقتي', m.lateNow], ['وصله', m.recv + ' تحويلة'], [sales ? 'رد على' : 'خلّص', m.done], ['اتأخر فيه', m.late], ['في الوقت', m.onTime == null ? '—' : m.onTime + '%'], [sales ? 'متوسط وقت أول تواصل' : 'متوسط وقت الرد', m.avg == null ? '—' : dur(m.avg)]];
    if (sales) rows.push(['اتباع', m.sold], ['ما اتباعش', m.lost], ['نسبة البيع', m.conv == null ? '—' : m.conv + '%'], ['حالات اتسجلت متأخر', m.stLate + ' من ' + m.stAll]);
    const open = S.reqs.filter((r) => r.stage !== 'closed' && holderIdOf(r) === pid);
    return `<div class="kv">${rows.map((r) => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>` + (open.length ? `<div class="blk"><h3>اللي في إيده</h3>${open.map(card).join('')}</div>` : '');
  }

  // ---------- team (owner and GM) ----------
  function vTeam() {
    let h = canManage ? '<button class="btn pri" data-a="addmember">+ ضيف عضو</button>' : '';
    const groups = ROLE_ORDER.map((r0) => [r0, S.staff.filter((p) => p.role === r0)]).filter((g) => g[1].length);
    h += groups.length ? groups.map((g) => `<section class="team"><header><b>${ROLES[g[0]]}</b><span class="sub num">${g[1].length}</span></header>${g[1].map((p) => `<button class="mr" data-a="${canManage && p.id !== me.id ? 'member' : 'noop'}" data-id="${p.id}"${p.active ? '' : ' style="opacity:.55"'}><span class="av">${esc(p.name.slice(0, 1))}</span><span class="nm"><b>${esc(p.name)}${p.id === me.id ? ' (إنت)' : ''}</b><span>${p.active ? '' : 'موقوف · '}${p.activated ? 'فعّل حسابه' : 'لسه ما فعّلش'}</span></span></button>`).join('')}</section>`).join('') : '<div class="empty">مفيش أعضاء لسه.</div>';
    return h;
  }

  // ---------- request sheet ----------
  function path(r) {
    if (r.via === 'ask') return '';
    const idx = { new: 0, up_sa: 0, tl: 1, up_tl: 1, sup: 2, up_sup: 2, sales: 3 }[r.stage], closed = r.stage === 'closed', up = !closed && r.stage.startsWith('up_');
    const nodes = [['الأدمن', 'السيلز أدمن'], ['التيم ليدر', r.tl_id ? P(r.tl_id).name : '—'], ['المشرف', r.sup_id ? P(r.sup_id).name : '—'], ['السيلز', r.sales_id ? P(r.sales_id).name : '—']];
    return `<div class="path">${nodes.map((n, i) => { let c = closed ? 'done' : i === idx ? 'now' : up ? 'done' : i < idx ? 'done' : ''; const fyi = i === 1 && informed(r) && r.stage !== 'new'; if (fyi && !closed && i !== idx) c = 'fyi';
      return `<div class="pn ${c}"><i>${c === 'done' ? '✓' : i + 1}</i><b>${n[0]}</b><span>${fyi ? 'للعلم بس' : esc(n[1])}</span></div>`; }).join('')}</div><p class="dir">${closed ? 'الطلب اتقفل' : up ? '↑ راجع لفوق' : r.stage === 'new' ? 'لسه عند الأدمن' : '↓ نازل'}</p>`;
  }
  const fact = (k, v, wide) => `<div${wide ? ' class="w"' : ''}><span>${k}</span><b>${v}</b></div>`;
  function unitBlock(r, d) {
    if (r.via === 'ask') return `<div class="blk"><h3>المطلوب</h3><div class="facts">${fact('المنطقة', esc(r.zone || '—'))}${fact('الحي', esc(r.district || '—'))}${fact('الميزانية', r.budget ? fmt(r.budget) + ' ج.م' : '—', 1)}</div></div>`;
    if (!d) return '<div class="blk"><h3>القطعة</h3><span class="sub">بنحمّل بيانات القطعة...</span></div>';
    const u = d.unit; if (!u) return '<div class="blk"><h3>القطعة</h3><span class="sub">القطعة دي اتشالت.</span></div>';
    const status = u.allocated === false ? `غير مخصصة · ${u.on_list ? 'على الكشف' : 'مش على الكشف'} · الشيك ${u.check_paid ? 'مدفوع' : 'مش مدفوع'}` : LSTAGE[u.stage] || 'مخصصة';
    const pay = ((u.pay && u.pay.items) || []).map((i) => fact('↳ ' + esc(PAY_TXT[i.k] || i.k), i.amt != null ? fmt(i.amt) + ' ج.م' : '—')).join('');
    const ph = photoUrl(u.photo_path);
    return `<div class="blk"><h3>القطعة ${esc(u.code || '')}</h3>${ph ? `<img class="photo" src="${esc(ph)}" alt="صورة القطعة" loading="lazy">` : ''}<div class="facts">
      ${fact('المنطقة', esc(u.zone || '—'))}${fact('الحي', esc(u.district || '—'))}
      ${fact('المجاورة / البلوك / القطعة', esc([u.neighborhood || '—', u.block || '—', u.plot || '—'].join(' / ')), 1)}
      ${fact('أصل المساحة', u.area_orig != null ? fmt(u.area_orig) + ' م²' : '—')}${fact('بعد التقنين', u.area_final != null ? fmt(u.area_final) + ' م²' : '—')}
      ${fact('الواجهة', esc(u.facade || '—'))}${fact('قدامها', esc(u.view_type || '—'))}
      ${fact('حالة القطعة', esc(status), 1)}
      ${fact('السعر الكلي', fmt(u.price) + ' ج.م')}${fact('المطلوب دفعه', fmt(u.paid) + ' ج.م')}
      ${fact('المتبقي', fmt(u.remaining) + ' ج.م')}${fact('الأقساط المتبقية', u.inst_left ?? '—')}${pay}
      ${u.description ? fact('الوصف', esc(u.description), 1) : ''}
      ${fact('البائع', esc(u.owner_name || '—'))}${fact('رقم البائع', `<span dir="ltr">${esc(u.owner_phone || '—')}</span>`)}
      ${fact('خطاب التخصيص', u.has_letter ? 'موجود · بيتفتح من لوحة الإعلانات (للأدمن)' : 'مش مرفوع', 1)}</div>
      ${u.owner_phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(u.owner_phone)}">كلّم البائع</a><a class="btn sm wa" href="https://wa.me/2${esc(u.owner_phone)}" target="_blank" rel="noopener">واتساب البائع</a></div>` : ''}</div>`;
  }
  function vReq(L) {
    const r = Rq(L.id); if (!r) return { t: 'الطلب', b: '<div class="empty">الطلب ده مش ظاهر لك دلوقتي.</div>', f: '' };
    const d = DETAIL[r.id]; if (!d && !L.loading) { L.loading = true; loadDetail(r.id); }
    const mine = isMine(r);
    let h = `<div class="blk"><div class="facts">${fact('المشتري', esc(r.name || '—'))}${fact('رقمه', `<span dir="ltr">${esc(r.phone || '—')}</span>`)}${fact('وصل', when(r.at))}${fact('من', r.via === 'ask' ? 'طلب "بيدوّر على قطعة"' : '"اطلبها" من صفحة القطعة')}</div>
      ${r.phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(r.phone)}">كلّم المشتري</a><a class="btn sm wa" href="https://wa.me/2${esc(r.phone)}" target="_blank" rel="noopener">واتساب المشتري</a></div>` : ''}</div>`;
    h += `<div class="blk">${path(r)}<div class="chips" style="justify-content:center">${whereChip(r)}${timerChip(r)}</div></div>`;
    if (r.sales_id || r.via === 'ask') {
      const done = stDone(r), can = (mine && r.stage === 'sales') || (r.via === 'ask' && isSA && r.stage !== 'closed');
      h += `<div class="blk"><h3>حالة الطلب${r.sales_id ? ' مع ' + esc(P(r.sales_id).name) : ''}</h3><div class="sts">${STS.map((s) => { const x = done[s[0]];
        return `<button class="st${x ? ' on' : ''}"${can && !x ? ` data-a="status" data-v="${s[0]}"` : ' disabled'}><i>${x ? '✓' : ''}</i><span>${s[1]}</span>${x ? `<small>${x.late ? '<span style="color:var(--bad)">متأخر · </span>' : ''}${when(x.at)}</small>` : ''}</button>`; }).join('')}</div>${can ? '<span class="sub">كل حالة ليها ساعتين من اللي قبلها.</span>' : ''}</div>`;
    }
    if (r.outcome) h += `<div class="blk"><div class="chips"><span class="chip ${r.outcome === 'sold' ? 'c-ok' : ''}">النتيجة: ${esc(OUT[r.outcome])}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome_summary ? `<div class="log"><div class="lg"><span><b>${esc(P(r.sales_id).name)}</b> — ملخص</span><span></span><q>${esc(r.outcome_summary)}</q></div></div>` : ''}</div>`;
    h += unitBlock(r, d);
    if (d) {
      const items = d.events.map((e) => ({ at: T(e.at), who: e.who, txt: e.body })).concat(d.notes.map((n) => ({ at: T(n.at), who: n.who, role: n.role, txt: n.kind === 'instr' ? 'تعليمات' : 'ملاحظة', note: n.body, instr: n.kind === 'instr' }))).sort((a, b) => b.at - a.at);
      h += `<div class="blk"><h3>السجل</h3><div class="log">${items.map((x) => `<div class="lg"><span>${x.who ? `<b>${esc(x.who)}</b>${x.role ? ' <span class="sub">· ' + (ROLES[x.role] || '') + '</span>' : ''} — ` : ''}${esc(x.txt)}</span><time class="num">${when(x.at)}</time>${x.note ? `<q class="${x.instr ? 'instr' : ''}">${esc(x.note)}</q>` : ''}</div>`).join('')}</div></div>`;
    }
    const b = [];
    if (R !== 'gm' && r.stage !== 'closed') b.push('<button class="btn ghost" data-a="sub" data-v="note">ملاحظة</button>');
    if (R === 'tl' && r.tl_id === me.id && informed(r) && !r.tl_ack && r.stage !== 'closed') b.push(`<button class="btn" data-a="ack"${busy ? ' disabled' : ''}>شفته</button>`);
    if (mine) {
      const upLabel = r.stage === 'up_sup' && r.tl_id && !informed(r) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن';
      const A = r.via === 'ask' ? [['close', 'اقفل الطلب', 'pri']] : {
        new: [['fwd', 'حوّل', 'pri']], tl: [['confirm', 'حوّل لمشرف', 'pri']], sup: [['assign', 'اختار السيلز', 'pri']], sales: [['finish', 'خلّصت', 'pri']],
        up_sup: [['down', 'رجّعه للسيلز', ''], ['up', upLabel, 'pri']], up_tl: [['down', 'رجّعه للمشرف', ''], ['up', 'ابعته للسيلز أدمن', 'pri']], up_sa: [['down', 'رجّعه', ''], ['close', 'اقفل الطلب', 'pri']] }[r.stage] || [];
      A.forEach((a) => b.push(`<button class="btn ${a[2]}" data-a="sub" data-v="${a[0]}">${a[1]}</button>`));
    }
    return { t: 'R-' + r.id + (r.code ? ' · ' + r.code : ''), b: h, f: b.join('') };
  }

  // ---------- action sheets ----------
  const minsPick = (f) => `<div class="fld"><span>المهلة للي هيستلمه</span><div class="seg">${MINS.map(([l, m]) => `<button class="${f.mins === m ? 'on' : ''}" data-a="set" data-k="mins" data-v="${m}" data-num="1">${l}</button>`).join('')}</div></div>`;
  const noteF = (f, label) => `<label class="fld"><span>${label || 'ملاحظة أو تعليمات (اختياري)'}</span><textarea data-f="note" rows="3" maxlength="1000">${esc(f.note || '')}</textarea></label>`;
  const opt = (k, v, on, title, sub, extra, dis, num) => `<button class="opt${on ? ' on' : ''}" data-a="set" data-k="${k}" data-v="${v}"${num ? ' data-num="1"' : ''}${dis ? ' disabled' : ''}><span class="rd"></span><span class="tx"><b>${title}${extra || ''}</b>${sub ? `<span>${sub}</span>` : ''}</span></button>`;
  const supPick = (f) => { const sups = byRole('sup'); return `<div class="fld"><span>المشرف</span>${sups.length ? `<div class="pick">${sups.map((s) => { const c = counts(s.id); return opt('sup', s.id, f.sup === s.id, esc(s.name), `${c.open} طلب في إيده${c.late ? ' · ' + c.late + ' متأخر' : ''}${s.activated ? '' : ' · لسه ما فعّلش'}`, '', false, 1); }).join('')}</div>` : '<span class="sub">مفيش مشرفين متسجلين.</span>'}</div>`; };
  const tlPick = (f) => { const tls = byRole('tl'); return tls.length > 1 ? `<div class="fld"><span>التيم ليدر</span><div class="pick">${tls.map((t) => opt('tl', t.id, f.tl === t.id, esc(t.name), counts(t.id).open + ' طلب في إيده', '', false, 1)).join('')}</div></div>` : ''; };
  function suggestSales() { return allSales().filter((p) => p.avail !== false).sort((a, b) => counts(a.id).open - counts(b.id).open || counts(a.id).late - counts(b.id).late)[0] || null; }
  const ACT = {
    fwd: { t: 'حوّل الطلب',
      init: () => { const tls = byRole('tl'); return { mode: tls.length ? 'confirm' : 'info', tl: tls.length === 1 ? tls[0].id : null }; },
      body: (r, f) => { const hasTl = byRole('tl').length > 0; return (hasTl ? `<div class="pick">${opt('mode', 'confirm', f.mode === 'confirm', 'للتيم ليدر', 'هو يأكد ويحوّل للمشرف')}${opt('mode', 'info', f.mode === 'info', 'للمشرف على طول', 'والتيم ليدر يتبلّغ بس')}</div>` : '<span class="sub">مفيش تيم ليدر متسجل، فالطلب هيروح للمشرف على طول.</span>') + (hasTl ? tlPick(f) : '') + (f.mode === 'info' ? supPick(f) : '') + noteF(f) + minsPick(f); },
      ok: (f) => (f.mode === 'confirm' ? !!f.tl : !!f.sup) && !!f.mins, btn: (f) => (f.mode === 'info' ? (f.sup ? 'ابعته لـ' + P(f.sup).name : 'اختار المشرف') : f.tl ? 'ابعته للتيم ليدر' : 'اختار التيم ليدر'),
      run: (r, f) => act(r.id, { a: 'forward', tl_id: f.tl || null, sup_id: f.mode === 'info' ? f.sup : null, mode: f.mode, mins: f.mins, note: f.note }, 'اتحوّل', 2) },
    confirm: { t: 'حوّل لمشرف', body: (r, f) => supPick(f) + noteF(f) + minsPick(f), ok: (f) => !!f.sup && !!f.mins, btn: (f) => (f.sup ? 'ابعته لـ' + P(f.sup).name : 'اختار المشرف'),
      run: (r, f) => act(r.id, { a: 'confirm', sup_id: f.sup, mins: f.mins, note: f.note }, 'اتبعت للمشرف', 2) },
    assign: { t: 'اختار السيلز', init: () => { const s = suggestSales(); return { sales: s ? s.id : null }; },
      body: (r, f) => { const sug = suggestSales(), team = allSales(); return (team.length ? `<div class="pick">${team.map((p) => { const c = counts(p.id), on = p.avail !== false; return opt('sales', p.id, f.sales === p.id, esc(p.name), (on ? 'متاح' : 'مش متاح') + ` · ${c.open} في إيده` + (c.late ? ` · ${c.late} متأخر` : '') + (p.activated ? '' : ' · لسه ما فعّلش'), sug && sug.id === p.id ? ' <span class="tag-s">مقترح</span>' : '', !on, 1); }).join('')}</div><span class="sub">المقترح: المتاح اللي في إيده أقل شغل.</span>` : '<div class="empty">مفيش سيلز متسجلين.</div>') + noteF(f) + minsPick(f); },
      ok: (f) => !!f.sales && !!f.mins, btn: (f) => (f.sales ? 'اديه لـ' + P(f.sales).name : 'اختار'),
      run: (r, f) => act(r.id, { a: 'assign', sales_id: f.sales, mins: f.mins, note: f.note }, 'اتبعت لـ' + P(f.sales).name, 2) },
    finish: { t: 'خلّصت', body: (r, f) => `<div class="pick">${opt('out', 'sold', f.out === 'sold', 'اتباع')}${opt('out', 'lost', f.out === 'lost', 'ما اتباعش')}</div>${f.out === 'lost' ? `<div class="fld"><span>السبب</span><div class="pick">${LOST.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}</div></div>` : ''}${noteF(f, 'ملخص (اختياري)')}${minsPick(f)}`,
      ok: (f) => (f.out === 'sold' || (f.out === 'lost' && !!f.reason)) && !!f.mins, btn: () => 'ابعته للمشرف',
      run: (r, f) => act(r.id, { a: 'return', outcome: f.out, reason: f.out === 'lost' ? f.reason : '', summary: f.note, mins: f.mins }, 'اتبعت للمشرف', 2) },
    up: { t: 'وافق وابعته لفوق', body: (r, f) => noteF(f) + minsPick(f), ok: (f) => !!f.mins, btn: (f, r) => (r.stage === 'up_sup' && r.tl_id && !informed(r) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن'),
      run: (r, f) => act(r.id, { a: 'up', mins: f.mins, note: f.note }, 'اتبعت', 2) },
    down: { t: 'رجّعه', body: (r, f) => noteF(f, 'السبب (إجباري)') + minsPick(f), ok: (f) => !!(f.note || '').trim() && !!f.mins, btn: () => 'رجّعه',
      run: (r, f) => act(r.id, { a: 'down', note: f.note.trim(), mins: f.mins }, 'رجع', 2) },
    close: { t: 'اقفل الطلب',
      body: (r, f) => (r.outcome ? `<div class="chips"><span class="chip ${r.outcome === 'sold' ? 'c-ok' : ''}">${esc(OUT[r.outcome])}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome === 'sold' ? '<span class="sub">الويب أدمن هيوصله تنبيه يشيل القطعة من الموقع.</span>' : ''}`
        : `<div class="pick">${opt('out', 'sold', f.out === 'sold', 'اتباع')}${opt('out', 'lost', f.out === 'lost', 'ما اتباعش')}</div>${f.out === 'lost' ? `<div class="fld"><span>السبب</span><div class="pick">${LOST.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}</div></div>` : ''}`) + noteF(f),
      ok: (f, r) => !!r.outcome || f.out === 'sold' || (f.out === 'lost' && !!f.reason), btn: () => 'اقفل الطلب',
      run: (r, f) => act(r.id, { a: 'close', outcome: r.outcome || f.out, reason: r.outcome ? '' : (f.reason || ''), note: f.note }, 'الطلب اتقفل', 2) },
    note: { t: 'ملاحظة', body: (r, f) => noteF(f, 'اكتب ملاحظتك') + '<span class="sub">بتظهر لكل اللي ماسكين الطلب، واللي الطلب عنده يوصله تنبيه.</span>', ok: (f) => !!(f.note || '').trim(), btn: () => 'حفظ',
      run: (r, f) => act(r.id, { a: 'note', kind: 'note', note: f.note.trim() }, 'الملاحظة اتسجلت', 1) },
  };
  function vSub(L) { const r = Rq(L.id), a = ACT[L.k], f = L.f; if (!r) return { t: '', b: '', f: '' };
    return { t: a.t, b: a.body(r, f), f: `<button class="btn pri" data-a="run"${a.ok(f, r) && !busy ? '' : ' disabled'}>${busy ? 'استنى...' : esc(a.btn(f, r))}</button>` }; }
  function vBell() {
    return { t: 'التنبيهات', b: (S.notes.some((n) => !n.read) ? '<button class="btn sm" data-a="readall" style="justify-self:start">علّم الكل اتقرا</button>' : '') + (S.notes.length ? `<div class="log">${S.notes.map((n) => `<button class="lg${n.read ? '' : ' new'}" data-a="note" data-id="${n.id}" style="text-align:right"><span>${esc(n.body)}</span><time class="num">${when(T(n.at))}</time></button>`).join('')}</div>` : '<div class="empty">مفيش تنبيهات.</div>'), f: '' };
  }
  function vPerson(L) { const p = P(L.id); return { t: p.name + ' · ' + (ROLES[p.role] || ''), b: personDetail(L.id), f: '' }; }
  function vAdd(L) {
    return { t: 'ضيف عضو', b: `<label class="fld"><span>الاسم</span><input type="text" data-f="name" value="${esc(L.f.name || '')}"></label><label class="fld"><span>رقم الموبايل (بيدخل بيه)</span><input type="tel" inputmode="tel" data-f="phone" value="${esc(L.f.phone || '')}" placeholder="01xxxxxxxxx" dir="ltr" style="text-align:right"></label>
      <div class="fld"><span>الدور</span><div class="rch">${ROLE_ORDER.map((x) => `<button data-a="set" data-k="role" data-v="${x}" class="${L.f.role === x ? 'on' : ''}">${ROLES[x]}</button>`).join('')}</div></div>`,
      f: `<button class="btn pri" data-a="addgo"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'ضيف واطلع كود التفعيل'}</button>` };
  }
  function vCode(L) { return { t: 'كود التفعيل', b: `<div class="card" style="text-align:center"><span class="sub">ابعت الكود ده لـ${esc(L.name)} (صالح 7 أيام):</span><b class="bigcode num">${esc(L.code)}</b><button class="btn sm" data-a="copy" data-v="${esc(L.code)}">انسخ الكود</button></div><span class="sub">العضو يفتح telad.vercel.app/admin ويدوس "تفعيل حساب جديد"، ويكتب رقمه والكود ده، ويختار باسورد لنفسه. الكود بيتقفل بعد 5 محاولات غلط.</span>`, f: '' }; }
  function vMember(L) {
    const p = P(L.id);
    return { t: p.name, b: `<div class="kv"><div><span>الدور</span><b>${ROLES[p.role]}</b></div><div><span>الموبايل</span><b dir="ltr">${esc(p.phone || '')}</b></div><div><span>الحساب</span><b>${p.activated ? 'فعّله' : 'لسه ما فعّلش'}${p.active ? '' : ' · موقوف'}</b></div></div>
      <div class="fld"><span>غيّر الدور</span><div class="rch">${ROLE_ORDER.map((x) => `<button data-a="setrole" data-id="${p.id}" data-v="${x}" class="${p.role === x ? 'on' : ''}"${busy ? ' disabled' : ''}>${ROLES[x]}</button>`).join('')}</div><span class="sub">لو عنده طلبات مفتوحة لازم تتحوّل الأول.</span></div>
      ${p.activated ? '' : `<button class="btn" data-a="newcode" data-id="${p.id}">كود تفعيل جديد</button>`}`,
      f: `<button class="btn ${p.active ? '' : 'dark'}" data-a="toggle" data-id="${p.id}">${p.active ? 'وقّفه' : 'رجّعه'}</button><button class="btn red" data-a="askdel" data-id="${p.id}">امسحه</button>` };
  }
  function vDel(L) { const p = P(L.id); return { t: 'تمسح ' + p.name + '؟', b: `<span class="sub">${esc(p.name)} (${ROLES[p.role]}) هيتشال من الفريق ومش هيقدر يدخل. المسح نهائي، والطلبات القديمة بتفضل في السجل. لو عايز توقفه مؤقتًا استخدم "وقّفه".</span>`, f: `<button class="btn" data-a="back">لا، سيبه</button><button class="btn dark" data-a="delgo" data-id="${p.id}"${busy ? ' disabled' : ''}>امسح نهائي</button>` }; }
  const VIEWS = { req: vReq, sub: vSub, bell: vBell, person: vPerson, add: vAdd, code: vCode, member: vMember, del: vDel };

  // ---------- render ----------
  function render() {
    if (dead) return;
    const y = window.scrollY;
    $('app').innerHTML = header() + '<main class="pg">' + vMain() + '</main>';
    window.scrollTo(0, y);
    renderSheet();
  }
  function renderSheet() {
    if (dead) return;
    const ov = $('ov'), L = top();
    if (!L) { if (!ov.hidden) { ov.hidden = true; document.body.style.overflow = ''; } return; }
    const v = VIEWS[L.v](L), b = $('shB'), st = b.scrollTop, same = ov.dataset.k === String(UI.stack.length) + L.v + (L.id || '');
    $('shT').textContent = v.t; b.innerHTML = v.b; $('shF').innerHTML = v.f; $('shF').hidden = !v.f;
    $('shBack').hidden = UI.stack.length < 2; $('peek').hidden = UI.stack.length < 2; $('sheet').classList.toggle('lvl2', UI.stack.length > 1);
    if (same) b.scrollTop = st;
    ov.dataset.k = String(UI.stack.length) + L.v + (L.id || '');
    if (ov.hidden) { ov.hidden = false; document.body.style.overflow = 'hidden'; }
  }

  // ---------- events ----------
  // Listeners are removed when this desk is unmounted, so a remount never answers one tap twice.
  const ac = new AbortController();
  root.addEventListener('click', async (ev) => {
    if (dead) return;
    const b = ev.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v, id = b.dataset.id ? Number(b.dataset.id) : null, L = top();
    switch (a) {
      case 'tab': UI.tab = v; UI.stack = []; render(); window.scrollTo(0, 0); break;
      case 'flt': UI.flt = v; render(); break;
      case 'per': UI.per = Number(v); render(); break;
      case 'open': push({ v: 'req', id }); break;
      case 'close': closeAll(); break;
      case 'back': UI.stack.pop(); renderSheet(); break;
      case 'bell': push({ v: 'bell' }); break;
      case 'person': push({ v: 'person', id }); break;
      case 'reload': toast('بنحدّث...'); load(); break;
      case 'signout': onSignOut(); break;
      case 'listings': if (opts.onListings) opts.onListings(); break;
      case 'sub': { const r = Rq(L.id); push({ v: 'sub', id: L.id, k: v, f: Object.assign({ mins: 120, note: '' }, ACT[v].init ? ACT[v].init(r) : {}) }); break; }
      case 'set': L.f[b.dataset.k] = b.dataset.num ? Number(v) : v; if (b.dataset.k === 'out') L.f.reason = null; renderSheet(); break;
      case 'run': { const r = Rq(L.id), A = ACT[L.k]; if (!A.ok(L.f, r)) return; await A.run(r, L.f); break; }
      case 'status': { const r = Rq(L.id); await act(r.id, { a: 'status', key: v, mins: ST_MINS }, 'اتسجلت الحالة', 0); break; }
      case 'ack': await act(L.id, { a: 'ack' }, 'اتسجل إنك شفته', 0); break;
      case 'webdone': await act(id, { a: 'webdone' }, 'اتسجل', 0); break;
      case 'avail': { const nv = me.avail === false; if (await rpcToast('staff_set_avail', { p_avail: nv }, nv ? 'إنت متاح دلوقتي' : 'إنت مش متاح دلوقتي')) { me.avail = nv; await load(); } break; }
      case 'readall': await sb.rpc('desk_notifications_read', { p_id: null }); S.notes.forEach((n) => { n.read = true; }); render(); break;
      case 'note': { const n = S.notes.find((o) => o.id === id); if (!n) break; if (!n.read) { n.read = true; sb.rpc('desk_notifications_read', { p_id: n.id }); } render(); if (n.request_id && Rq(n.request_id)) { UI.stack = []; push({ v: 'req', id: n.request_id }); } break; }
      case 'addmember': push({ v: 'add', f: { role: 'senior' } }); break;
      case 'addgo': { const f = L.f, phone = (f.phone || '').trim(); if ((f.name || '').trim().length < 2) return toast('اكتب الاسم.'); if (!/^01[0125][0-9]{8}$/.test(phone)) return toast('اكتب رقم موبايل مصري صح، زي 01012345678.');
        const d = await rpcToast('staff_add', { p: { name: f.name.trim(), phone, role: f.role || 'senior', parent_id: null } }); if (d) { UI.stack.pop(); await load(); push({ v: 'code', code: d.code, name: f.name.trim() }); } break; }
      case 'member': push({ v: 'member', id }); break;
      case 'toggle': { const p = P(id); if (await rpcToast('staff_update', { p_id: id, p: { active: !p.active } }, p.active ? 'اتوقف' : 'رجع')) await load(); break; }
      case 'setrole': { const p = P(id); if (p.role === v) break; if (await rpcToast('staff_update', { p_id: id, p: { role: v } }, p.name + ' بقى ' + ROLES[v])) await load(); break; }
      case 'askdel': push({ v: 'del', id }); break;
      case 'delgo': { const n = P(id).name; if (await rpcToast('staff_delete', { p_id: id }, 'اتمسح ' + n)) { UI.stack = []; await load(); } break; }
      case 'newcode': { const c = await rpcToast('staff_new_code', { p_id: id }); if (c) push({ v: 'code', code: c, name: P(id).name }); break; }
      case 'copy': try { await navigator.clipboard.writeText(v); toast('اتنسخ'); } catch (e) { toast('الكود: ' + v); } break;
      default: break;
    }
  }, { signal: ac.signal });
  root.addEventListener('input', (ev) => {
    const t = ev.target, L = top(); if (!t.dataset.f || !L || !L.f) return; L.f[t.dataset.f] = t.value;
    if (L.v === 'sub') { const btn = root.querySelector('[data-a="run"]'), r = Rq(L.id); if (btn && r) btn.disabled = busy || !ACT[L.k].ok(L.f, r); }
  }, { signal: ac.signal });
  const onKey = (e) => { if (e.key === 'Escape' && top()) { UI.stack.pop(); renderSheet(); } };
  document.addEventListener('keydown', onKey);
  const timer = setInterval(() => { if (!top()) load(); else sb.rpc('desk_notifications').then(({ data }) => { if (data && !dead) S.notes = data; }); }, 60000);
  render(); load();
  return () => { dead = true; ac.abort(); clearInterval(timer); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
}
