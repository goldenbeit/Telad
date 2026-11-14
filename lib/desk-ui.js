// Team desk for buyer requests: each role sees its own tabs, a request opens in a bottom sheet,
// and every step (forward, confirm, assign, statuses, return, close) opens a second sheet on top.
// Vanilla UI mounted into a shadow root (styles in desk-css.js). All data goes through the desk_* RPCs.
import { DESK_CSS } from './desk-css';

const ROLES = { junior: 'جونيور', senior: 'سينيور', sup: 'مشرف', tl: 'تيم ليدر', sadmin: 'سيلز أدمن', web: 'ويب أدمن', super: 'سوبر أدمن', gm: 'GM', owner: 'الأدمن' };
const ROLE_ORDER = ['gm', 'super', 'sadmin', 'web', 'tl', 'sup', 'senior', 'junior'];
const SALES = ['junior', 'senior'];
const M = 60000, H = 60 * M, D = 24 * H;
const MINS = [['ساعة', 60], ['ساعتين', 120], ['4 ساعات', 240], ['يوم', 1440]];
// [key, label on screen, label the database stores on the status step]
const STS = [['call_buyer', 'اتواصلت مع المشتري', 'تواصلنا مع المشتري'], ['call_seller', 'اتواصلت مع البائع', 'تواصلنا مع البائع'], ['visit_set', 'المعاينة اتحددت', 'اتحدد معاد معاينة'],
  ['visited', 'المعاينة تمت', 'المعاينة تمت'], ['nego', 'بنتفاوض على السعر', 'بنتفاوض على السعر'], ['deposit', 'العربون اتدفع', 'اتدفع عربون']];
const ST_MINS = 120;
// seller offers: the review statuses (two hours each) and the reasons an offer is not fit to publish
const OSTS = [['o_seller', 'اتواصلت مع البائع', 'كلّمنا البائع'], ['o_data', 'اتأكدت من بيانات القطعة: المكان، والمساحة، والمرحلة', 'اتأكدنا من بيانات القطعة'],
  ['o_photos', 'الصورتين واضحين: صورة القطعة وخطاب التخصيص', 'الصورتين واضحين'], ['o_price', 'السعر منطقي ومناسب للحي', 'السعر منطقي ومناسب للحي'], ['o_serious', 'البائع جاد ومستعد يبيع', 'البائع جاد ومستعد يبيع']];
const UNFIT = ['السعر مبالغ فيه', 'البيانات مش صحيحة', 'البائع مش جاد', 'البائع مبيردّش'];
const ZONES = { 'القادسية': [8, 9, 10, 12, 17, 20, 22, 23], 'الأمل': [28, 29, 30, 31, 32, 33, 35, 36] };
const FACADES = ['بحري', 'قبلي', 'شرقي', 'غربي', 'ناصية'];
const VIEW_TYPES = ['شارع رئيسي', 'حديقة', 'خدمات', 'داخلي'];
const SITE = 'https://telad.vercel.app';
const LOST = ['السعر عالي عليه', 'لقى قطعة تانية', 'العميل مبيردّش', 'البائع رجع في كلامه', 'سبب تاني'];
const OUT = { sold: 'اتباع', lost: 'ما اتباعش', deposit: 'اتدفع عربون', follow: 'محتاج متابعة', ready: 'جاهز للنشر', unfit: 'مش مناسب' };
const STAGE_ROLE = { new: 'سيلز أدمن', up_sa: 'سيلز أدمن', tl: 'تيم ليدر', up_tl: 'تيم ليدر', sup: 'مشرف', up_sup: 'مشرف', sales: 'سيلز' };
const LEG_ROLE = { sadmin: 'سيلز أدمن', tl: 'تيم ليدر', sup: 'مشرف', junior: 'سيلز', senior: 'سيلز' };
const PAY_TXT = { check: 'شيك التقنين', waiver: 'التنازل', comp: 'الاستكمال', inst: 'الأقساط' };
const LSTAGE = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
const ERR = { phone_required: 'رقم العميل مش متسجل.', invalid_phone: 'اكتب رقم موبايل مصري صح.', mins_required: 'اختار المهلة.', note_required: 'اكتب السبب.', reason_required: 'اختار السبب.', invalid_sup: 'اختار المشرف.', invalid_sales: 'اختار السيلز.', not_allowed: 'مش مسموح لك بالخطوة دي، أو الطلب اتحرّك. حدّث الصفحة.', invalid_parent: 'اختار صح.', phone_taken: 'الرقم ده متسجل قبل كده.', has_open: 'العضو ده عنده طلبات مفتوحة دلوقتي. لازم تتحوّل الأول.', not_self: 'مينفعش تغيّر أو تمسح حسابك إنت.', not_owner: 'الصلاحية دي للأدمن والـ GM بس.', staff_phone_key: 'الرقم ده متسجل قبل كده.', invalid_outcome: 'اختار النتيجة.', invalid_status: 'الحالة دي مش موجودة.', eval_required: 'اختار تقييم واحد على الأقل.', invalid_until: 'اختار يوم من بكرة لحد 6 شهور.', invalid_action: 'اختار الإجراء.', invalid_target: 'اختار حد تاني بنفس الدور.', too_late: 'المهلة خلصت خلاص، مينفعش تسجّل التأخير دلوقتي.', note_too_long: 'الكلام طويل. اختصره.', not_admin: 'مش مسموح لك تعدّل القطعة دي دلوقتي.' };
// What the supervisor does when a sale is cancelled ("البيعة اتلغت")
const CX = [['reassign', 'تغيير وش', 'سيلز تاني يكمّل مع نفس العميل'], ['escalate', 'متابعة من ليفل أعلى', 'التيم ليدر يتابع مع العميل بنفسه'], ['postpone', 'تأجيل حتى', 'يرجع لنفس السيلز في يوم تختاره'], ['confirm', 'تأكيد إلغاء الطلب', 'يطلع للسيلز أدمن يعتمد الإلغاء'], ['other', 'أخرى', 'اكتب الإجراء']];
const CX_TAG = { reassign: 'تغيير وش', escalate: 'متابعة من ليفل أعلى', postpone: 'مؤجل', confirm: 'إلغاء مستني اعتماد', other: 'البيعة اتلغت' };
// the same supervisor actions for an offer that is not fit
const CXO = [['reassign', 'تغيير وش', 'عضو تاني يراجعه من الأول'], ['escalate', 'متابعة من ليفل أعلى', 'التيم ليدر يكلّم البائع بنفسه'], ['postpone', 'تأجيل حتى', 'يرجع لنفس العضو في يوم تختاره'], ['confirm', 'تأكيد الرفض', 'يطلع للسيلز أدمن أو الويب أدمن يعتمد الرفض'], ['other', 'أخرى', 'اكتب الإجراء']];
const CXO_TAG = { reassign: 'تغيير وش', escalate: 'متابعة من ليفل أعلى', postpone: 'مؤجل', confirm: 'رفض مستني اعتماد', other: 'العرض مش مناسب' };
const isOffer = (r) => r.via === 'offer';
const stList = (r) => (isOffer(r) ? OSTS : STS);
// The sales admin's evaluation of a final cancellation (for the reports)
const EVAL = [['fake', 'ريكويست fake'], ['not_qualified', 'ريكويست لم يتم اعتماده'], ['sales_late', 'تأخّر من السيلز'], ['followup_late', 'تأخّر من المتابعة'], ['competitor', 'بيان منافس'], ['market', 'تغيّر في السوق'], ['real_reason', 'العميل حصل معاه ظرف حقيقي'], ['hesitant', 'العميل تردد'], ['other', 'أخرى']];
const evalName = (k) => (EVAL.find((e) => e[0] === k) || [])[1] || k;
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
  const canManage = R === 'owner' || R === 'gm' || R === 'super';
  // a super admin manages the members below him, not the GM or another super admin
  const canEdit = (p) => canManage && p.id !== me.id && !(R === 'super' && ['gm', 'super'].includes(p.role));
  const myRoles = () => ROLE_ORDER.filter((x) => R !== 'super' || !['gm', 'super'].includes(x));
  const canStep = R === 'owner' || R === 'super', canMove = canStep || R === 'gm';
  const isSA = R === 'owner' || R === 'sadmin' || R === 'super', isWeb = R === 'owner' || R === 'web' || R === 'super', isSales = SALES.includes(R);
  const S = { staff: [], reqs: [], notes: [], loaded: false, err: false };
  const UI = { tab: null, flt: 'open', oflt: 'open', per: 30, stack: [], mf: 'all', ms: 'open', rf: 'all', rs: 'open' };
  const DETAIL = {};
  // Folding sections ("منبثقة"): any element with data-fold becomes a group whose title opens/closes it.
  // Open by default; what the person closes stays closed on this device.
  const FOLD = (() => { try { return new Set(JSON.parse(localStorage.getItem('telad.fold') || '[]')); } catch (e) { return new Set(); } })();
  function saveFold() { try { localStorage.setItem('telad.fold', JSON.stringify([...FOLD])); } catch (e) { /* private mode */ } }
  function foldify(box) {
    box.querySelectorAll('[data-fold]').forEach((el) => {
      const key = el.dataset.fold, head = el.firstElementChild; if (!head) return;
      const kids = [...el.children].slice(1), shut = FOLD.has(key);
      const btn = document.createElement('button'); btn.className = 'grp-h'; btn.dataset.a = 'fold'; btn.dataset.v = key; btn.setAttribute('aria-expanded', String(!shut));
      btn.innerHTML = '<span class="grp-t">' + head.innerHTML + '</span><i class="chev" aria-hidden="true"></i>';
      const body = document.createElement('div'); body.className = 'grp-b';
      if (el.hasAttribute('data-many')) kids.forEach((k) => { const br = document.createElement('div'); br.className = 'br'; br.appendChild(k); body.appendChild(br); });
      else { const br = document.createElement('div'); br.className = 'br'; kids.forEach((k) => br.appendChild(k)); body.appendChild(br); }
      head.replaceWith(btn); el.appendChild(body); el.classList.add('grp'); el.classList.toggle('shut', shut); el.removeAttribute('data-fold');
    });
  }
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
  async function loadDetail(id) { const { data } = await sb.rpc('desk_request', { p_id: id });
    if (data && data.unit && data.unit.letter_path) { const s = await sb.storage.from('allocation-letters').createSignedUrl(data.unit.letter_path, 1800); if (s.data) data.unit.letter_url = s.data.signedUrl; }
    if (data && !dead) { DETAIL[id] = data; if (UI.stack.some((L) => L.id === id)) renderSheet(); } }
  function errMsg(error) { const k = Object.keys(ERR).find((e) => (error.message || '').includes(e)); return k ? ERR[k] : 'محصلش. جرب تاني.'; }
  async function act(id, p, okMsg, pops) {
    if (busy) return; busy = true; renderSheet();
    const { error } = await sb.rpc('desk_act', { p_id: id, p });
    busy = false;
    if (error) { toast(errMsg(error)); renderSheet(); return false; }
    UI.stack.splice(Math.max(0, UI.stack.length - (pops || 0)));
    delete DETAIL[id]; UI.stack.forEach((L) => { if (L.id === id) L.loading = false; }); toast(okMsg); await load(); return true;
  }
  async function rpcToast(fn, args, ok) { if (busy) return null; busy = true; renderSheet(); const { data, error } = await sb.rpc(fn, args); busy = false; if (error) { toast(errMsg(error)); renderSheet(); return null; } if (ok) toast(ok); return data ?? true; }

  // ---------- rules on the client (the database checks them again) ----------
  function holderLeg(r) { for (let i = r.legs.length - 1; i >= 0; i--) if (r.legs[i].kind === 't' && !r.legs[i].end) return r.legs[i]; return null; }
  function curDue(r) { if (r.stage === 'closed') return null; if (r.stage === 'sales' && r.st_due_t) return r.st_due_t; const l = holderLeg(r); return l ? l.due : null; }
  const isLate = (r) => { const d = curDue(r); return !!(d && d < now()); };
  // waiting at the top for the sales admin or the web admin: a cancelled sale / an unfit offer (not escalated), or an offer ready to publish
  const webCancel = (r) => ((r.outcome === 'lost' || r.outcome === 'unfit') && r.cx !== 'escalate') || (isOffer(r) && r.outcome === 'ready');
  const inbox = (r) => isMine(r) || (R === 'super' && isLate(r));
  function isMine(r) {
    if (r.stage === 'closed') return false;
    if (r.via === 'ask') return isSA;
    if (r.stage === 'new') return isSA;
    // a cancelled request waiting for final approval: the sales admin or the web admin
    if (r.stage === 'up_sa') return isSA || (R === 'web' && webCancel(r));
    if (r.stage === 'tl' || r.stage === 'up_tl') return R === 'tl' && r.tl_id === me.id;
    if (r.stage === 'sup' || r.stage === 'up_sup') return R === 'sup' && r.sup_id === me.id;
    if (r.stage === 'sales') return isSales && r.sales_id === me.id;
    return false;
  }
  function holderName(r) {
    if (r.stage === 'up_sa' && webCancel(r)) return 'السيلز أدمن أو الويب أدمن';
    if (r.stage === 'new' || r.stage === 'up_sa' || r.via === 'ask') return 'السيلز أدمن';
    const id = { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage];
    return id ? P(id).name : '—';
  }
  const informed = (r) => r.tl_mode === 'info';
  // statuses done on this request, from the status steps the database keeps
  function stDone(r) {
    const out = {}; let prevDue = null;
    const tr = r.legs.filter((l) => l.kind === 't' && SALES.includes(l.role)); if (tr.length) prevDue = tr[tr.length - 1].due;
    const L0 = stList(r);
    r.legs.filter((l) => l.kind === 's').forEach((l) => { const s = L0.find((x) => x[2] === l.label); if (s && !out[s[0]]) out[s[0]] = { at: l.start, late: !!(prevDue && l.start > prevDue) }; prevDue = l.due; });
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
    if (r.stage === 'closed' && isOffer(r)) return r.outcome === 'ready' ? '<span class="chip c-ok">اتنشر ✓</span>' : '<span class="chip">اترفض</span>';
    if (r.stage === 'closed') return r.outcome === 'sold' ? '<span class="chip c-ok">اتباع ✓</span>' : `<span class="chip">${esc(OUT[r.outcome] || 'اتقفل')}</span>`;
    const up = r.stage.startsWith('up_');
    if (isMine(r)) return `<span class="chip c-me">${up ? '↑ ' : ''}عندك</span>`;
    return `<span class="chip c-blue">${up ? '↑ ' : ''}عند ${esc(holderName(r))}${r.stage !== 'new' && r.stage !== 'up_sa' ? ' · ' + STAGE_ROLE[r.stage] : ''}</span>`;
  }
  const qlChip = (r) => (r.ql === 'yes' ? '<span class="chip c-ok">كواليفايد ليد ✓</span>' : r.ql === 'asked' ? '<span class="chip c-warn">مستني اعتماد ليد</span>' : r.ql === 'no' ? '<span class="chip">مش كواليفايد</span>' : '');
  function cxChip(r) {
    if (!r.cx || r.stage === 'closed') return '';
    if (r.cx === 'postpone' && r.stage === 'sales') return `<span class="chip c-warn">مؤجل لحد ${when(T(r.cx_until)).split(' · ')[0]}</span>`;
    if (r.cx === 'reassign' && r.stage === 'sales') return '<span class="chip c-warn">تغيير وش</span>';
    if (['escalate', 'confirm', 'other'].includes(r.cx) && (r.stage === 'up_tl' || r.stage === 'up_sa')) return `<span class="chip c-bad">${(isOffer(r) ? CXO_TAG : CX_TAG)[r.cx]}</span>`;
    return '';
  }
  const qlList = () => S.reqs.filter((r) => R === 'tl' && r.tl_id === me.id && r.ql === 'asked' && r.stage !== 'closed');
  function card(r) {
    const done = stDone(r), last = stList(r).filter((s) => done[s[0]]).pop();
    return `<button class="rc${isLate(r) ? ' late' : ''}" data-a="open" data-id="${r.id}"><div class="rc-top"><b>${isOffer(r) ? 'عرض · ' : ''}${esc(unitTitle(r))}</b><span class="code">R-${r.id}${r.code ? ' · ' + esc(r.code) : ''}</span></div>
    <div class="sub">${isOffer(r) ? 'البائع: ' : ''}${esc(r.name || '—')}${informed(r) && r.stage !== 'new' ? ' · التيم ليدر للعلم' : ''}</div>
    <div class="chips">${whereChip(r)}${timerChip(r)}${r.stage === 'sales' && last ? `<span class="chip">${last[1]}</span>` : ''}${r.outcome && r.stage !== 'closed' ? `<span class="chip ${r.outcome === 'sold' || r.outcome === 'ready' ? 'c-ok' : ''}">${esc(OUT[r.outcome])}</span>` : ''}${qlChip(r)}${cxChip(r)}${r.notes ?`<span class="chip">${r.notes} ملاحظة</span>` : ''}</div></button>`;
  }
  const list = (l, emp) => (l.length ? l.map(card).join('') : `<div class="empty">${emp}</div>`);
  const counts = (pid) => { const open = S.reqs.filter((r) => r.stage !== 'closed' && holderIdOf(r) === pid); return { open: open.length, late: open.filter(isLate).length }; };
  function holderIdOf(r) { return { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage] || null; }

  // ---------- main views ----------
  function tabsFor() {
    if (R === 'owner' || R === 'sadmin' || R === 'super') return [['mine', 'عندي'], ['all', 'كل الطلبات'], ['offers', 'العروض'], ['mirror', 'المراية'], ['rep', 'التقارير']].concat(canManage ? [['team', 'الفريق']] : []);
    if (R === 'gm') return [['all', 'كل الطلبات'], ['offers', 'العروض'], ['mirror', 'المراية'], ['rep', 'التقارير'], ['team', 'الفريق']];
    if (R === 'web') return [['mine', 'عندي'], ['all', 'الطلبات'], ['offers', 'العروض'], ['rep', 'التقارير']];
    if (R === 'tl') return [['mine', 'عندي'], ['ql', 'للاعتماد'], ['info', 'للعلم'], ['mirror', 'المراية'], ['rep', 'التقارير']];
    if (R === 'sup') return [['mine', 'عندي'], ['mirror', 'فريقي'], ['rep', 'التقارير']];
    return [['mine', 'عندي'], ['done', 'خلصت'], ['rep', 'أدائي']];
  }
  const infoList = () => S.reqs.filter((r) => R === 'tl' && r.tl_id === me.id && informed(r));
  function header() {
    const un = S.notes.filter((n) => !n.read).length, tabs = tabsFor();
    if (!tabs.some((t) => t[0] === UI.tab)) UI.tab = tabs[0][0];
    const badge = (t) => (t === 'mine' ? S.reqs.filter(inbox).length : t === 'ql' ? qlList().length : t === 'info' ? infoList().filter((r) => !r.tl_ack && r.stage !== 'closed').length : 0);
    return `<header class="hd"><div class="hd-in"><span class="brand">تِلاد</span><span class="me"><b>${esc(me.name || '')}</b><span>${ROLES[R]}</span></span>
    ${opts.onListings ? '<button class="ib" data-a="listings">الإعلانات</button>' : ''}<button class="ib" data-a="reload" aria-label="تحديث">${IC.ref}</button>
    <button class="ib" data-a="bell" aria-label="التنبيهات${un ? '، ' + un + ' جديدة' : ''}">${IC.bell}${un ? `<b class="num">${un}</b>` : ''}</button><button class="ib" data-a="signout" aria-label="خروج">${IC.out}</button></div>
    ${me.can_act ? actAsBar() : ''}
    <nav class="tabs">${tabs.map((t) => { const c = badge(t[0]); return `<button class="tab${UI.tab === t[0] ? ' on' : ''}" data-a="tab" data-v="${t[0]}">${t[1]}${c ? `<i class="num">${c}</i>` : ''}</button>`; }).join('')}</nav></header>`;
  }
  function vMain() {
    if (S.err) return '<div class="empty">مقدرناش نحمّل الطلبات. دوس تحديث.</div>';
    if (!S.loaded) return '<div class="empty">بنحمّل...</div>';
    const t = UI.tab;
    if (t === 'mine') {
      const mine = S.reqs.filter(inbox).sort((a, b) => (curDue(a) || 9e15) - (curDue(b) || 9e15));
      return (isSales ? availSwitch() : '') + list(mine, 'مفيش طلبات عندك دلوقتي.');
    }
    if (t === 'info') return list(infoList(), 'مفيش طلبات للعلم.');
    if (t === 'ql') return list(qlList(), 'مفيش طلبات مستنية اعتمادك ككواليفايد ليد.');
    if (t === 'done') return list(S.reqs.filter((r) => !isMine(r)), 'لسه مخلصتش طلبات.');
    if (t === 'all') {
      const tasks = isWeb ? S.reqs.filter((r) => r.web_task) : [];
      let l = S.reqs.filter((r) => !isOffer(r));
      if (UI.flt === 'open') l = l.filter((r) => r.stage !== 'closed'); else if (UI.flt === 'late') l = l.filter(isLate); else if (UI.flt === 'closed') l = l.filter((r) => r.stage === 'closed'); else if (UI.flt === 'ql') l = l.filter((r) => r.ql === 'yes');
      return tasks.map((r) => `<div class="task"><b>اتباعت ${esc(r.code || '')}${r.l_district ? ' · الحي ' + esc(r.l_district) : ''}</b><span class="sub">علّمها إنها اتباعت في لوحة الإعلانات، وبعدين دوس هنا.</span><button class="btn sm dark" data-a="webdone" data-id="${r.id}">شيلتها من الموقع</button></div>`).join('')
        + `<div class="flt">${[['open', 'مفتوح'], ['late', 'متأخر'], ['ql', 'كواليفايد ليد'], ['closed', 'اتقفل'], ['any', 'الكل']].map((f) => `<button class="fc${UI.flt === f[0] ? ' on' : ''}" data-a="flt" data-v="${f[0]}">${f[1]}</button>`).join('')}</div>` + list(l, 'مفيش طلبات هنا.');
    }
    if (t === 'offers') {
      let l = S.reqs.filter(isOffer);
      if (UI.oflt === 'open') l = l.filter((r) => r.stage !== 'closed'); else if (UI.oflt === 'late') l = l.filter(isLate);
      else if (UI.oflt === 'pub') l = l.filter((r) => r.stage === 'closed' && r.outcome === 'ready'); else if (UI.oflt === 'rej') l = l.filter((r) => r.stage === 'closed' && r.outcome !== 'ready');
      return chipsRow([['open', 'مفتوح'], ['late', 'متأخر'], ['pub', 'اتنشر'], ['rej', 'اترفض'], ['any', 'الكل']], 'oflt', 'oflt') + list(l, 'مفيش عروض هنا.');
    }
    if (t === 'mirror') return vMirror();
    if (t === 'rep') return vReports();
    if (t === 'team') return vTeam();
    return '';
  }
  // Owner only: act as any team member to try their screens (test mode).
  function actAsBar() {
    const people = ROLE_ORDER.flatMap((r0) => S.staff.filter((p) => p.role === r0 && p.active));
    return `<div class="actas${me.acting ? ' on' : ''}"><label for="actas">${me.acting ? 'وضع التجربة · شغال كأنك' : 'جرّب كأنك'}</label><select id="actas" data-ch="actas"${busy ? ' disabled' : ''}>
      <option value=""${me.acting ? '' : ' selected'}>الأدمن (إنت)</option>${people.map((p) => `<option value="${p.id}"${me.acting && p.id === me.id ? ' selected' : ''}>${esc(p.name)} · ${ROLES[p.role]}</option>`).join('')}</select></div>`;
  }
  function availSwitch() { const on = me.avail !== false; return `<button class="sw" data-a="avail"><span class="tg${on ? ' on' : ''}" aria-hidden="true"></span><span>${on ? 'متاح لطلبات جديدة' : 'مش متاح دلوقتي'}</span></button>`; }

  function mrow(p) {
    const c = counts(p.id), sales = SALES.includes(p.role), av = sales ? (p.avail !== false ? ' on' : ' off') : '';
    return `<button class="mr" data-a="person" data-id="${p.id}"><span class="av${av}">${esc(p.name.slice(0, 1))}</span><span class="nm"><b>${esc(p.name)}</b><span>${ROLES[p.role]}${sales ? (p.avail !== false ? ' · متاح' : ' · مش متاح') : ''}${p.activated ? '' : ' · لسه ما فعّلش'}</span></span><span class="ct"><span class="chip num">${c.open} في إيده</span>${c.late ? `<span class="chip c-bad num">${c.late} متأخر</span>` : ''}</span></button>`;
  }
  const chipsRow = (list, key, act) => `<div class="flt">${list.map((f) => `<button class="fc${UI[key] === f[0] ? ' on' : ''}" data-a="${act}" data-v="${f[0]}">${f[1]}</button>`).join('')}</div>`;
  const sortRow = (list, key, id) => `<div class="sortr"><label for="${id}">رتّب حسب</label><select id="${id}" data-ch="${key}">${list.map((s) => `<option value="${s[0]}"${UI[key] === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></div>`;
  const MSORT = [['open', 'الأكتر شغل'], ['late', 'الأكتر تأخير'], ['name', 'الاسم']];
  function sortPeople(list) {
    const c = (p) => counts(p.id);
    if (UI.ms === 'name') return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    if (UI.ms === 'late') return list.slice().sort((a, b) => c(b).late - c(a).late || c(b).open - c(a).open);
    return list.slice().sort((a, b) => c(b).open - c(a).open || c(b).late - c(a).late);
  }
  function vMirror() {
    const fl = R === 'sup' ? [['all', 'الكل'], ['avail', 'متاح'], ['off', 'مش متاح'], ['late', 'عنده متأخر']]
      : [['all', 'الكل'], ['sup', 'المشرفين'], ['sales', 'السيلز'], ['avail', 'سيلز متاح'], ['late', 'عنده متأخر']];
    if (!fl.some((f) => f[0] === UI.mf)) UI.mf = 'all';
    let sups = R === 'sup' ? [] : byRole('sup'), sales = allSales();
    const f = UI.mf;
    if (f === 'sup') sales = []; if (f === 'sales') sups = [];
    if (f === 'avail') { sups = []; sales = sales.filter((p) => p.avail !== false); }
    if (f === 'off') { sups = []; sales = sales.filter((p) => p.avail === false); }
    if (f === 'late') { sups = sups.filter((p) => counts(p.id).late); sales = sales.filter((p) => counts(p.id).late); }
    let h = chipsRow(fl, 'mf', 'mf') + sortRow(MSORT, 'ms', 'msort');
    if (sups.length) h += `<section class="team" data-fold="m_sup" data-many><header><b>المشرفين</b><span class="sub num">${sups.length}</span></header>${sortPeople(sups).map(mrow).join('')}</section>`;
    if (sales.length) h += `<section class="team" data-fold="m_sales" data-many><header><b>السيلز</b><span class="sub">أي مشرف يقدر يدي أي سيلز</span></header>${sortPeople(sales).map(mrow).join('')}</section>`;
    if (!sups.length && !sales.length) h += '<div class="empty">مفيش حد بالفلتر ده.</div>';
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
      const mine = S.reqs.filter((r) => r.sales_id === pid && r.at >= s0 && !isOffer(r)), res = mine.filter((r) => r.outcome === 'sold' || r.outcome === 'lost');
      m.ql = mine.filter((r) => r.ql === 'yes').length;
      m.sold = res.filter((r) => r.outcome === 'sold').length; m.lost = res.length - m.sold; m.conv = res.length ? Math.round(100 * m.sold / res.length) : null;
      let stAll = 0, stLate = 0; mine.forEach((r) => { const d = stDone(r); Object.values(d).forEach((x) => { stAll++; if (x.late) stLate++; }); });
      m.stAll = stAll; m.stLate = stLate;
    }
    return m;
  }
  function scopeIds() {
    if (isSales) return [me.id];
    let people = S.staff.filter((p) => p.active && p.role !== 'gm');
    if (R === 'sup') people = [P(me.id), ...allSales()];
    return people.map((p) => p.id);
  }
  function vReports() {
    const per = `<div class="flt">${[[7, 'آخر 7 أيام'], [30, 'آخر 30 يوم'], [0, 'كل الفترة']].map((o) => `<button class="fc${UI.per === o[0] ? ' on' : ''}" data-a="per" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
    if (isSales) return per + personDetail(me.id);
    const s0 = since(), rsAll = S.reqs.filter((r) => r.at >= s0 && (R !== 'sup' || r.sup_id === me.id)), rs = rsAll.filter((r) => !isOffer(r)), os = rsAll.filter(isOffer);
    const closed = rs.filter((r) => r.stage === 'closed'), res = closed.filter((r) => r.outcome === 'sold' || r.outcome === 'lost'), sold = res.filter((r) => r.outcome === 'sold').length;
    let h = per + `<div class="tiles"><div class="tl"><b>${rs.length}</b><span>طلب</span></div><div class="tl"><b>${rs.filter((r) => r.stage !== 'closed').length}</b><span>مفتوح</span></div><div class="tl bad"><b>${rs.filter(isLate).length}</b><span>متأخر دلوقتي</span></div><div class="tl ok"><b>${sold}</b><span>اتباع</span></div><div class="tl"><b>${res.length - sold}</b><span>ما اتباعش</span></div><div class="tl"><b>${res.length ? Math.round(100 * sold / res.length) + '%' : '—'}</b><span>نسبة البيع</span></div>
      <div class="tl ok"><b>${rs.filter((r) => r.ql === 'yes').length}</b><span>كواليفايد ليد</span></div><div class="tl"><b>${rs.length ? Math.round(100 * rs.filter((r) => r.ql === 'yes').length / rs.length) + '%' : '—'}</b><span>نسبة الكواليفايد</span></div><div class="tl"><b>${(() => { const q = res.filter((r) => r.ql === 'yes'); return q.length ? Math.round(100 * q.filter((r) => r.outcome === 'sold').length / q.length) + '%' : '—'; })()}</b><span>بيع من الكواليفايد</span></div></div>`;
    const st = { 'سيلز أدمن': [], 'تيم ليدر': [], 'مشرف': [], 'سيلز': [] };
    rs.forEach((r) => r.legs.forEach((l) => { if (l.kind === 't' && l.end && LEG_ROLE[l.role]) st[LEG_ROLE[l.role]].push(l.end - l.start); }));
    const av = Object.entries(st).map(([k, a]) => [k, avg(a) || 0]), mx = Math.max(1, ...av.map((a) => a[1]));
    const avgClose = avg(closed.filter((r) => r.closed_t).map((r) => r.closed_t - r.at));
    h += `<section class="card" data-fold="r_time"><h3>متوسط الوقت في كل خطوة</h3>${av.map(([k, v]) => `<div class="bar"><span>${k}</span><div><i style="width:${Math.round(100 * v / mx)}%"></i></div><b>${v ? dur(v) : '—'}</b></div>`).join('')}<span class="sub">متوسط مدة الطلب من أوله لحد ما يتقفل: <b class="num">${avgClose ? dur(avgClose) : '—'}</b></span></section>`;
    const why = {}; res.filter((r) => r.outcome === 'lost').forEach((r) => { const k = r.outcome_reason || 'من غير سبب'; why[k] = (why[k] || 0) + 1; });
    const evc = {}; res.forEach((r) => (r.cx_eval || []).forEach((k) => { evc[k] = (evc[k] || 0) + 1; }));
    const cxRows = [['اتلغت نهائي', res.length - sold], ['اتعمل لها إجراء قبل الإلغاء', rs.filter((r) => r.cx_count > 0).length], ['رجعت اتباعت بعد إجراء', rs.filter((r) => r.cx_count > 0 && r.outcome === 'sold' && r.stage === 'closed').length],
      ['مع سيلز تاني دلوقتي (تغيير وش)', rs.filter((r) => r.cx === 'reassign' && r.stage === 'sales').length], ['مؤجلة دلوقتي', rs.filter((r) => r.cx === 'postpone' && r.stage === 'sales').length],
      ['متابعة من ليفل أعلى دلوقتي', rs.filter((r) => r.cx === 'escalate' && r.stage !== 'closed' && r.stage !== 'sales').length]];
    h += `<section class="card" data-fold="r_cx"><h3>البيعات اللي اتلغت</h3><div class="kv">${cxRows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3 style="font-size:14px">تقييم الإلغاء النهائي</h3>${Object.keys(evc).length ? `<div class="kv">${Object.entries(evc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(evalName(k))}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    const oc = os.filter((r) => r.stage === 'closed'), opub = oc.filter((r) => r.outcome === 'ready').length, owhy = {};
    oc.filter((r) => r.outcome === 'unfit').forEach((r) => { const k = r.outcome_reason || 'من غير سبب'; owhy[k] = (owhy[k] || 0) + 1; });
    const oavg = avg(oc.filter((r) => r.closed_t).map((r) => r.closed_t - r.at));
    h += `<section class="card" data-fold="r_offers"><h3>عروض البائعين</h3><div class="kv">${[['وصل', os.length], ['مفتوح', os.length - oc.length], ['متأخر دلوقتي', os.filter(isLate).length], ['اتنشر', opub], ['اترفض', oc.length - opub], ['متوسط المدة لحد النشر أو الرفض', oavg ? dur(oavg) : '—']].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3 style="font-size:14px">أسباب الرفض</h3>${Object.keys(owhy).length ? `<div class="kv">${Object.entries(owhy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    const lateC = rsAll.reduce((a, r) => a + (r.client_late || 0), 0);
    h += `<section class="card" data-fold="r_late"><h3>تأخير من العميل أو البائع</h3><div class="kv"><div><span>مرات اتسجل فيها إن العميل أو البائع اتأخر في الرد (المهلة اتمدّت ومش محسوبة على السيلز)</span><b>${lateC}</b></div></div></section>`;
    h += `<section class="card" data-fold="r_why"><h3>أسباب ما اتباعش</h3>${Object.keys(why).length ? `<div class="kv">${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    const RF = R === 'sup' ? [['all', 'الكل'], ['sales', 'السيلز']] : [['all', 'الكل'], ['sales', 'السيلز'], ['sup', 'المشرفين'], ['tl', 'التيم ليدر'], ['sadmin', 'السيلز أدمن']];
    const RS = [['open', 'في إيده'], ['done', 'خلّص'], ['late', 'متأخر'], ['onTime', 'في الوقت'], ['sold', 'اتباع'], ['ql', 'كواليفايد'], ['name', 'الاسم']];
    if (!RF.some((f) => f[0] === UI.rf)) UI.rf = 'all';
    const rows = scopeIds().map((id) => ({ id, p: P(id), m: metrics(id) }))
      .filter((x) => UI.rf === 'all' || (UI.rf === 'sales' ? SALES.includes(x.p.role) : x.p.role === UI.rf))
      .sort((a, b) => (UI.rs === 'name' ? a.p.name.localeCompare(b.p.name, 'ar') : ((b.m[UI.rs] ?? -1) - (a.m[UI.rs] ?? -1))));
    const ids = rows.map((x) => x.id);
    h += `<section class="card" data-fold="r_people"><h3>الأفراد</h3>${chipsRow(RF, 'rf', 'rf')}${sortRow(RS, 'rs', 'rsort')}${ids.length ? `<div class="tbl"><table><thead><tr><th>الاسم</th><th>في إيده</th><th>خلّص</th><th>متأخر</th><th>في الوقت</th></tr></thead><tbody>${ids.map((id) => { const p = P(id), m = metrics(id);
      return `<tr data-a="person" data-id="${id}"><td><b>${esc(p.name)}</b><span class="r">${ROLES[p.role] || ''}</span></td><td>${m.open}</td><td>${m.done}</td><td${m.late ? ' style="color:var(--bad)"' : ''}>${m.late}</td><td>${m.onTime == null ? '—' : m.onTime + '%'}</td></tr>`; }).join('')}</tbody></table></div><span class="sub">دوس على أي اسم يطلعلك التفاصيل.</span>` : '<span class="sub">مفيش فريق متسجل لسه.</span>'}</section>`;
    return h;
  }
  function personDetail(pid) {
    const p = P(pid), m = metrics(pid), sales = SALES.includes(p.role);
    const rows = [['في إيده دلوقتي', m.open], ['متأخر دلوقتي', m.lateNow], ['وصله', m.recv + ' تحويلة'], [sales ? 'رد على' : 'خلّص', m.done], ['اتأخر فيه', m.late], ['في الوقت', m.onTime == null ? '—' : m.onTime + '%'], [sales ? 'متوسط وقت أول تواصل' : 'متوسط وقت الرد', m.avg == null ? '—' : dur(m.avg)]];
    if (sales) rows.push(['عروض راجعها', S.reqs.filter((r) => isOffer(r) && r.sales_id === pid && r.at >= since()).length], ['مرات العميل اتأخر في الرد', S.reqs.filter((r) => r.sales_id === pid && r.at >= since()).reduce((a, r) => a + (r.client_late || 0), 0)]);
    if (sales) rows.push(['كواليفايد ليد', m.ql], ['اتباع', m.sold], ['ما اتباعش', m.lost], ['نسبة البيع', m.conv == null ? '—' : m.conv + '%'], ['حالات اتسجلت متأخر', m.stLate + ' من ' + m.stAll]);
    const open = S.reqs.filter((r) => r.stage !== 'closed' && holderIdOf(r) === pid);
    let ev = '';
    if (sales) { const c = {}; S.reqs.filter((r) => r.sales_id === pid && r.at >= since()).forEach((r) => (r.cx_eval || []).forEach((k) => { c[k] = (c[k] || 0) + 1; }));
      if (Object.keys(c).length) ev = `<div class="blk" data-fold="p_eval"><h3>تقييم الإلغاءات</h3><div class="kv">${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(evalName(k))}</span><b>${v}</b></div>`).join('')}</div></div>`; }
    return `<div class="kv">${rows.map((r) => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>` + ev + (open.length ? `<div class="blk" data-fold="p_open" data-many><h3>اللي في إيده</h3>${open.map(card).join('')}</div>` : '');
  }

  // ---------- team (owner and GM) ----------
  function vTeam() {
    let h = canManage ? '<button class="btn pri" data-a="addmember">+ ضيف عضو</button>' : '';
    const groups = ROLE_ORDER.map((r0) => [r0, S.staff.filter((p) => p.role === r0)]).filter((g) => g[1].length);
    h += groups.length ? groups.map((g) => `<section class="team" data-fold="t_${g[0]}" data-many><header><b>${ROLES[g[0]]}</b><span class="sub num">${g[1].length}</span></header>${g[1].map((p) => `<button class="mr" data-a="${canEdit(p) ? 'member' : 'noop'}" data-id="${p.id}"${p.active ? '' : ' style="opacity:.55"'}><span class="av">${esc(p.name.slice(0, 1))}</span><span class="nm"><b>${esc(p.name)}${p.id === me.id ? ' (إنت)' : ''}</b><span>${p.active ? '' : 'موقوف · '}${p.activated ? 'فعّل حسابه' : 'لسه ما فعّلش'}</span></span></button>`).join('')}</section>`).join('') : '<div class="empty">مفيش أعضاء لسه.</div>';
    return h;
  }

  // ---------- request sheet ----------
  function path(r) {
    if (r.via === 'ask') return '';
    const idx = { new: 0, up_sa: 0, tl: 1, up_tl: 1, sup: 2, up_sup: 2, sales: 3 }[r.stage], closed = r.stage === 'closed', up = !closed && r.stage.startsWith('up_');
    const nodes = [['الأدمن', 'السيلز أدمن'], ['التيم ليدر', r.tl_id ? P(r.tl_id).name : '—'], ['المشرف', r.sup_id ? P(r.sup_id).name : '—'], [isOffer(r) ? 'المراجع' : 'السيلز', r.sales_id ? P(r.sales_id).name : '—']];
    return `<div class="path">${nodes.map((n, i) => { let c = closed ? 'done' : i === idx ? 'now' : up ? 'done' : i < idx ? 'done' : ''; const fyi = i === 1 && informed(r) && r.stage !== 'new'; if (fyi && !closed && i !== idx) c = 'fyi';
      return `<div class="pn ${c}"><i>${c === 'done' ? '✓' : i + 1}</i><b>${n[0]}</b><span>${fyi ? 'للعلم بس' : esc(n[1])}</span></div>`; }).join('')}</div><p class="dir">${closed ? (isOffer(r) ? (r.outcome === 'ready' ? 'العرض اتنشر' : 'العرض اترفض') : 'الطلب اتقفل') : up ? '↑ راجع لفوق' : r.stage === 'new' ? 'لسه عند الأدمن' : '↓ نازل'}</p>`;
  }
  const fact = (k, v, wide) => `<div${wide ? ' class="w"' : ''}><span>${k}</span><b>${v}</b></div>`;
  function unitBlock(r, d) {
    if (r.via === 'ask') return `<div class="blk" data-fold="q_unit"><h3>المطلوب</h3><div class="facts">${fact('المنطقة', esc(r.zone || '—'))}${fact('الحي', esc(r.district || '—'))}${fact('الميزانية', r.budget ? fmt(r.budget) + ' ج.م' : '—', 1)}</div></div>`;
    if (!d) return '<div class="blk" data-fold="q_unit"><h3>القطعة</h3><span class="sub">بنحمّل بيانات القطعة...</span></div>';
    const u = d.unit; if (!u) return '<div class="blk" data-fold="q_unit"><h3>القطعة</h3><span class="sub">القطعة دي اتشالت.</span></div>';
    const status = u.allocated === false ? `غير مخصصة · ${u.on_list ? 'على الكشف' : 'مش على الكشف'} · الشيك ${u.check_paid ? 'مدفوع' : 'مش مدفوع'}` : LSTAGE[u.stage] || 'مخصصة';
    const pay = ((u.pay && u.pay.items) || []).map((i) => fact('↳ ' + esc(PAY_TXT[i.k] || i.k), i.amt != null ? fmt(i.amt) + ' ج.م' : '—')).join('');
    const ph = photoUrl(u.photo_path);
    return `<div class="blk" data-fold="q_unit"><h3>القطعة ${esc(u.code || '')}</h3>${ph ? `<img class="photo" src="${esc(ph)}" alt="صورة القطعة" loading="lazy">` : ''}<div class="facts">
      ${fact('المنطقة', esc(u.zone || '—'))}${fact('الحي', esc(u.district || '—'))}
      ${fact('المجاورة / البلوك / القطعة', esc([u.neighborhood || '—', u.block || '—', u.plot || '—'].join(' / ')), 1)}
      ${fact('أصل المساحة', u.area_orig != null ? fmt(u.area_orig) + ' م²' : '—')}${fact('بعد التقنين', u.area_final != null ? fmt(u.area_final) + ' م²' : '—')}
      ${fact('الواجهة', esc(u.facade || '—'))}${fact('قدامها', esc(u.view_type || '—'))}
      ${fact('حالة القطعة', esc(status), 1)}
      ${fact('السعر الكلي', fmt(u.price) + ' ج.م')}${fact('المطلوب دفعه', fmt(u.paid) + ' ج.م')}
      ${fact('المتبقي', fmt(u.remaining) + ' ج.م')}${fact('الأقساط المتبقية', u.inst_left ?? '—')}${pay}
      ${u.description ? fact('الوصف', esc(u.description), 1) : ''}
      ${fact('البائع', esc(u.owner_name || '—'))}${fact('رقم البائع', `<span dir="ltr">${esc(u.owner_phone || '—')}</span>`)}
      ${fact('خطاب التخصيص', u.letter_url ? `<a href="${esc(u.letter_url)}" target="_blank" rel="noopener">افتح خطاب التخصيص</a>` : u.has_letter ? 'موجود · بيتفتح من لوحة الإعلانات (للأدمن)' : 'مش مرفوع', 1)}</div>
      ${u.owner_phone && !isOffer(r) ? `<div class="g2"><a class="btn sm" href="tel:${esc(u.owner_phone)}">كلّم البائع</a><a class="btn sm wa" href="https://wa.me/2${esc(u.owner_phone)}" target="_blank" rel="noopener">واتساب البائع</a></div>` : ''}</div>`;
  }
  // Stepping in (super admin and owner; moving a request also the GM).
  const MOVE_ROLE = { tl: ['tl'], up_tl: ['tl'], sup: ['sup'], up_sup: ['sup'], sales: SALES };
  function stepBlock(r) {
    if (r.stage === 'closed' || !canMove) return '';
    const b = [];
    if (MOVE_ROLE[r.stage]) b.push('<button class="btn sm" data-a="sub" data-v="move">حوّله لحد تاني</button>');
    if (canStep) b.push('<button class="btn sm" data-a="sub" data-v="extend">مدّ المهلة</button>', '<button class="btn sm" data-a="sub" data-v="ping">نبّه حد</button>');
    return b.length ? `<div class="blk" data-fold="q_step"><h3>تدخّل</h3><div class="chips">${b.join('')}</div></div>` : '';
  }
  // Qualified lead: the salesperson asks after the first contact; the team leader approves or says no (with a reason).
  function qlBlock(r) {
    const mineSales = isSales && r.sales_id === me.id && r.stage !== 'closed';
    const canAsk = mineSales && r.first_t && r.ql !== 'asked' && r.ql !== 'yes';
    const canDecide = R === 'tl' && r.tl_id === me.id && r.ql === 'asked' && r.stage !== 'closed';
    if (!r.ql && !mineSales) return '';
    let h = `<div class="blk" data-fold="q_ql"><h3>كواليفايد ليد</h3><div class="chips">${qlChip(r) || '<span class="chip">لسه متطلبش اعتماده</span>'}${r.ql_at ? `<span class="chip num">${when(T(r.ql_at))}</span>` : ''}</div>`;
    if (r.ql_note) h += `<div class="log"><div class="lg"><span>${r.ql === 'no' ? 'السبب' : 'ملاحظة'}</span><span></span><q>${esc(r.ql_note)}</q></div></div>`;
    if (canAsk) h += `<button class="btn sm" data-a="sub" data-v="qlask">${r.ql === 'no' ? 'اطلب اعتماده تاني' : 'اطلب اعتماده كواليفايد ليد'}</button>`;
    else if (mineSales && !r.first_t) h += '<span class="sub">علّم أول حالة مع المشتري الأول، وبعدها تقدر تطلب اعتماده.</span>';
    if (canDecide) h += '<div class="g2"><button class="btn sm" data-a="sub" data-v="qlno">مش كواليفايد</button><button class="btn sm pri" data-a="sub" data-v="qlok">اعتمده</button></div>';
    return h + '</div>';
  }
  function vReq(L) {
    const r = Rq(L.id); if (!r) return { t: 'الطلب', b: '<div class="empty">الطلب ده مش ظاهر لك دلوقتي.</div>', f: '' };
    const d = DETAIL[r.id]; if (!d && !L.loading) { L.loading = true; loadDetail(r.id); }
    const mine = isMine(r);
    const who = isOffer(r) ? 'البائع' : 'المشتري';
    let h = `<div class="blk"><div class="facts">${fact(who, esc(r.name || '—'))}${fact('رقمه', `<span dir="ltr">${esc(r.phone || '—')}</span>`)}${fact('وصل', when(r.at))}${fact('من', isOffer(r) ? 'عرض من "اعرض قطعتك"' : r.via === 'ask' ? 'طلب "بيدوّر على قطعة"' : '"اطلبها" من صفحة القطعة')}</div>
      ${r.phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(r.phone)}">كلّم ${who}</a><a class="btn sm wa" href="https://wa.me/2${esc(r.phone)}" target="_blank" rel="noopener">واتساب ${who}</a></div>` : ''}</div>`;
    h += r.via === 'ask' ? `<div class="blk"><div class="chips" style="justify-content:center">${whereChip(r)}${timerChip(r)}${cxChip(r)}</div></div>` : `<div class="blk" data-fold="q_path"><h3>المسار</h3><div>${path(r)}</div><div class="chips" style="justify-content:center">${whereChip(r)}${timerChip(r)}${cxChip(r)}</div></div>`;
    if (r.cx_eval && r.cx_eval.length) h += `<div class="blk" data-fold="q_eval"><h3>تقييم الإلغاء</h3><div class="chips">${r.cx_eval.map((k) => `<span class="chip c-bad">${esc(evalName(k))}</span>`).join('')}</div></div>`;
    if (r.sales_id || r.via === 'ask') {
      const done = stDone(r), can = (mine && r.stage === 'sales') || (r.via === 'ask' && isSA && r.stage !== 'closed');
      h += `<div class="blk" data-fold="q_st"><h3>${isOffer(r) ? 'المراجعة' : 'حالة الطلب'}${r.sales_id ? ' مع ' + esc(P(r.sales_id).name) : ''}</h3><div class="sts">${stList(r).map((s) => { const x = done[s[0]];
        return `<button class="st${x ? ' on' : ''}"${can && !x ? ` data-a="status" data-v="${s[0]}"` : ' disabled'}><i>${x ? '✓' : ''}</i><span>${s[1]}</span>${x ? `<small>${x.late ? '<span style="color:var(--bad)">متأخر · </span>' : ''}${when(x.at)}</small>` : ''}</button>`; }).join('')}</div>${can ? '<span class="sub">كل حالة ليها ساعتين من اللي قبلها.</span>' : ''}${mine && r.stage === 'sales' && curDue(r) && curDue(r) > now() ? `<button class="btn sm" data-a="sub" data-v="late">${isOffer(r) ? 'البائع' : 'العميل'} اتأخر في الرد</button>` : ''}${r.client_late ? `<span class="sub">${isOffer(r) ? 'البائع' : 'العميل'} اتأخر في الرد ${r.client_late} مرة، والمهلة اتمدّت.</span>` : ''}</div>`;
    }
    if (r.outcome) h += `<div class="blk"><div class="chips"><span class="chip ${r.outcome === 'sold' || r.outcome === 'ready' ? 'c-ok' : ''}">النتيجة: ${esc(OUT[r.outcome])}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome_summary ? `<div class="log"><div class="lg"><span><b>${esc(P(r.sales_id).name)}</b> — ملخص</span><span></span><q>${esc(r.outcome_summary)}</q></div></div>` : ''}</div>`;
    if (!isOffer(r)) h += qlBlock(r);
    h += stepBlock(r);
    h += unitBlock(r, d);
    if (isOffer(r) && r.stage !== 'closed' && d && d.unit && (isSA || isWeb || (isSales && mine && r.stage === 'sales'))) h += '<button class="btn sm" data-a="sub" data-v="edit">صلّح بيانات القطعة</button>';
    if (d) {
      const items = d.events.map((e) => ({ at: T(e.at), who: e.who, txt: e.body })).concat(d.notes.map((n) => ({ at: T(n.at), who: n.who, role: n.role, txt: n.kind === 'instr' ? 'تعليمات' : 'ملاحظة', note: n.body, instr: n.kind === 'instr' }))).sort((a, b) => b.at - a.at);
      h += `<div class="blk" data-fold="q_log"><h3>السجل</h3><div class="log">${items.map((x) => `<div class="lg"><span>${x.who ? `<b>${esc(x.who)}</b>${x.role ? ' <span class="sub">· ' + (ROLES[x.role] || '') + '</span>' : ''} — ` : ''}${esc(x.txt)}</span><time class="num">${when(x.at)}</time>${x.note ? `<q class="${x.instr ? 'instr' : ''}">${esc(x.note)}</q>` : ''}</div>`).join('')}</div></div>`;
    }
    const b = [];
    if (R !== 'gm' && r.stage !== 'closed') b.push('<button class="btn ghost" data-a="sub" data-v="note">ملاحظة</button>');
    if (R === 'tl' && r.tl_id === me.id && informed(r) && !r.tl_ack && r.stage !== 'closed') b.push(`<button class="btn" data-a="ack"${busy ? ' disabled' : ''}>شفته</button>`);
    if (mine) {
      const upLabel = r.stage === 'up_sup' && r.tl_id && !informed(r) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن';
      const A = r.via === 'ask' ? [['close', 'اقفل الطلب', 'pri']] : {
        new: [['fwd', 'حوّل', 'pri']], tl: [['confirm', 'حوّل لمشرف', 'pri']], sup: [['assign', 'اختار السيلز', 'pri']], sales: [['finish', 'خلّصت', 'pri']],
        up_sup: r.outcome === 'lost' || r.outcome === 'unfit' ? [['cx', 'اختار الإجراء', 'pri']] : [['down', 'رجّعه للسيلز', ''], ['up', upLabel, 'pri']], up_tl: [['down', 'رجّعه للمشرف', ''], ['up', 'ابعته للسيلز أدمن', 'pri']], up_sa: [['down', 'رجّعه', ''], ['close', isOffer(r) ? (r.outcome === 'ready' ? 'انشره' : 'اعتمد الرفض') : 'اقفل الطلب', 'pri']] }[r.stage] || [];
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
  // reasons an offer is not fit: one of the list, or "أخرى" with the reason written
  const unfitPick = (f) => `<div class="fld"><span>السبب</span><div class="pick">${UNFIT.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}${opt('reason', 'other', f.reason === 'other', 'أخرى')}</div>${f.reason === 'other' ? `<input type="text" data-f="other" maxlength="180" value="${esc(f.other || '')}" placeholder="اكتب السبب">` : ''}</div>`;
  const unfitReason = (f) => (f.reason === 'other' ? ((f.other || '').trim() ? 'أخرى: ' + f.other.trim() : '') : f.reason || '');
  // fixing the plot data of an open offer (same fields and checks as the listings dashboard)
  function editInit(r) {
    const u = (DETAIL[r.id] || {}).unit || {}, n = (x) => (x == null ? '' : String(Number(x)));
    return { zone: u.zone || 'القادسية', district: u.district ?? '', neighborhood: u.neighborhood ?? '', block: u.block || '', plot_number: u.plot || '', area_orig: n(u.area_orig), area_final: n(u.area_final),
      facade: u.facade || '', view_type: u.view_type || '', price: n(u.price), paid: n(u.paid), inst_left: u.inst_left ?? '', description: u.description || '', name: u.owner_name || '', phone: u.owner_phone || '' };
  }
  const tx = (k, f, label, num) => `<label class="fld"><span>${label}</span><input type="text" data-f="${k}" value="${esc(f[k])}"${num ? ' inputmode="decimal" dir="ltr" style="text-align:right"' : ''}></label>`;
  const chips1 = (k, f, list, label) => `<div class="fld"><span>${label}</span><div class="rch">${list.map((x) => `<button data-a="tg1" data-k="${k}" data-v="${esc(x)}" class="${String(f[k]) === String(x) ? 'on' : ''}">${esc(x)}</button>`).join('')}</div></div>`;
  function editBody(f) {
    const pr = Number(f.price), pd = Number(f.paid), rem = f.price !== '' && f.paid !== '' && !isNaN(pr) && !isNaN(pd) ? pr - pd : null;
    return `<div class="seg">${Object.keys(ZONES).map((z) => `<button class="${f.zone === z ? 'on' : ''}" data-a="set" data-k="zone" data-v="${z}">${z}</button>`).join('')}</div>
      <div class="fld"><span>الحي</span><div class="rch"><button data-a="set" data-k="district" data-v="" class="${f.district === '' ? 'on' : ''}">غير مخصصة</button>${ZONES[f.zone].map((d) => `<button data-a="set" data-k="district" data-v="${d}" data-num="1" class="${Number(f.district) === d && f.district !== '' ? 'on' : ''}">${d}</button>`).join('')}</div></div>
      <div class="g2">${tx('price', f, 'السعر الكلي', 1)}${tx('paid', f, 'المطلوب دفعه (للبائع)', 1)}</div>
      <span class="sub">المتبقي: <b class="num">${rem == null ? '—' : fmt(rem) + ' ج.م'}</b></span>
      ${chips1('inst_left', f, [0, 1, 2, 3], 'الأقساط المتبقية')}
      <div class="g2">${tx('area_orig', f, 'أصل المساحة (م²)', 1)}${tx('area_final', f, 'بعد التقنين (م²)', 1)}</div>
      ${f.district !== '' ? chips1('neighborhood', f, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'المجاورة') + `<div class="g2">${tx('block', f, 'البلوك')}${tx('plot_number', f, 'رقم القطعة')}</div>` + chips1('facade', f, FACADES, 'الواجهة') + chips1('view_type', f, VIEW_TYPES, 'القطعة قدامها') : ''}
      <div class="g2">${tx('name', f, 'اسم البائع')}${tx('phone', f, 'رقم البائع', 1)}</div>
      <label class="fld"><span>الوصف</span><textarea data-f="description" rows="3" maxlength="1000">${esc(f.description)}</textarea></label>`;
  }
  function editPayload(f) {
    const num = (x) => { const s = String(x ?? '').trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/,/g, ''); return s === '' || isNaN(s) ? null : Number(s); };
    const price = num(f.price), paid = num(f.paid), ao = num(f.area_orig), af = num(f.area_final), phone = String(f.phone || '').trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
    if (f.district !== '' && !ZONES[f.zone].includes(Number(f.district))) return 'اختار حي من أحياء ' + f.zone + '.';
    if (!(ao > 0) && !(af > 0)) return 'اكتب المساحة: أصل المساحة أو بعد التقنين.';
    if (!(price > 0)) return 'اكتب السعر الكلي.';
    if (paid == null || paid < 0) return 'اكتب المطلوب دفعه.';
    if (paid > price) return 'المطلوب دفعه أكبر من السعر الكلي.';
    if ((f.name || '').trim().length < 2) return 'اكتب اسم البائع.';
    if (!/^01[0125]\d{8}$/.test(phone)) return 'رقم البائع مش صح.';
    const al = f.district !== '';
    return { zone: f.zone, district: al ? Number(f.district) : '', neighborhood: al && f.neighborhood !== '' ? Number(f.neighborhood) : '', block: al ? f.block : '', plot_number: al ? f.plot_number : '',
      area_orig: ao, area_final: af, facade: al ? f.facade : '', view_type: al ? f.view_type : '', price, paid, inst_left: f.inst_left === '' ? '' : Number(f.inst_left), description: f.description || '', name: f.name.trim(), phone };
  }
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
    finish: { t: 'خلّصت', body: (r, f) => (isOffer(r) ? `<div class="pick">${opt('out', 'ready', f.out === 'ready', 'جاهز للنشر')}${opt('out', 'unfit', f.out === 'unfit', 'مش مناسب')}</div>${f.out === 'unfit' ? unfitPick(f) : ''}${noteF(f, 'ملخص (اختياري)')}${minsPick(f)}` : `<div class="pick">${opt('out', 'sold', f.out === 'sold', 'اتباع')}${opt('out', 'lost', f.out === 'lost', 'ما اتباعش')}</div>${f.out === 'lost' ? `<div class="fld"><span>السبب</span><div class="pick">${LOST.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}</div></div>` : ''}${noteF(f, 'ملخص (اختياري)')}${minsPick(f)}`),
      ok: (f, r) => (isOffer(r) ? (f.out === 'ready' || (f.out === 'unfit' && !!unfitReason(f))) : (f.out === 'sold' || (f.out === 'lost' && !!f.reason))) && !!f.mins, btn: () => 'ابعته للمشرف',
      run: (r, f) => act(r.id, { a: 'return', outcome: f.out, reason: f.out === 'lost' ? f.reason : f.out === 'unfit' ? unfitReason(f) : '', summary: f.note, mins: f.mins }, 'اتبعت للمشرف', 2) },
    late: { t: 'اتأخر في الرد', body: (r, f) => `<span class="sub">بيتسجل في سجل ${isOffer(r) ? 'العرض' : 'الطلب'} والمشرف بيشوفه، والمهلة بتتمد ساعتين، والتأخير ده بيتحسب على ${isOffer(r) ? 'البائع' : 'العميل'} مش عليك.</span>` + noteF(f, 'حصل إيه؟ (اختياري)'),
      ok: () => true, btn: () => 'سجّل ومدّ المهلة ساعتين',
      run: (r, f) => act(r.id, { a: 'late', note: f.note }, 'اتسجل والمهلة اتمدّت ساعتين', 1) },
    edit: { t: 'صلّح بيانات القطعة', init: (r) => editInit(r), body: (r, f) => editBody(f), ok: () => true, btn: () => 'احفظ التعديلات',
      run: async (r, f) => { const p = editPayload(f); if (typeof p === 'string') { toast(p); return; }
        if (await rpcToast('admin_update_listing', { p_id: r.listing_id, p }, 'البيانات اتحفظت')) { UI.stack.pop(); delete DETAIL[r.id]; UI.stack.forEach((L) => { if (L.id === r.id) L.loading = false; }); await load(); } } },
    up: { t: 'وافق وابعته لفوق', body: (r, f) => noteF(f) + minsPick(f), ok: (f) => !!f.mins, btn: (f, r) => (r.stage === 'up_sup' && r.tl_id && !informed(r) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن'),
      run: (r, f) => act(r.id, { a: 'up', mins: f.mins, note: f.note }, 'اتبعت', 2) },
    down: { t: 'رجّعه', body: (r, f) => noteF(f, 'السبب (إجباري)') + minsPick(f), ok: (f) => !!(f.note || '').trim() && !!f.mins, btn: () => 'رجّعه',
      run: (r, f) => act(r.id, { a: 'down', note: f.note.trim(), mins: f.mins }, 'رجع', 2) },
    oclose: { t: 'قرار العرض',
      init: (r) => { const f = { out: r.outcome }; if (r.outcome === 'unfit' && r.outcome_reason) { if (UNFIT.includes(r.outcome_reason)) f.reason = r.outcome_reason; else { f.reason = 'other'; f.other = r.outcome_reason.replace(/^أخرى: /, ''); } } return f; },
      body: (r, f) => `<div class="pick">${opt('out', 'ready', f.out === 'ready', 'انشره على الموقع', 'القطعة تظهر على الموقع، وتبعت للبائع على واتساب')}${opt('out', 'unfit', f.out === 'unfit', 'ارفضه', 'تبعت للبائع السبب على واتساب')}</div>${f.out === 'unfit' ? unfitPick(f) : ''}` + noteF(f),
      ok: (f) => f.out === 'ready' || (f.out === 'unfit' && !!unfitReason(f)), btn: (f) => (f.out === 'ready' ? 'انشره' : 'اعتمد الرفض'),
      run: async (r, f) => { const reason = f.out === 'unfit' ? unfitReason(f) : '';
        if (await act(r.id, { a: 'close', outcome: f.out, reason, note: f.note }, f.out === 'ready' ? 'العرض اتنشر على الموقع' : 'الرفض اتعتمد', 1)) push({ v: 'wa', id: r.id, ready: f.out === 'ready', reason }); } },
    close: { t: 'اقفل الطلب',
      init: (r) => ({ eval: r.ql === 'yes' ? [] : ['not_qualified'] }),
      body: (r, f) => { const lost = (r.outcome || f.out) === 'lost';
        return (r.outcome ? `<div class="chips"><span class="chip ${r.outcome === 'sold' ? 'c-ok' : ''}">${esc(OUT[r.outcome])}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome === 'sold' ? '<span class="sub">الويب أدمن هيوصله تنبيه يشيل القطعة من الموقع.</span>' : ''}`
          : `<div class="pick">${opt('out', 'sold', f.out === 'sold', 'اتباع')}${opt('out', 'lost', f.out === 'lost', 'ما اتباعش')}</div>${f.out === 'lost' ? `<div class="fld"><span>السبب</span><div class="pick">${LOST.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}</div></div>` : ''}`)
          + (lost ? `<div class="fld"><span>تقييم الإلغاء (اختار واحد أو أكتر)</span><div class="rch">${EVAL.map(([k, l]) => `<button data-a="tog" data-k="eval" data-v="${k}" class="${(f.eval || []).includes(k) ? 'on' : ''}" aria-pressed="${(f.eval || []).includes(k)}">${l}</button>`).join('')}</div><span class="sub">ده الإلغاء النهائي، والتقييم بيظهر في التقارير.</span></div>` : '') + noteF(f); },
      ok: (f, r) => { const out = r.outcome || f.out; if (!out || (!r.outcome && out === 'lost' && !f.reason)) return false; return out !== 'lost' || (f.eval || []).length > 0; },
      btn: (f, r) => ((r.outcome || f.out) === 'lost' ? 'اعتمد الإلغاء واقفل' : 'اقفل الطلب'),
      run: (r, f) => { const out = r.outcome || f.out; return act(r.id, { a: 'close', outcome: out, reason: r.outcome ? '' : (f.reason || ''), note: f.note, eval: out === 'lost' ? f.eval : null }, out === 'lost' ? 'الإلغاء اتعتمد والطلب اتقفل' : 'الطلب اتقفل', 2); } },
    cx: { t: 'البيعة اتلغت: الإجراء',
      body: (r, f) => { const others = allSales().filter((p) => p.id !== r.sales_id), sug = others.filter((p) => p.avail !== false).sort((a, b) => counts(a.id).open - counts(b.id).open)[0], o = isOffer(r);
        let h = `<div class="chips"><span class="chip">${esc(P(r.sales_id).name)}: ${o ? 'مش مناسب' : 'ما اتباعش'}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome_summary ? `<div class="log"><div class="lg"><span>${o ? 'ملخص المراجع' : 'ملخص السيلز'}</span><span></span><q>${esc(r.outcome_summary)}</q></div></div>` : ''}`;
        h += `<div class="pick">${(o ? CXO : CX).map(([k, l, s]) => opt('do', k, f.do === k, l, s)).join('')}</div>`;
        if (f.do === 'reassign') h += `<div class="fld"><span>${o ? 'العضو اللي هيراجعه' : 'السيلز الجديد'}</span>${others.length ? `<div class="pick">${others.map((p) => { const c = counts(p.id), on = p.avail !== false; return opt('sales', p.id, f.sales === p.id, esc(p.name), (on ? 'متاح' : 'مش متاح') + ` · ${c.open} في إيده`, sug && sug.id === p.id ? ' <span class="tag-s">مقترح</span>' : '', !on, 1); }).join('')}</div>` : '<span class="sub">مفيش سيلز تاني متسجل.</span>'}</div>`;
        if (f.do === 'postpone') { const d0 = new Date(Date.now() + D), d1 = new Date(Date.now() + 180 * D), iso = (d) => d.toISOString().slice(0, 10);
          h += `<label class="fld"><span>أجّله لحد يوم</span><input type="date" data-f="until" min="${iso(d0)}" max="${iso(d1)}" value="${esc(f.until || '')}" dir="ltr"></label><span class="sub">${isOffer(r) ? 'العرض' : 'الطلب'} بيرجع لـ${esc(P(r.sales_id).name)}، ومهلته الساعة 10 الصبح في اليوم ده.</span>`; }
        h += noteF(f, f.do === 'other' ? 'اكتب الإجراء (إجباري)' : '');
        if (f.do && f.do !== 'postpone') h += minsPick(f);
        return h; },
      ok: (f) => !!f.do && (f.do !== 'reassign' || !!f.sales) && (f.do !== 'postpone' || /^\d{4}-\d{2}-\d{2}$/.test(f.until || '')) && (f.do !== 'other' || !!(f.note || '').trim()) && (f.do === 'postpone' || !!f.mins),
      btn: (f, r) => ({ reassign: f.sales ? 'اديه لـ' + P(f.sales).name : isOffer(r) ? 'اختار العضو' : 'اختار السيلز', escalate: r.tl_id && !informed(r) ? 'ابعته للتيم ليدر يتابع' : 'ابعته للسيلز أدمن يتابع', postpone: 'أجّله', confirm: isOffer(r) ? 'ابعته لاعتماد الرفض' : 'ابعته للإلغاء', other: 'ابعت' }[f.do] || 'اختار الإجراء'),
      run: (r, f) => act(r.id, { a: 'cx', do: f.do, sales_id: f.sales || null, until: f.until || null, note: f.note, mins: f.do === 'postpone' ? null : f.mins }, { reassign: (isOffer(r) ? 'العرض راح لـ' : 'الطلب راح لـ') + (f.sales ? P(f.sales).name : ''), postpone: isOffer(r) ? 'العرض اتأجل' : 'الطلب اتأجل', escalate: 'اتبعت للمتابعة', confirm: 'اتبعت للإلغاء', other: 'اتبعت' }[f.do], 2) },
    move: { t: 'حوّله لحد تاني',
      body: (r, f) => { const cur = holderIdOf(r), list = S.staff.filter((p) => p.active && MOVE_ROLE[r.stage].includes(p.role) && p.id !== cur);
        return `<span class="sub">دلوقتي عند ${esc(holderName(r))}. اختار ${STAGE_ROLE[r.stage]} تاني يكمّل الطلب.</span>` + (list.length ? `<div class="pick">${list.map((p) => { const c = counts(p.id); return opt('to', p.id, f.to === p.id, esc(p.name), `${c.open} في إيده${c.late ? ' · ' + c.late + ' متأخر' : ''}${SALES.includes(p.role) && p.avail === false ? ' · مش متاح' : ''}`, '', false, 1); }).join('')}</div>` : '<span class="sub">مفيش حد تاني بنفس الدور.</span>') + noteF(f) + minsPick(f); },
      ok: (f) => !!f.to && !!f.mins, btn: (f) => (f.to ? 'حوّله لـ' + P(f.to).name : 'اختار'),
      run: (r, f) => act(r.id, { a: 'move', to: f.to, mins: f.mins, note: f.note }, 'اتحوّل لـ' + P(f.to).name, 2) },
    extend: { t: 'مدّ المهلة', body: (r, f) => `<span class="sub">المهلة الجديدة بتبدأ من دلوقتي، واللي الطلب عنده يوصله تنبيه.</span>` + minsPick(f) + noteF(f, 'السبب (اختياري)'), ok: (f) => !!f.mins, btn: () => 'مدّ المهلة',
      run: (r, f) => act(r.id, { a: 'extend', mins: f.mins, note: f.note }, 'المهلة اتمدّت', 2) },
    ping: { t: 'نبّه حد على الطلب',
      body: (r, f) => { const ids = [r.tl_id, r.sup_id, r.sales_id].filter(Boolean), list = S.staff.filter((p) => p.active && p.id !== me.id).sort((a, b) => (ids.includes(b.id) ? 1 : 0) - (ids.includes(a.id) ? 1 : 0));
        return `<div class="pick">${list.map((p) => opt('to', p.id, f.to === p.id, esc(p.name), ROLES[p.role] + (ids.includes(p.id) ? ' · ماسك الطلب ده' : ''), '', false, 1)).join('')}</div>` + noteF(f, 'الرسالة (إجباري)'); },
      ok: (f) => !!f.to && !!(f.note || '').trim(), btn: (f) => (f.to ? 'نبّه ' + P(f.to).name : 'اختار'),
      run: (r, f) => act(r.id, { a: 'ping', to: f.to, note: f.note.trim() }, 'اتبعت التنبيه', 2) },
    qlask: { t: 'اطلب اعتماده كواليفايد ليد', body: (r, f) => noteF(f, 'ملاحظة للتيم ليدر (اختياري)'), ok: () => true, btn: () => 'ابعته للتيم ليدر',
      run: (r, f) => act(r.id, { a: 'ql_ask', note: f.note }, 'اتبعت للتيم ليدر يعتمده', 1) },
    qlok: { t: 'اعتمده كواليفايد ليد', body: (r, f) => (r.ql_note ? `<div class="log"><div class="lg"><span>ملاحظة السيلز</span><span></span><q>${esc(r.ql_note)}</q></div></div>` : '') + noteF(f), ok: () => true, btn: () => 'اعتمده',
      run: (r, f) => act(r.id, { a: 'ql_ok', note: f.note }, 'اتعتمد كواليفايد ليد', 1) },
    qlno: { t: 'مش كواليفايد ليد', body: (r, f) => noteF(f, 'السبب (إجباري)'), ok: (f) => !!(f.note || '').trim(), btn: () => 'ابعت',
      run: (r, f) => act(r.id, { a: 'ql_no', note: f.note.trim() }, 'اتسجل إنه مش كواليفايد', 1) },
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
      <div class="fld"><span>الدور</span><div class="rch">${myRoles().map((x) => `<button data-a="set" data-k="role" data-v="${x}" class="${L.f.role === x ? 'on' : ''}">${ROLES[x]}</button>`).join('')}</div></div>`,
      f: `<button class="btn pri" data-a="addgo"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'ضيف واطلع كود التفعيل'}</button>` };
  }
  function vCode(L) { return { t: 'كود التفعيل', b: `<div class="card" style="text-align:center"><span class="sub">ابعت الكود ده لـ${esc(L.name)} (صالح 7 أيام):</span><b class="bigcode num">${esc(L.code)}</b><button class="btn sm" data-a="copy" data-v="${esc(L.code)}">انسخ الكود</button></div><span class="sub">العضو يفتح telad.vercel.app/admin ويدوس "تفعيل حساب جديد"، ويكتب رقمه والكود ده، ويختار باسورد لنفسه. الكود بيتقفل بعد 5 محاولات غلط.</span>`, f: '' }; }
  function vMember(L) {
    const p = P(L.id);
    return { t: p.name, b: `<div class="kv"><div><span>الدور</span><b>${ROLES[p.role]}</b></div><div><span>الموبايل</span><b dir="ltr">${esc(p.phone || '')}</b></div><div><span>الحساب</span><b>${p.activated ? 'فعّله' : 'لسه ما فعّلش'}${p.active ? '' : ' · موقوف'}</b></div></div>
      <div class="fld"><label for="mname" style="font-size:13px;font-weight:600">الاسم</label><div style="display:flex;gap:8px"><input id="mname" type="text" data-f="name" maxlength="60" value="${esc(L.f.name ?? p.name)}" style="flex:1;min-width:0"><button class="btn sm" data-a="savename" data-id="${p.id}"${busy ? ' disabled' : ''}>احفظ</button></div></div>
      <div class="fld"><span>غيّر الدور</span><div class="rch">${myRoles().map((x) => `<button data-a="setrole" data-id="${p.id}" data-v="${x}" class="${p.role === x ? 'on' : ''}"${busy ? ' disabled' : ''}>${ROLES[x]}</button>`).join('')}</div><span class="sub">لو عنده طلبات مفتوحة لازم تتحوّل الأول.</span></div>
      ${p.activated ? '' : `<button class="btn" data-a="newcode" data-id="${p.id}">كود تفعيل جديد</button>`}`,
      f: `<button class="btn ${p.active ? '' : 'dark'}" data-a="toggle" data-id="${p.id}">${p.active ? 'وقّفه' : 'رجّعه'}</button><button class="btn red" data-a="askdel" data-id="${p.id}">امسحه</button>` };
  }
  function vDel(L) { const p = P(L.id); return { t: 'تمسح ' + p.name + '؟', b: `<span class="sub">${esc(p.name)} (${ROLES[p.role]}) هيتشال من الفريق ومش هيقدر يدخل. المسح نهائي، والطلبات القديمة بتفضل في السجل. لو عايز توقفه مؤقتًا استخدم "وقّفه".</span>`, f: `<button class="btn" data-a="back">لا، سيبه</button><button class="btn dark" data-a="delgo" data-id="${p.id}"${busy ? ' disabled' : ''}>امسح نهائي</button>` }; }
  // after publishing / rejecting an offer: the WhatsApp message to the seller, sent by the person who decided
  function vWa(L) {
    const r = Rq(L.id) || {}, nm = (r.name || '').trim().split(/\s+/)[0] || '';
    const msg = L.ready ? `أهلًا ${nm}، قطعتك ${r.code || ''} اتنشرت على تِلاد.\n${SITE}` : `أهلًا ${nm}، عرض قطعتك ${r.code || ''} مااتنشرش.\nالسبب: ${L.reason || ''}`;
    return { t: 'ابعت للبائع', b: `<span class="sub">${L.ready ? 'العرض اتنشر.' : 'الرفض اتعتمد.'} ابعت للبائع الرسالة دي على واتساب:</span><div class="log"><div class="lg"><span>${esc(r.name || '')} · <span dir="ltr">${esc(r.phone || '')}</span></span><span></span><q>${esc(msg)}</q></div></div>`,
      f: r.phone ? `<a class="btn pri wa" href="https://wa.me/2${esc(r.phone)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">افتح واتساب</a>` : '' };
  }
  const VIEWS = { req: vReq, sub: vSub, bell: vBell, person: vPerson, add: vAdd, code: vCode, member: vMember, del: vDel, wa: vWa };

  // ---------- render ----------
  function render() {
    if (dead) return;
    const y = window.scrollY;
    $('app').innerHTML = header() + '<main class="pg">' + vMain() + '</main>'; foldify($('app'));
    window.scrollTo(0, y);
    renderSheet();
  }
  function renderSheet() {
    if (dead) return;
    const ov = $('ov'), L = top();
    if (!L) { if (!ov.hidden) { ov.hidden = true; document.body.style.overflow = ''; } return; }
    const v = VIEWS[L.v](L), b = $('shB'), st = b.scrollTop, same = ov.dataset.k === String(UI.stack.length) + L.v + (L.id || '');
    $('shT').textContent = v.t; b.innerHTML = v.b; foldify(b); $('shF').innerHTML = v.f; $('shF').hidden = !v.f;
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
    const a = b.dataset.a, v = b.dataset.v, id = b.dataset.id ? Number(b.dataset.id) : null, L = top(); let v2;
    switch (a) {
      case 'tab': UI.tab = v; UI.stack = []; render(); window.scrollTo(0, 0); break;
      case 'flt': UI.flt = v; render(); break;
      case 'oflt': UI.oflt = v; render(); break;
      case 'fold': { const g = b.closest('.grp'), shut = !FOLD.has(v); if (shut) FOLD.add(v); else FOLD.delete(v); saveFold();
        if (g) { g.classList.toggle('shut', shut); b.setAttribute('aria-expanded', String(!shut)); } break; }
      case 'mf': UI.mf = v; render(); break;
      case 'rf': UI.rf = v; render(); break;
      case 'savename': { const p = P(id), nm = (L.f.name || '').trim(); if (nm.length < 2 || nm.length > 60) return toast('الاسم لازم يكون من 2 لـ 60 حرف.'); if (nm === p.name) return toast('الاسم زي ما هو.');
        if (await rpcToast('staff_update', { p_id: id, p: { name: nm } }, 'الاسم اتغيّر لـ' + nm)) await load(); break; }
      case 'per': UI.per = Number(v); render(); break;
      case 'open': push({ v: 'req', id }); break;
      case 'close': closeAll(); break;
      case 'back': UI.stack.pop(); renderSheet(); break;
      case 'bell': push({ v: 'bell' }); break;
      case 'person': push({ v: 'person', id }); break;
      case 'reload': toast('بنحدّث...'); load(); break;
      case 'signout': onSignOut(); break;
      case 'listings': if (opts.onListings) opts.onListings(); break;
      case 'sub': { const r = Rq(L.id); if (v === 'close' && isOffer(r)) v2 = 'oclose'; else v2 = v; push({ v: 'sub', id: L.id, k: v2, f: Object.assign({ mins: 120, note: '' }, ACT[v2].init ? ACT[v2].init(r) : {}) }); break; }
      case 'tog': { const a0 = L.f[b.dataset.k] || (L.f[b.dataset.k] = []), i = a0.indexOf(v); if (i > -1) a0.splice(i, 1); else a0.push(v); renderSheet(); break; }
      case 'set': L.f[b.dataset.k] = b.dataset.num ? Number(v) : v; if (b.dataset.k === 'out') L.f.reason = null;
        if (b.dataset.k === 'zone' && L.f.district !== '' && !ZONES[v].includes(Number(L.f.district))) L.f.district = ZONES[v][0]; renderSheet(); break;
      case 'tg1': L.f[b.dataset.k] = L.f[b.dataset.k] === v ? '' : v; renderSheet(); break;
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
      case 'member': push({ v: 'member', id, f: {} }); break;
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
  root.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.ch === 'ms' || t.dataset.ch === 'rs') { UI[t.dataset.ch] = t.value; render(); return; }
    if (t.dataset.ch !== 'actas' || busy) return;
    busy = true; t.disabled = true;
    const { error } = await sb.rpc('desk_act_as', { p_staff: t.value ? Number(t.value) : null });
    busy = false;
    if (error) { toast(errMsg(error)); render(); return; }
    toast(t.value ? 'إنت دلوقتي شغال كأنك ' + P(Number(t.value)).name : 'رجعت الأدمن');
    if (opts.onActAs) opts.onActAs();
  }, { signal: ac.signal });
  const onKey = (e) => { if (e.key === 'Escape' && top()) { UI.stack.pop(); renderSheet(); } };
  document.addEventListener('keydown', onKey);
  const timer = setInterval(() => { if (!top()) load(); else sb.rpc('desk_notifications').then(({ data }) => { if (data && !dead) S.notes = data; }); }, 60000);
  render(); load();
  return () => { dead = true; ac.abort(); clearInterval(timer); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
}
