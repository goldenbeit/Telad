// Team desk for buyer requests: each role sees its own tabs, a request opens in a bottom sheet,
// and every step (forward, confirm, assign, statuses, return, close) opens a second sheet on top.
// Vanilla UI mounted into a shadow root (styles in desk-css.js). All data goes through the desk_* RPCs.
import { DESK_CSS } from './desk-css';
import { SVC } from './solutions';
import { readXlsx, importRows, nameKey, parseCsv, planRows, geoRows } from './xlsx-read';
import { calc, RULES, tierOptions } from './legal-calc';

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
const SITE = 'https://www.telad-group.com';
const LOST = ['السعر عالي عليه', 'لقى قطعة تانية', 'العميل مبيردّش', 'البائع رجع في كلامه', 'سبب تاني'];
const OUT = { sold: 'اتباع', lost: 'ما اتباعش', deposit: 'اتدفع عربون', follow: 'محتاج متابعة', ready: 'جاهز للنشر', unfit: 'مش مناسب', dropped: 'اتشال من المسار', sound: 'تمام', unsound: 'مش سليمة' };
const STAGE_ROLE = { new: 'سيلز أدمن', up_sa: 'سيلز أدمن', tl: 'تيم ليدر', up_tl: 'تيم ليدر', sup: 'مشرف', up_sup: 'مشرف', sales: 'سيلز' };
const LEG_ROLE = { sadmin: 'سيلز أدمن', tl: 'تيم ليدر', sup: 'مشرف', junior: 'سيلز', senior: 'سيلز' };
const PAY_TXT = { check: 'شيك التقنين', waiver: 'التنازل', comp: 'الاستكمال', inst: 'الأقساط' };
const LSTAGE = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
const ERR = { phone_required: 'رقم العميل مش متسجل.', invalid_phone: 'اكتب رقم موبايل مصري صح.', mins_required: 'اختار المهلة.', note_required: 'اكتب السبب.', reason_required: 'اختار السبب.', invalid_sup: 'اختار المشرف.', invalid_sales: 'اختار السيلز.', not_allowed: 'مش مسموح لك بالخطوة دي، أو الطلب اتحرّك. حدّث الصفحة.', invalid_parent: 'اختار صح.', phone_taken: 'الرقم ده متسجل قبل كده.', has_open: 'العضو ده عنده طلبات مفتوحة دلوقتي. لازم تتحوّل الأول.', not_self: 'مينفعش تغيّر أو تمسح حسابك إنت.', not_owner: 'الصلاحية دي للأدمن والـ GM بس.', staff_phone_key: 'الرقم ده متسجل قبل كده.', invalid_outcome: 'اختار النتيجة.', invalid_status: 'الحالة دي مش موجودة.', eval_required: 'اختار تقييم واحد على الأقل.', invalid_until: 'اختار يوم من بكرة لحد 6 شهور.', invalid_action: 'اختار الإجراء.', invalid_target: 'اختار حد تاني بنفس الدور.', too_late: 'المهلة خلصت خلاص، مينفعش تسجّل التأخير دلوقتي.', note_too_long: 'الكلام طويل. اختصره.', not_admin: 'مش مسموح لك تعدّل القطعة دي دلوقتي.', already_asked: 'فيه طلب شيل للقطعة دي مستني موافقة.', listing_not_found: 'القطعة دي مش منشورة دلوقتي.', data_missing: 'كمّل البيانات الناقصة الأول من "صلّح بيانات القطعة".', invalid_amount: 'اكتب رقم صح.', not_found: 'مش لاقيينه. حدّث الصفحة.', name_required: 'اكتب اسم المصدر.', too_many: 'الشيت فيه أكتر من 500 صف. قسّمه.', bad_sales: 'اختار السيلز.', empty: 'مفيش صفوف ترفعها.' };
// What the supervisor does when a sale is cancelled ("البيعة اتلغت")
const CX = [['reassign', 'تغيير وش', 'سيلز تاني يكمّل مع نفس العميل'], ['escalate', 'متابعة من ليفل أعلى', 'التيم ليدر يتابع مع العميل بنفسه'], ['postpone', 'تأجيل حتى', 'يرجع لنفس السيلز في يوم تختاره'], ['confirm', 'تأكيد إلغاء الطلب', 'يطلع للسيلز أدمن يعتمد الإلغاء'], ['other', 'أخرى', 'اكتب الإجراء']];
const CX_TAG = { reassign: 'تغيير وش', escalate: 'متابعة من ليفل أعلى', postpone: 'مؤجل', confirm: 'إلغاء مستني اعتماد', other: 'البيعة اتلغت' };
// the same supervisor actions for an offer that is not fit
const CXO = [['reassign', 'تغيير وش', 'عضو تاني يراجعه من الأول'], ['escalate', 'متابعة من ليفل أعلى', 'التيم ليدر يكلّم البائع بنفسه'], ['postpone', 'تأجيل حتى', 'يرجع لنفس العضو في يوم تختاره'], ['confirm', 'تأكيد الرفض', 'يطلع للسيلز أدمن أو الويب أدمن يعتمد الرفض'], ['other', 'أخرى', 'اكتب الإجراء']];
const CXO_TAG = { reassign: 'تغيير وش', escalate: 'متابعة من ليفل أعلى', postpone: 'مؤجل', confirm: 'رفض مستني اعتماد', other: 'العرض مش مناسب' };
const isOffer = (r) => r.via === 'offer';
const isVerify = (r) => r.via === 'verify';
const isUnit = (r) => !isOffer(r) && !isVerify(r);
// verifying the old plots: five statuses, six hours each; the reasons a plot is not sound
const VSTS = [['v_seller', 'كلّمت البائع', 'اتواصلنا مع البائع للتوثيق'], ['v_data', 'البيانات اتأكدت أو اتصلّحت', 'البيانات اتأكدت أو اتصلّحت'], ['v_photos', 'الصورتين اترفعوا', 'الصورتين اترفعوا'],
  ['v_still', 'البائع لسه عايز يبيع', 'البائع لسه عايز يبيع'], ['v_price', 'السعر اتأكد', 'السعر اتأكد']];
const V_MINS = 360;
const UNSOUND = ['البائع باعها', 'البائع مبيردّش', 'البيانات غلط', 'البائع مش عايز يبيع'];
const stList = (r) => (isOffer(r) ? OSTS : isVerify(r) ? VSTS : STS);
// The sales admin's evaluation of a final cancellation (for the reports)
const EVAL = [['fake', 'ريكويست fake'], ['not_qualified', 'ريكويست لم يتم اعتماده'], ['sales_late', 'تأخّر من السيلز'], ['followup_late', 'تأخّر من المتابعة'], ['competitor', 'بيان منافس'], ['market', 'تغيّر في السوق'], ['real_reason', 'العميل حصل معاه ظرف حقيقي'], ['hesitant', 'العميل تردد'], ['other', 'أخرى']];
const evalName = (k) => (EVAL.find((e) => e[0] === k) || [])[1] || k;
const TAB_IC = {
  mine: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  all: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>',
  offers: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>',
  verify: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z"/>',
  svc: '<path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/>',
  plots: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  gone: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
  mirror: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 4.5"/>',
  rep: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  team: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  range: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>', prc: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.2-3-2.2s-3 .8-3 2.2 1.3 1.9 3 2.3 3 .9 3 2.3-1.3 2.3-3 2.3-3-.9-3-2.3"/>', archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
  imp: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2M8 18h2M12 18h2"/>',
  ql: '<path d="M20 6L9 17l-5-5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>', done: '<path d="M20 6L9 17l-5-5"/>',
};
const IC = {
  filter: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  ref: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></svg>',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null || n === '' || isNaN(n) ? '—' : Math.round(Number(n)).toLocaleString('en-US'));
const T = (v) => (v ? Date.parse(v) : null);
const now = () => Date.now();
function when(t) { if (!t) return ''; const d = new Date(t); const h = d.getHours(), m = d.getMinutes(); return d.getDate() + '/' + (d.getMonth() + 1) + ' · ' + ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' ص' : ' م'); }
function dur(ms) { ms = Math.max(0, ms); const m = Math.round(ms / M); if (m < 60) return Math.max(1, m) + ' د'; const h = Math.floor(m / 60), r = m % 60; if (h < 24) return h + ' س' + (r ? ' ' + r + ' د' : ''); return Math.round(h / 24 * 10) / 10 + ' يوم'; }
const ini = (s) => { const w = String(s || '').split(' ').filter((x) => x.length > 1); return (w[0] || s || '؟')[0]; };
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
  const canRmAsk = ['owner', 'super', 'gm', 'sadmin', 'web', 'tl'].includes(R), canRmDecide = ['owner', 'super', 'sadmin', 'web'].includes(R);
  const canDrop = canRmDecide, canDel = R === 'owner' || R === 'super';
  const canSvc = ['owner', 'gm', 'super', 'sadmin', 'web'].includes(R), canPlots = ['owner', 'super', 'web', 'gm'].includes(R), plotsRO = R === 'gm';
  const isSA = R === 'owner' || R === 'sadmin' || R === 'super', isWeb = R === 'owner' || R === 'web' || R === 'super', isSales = SALES.includes(R);
  const S = { staff: [], reqs: [], notes: [], rem: [], svc: [], plots: [], bands: [], reviews: [], imports: [], loaded: false, err: false };
  const canArchive = ['owner', 'gm', 'super', 'sadmin', 'web'].includes(R), canReview = ['owner', 'gm', 'super', 'sadmin', 'web', 'tl'].includes(R);
  const PLETTER = {};
  const SDET = {};
  const KEEP_KEY = 'telad.desk.' + (me.owner && !me.acting ? 'owner' : me.id) + '.' + me.role, KEEP = { y: null };
  const UI = { vflt: 'wait', vsel: new Set(), tab: null, flt: 'open', oflt: 'open', sflt: 'open', pflt: 'approved', pq: '', per: 30, stack: [], mf: 'all', ms: 'open', rf: 'all', rs: 'open' };
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
  // Plot photos are private (team only, 18/11): fetched as short-lived links in batches and put into the <img> in place,
  // so a sheet being typed in is never re-rendered for them.
  const PH = {}, phQ = new Set(); let phT = null;
  async function phFetch() {
    const paths = [...phQ]; phQ.clear(); if (!paths.length) return;
    const { data } = await sb.storage.from('listing-photos').createSignedUrls(paths, 3600);
    (data || []).forEach((d) => { if (d.path && d.signedUrl) PH[d.path] = d.signedUrl; });
    if (dead) return;
    root.querySelectorAll('img[data-ph]').forEach((im) => { const u = PH[im.dataset.ph]; if (u && im.getAttribute('src') !== u) im.src = u; });
  }
  const photoImg = (path) => { if (!path) return '';
    if (PH[path] === undefined) { PH[path] = ''; phQ.add(path); clearTimeout(phT); phT = setTimeout(phFetch, 0); }
    return `<img class="photo" data-ph="${esc(path)}"${PH[path] ? ` src="${esc(PH[path])}"` : ''} alt="صورة القطعة" loading="lazy">`; };

  // ---------- data ----------
  function norm(r) { r.legs = (r.legs || []).map((l) => ({ ...l, start: T(l.start), due: T(l.due), end: T(l.end) })); r.at = T(r.created_at); r.st_due_t = T(r.st_due); r.first_t = T(r.first_at); r.closed_t = T(r.closed_at); return r; }
  // The first load (and the refresh button) brings everything; after that only what changed since the last load, plus
  // the ids still visible so removed ones drop out (18/11: saves most of the data the desk used to pull every minute).
  const CUR = { r: null, p: null };
  const sinceOf = (k, full) => (!full && S.loaded && CUR[k] ? new Date(new Date(CUR[k]).getTime() - 120000).toISOString() : null);
  const newest = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id);
  function merge(list, d, since, fn) {
    if (!since) return (d.rows || []).map(fn);
    const ch = new Map((d.rows || []).map((x) => [x.id, fn(x)])), ids = new Set(d.ids || []);
    ch.forEach((_, id) => { if (!UI.stack.some((L) => L.id === id)) delete DETAIL[id]; });
    return list.filter((x) => ids.has(x.id) && !ch.has(x.id)).concat([...ch.values()]).sort(newest);
  }
  async function load(full) {
    const sr = sinceOf('r', full), sp = sinceOf('p', full);
    let st, rq, nt, rm, sv, pl, rg, rv, ct, im, ms;
    try { [st, rq, nt, rm, sv, pl, rg, rv, ct, im, ms] = await Promise.all([sb.rpc('desk_staff'), sb.rpc('desk_requests_since', { p_since: sr }), sb.rpc('desk_notifications'), canRmAsk ? sb.rpc('desk_removals') : Promise.resolve({ data: [] }), canSvc ? sb.rpc('desk_services') : Promise.resolve({ data: [] }), canPlots ? sb.rpc('admin_listings_since', { p_since: sp }) : Promise.resolve({ data: null }), sb.rpc('desk_bands'), canReview ? sb.rpc('desk_price_reviews') : Promise.resolve({ data: [] }), canReview ? sb.rpc('desk_counts') : Promise.resolve({ data: null }), canReview || canPlots ? sb.rpc('desk_imports') : Promise.resolve({ data: [] }), canReview || canPlots ? sb.rpc('desk_map_stats') : Promise.resolve({ data: null })]); } catch (e) { st = { error: e }; }
    if (dead) return;
    if (st.error || rq.error) { S.err = true; render(); return; }
    if (canReview && (full || !S.wa || UI.tab === 'wa')) { const w = await sb.rpc('desk_wa_clicks'); if (dead) return; if (!w.error) S.wa = w.data || []; }
    S.staff = st.data || []; S.reqs = merge(S.reqs || [], rq.data || {}, sr, norm); CUR.r = rq.data && rq.data.now;
    if (pl && pl.data && !pl.error) { S.plots = merge(S.plots || [], pl.data, sp, (x) => x); CUR.p = pl.data.now; }
    S.notes = nt.data || []; S.rem = (rm && rm.data) || []; S.svc = (sv && sv.data) || []; S.bands = (rg && rg.data) || []; S.reviews = (rv && rv.data) || []; S.counts = (ct && ct.data) || null; if (im && !im.error) S.imports = im.data || []; if (ms && !ms.error) S.mapst = ms.data; Object.keys(MAPD).forEach((k) => MAPS.add(Number(k))); S.loaded = true; S.err = false;
    const meRow = S.staff.find((p) => p.id === me.id); if (meRow) me.avail = meRow.avail;
    render(); openFromUrl();
    if (KEEP.y != null) { const y = KEEP.y; KEEP.y = null; requestAnimationFrame(() => window.scrollTo(0, y)); }
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
    if (r.stage === 'tl' || r.stage === 'up_tl') return R === 'tl' && (r.tl_id === me.id || (isVerify(r) && !r.tl_id && r.stage === 'up_tl')) && !(isVerify(r) && r.stage === 'tl');
    if (r.stage === 'sup' || r.stage === 'up_sup') return R === 'sup' && (r.sup_id === me.id || (r.batch && !r.sup_id));
    if (r.stage === 'sales') return isSales && r.sales_id === me.id;
    return false;
  }
  function holderName(r) {
    if (r.stage === 'up_sa' && webCancel(r)) return 'السيلز أدمن أو الويب أدمن';
    if (r.stage === 'new' || r.stage === 'up_sa' || r.via === 'ask') return 'السيلز أدمن';
    if (isVerify(r) && r.stage === 'tl' && !r.tl_id) return 'التيم ليدر';
    if (r.stage === 'up_tl' && !r.tl_id) return 'أي تيم ليدر';
    if (r.stage === 'up_sup' && !r.sup_id) return 'أي مشرف';
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
    if (r.stage === 'closed' && r.outcome === 'dropped') return '<span class="chip">اتشال من المسار</span>';
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
  // Card: a colored edge for the deadline, one line "who has it" with the time, and one quiet line for the rest.
  const outBad = (r) => ['lost', 'unfit', 'unsound'].includes(r.outcome);
  function whereText(r) {
    if (r.stage === 'closed') return r.outcome === 'dropped' ? 'اتشال من المسار' : isOffer(r) ? (r.outcome === 'ready' ? 'اتنشر ✓' : 'اترفض') : isVerify(r) ? (r.outcome === 'sound' ? 'اتوثقت ✓' : 'مش سليمة') : r.outcome === 'sold' ? 'اتباع ✓' : esc(OUT[r.outcome] || 'اتقفل');
    const up = r.stage.startsWith('up_') ? '↑ ' : '';
    if (isMine(r)) return `<span class="me">${up}عندك</span>`;
    const role = r.stage !== 'new' && r.stage !== 'up_sa' && STAGE_ROLE[r.stage] && !(isVerify(r) && r.stage === 'tl' && !r.tl_id) ? ` <span class="rl">· ${STAGE_ROLE[r.stage]}</span>` : '';
    return `${up}عند ${esc(holderName(r))}${role}`;
  }
  function card(r) {
    const done = stDone(r), last = stList(r).filter((s0) => done[s0[0]]).pop(), due = curDue(r), d = due ? due - now() : null;
    const col = r.stage === 'closed' ? (['sold', 'ready', 'sound'].includes(r.outcome) ? 'var(--ok)' : 'var(--line)') : d == null ? 'var(--line)' : d < 0 ? 'var(--bad)' : d < 30 * M ? 'var(--gold)' : 'var(--ok)';
    const tm = d == null ? '' : d < 0 ? `<span class="tm bad">${IC.clock}متأخر ${dur(-d)}</span>` : `<span class="tm${d < 30 * M ? ' warn' : ''}">${IC.clock}فاضل ${dur(d)}</span>`;
    const extra = [r.stage === 'sales' && last ? last[1] : '', r.outcome && r.stage !== 'closed' ? OUT[r.outcome] + (r.outcome_reason && outBad(r) ? ' (' + r.outcome_reason + ')' : '') : '',
      r.ql === 'yes' ? 'كواليفايد ليد ✓' : r.ql === 'asked' ? 'مستني اعتماد ليد' : '', cxTag(r), informed(r) && r.stage !== 'new' && isUnit(r) ? 'التيم ليدر للعلم' : '', r.l_hold ? 'مستنية مراجعة السعر' : r.l_level === 'bomb' ? 'قنبلة 💣' : r.l_over && r.stage !== 'closed' ? 'فوق النطاق السعري' : '', r.l_missing && r.stage !== 'closed' ? 'ناقص: ' + r.l_missing.join('، ') : '', r.notes ? r.notes + ' ملاحظة' : ''].filter(Boolean);
    const av = r.stage === 'closed' ? (['sold', 'ready', 'sound'].includes(r.outcome) ? '✓' : '–') : isMine(r) ? ini(me.name) : ini(holderName(r));
    return `<button class="rc ca" style="--st:${col}" data-a="open" data-id="${r.id}"><span class="cav">${esc(av)}</span><span class="cb"><span class="rc-top"><b>${isOffer(r) ? 'عرض · ' : isVerify(r) ? 'توثيق · ' : ''}${esc(unitTitle(r))}</b><span class="code">R-${r.id}${r.code ? ' · ' + esc(r.code) : ''}</span></span>
    <span class="cw"><span class="who">${whereText(r)}</span>${tm}</span><span class="cx">${esc([(isUnit(r) ? '' : 'البائع: ') + (r.name || '—'), ...extra].join(' · '))}</span></span></button>`;
  }
  function cxTag(r) {
    if (!r.cx || r.stage === 'closed') return '';
    if (r.cx === 'postpone' && r.stage === 'sales') return 'مؤجل لحد ' + when(T(r.cx_until)).split(' · ')[0];
    if (r.cx === 'reassign' && r.stage === 'sales') return 'تغيير وش';
    if (['escalate', 'confirm', 'other'].includes(r.cx) && (r.stage === 'up_tl' || r.stage === 'up_sa')) return (isOffer(r) ? CXO_TAG : CX_TAG)[r.cx];
    return '';
  }
  const list = (l, emp) => (l.length ? l.map(card).join('') : `<div class="empty">${emp}</div>`);
  const counts = (pid) => { const open = S.reqs.filter((r) => r.stage !== 'closed' && holderIdOf(r) === pid); return { open: open.length, late: open.filter(isLate).length }; };
  function holderIdOf(r) { return { tl: r.tl_id, up_tl: r.tl_id, sup: r.sup_id, up_sup: r.sup_id, sales: r.sales_id }[r.stage] || null; }

  // ---------- main views ----------
  function tabsFor() {
    if (R === 'owner' || R === 'sadmin' || R === 'super') return [['mine', 'عندي'], ['all', 'الطلبات'], ['offers', 'العروض'], ['verify', 'التوثيق'], ['svc', 'الخدمات'], ['plots', 'القطع'], ['prc', 'مراجعة السعر'], ['imp', 'رفع شيت'], ['wa', 'واتساب'], ['calc', 'حاسبة التقنين'], ['gone', 'اتشالت'], ['mirror', 'المراية'], ['rep', 'التقارير']].concat(canManage ? [['range', 'النطاق السعري'], ['team', 'الفريق']] : []);
    if (R === 'gm') return [['all', 'الطلبات'], ['offers', 'العروض'], ['verify', 'التوثيق'], ['svc', 'الخدمات'], ['plots', 'القطع'], ['prc', 'مراجعة السعر'], ['imp', 'رفع شيت'], ['wa', 'واتساب'], ['calc', 'حاسبة التقنين'], ['gone', 'اتشالت'], ['mirror', 'المراية'], ['rep', 'التقارير'], ['range', 'النطاق السعري'], ['team', 'الفريق']];
    if (R === 'web') return [['mine', 'عندي'], ['all', 'الطلبات'], ['offers', 'العروض'], ['verify', 'التوثيق'], ['svc', 'الخدمات'], ['plots', 'القطع'], ['prc', 'مراجعة السعر'], ['imp', 'رفع شيت'], ['wa', 'واتساب'], ['calc', 'حاسبة التقنين'], ['gone', 'اتشالت'], ['mirror', 'المراية'], ['rep', 'التقارير']];
    if (R === 'tl') return [['mine', 'عندي'], ['verify', 'التوثيق'], ['prc', 'مراجعة السعر'], ['imp', 'رفع شيت'], ['wa', 'واتساب'], ['calc', 'حاسبة التقنين'], ['ql', 'للاعتماد'], ['info', 'للعلم'], ['mirror', 'المراية'], ['rep', 'التقارير']];
    if (R === 'sup') return [['mine', 'عندي'], ['mirror', 'فريقي'], ['rep', 'التقارير']];
    return [['mine', 'عندي'], ['done', 'خلصت'], ['rep', 'أدائي']];
  }
  const infoList = () => S.reqs.filter((r) => R === 'tl' && r.tl_id === me.id && informed(r));
  function header() {
    const un = S.notes.filter((n) => !n.read).length, tabs = tabsFor();
    if (!tabs.some((t) => t[0] === UI.tab)) UI.tab = tabs[0][0];
    const badge = (t) => (t === 'wa' ? (S.wa || []).filter(waToday).length : t === 'prc' ? S.reviews.length : t === 'all' ? S.reqs.filter((r) => isUnit(r) && r.stage !== 'closed').length : t === 'offers' ? S.reqs.filter((r) => isOffer(r) && r.stage !== 'closed').length : t === 'verify' ? (R === 'tl' ? vWait().length : 0) : t === 'svc' ? S.svc.filter((x) => x.state === 'new').length : t === 'gone' ? (canRmDecide ? S.rem.filter((x) => x.state === 'pending').length : 0) : t === 'mine' ? S.reqs.filter(inbox).length : t === 'ql' ? qlList().length : t === 'info' ? infoList().filter((r) => !r.tl_ack && r.stage !== 'closed').length : 0);
    const open = S.reqs.filter(isOpen), day = new Date(); day.setHours(0, 0, 0, 0);
    const myLate = S.reqs.filter((r) => inbox(r) && isLate(r)).length, hasMine = tabs.some((t) => t[0] === 'mine');
    const hello = `<div class="hello">${new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'} يا ${esc(me.name || '')}<small>${!S.loaded ? 'بنحمّل...' : myLate ? `فيه ${myLate} متأخر مستنيك` : 'كله ماشي في الوقت'}</small></div>
    <div class="stats"><div class="stat bad"><b class="num">${isSales ? myLate : open.filter(isLate).length}</b><span>متأخر</span></div><div class="stat"><b class="num">${hasMine ? S.reqs.filter(inbox).length : open.length}</b><span>${hasMine ? 'عندي' : 'مفتوح'}</span></div><div class="stat"><b class="num">${S.reqs.filter((r) => !isOpen(r) && r.closed_t >= day.getTime()).length}</b><span>اتقفل النهارده</span></div></div>`;
    return `<header class="hd"><div class="hd-in"><span class="brand">تِلاد</span><span class="me"><b>${esc(me.name || '')}</b><span>${ROLES[R]}</span></span>
    ${opts.onListings ? '<button class="ib" data-a="listings">الإعلانات</button>' : ''}${me.alt ? `<button class="ib" data-a="altgo" aria-label="بدّل لحساب ${ROLES[me.alt.role] || ''}">⇄ ${ROLES[me.alt.role] || ''}</button>` : ''}<button class="ib" data-a="reload" aria-label="تحديث">${IC.ref}</button>
    <button class="ib" data-a="bell" aria-label="التنبيهات${un ? '، ' + un + ' جديدة' : ''}">${IC.bell}${un ? `<b class="num">${un}</b>` : ''}</button><button class="ib" data-a="signout" aria-label="خروج">${IC.out}</button></div>
    ${me.can_act ? actAsBar() : ''}${hello}</header>
    <nav class="tabs">${tabs.map((t) => { const c = badge(t[0]); return `<button class="tab${UI.tab === t[0] ? ' on' : ''}" data-a="tab" data-v="${t[0]}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_IC[t[0]] || TAB_IC.all}</svg><span>${t[1]}</span>${c ? `<i class="num">${c}</i>` : ''}</button>`; }).join('')}</nav>`;
  }
  // A list tab: "الكل" on top with the minor filters under it, then sort and filter, then the cards.
  const LT = {}, LTA = {};
  const lt = (t) => LT[t] || (LT[t] = { mn: 'all', sort: null, f: {} });
  const H_ = 60 * M;
  const REQ_SORTS = [['due', 'الأقرب مهلة'], ['late', 'المتأخر الأول'], ['new', 'الأحدث'], ['old', 'الأقدم'], ['dist', 'الحي']];
  const REQ_SORT = { due: (r) => (r.stage === 'closed' ? 9e15 + r.at : curDue(r) ?? 8e15), late: (r) => (isLate(r) ? curDue(r) : r.stage === 'closed' ? 9.5e15 : 9e15 + (curDue(r) || 0)), new: (r) => -r.at, old: (r) => r.at, dist: (r) => Number(r.l_district || r.district || 999) };
  const reqDist = (r) => (r.l_district ? 'الحي ' + r.l_district : r.district ? 'الحي ' + r.district : r.l_zone || r.zone || 'من غير حي');
  const REQ_OPT = (allLabel, empty, extra) => ({ allLabel, empty, extra, card, sorts: REQ_SORTS, sortFn: REQ_SORT,
    filters: (items) => [['holder', 'عند مين', [...new Set(items.filter((r) => r.stage !== 'closed').map((r) => holderName(r)))]], ['dist', 'الحي', [...new Set(items.map(reqDist))].sort()],
      ['flag', 'الحالة', ['متأخر', 'راجع لفوق', 'فيه ملاحظات', 'كواليفايد ليد', 'ما اتباعش / مش مناسب', 'العميل اتأخر في الرد']]],
    field: { holder: (r) => holderName(r), dist: reqDist },
    flag: { 'متأخر': isLate, 'راجع لفوق': (r) => r.stage.startsWith('up_'), 'فيه ملاحظات': (r) => r.notes > 0, 'كواليفايد ليد': (r) => r.ql === 'yes', 'ما اتباعش / مش مناسب': outBad, 'العميل اتأخر في الرد': (r) => r.client_late > 0 } });
  const isOpen = (r) => r.stage !== 'closed';
  const soon = (r) => { const d = curDue(r); return !!(d && d > now() && d - now() < H_); };
  function ltList(t) {
    const A = LTA[t], s0 = lt(t), o = A.opt, mn = A.minors.find((m) => m[0] === s0.mn);
    let l = mn ? A.items.filter(mn[2]) : A.items.slice();
    Object.entries(s0.f).forEach(([k, vals]) => { if (vals && vals.length) l = l.filter((x) => (k === 'flag' ? vals.every((v) => o.flag[v](x)) : vals.includes(o.field[k](x)))); });
    if (o.search && UI.pq.trim()) { const q = UI.pq.trim().toLowerCase().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)); l = l.filter((x) => o.search(x, q)); }
    const key = o.sortFn[s0.sort || o.sorts[0][0]]; l.sort((a, b) => key(a) - key(b));
    return `<div class="lcnt num">${l.length} من ${A.items.length}</div>` + (l.length ? l.map(o.card).join('') : `<div class="empty">${o.empty}</div>`);
  }
  function listTab(t, items, minors, opt) {
    LTA[t] = { items, minors, opt }; const s0 = lt(t);
    if (s0.mn !== 'all' && !minors.some((m) => m[0] === s0.mn)) s0.mn = 'all';
    const fc = Object.values(s0.f).reduce((a, v) => a + (v ? v.length : 0), 0);
    return `<section class="scope"><button class="all${s0.mn === 'all' ? ' on' : ''}" data-a="mn" data-v="all"><b>الكل</b><small>${opt.allLabel}</small><span class="n num">${items.length}</span></button>
      ${minors.length ? `<div class="minor">${minors.map(([k, lb, test, cls]) => `<button class="mn${s0.mn === k ? ' on' : ''}${cls ? ' ' + cls : ''}" data-a="mn" data-v="${k}">${lb}<em class="num">${items.filter(test).length}</em></button>`).join('')}</div>` : ''}</section>
      ${opt.extra || ''}${opt.search ? `<input type="text" id="pq" class="srch" placeholder="${opt.searchPh}" value="${esc(UI.pq)}">` : ''}
      <div class="ltools"><label class="sortr">رتّب حسب <select data-ch="lsort">${opt.sorts.map(([k, lb]) => `<option value="${k}"${(s0.sort || opt.sorts[0][0]) === k ? ' selected' : ''}>${lb}</option>`).join('')}</select></label>
      <button class="fbtn${fc ? ' on' : ''}" data-a="lfilter">${IC.filter}فلتر${fc ? `<b class="num">${fc}</b>` : ''}</button></div><div id="llist">${ltList(t)}</div>`;
  }
  function vLFilter(L) {
    const A = LTA[L.t], s0 = lt(L.t); if (!A) return { t: 'فلتر', b: '', f: '' };
    return { t: 'فلتر', b: A.opt.filters(A.items).filter((g) => g[2].length).map(([k, lb, vals]) => `<div class="fld"><span>${lb}</span><div class="rch">${vals.map((v) => `<button data-a="lfv" data-k="${k}" data-v="${esc(v)}" class="${(s0.f[k] || []).includes(v) ? 'on' : ''}">${esc(v)}</button>`).join('')}</div></div>`).join('') || '<span class="sub">مفيش فلاتر هنا.</span>',
      f: '<button class="btn" data-a="lfclear">امسح الفلتر</button><button class="btn pri" data-a="lfdone">طبّق</button>' };
  }
  // تبويب "واتساب" (25/11): كل دوسة على زرار واتساب في الموقع، للعلم بس (التيم ليدر فما فوق). من غير اسم ولا رقم ولا أزرار.
  const WA_PLACE = { card: 'من كارت القطعة', sheet: 'من تفاصيل القطعة', plot_page: 'من صفحة القطعة', district_page: 'من صفحة الحي', dock: 'من زرار الموقع العام', seo_footer: 'من آخر صفحات المناطق', seller: 'بعد ما عرض قطعته', guide: 'من دليل التقنين' };
  const waDist = (x) => (x.district ? 'الحي ' + x.district : x.zone ? 'غير مخصصة' : '');
  const waWhere = (x) => [waDist(x), x.zone].filter(Boolean).join(' · ');
  const waTitle = (x) => (x.kind === 'plot' ? 'واتساب على القطعة ' + (x.code || '') : x.kind === 'seller' ? 'بائع كلّم واتساب · ' + (x.code || '')
    : x.kind === 'district' ? 'واتساب من صفحة ' + (x.district ? 'الحي ' + x.district : 'غير المخصصة') + ' · ' + (x.zone || '') : 'واتساب عام من الموقع');
  const cairoDay = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  const waToday = (x) => cairoDay(x.at) === cairoDay(Date.now());
  function waCard(x) {
    const col = x.kind === 'plot' ? 'var(--gold)' : x.kind === 'seller' ? 'var(--blue)' : 'var(--line)';
    const sub = [x.kind === 'plot' ? waWhere(x) : '', WA_PLACE[x.place] || ''].filter(Boolean).join(' · ');
    return `<div class="rc ca" style="--st:${col}"><span class="cav"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_IC.wa}</svg></span><span class="cb"><span class="rc-top"><b>${esc(waTitle(x))}</b></span>
      <span class="cw"><span class="who">${waToday(x) ? 'النهارده' : ''}</span><span class="tm plain">${when(T(x.at))}</span></span>${sub ? `<span class="cx">${esc(sub)}</span>` : ''}</span></div>`;
  }
  function vWaTab() {
    if (!S.wa) return '<div class="empty">بنحمّل...</div>';
    return listTab('wa', S.wa, [['today', 'النهارده', waToday], ['plot', 'على قطعة', (x) => x.kind === 'plot'], ['district', 'من صفحة حي', (x) => x.kind === 'district'], ['general', 'عام', (x) => x.kind === 'general'], ['seller', 'بائعين', (x) => x.kind === 'seller']],
      { allLabel: 'دوسات واتساب في آخر 30 يوم', empty: 'مفيش دوسات واتساب هنا.', card: waCard, sorts: [['new', 'الأحدث'], ['old', 'الأقدم']], sortFn: { new: (x) => -T(x.at), old: (x) => T(x.at) },
        filters: (items) => [['zone', 'المنطقة', [...new Set(items.map((x) => x.zone).filter(Boolean))]], ['dist', 'الحي', [...new Set(items.map(waDist).filter(Boolean))]]], field: { zone: (x) => x.zone, dist: waDist }, flag: {},
        search: (x, q) => String(x.code || '').toLowerCase().includes(q), searchPh: 'دوّر بكود القطعة',
        extra: '<p class="sub" style="margin:0 0 8px">للعلم بس: الدوسة معناها إن حد فتح واتساب، مش لازم يكون بعت رسالة.</p>' });
  }
  function vMain() {
    if (S.err) return '<div class="empty">مقدرناش نحمّل الطلبات. دوس تحديث.</div>';
    if (!S.loaded) return '<div class="empty">بنحمّل...</div>';
    const t = UI.tab;
    if (t === 'mine') return listTab('mine', S.reqs.filter(inbox), [['late', 'متأخر', isLate, 'bad'], ['soon', 'فاضل أقل من ساعة', soon], ['up', 'راجع لفوق', (r) => r.stage.startsWith('up_')]],
      REQ_OPT('كل اللي عندك', 'مفيش حاجة عندك دلوقتي.', isSales ? availSwitch() : ''));
    if (t === 'info') return list(infoList(), 'مفيش طلبات للعلم.');
    if (t === 'ql') return list(qlList(), 'مفيش طلبات مستنية اعتمادك ككواليفايد ليد.');
    if (t === 'done') return listTab('done', S.reqs.filter((r) => !isMine(r)), [['sold', 'اتباع', (r) => r.outcome === 'sold'], ['lost', 'ما اتباعش', outBad], ['open', 'لسه مفتوح', isOpen]], REQ_OPT('كل اللي خلصته', 'لسه مخلصتش حاجة.'));
    if (t === 'all') {
      const tasks = isWeb ? S.reqs.filter((r) => r.web_task) : [];
      const tk = tasks.map((r) => `<div class="task"><b>اتباعت ${esc(r.code || '')}${r.l_district ? ' · الحي ' + esc(r.l_district) : ''}</b><span class="sub">دوس هنا والقطعة هتتعلّم "اتباعت" وتتشال من الموقع.</span><button class="btn sm dark" data-a="webdone" data-id="${r.id}">علّمها اتباعت وشيلها</button></div>`).join('');
      return listTab('all', S.reqs.filter(isUnit), [['open', 'مفتوح', isOpen], ['late', 'متأخر', isLate, 'bad'], ['ql', 'كواليفايد ليد', (r) => r.ql === 'yes'], ['closed', 'اتقفل', (r) => !isOpen(r)]], REQ_OPT('كل الطلبات', 'مفيش طلبات هنا.', tk));
    }
    if (t === 'offers') return listTab('offers', S.reqs.filter(isOffer), [['open', 'مفتوح', isOpen], ['late', 'متأخر', isLate, 'bad'], ['pub', 'اتنشر', (r) => r.stage === 'closed' && r.outcome === 'ready'], ['rej', 'اترفض', (r) => r.stage === 'closed' && r.outcome !== 'ready']], REQ_OPT('كل العروض', 'مفيش عروض هنا.'));
    if (t === 'gone') return vGone();
    if (t === 'verify') return vVerifyTab();
    if (t === 'plots') return listTab('plots', S.plots, [['approved', 'منشورة', (x) => x.state === 'approved'], ['unver', 'غير موثقة', (x) => x.state === 'approved' && !x.verified, 'bad'], ['ver', 'موثقة', (x) => x.state === 'approved' && x.verified], ['sold', 'اتباعت', (x) => x.state === 'sold'], ['hidden', 'مخفية', (x) => x.state === 'hidden'], ['rejected', 'مرفوضة', (x) => x.state === 'rejected'], ['pending', 'في المراجعة', (x) => x.state === 'pending'], ['over', 'عدّت النطاق السعري', (x) => x.over_range === true, 'bad'], ['archived', 'الأرشيف', (x) => x.state === 'archived']],
      { allLabel: 'كل القطع', empty: 'مفيش قطع هنا.', card: plotCard, search: (x, q) => [x.code, x.id, x.district, x.zone, x.owner_name, x.phone, impName(x.import_id)].some((v) => String(v ?? '').toLowerCase().includes(q)), searchPh: 'ابحث بالكود أو الحي أو اسم البائع أو رقمه أو المصدر',
        sorts: [['new', 'الأحدث'], ['old', 'الأقدم'], ['dist', 'الحي'], ['paid', 'أقل مطلوب دفعه'], ['price', 'أقل سعر كلي'], ['reqs', 'الأكتر طلبات']],
        sortFn: { new: (x) => -T(x.created_at), old: (x) => T(x.created_at), dist: (x) => Number(x.district || 999), paid: (x) => Number(x.paid), price: (x) => Number(x.price), reqs: (x) => -(x.request_count || 0) },
        filters: (items) => [['zone', 'المنطقة', [...new Set(items.map((x) => x.zone).filter(Boolean))]], ['dist', 'الحي', [...new Set(items.map((x) => (x.district ? 'الحي ' + x.district : 'غير مخصصة')))].sort()], ['flag', 'تانية', ['عليها طلبات', 'من غير صورة', 'من غير خطاب تخصيص']]],
        field: { zone: (x) => x.zone, dist: (x) => (x.district ? 'الحي ' + x.district : 'غير مخصصة') }, flag: { 'عليها طلبات': (x) => x.request_count > 0, 'من غير صورة': (x) => !x.photo_path, 'من غير خطاب تخصيص': (x) => !x.letter_path } });
    if (t === 'svc') return listTab('svc', S.svc, [['new', 'جديد', (x) => x.state === 'new'], ['contacted', 'اتكلمنا', (x) => x.state === 'contacted'], ['closed', 'اتقفل', (x) => x.state === 'closed']],
      { allLabel: 'كل طلبات الخدمات', empty: 'مفيش طلبات خدمات هنا.', card: svcCard, sorts: [['new', 'الأحدث'], ['old', 'الأقدم']], sortFn: { new: (x) => -T(x.created_at), old: (x) => T(x.created_at) },
        filters: (items) => [['svc', 'الخدمة', [...new Set(items.map(svcName))]], ['flag', 'تانية', ['فيه ملاحظات']]], field: { svc: svcName }, flag: { 'فيه ملاحظات': (x) => x.notes > 0 } });
    if (t === 'mirror') return vMirror();
    if (t === 'rep') return vReports();
    if (t === 'range') return vRanges();
    if (t === 'prc') return vPrc();
    if (t === 'imp') return vImp();
    if (t === 'calc') return vCalc();
    if (t === 'wa') return vWaTab();
    if (t === 'team') return vTeam();
    return '';
  }
  // Owner only: act as any team member to try their screens (test mode).
  function actAsBar() {
    const people = ROLE_ORDER.flatMap((r0) => S.staff.filter((p) => p.role === r0 && p.active));
    return `<div class="actas${me.acting ? ' on' : ''}"><label for="actas">${me.acting ? 'وضع التجربة · شغال كأنك' : 'جرّب كأنك'}</label><select id="actas" data-ch="actas"${busy ? ' disabled' : ''}>
      <option value=""${me.acting ? '' : ' selected'}>الأدمن (إنت)</option>${people.map((p) => `<option value="${p.id}"${me.acting && p.id === me.id ? ' selected' : ''}>${esc(p.name)} · ${ROLES[p.role]}</option>`).join('')}</select></div>`;
  }
  // Plots taken off the site: asks waiting for the web admin / sales admin, and the plots that are off (they can go back).
  function rmItem(x, btns) {
    return `<div class="rmi"><b>${esc(x.code || '')} · ${x.district ? 'الحي ' + esc(x.district) : esc(x.zone || '')}${x.area ? ' · ' + fmt(x.area) + ' م²' : ''}</b><span class="sub">السبب: ${esc(x.reason)}</span>
      <span class="sub">طلبها ${esc(x.asked || '—')} · ${when(T(x.asked_at))}${x.open ? ` · عليها ${x.open} طلب مفتوح` : ''}</span>${x.decided && x.state !== 'pending' ? `<span class="sub">${x.state === 'rejected' ? 'رفض' : 'وافق'}: ${esc(x.decided)} · ${when(T(x.decided_at))}${x.note ? ' · ' + esc(x.note) : ''}</span>` : ''}${btns || ''}</div>`;
  }
  function vGone() {
    const wait = S.rem.filter((x) => x.state === 'pending'), off = S.rem.filter((x) => x.state === 'approved'), no = S.rem.filter((x) => x.state === 'rejected').slice(0, 20);
    const sec = (key, title, items, empty) => `<section class="card" data-fold="${key}"${items.length ? ' data-many' : ''}><h3>${title}${items.length ? ` <span class="sub num">${items.length}</span>` : ''}</h3>${items.length ? items.join('') : `<span class="sub">${empty}</span>`}</section>`;
    return sec('g_wait', 'مستني موافقة', wait.map((x) => rmItem(x, canRmDecide ? `<div class="g2"><button class="btn sm" data-a="rmno" data-id="${x.id}"${busy ? ' disabled' : ''}>مش موافق</button><button class="btn sm pri" data-a="rmok" data-id="${x.id}"${busy ? ' disabled' : ''}>وافق وشيلها</button></div>` : '')), 'مفيش طلبات شيل مستنية.')
      + sec('g_off', 'اتشالت من الموقع', off.map((x) => rmItem(x, canRmDecide ? `<button class="btn sm" data-a="rmback" data-id="${x.listing_id}"${busy ? ' disabled' : ''}>رجّعها للموقع</button>` : '')), 'مفيش قطع اتشالت.')
      + (no.length ? sec('g_no', 'اترفض شيلها', no.map((x) => rmItem(x, '')), '') : '');
  }
  // "الخدمات": requests from "حلول تِلاد". A simple state (new / contacted / closed), notes and a log; no chain.
  const SV_ST = { new: ['جديد', 'c-me'], contacted: ['اتكلمنا', 'c-blue'], closed: ['اتقفل', ''] };
  const svcName = (x) => (SVC[x.service] && SVC[x.service].n) || x.service;
  const Sv = (id) => S.svc.find((x) => x.id === id);
  function svcCard(x) {
    const st = SV_ST[x.state] || [x.state, ''], col = x.state === 'new' ? 'var(--gold)' : x.state === 'contacted' ? 'var(--blue)' : 'var(--line)';
    return `<button class="rc ca" style="--st:${col}" data-a="svcopen" data-id="${x.id}"><span class="cav"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_IC.svc}</svg></span><span class="cb"><span class="rc-top"><b>${esc(svcName(x))}</b><span class="code">T-${x.id}</span></span>
      <span class="cw"><span class="who">${st[0]}</span><span class="tm plain">${when(T(x.created_at))}</span></span><span class="cx">${esc([x.name || '—', x.channel ? 'يفضّل ' + x.channel : '', x.notes ? x.notes + ' ملاحظة' : ''].filter(Boolean).join(' · '))}</span></span></button>`;
  }
  function vSvc(L) {
    const x = Sv(L.id); if (!x) return { t: 'الخدمة', b: '<div class="empty">الطلب ده مبقاش موجود.</div>', f: '' };
    const d = SDET[x.id]; if (!d && !L.loading) { L.loading = true; sb.rpc('desk_service', { p_id: x.id }).then(({ data }) => { if (data && !dead) { SDET[x.id] = data; if (top() === L) renderSheet(); } }); }
    const ans = Object.entries(x.answers || {});
    let h = `<div class="blk"><div class="facts">${fact('الخدمة', esc(svcName(x)), 1)}${fact('العميل', esc(x.name || '—'))}${fact('رقمه', `<span dir="ltr">${esc(x.phone || '—')}</span>`)}${fact('يفضّل التواصل', esc(x.channel || '—'))}${fact('الوقت المناسب', esc(x.contact_time || '—'))}${fact('وصل', when(T(x.created_at)), 1)}</div>
      ${x.phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(x.phone)}">كلّم العميل</a><a class="btn sm wa" href="https://wa.me/2${esc(x.phone)}" target="_blank" rel="noopener">واتساب العميل</a></div>` : ''}</div>`;
    h += `<div class="blk" data-fold="s_state"><h3>الحالة</h3><div class="seg">${Object.entries(SV_ST).map(([k, v]) => `<button class="${x.state === k ? 'on' : ''}" data-a="svcstate" data-v="${k}"${busy ? ' disabled' : ''}>${v[0]}</button>`).join('')}</div></div>`;
    if (ans.length) h += `<div class="blk" data-fold="s_ans"><h3>إجاباته</h3><div class="facts">${ans.map(([k, v]) => fact(esc(k), esc(v), 1)).join('')}</div></div>`;
    h += d ? `<div class="blk" data-fold="s_log"><h3>السجل</h3><div class="log">${d.log.map((g) => `<div class="lg"><span>${g.who ? `<b>${esc(g.who)}</b>${g.role ? ' <span class="sub">· ' + (ROLES[g.role] || '') + '</span>' : ''} — ` : ''}${g.kind === 'note' ? 'ملاحظة' : esc(g.body)}</span><time class="num">${when(T(g.at))}</time>${g.kind === 'note' ? `<q>${esc(g.body)}</q>` : ''}</div>`).join('')}</div></div>` : '<span class="sub">بنحمّل السجل...</span>';
    return { t: 'T-' + x.id + ' · ' + svcName(x), b: h, f: `<button class="btn ghost" data-a="svcnote">ملاحظة</button><button class="btn red" data-a="svcdel">امسحه نهائي</button>` };
  }
  function vSvcNote(L) { return { t: 'ملاحظة على T-' + L.id, b: `<label class="fld"><span>اكتب ملاحظتك</span><textarea data-f="note" rows="3" maxlength="1000">${esc(L.f.note || '')}</textarea></label><span class="sub">بتظهر لكل اللي بيتابعوا الخدمات، وبيوصلهم تنبيه.</span>`,
    f: `<button class="btn pri" data-a="svcnotego"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'حفظ'}</button>` }; }
  function vSvcDel(L) { return { t: 'تمسحه نهائي؟', b: `<span class="sub">T-${L.id} هيتمسح نهائي هو وسجله وملاحظاته، ومش هيرجع تاني. لو عايز تقفله بس، اختار "اتقفل" في الحالة.</span>`,
    f: `<button class="btn" data-a="back">لا، سيبه</button><button class="btn dark" data-a="svcdelgo"${busy ? ' disabled' : ''}>امسح نهائي</button>` }; }
  async function svcReload(id) { delete SDET[id]; UI.stack.forEach((L) => { if (L.v === 'svc' && L.id === id) L.loading = false; }); await load(); }
  // "القطع": every plot (was the listings dashboard). The owner, super admin and web admin edit, mark sold, hide and republish;
  // final delete is for the owner and the super admin.
  const PST = { pending: ['مستنية مراجعة', 'c-warn'], approved: ['منشورة', 'c-ok'], sold: ['اتباعت', 'c-blue'], hidden: ['مخفية', ''], rejected: ['مرفوضة', 'c-bad'], archived: ['في الأرشيف', ''], held: ['مستخبية لحد التوثيق', 'c-warn'] };
  const Pl = (id) => S.plots.find((x) => x.id === id);
  const plotArea = (x) => (x.area_final != null ? x.area_final : x.area_orig);
  const plotTitle = (x) => [x.district ? 'الحي ' + x.district : x.allocated === false ? 'غير مخصصة · ' + (x.zone || '') : (x.zone || 'المكان ناقص'), plotArea(x) ? fmt(plotArea(x)) + ' م²' : ''].filter(Boolean).join(' · ');
  function plotCard(x) {
    const st = PST[x.verify_hold && x.state === 'hidden' ? 'held' : x.state] || [x.state, ''], col = x.state === 'approved' ? (x.verified ? 'var(--ok)' : 'var(--gold)') : 'var(--line)';
    const extra = [x.state === 'approved' ? (x.verified ? 'موثقة ✓' : 'غير موثقة') : '', x.price_hold ? 'مستنية مراجعة السعر' : x.band_level === 'bomb' ? 'قنبلة 💣' : x.over_range && x.state !== 'archived' ? 'فوق النطاق السعري' : x.band_level ? LEVEL[x.band_level] : '', x.map_state === 'card' ? 'بطاقة ✓' : x.map_state === 'review' ? 'البطاقة محتاجة مراجعة' : '', x.import_id ? 'من شيت: ' + impName(x.import_id) : '', x.missing ? 'ناقص: ' + x.missing.join('، ') : '', x.request_count ? x.request_count + ' طلب' : '', !x.photo_path ? 'من غير صورة' : ''].filter(Boolean);
    return `<button class="rc ca" style="--st:${col}" data-a="plotopen" data-id="${x.id}"><span class="cav"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_IC.plots}</svg></span><span class="cb"><span class="rc-top"><b>${esc(plotTitle(x))}</b><span class="code">${esc(x.code || '#' + x.id)}</span></span>
      <span class="cw"><span class="who">${st[0]}</span><span class="tm plain">المطلوب دفعه ${fmt(x.paid)} ج.م</span></span><span class="cx">${esc(['السعر الكلي ' + fmt(x.price) + ' ج.م', ...extra].join(' · '))}</span></span></button>`;
  }
  function vPlot(L) {
    const x = Pl(L.id); if (!x) return { t: 'القطعة', b: '<div class="empty">القطعة دي مبقتش موجودة.</div>', f: '' };
    if (x.letter_path && PLETTER[x.id] === undefined) { PLETTER[x.id] = null; sb.storage.from('allocation-letters').createSignedUrl(x.letter_path, 1800).then((r) => { if (r.data && !dead) { PLETTER[x.id] = r.data.signedUrl; if (top() === L) renderSheet(); } }); }
    const st = PST[x.verify_hold && x.state === 'hidden' ? 'held' : x.state] || [x.state, ''], ph = photoImg(x.photo_path);
    const status = x.allocated === false ? `غير مخصصة · ${x.on_list ? 'على الكشف' : 'مش على الكشف'} · الشيك ${x.check_paid ? 'مدفوع' : 'مش مدفوع'}` : LSTAGE[x.stage] || 'مخصصة';
    const pay = ((x.pay && x.pay.items) || []).map((i) => fact('↳ ' + esc(PAY_TXT[i.k] || i.k), i.amt != null ? fmt(i.amt) + ' ج.م' : '—')).join('');
    let h = `<div class="chips"><span class="chip ${st[1]}">${st[0]}</span>${x.request_count ? `<span class="chip">${x.request_count} طلب عليها</span>` : ''}</div>${ph}`;
    h += `<div class="blk" data-fold="pl_data"><h3>البيانات</h3><div class="facts">${fact('المنطقة', esc(x.zone || '—'))}${fact('الحي', esc(x.district || '—'))}
      ${fact('المجاورة / البلوك / القطعة', esc([x.neighborhood || '—', x.block || '—', x.plot_number || '—'].join(' / ')), 1)}
      ${fact('أصل المساحة', x.area_orig != null ? fmt(x.area_orig) + ' م²' : '—')}${fact('بعد التقنين', x.area_final != null ? fmt(x.area_final) + ' م²' : '—')}
      ${fact('الواجهة', esc(x.facade || '—'))}${fact('قدامها', esc(x.view_type || '—'))}${fact('حالة القطعة', esc(status), 1)}
      ${fact('السعر الكلي', fmt(x.price) + ' ج.م')}${fact('المطلوب دفعه', fmt(x.paid) + ' ج.م')}${fact('المتبقي', fmt(x.remaining) + ' ج.م')}${fact('الأقساط المتبقية', x.inst_left ?? '—')}${pay}${rangeFacts(x.zone, x.allocated !== false, x.pm, x)}
      ${x.description ? fact('الوصف', esc(x.description), 1) : ''}${x.import_id ? fact('المصدر', 'شيت ' + esc(impName(x.import_id)), 1) : ''}${fact('اتعرضت', when(T(x.created_at)))}${fact('اتنشرت', x.published_at ? when(T(x.published_at)) : '—')}</div></div>${mapBlock(x.id)}`;
    h += `<div class="blk" data-fold="pl_owner"><h3>البائع</h3><div class="facts">${fact('الاسم', esc(x.owner_name || '—'))}${fact('رقمه', `<span dir="ltr">${esc(x.phone || '—')}</span>`)}${uploaderLine(x.uploader, x.phone2)}
      ${fact('خطاب التخصيص', PLETTER[x.id] ? `<a href="${esc(PLETTER[x.id])}" target="_blank" rel="noopener">افتح خطاب التخصيص</a>` : x.letter_path ? 'بنجهّز اللينك...' : 'مش مرفوع', 1)}</div>
      ${x.phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(x.phone)}">كلّم البائع</a><a class="btn sm wa" href="https://wa.me/2${esc(x.phone)}" target="_blank" rel="noopener">واتساب البائع</a></div>` : ''}</div>`;
    if (x.state === 'pending') h += '<span class="sub">القطعة دي لسه في المراجعة. تابعها من تبويب "العروض".</span>';
    // 22/11: the GM sees plots read-only (no edit / publish / hide / archive / delete)
    if (x.state === 'approved') h += plotLink(x.code);
    if (canReview && x.allocated !== false && x.area_orig != null) h += `<button class="btn sm" data-a="calcplot" data-id="${x.id}">راجع الأقساط بالحاسبة</button>`;
    if (plotsRO) return { t: x.code || 'القطعة #' + x.id, b: h + '<span class="sub">للاطلاع بس.</span>', f: '' };
    h += archBtn(x.id, x.over_range, x.state);
    if (canDel) h += `<div class="blk" data-fold="pl_admin"><h3>إدارة</h3><div class="chips"><button class="btn sm red" data-a="plotdel">امسحها نهائي</button></div></div>`;
    const b = ['<button class="btn ghost" data-a="plotedit">تعديل</button>'];
    if (x.state === 'approved') b.push(`<button class="btn" data-a="plotset" data-v="hidden"${busy ? ' disabled' : ''}>إخفاء</button>`, `<button class="btn pri" data-a="plotset" data-v="sold"${busy ? ' disabled' : ''}>اتباعت</button>`);
    else if (x.state !== 'pending') b.push(`<button class="btn pri" data-a="plotset" data-v="approved"${busy ? ' disabled' : ''}>انشرها تاني</button>`);
    return { t: x.code || 'القطعة #' + x.id, b: h, f: b.join('') };
  }
  const plotInit = (x) => plotFields(x);
  function vPlotEdit(L) { return { t: 'تعديل القطعة', b: editBody(L.f), f: `<button class="btn pri" data-a="plotsave"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'احفظ التعديلات'}</button>` }; }
  function vPlotDel(L) { const x = Pl(L.id) || {};
    return { t: 'تمسحها نهائي؟', b: `<span class="sub">${esc(x.code || '#' + L.id)} هتتمسح نهائي هي وصورها وبيانات البائع، ومش هترجع تاني. لو عايز تشيلها من الموقع بس، استخدم "إخفاء".</span>`,
      f: `<button class="btn" data-a="back">لا، سيبها</button><button class="btn dark" data-a="plotdelgo"${busy ? ' disabled' : ''}>امسح نهائي</button>` }; }
  // "التوثيق": the old plots. The team leader ticks the ones waiting and sends them to a supervisor in one go.
  const vWait = () => S.reqs.filter((r) => isVerify(r) && r.stage === 'tl' && (!r.tl_id || r.tl_id === me.id));
  function vVerifyTab() {
    const all = S.reqs.filter(isVerify), wait = all.filter((r) => r.stage === 'tl'), done = all.filter((r) => r.stage === 'closed' && r.outcome === 'sound'), bad = all.filter((r) => r.stage === 'closed' && r.outcome === 'unsound');
    let h = R !== 'tl' ? '' : `<div class="tiles"><div class="tl"><b>${wait.length}</b><span>لسه متوزعتش</span></div><div class="tl"><b>${all.filter((r) => r.stage !== 'closed' && r.stage !== 'tl').length}</b><span>في المسار</span></div><div class="tl ok"><b>${done.length}</b><span>اتوثقت</span></div><div class="tl bad"><b>${bad.length}</b><span>مش سليمة</span></div></div>`;
    if (R === 'tl') {
      const mineW = vWait();
      UI.vsel.forEach((id) => { if (!mineW.some((r) => r.id === id)) UI.vsel.delete(id); });
      h += `<section class="card" data-fold="v_wait"><h3>وزّع على المشرفين <span class="sub num">${mineW.length}</span></h3>${mineW.length ? `<div class="g2"><button class="btn sm" data-a="vall">${UI.vsel.size === mineW.length ? 'شيل التعليم' : 'علّم الكل'}</button><button class="btn sm pri" data-a="vassign"${UI.vsel.size ? '' : ' disabled'}>ابعت (${UI.vsel.size}) لمشرف</button></div>
        <div class="vlist">${mineW.map((r) => `<label class="vrow"><input type="checkbox" data-vsel="${r.id}"${UI.vsel.has(r.id) ? ' checked' : ''}><span><b>${esc(unitTitle(r))}</b><span class="sub">${esc(r.code || '')} · البائع: ${esc(r.name || '—')}</span></span><button class="btn sm ghost" data-a="open" data-id="${r.id}">افتح</button></label>`).join('')}</div>` : '<span class="sub">كل القطع اتوزعت.</span>'}</section>`;
      return h;
    }
    return listTab('verify', all, [['wait', 'لسه متوزعتش', (r) => r.stage === 'tl'], ['open', 'في المسار', (r) => r.stage !== 'closed' && r.stage !== 'tl'], ['late', 'متأخر', isLate, 'bad'], ['done', 'اتوثقت', (r) => r.stage === 'closed' && r.outcome === 'sound'], ['bad', 'مش سليمة', (r) => r.stage === 'closed' && r.outcome === 'unsound']], REQ_OPT('كل القطع القديمة', 'مفيش قطع هنا.'));
  }
  function vVAssign(L) {
    const n = L.ids.length;
    // 19/11: like buyer requests, the plots can go straight to a salesperson; a supervisor is still chosen for the way back
    const f = L.f, direct = f.via === 'sales', ok = f.sup && (!direct || f.sales);
    return { t: n === 1 ? 'وزّع القطعة' : `وزّع ${n} قطع`,
      b: `<div class="pick">${opt('via', 'sup', !direct, 'لمشرف', 'المشرف يختار السيلز')}${opt('via', 'sales', direct, 'لسيلز على طول', 'وتختار المشرف اللي الرجوع هيعدّي عليه')}</div>`
        + (direct ? salesPick(f) : '') + supPick(f) + noteF(f, 'تعليمات (اختياري)') + minsPick(f),
      f: `<button class="btn pri" data-a="vassigngo"${ok && !busy ? '' : ' disabled'}>${busy ? 'استنى...' : direct ? (f.sales ? 'ادّيها لـ' + esc(P(f.sales).name) : 'اختار السيلز') : f.sup ? 'ابعت لـ' + esc(P(f.sup).name) : 'اختار المشرف'}</button>` };
  }
  // reviewer / plots team: upload the plot photo or the allocation letter (shrunk on the phone, stored under incoming/)
  async function shrinkImg(file) {
    try { const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82)); } catch (e) { return file.size <= 5e6 ? file : null; }
  }
  async function uploadFile(kind, file, listingId, reqId) {
    if (!file || busy) return; busy = true; toast('بنرفع الصورة...');
    const blob = await shrinkImg(file); if (!blob) { busy = false; return toast('الصورة كبيرة أو مش مدعومة.'); }
    const path = 'incoming/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.jpg';
    const up = await sb.storage.from(kind === 'photo' ? 'listing-photos' : 'allocation-letters').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) { busy = false; return toast('مقدرناش نرفع الصورة. جرب تاني.'); }
    const { error } = await sb.rpc('desk_set_files', { p_listing: listingId, p_photo: kind === 'photo' ? path : null, p_letter: kind === 'letter' ? path : null });
    busy = false; if (error) return toast(errMsg(error));
    toast(kind === 'photo' ? 'صورة القطعة اترفعت' : 'خطاب التخصيص اترفع');
    if (reqId) { delete DETAIL[reqId]; UI.stack.forEach((L) => { if (L.id === reqId) L.loading = false; }); } delete PLETTER[listingId]; await load();
  }
  function availSwitch() { const on = me.avail !== false; return `<button class="sw" data-a="avail"><span class="tg${on ? ' on' : ''}" aria-hidden="true"></span><span>${on ? 'متاح لطلبات جديدة' : 'مش متاح دلوقتي'}</span></button>`; }

  // "أونلاين" = the dashboard was open in front of them in the last 2.5 minutes (it says so every minute)
  function seenTxt(p) {
    if (!p.seen_ok || p.id === me.id) return '';
    if (!p.seen) return ' · <span class="seen">مادخلش لسه</span>';
    const d = now() - T(p.seen);
    if (d < 150e3) return ' · <span class="seen on">🟢 أونلاين</span>';
    return ' · <span class="seen">آخر ظهور ' + (d < 3600e3 ? 'من ' + Math.max(1, Math.round(d / 60000)) + ' دقيقة' : esc(when(T(p.seen)))) + '</span>';
  }
  function mrow(p) {
    const c = counts(p.id), sales = SALES.includes(p.role), av = sales ? (p.avail !== false ? ' on' : ' off') : '';
    return `<button class="mr" data-a="person" data-id="${p.id}"><span class="av${av}">${esc(p.name.slice(0, 1))}</span><span class="nm"><b>${esc(p.name)}</b><span>${ROLES[p.role]}${sales ? (p.avail !== false ? ' · متاح' : ' · مش متاح') : ''}${p.activated ? seenTxt(p) : ' · لسه ما فعّلش'}</span></span><span class="ct"><span class="chip num">${c.open} في إيده</span>${c.late ? `<span class="chip c-bad num">${c.late} متأخر</span>` : ''}</span></button>`;
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
    const heads = f === 'all' ? S.staff.filter((p) => p.active && p.seen_ok && p.id !== me.id && !['sup', 'senior', 'junior'].includes(p.role)) : [];
    if (heads.length) h += `<section class="team" data-fold="m_heads" data-many><header><b>الإدارة والتيم ليدر</b><span class="sub num">${heads.length}</span></header>${sortPeople(heads).map(mrow).join('')}</section>`;
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
    // 22/11: plain numbers for the team leader and above, right now (not by period)
    const c = S.counts, now0 = c ? `<div class="tiles">${[['listed', 'قطع معروضة'], ['offers', 'عروض بائعين'], ['verify', 'تحت التوثيق'], ['review', 'مراجعة السعر'], ['buyers', 'طلبات المشترين'], ['sold_month', 'اتباع الشهر ده']]
      .map(([k, t]) => `<div class="tl${k === 'review' && c[k] ? ' bad' : k === 'sold_month' ? ' ok' : ''}"><b class="num">${fmt(c[k] || 0)}</b><span>${t}</span></div>`).join('')}</div>` : '';
    const s0 = since(), rsAll = S.reqs.filter((r) => r.at >= s0 && (R !== 'sup' || r.sup_id === me.id)), rs = rsAll.filter(isUnit), vs = rsAll.filter(isVerify), os = rsAll.filter(isOffer);
    const closed = rs.filter((r) => r.stage === 'closed'), res = closed.filter((r) => r.outcome === 'sold' || r.outcome === 'lost'), sold = res.filter((r) => r.outcome === 'sold').length;
    let h = now0 + per + `<div class="tiles"><div class="tl"><b>${rs.length}</b><span>طلب</span></div><div class="tl"><b>${rs.filter((r) => r.stage !== 'closed').length}</b><span>مفتوح</span></div><div class="tl bad"><b>${rs.filter(isLate).length}</b><span>متأخر دلوقتي</span></div><div class="tl ok"><b>${sold}</b><span>اتباع</span></div><div class="tl"><b>${res.length - sold}</b><span>ما اتباعش</span></div><div class="tl"><b>${res.length ? Math.round(100 * sold / res.length) + '%' : '—'}</b><span>نسبة البيع</span></div>
      <div class="tl ok"><b>${rs.filter((r) => r.ql === 'yes').length}</b><span>كواليفايد ليد</span></div><div class="tl"><b>${rs.length ? Math.round(100 * rs.filter((r) => r.ql === 'yes').length / rs.length) + '%' : '—'}</b><span>نسبة الكواليفايد</span></div><div class="tl"><b>${(() => { const q = res.filter((r) => r.ql === 'yes'); return q.length ? Math.round(100 * q.filter((r) => r.outcome === 'sold').length / q.length) + '%' : '—'; })()}</b><span>بيع من الكواليفايد</span></div></div>`;
    const st = { 'سيلز أدمن': [], 'تيم ليدر': [], 'مشرف': [], 'سيلز': [] };
    rs.forEach((r) => r.legs.forEach((l) => { if (l.kind === 't' && l.end && LEG_ROLE[l.role]) st[LEG_ROLE[l.role]].push(l.end - l.start); }));
    const av = Object.entries(st).map(([k, a]) => [k, avg(a) || 0]), mx = Math.max(1, ...av.map((a) => a[1]));
    const avgClose = avg(closed.filter((r) => r.closed_t).map((r) => r.closed_t - r.at));
    h += `<section class="card" data-fold="r_time"><h3>متوسط الوقت في كل خطوة</h3>${av.map(([k, v]) => `<div class="bar"><span>${k}</span><div><i style="width:${Math.round(100 * v / mx)}%"></i></div><b>${v ? dur(v) : '—'}</b></div>`).join('')}<span class="sub">متوسط مدة الطلب من أوله لحد ما يتقفل: <b class="num">${avgClose ? dur(avgClose) : '—'}</b></span></section>`;
    const why = {}; res.filter((r) => r.outcome === 'lost').forEach((r) => { const k = r.outcome_reason || 'من غير سبب'; why[k] = (why[k] || 0) + 1; });
    const evc = {}; res.forEach((r) => (r.cx_eval || []).forEach((k) => { evc[k] = (evc[k] || 0) + 1; }));
    const cxRows = [['اتلغت نهائي', res.length - sold], ['اتشال من المسار', rs.filter((r) => r.outcome === 'dropped').length], ['اتعمل لها إجراء قبل الإلغاء', rs.filter((r) => r.cx_count > 0).length], ['رجعت اتباعت بعد إجراء', rs.filter((r) => r.cx_count > 0 && r.outcome === 'sold' && r.stage === 'closed').length],
      ['مع سيلز تاني دلوقتي (تغيير وش)', rs.filter((r) => r.cx === 'reassign' && r.stage === 'sales').length], ['مؤجلة دلوقتي', rs.filter((r) => r.cx === 'postpone' && r.stage === 'sales').length],
      ['متابعة من ليفل أعلى دلوقتي', rs.filter((r) => r.cx === 'escalate' && r.stage !== 'closed' && r.stage !== 'sales').length]];
    h += `<section class="card" data-fold="r_cx"><h3>البيعات اللي اتلغت</h3><div class="kv">${cxRows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3 style="font-size:14px">تقييم الإلغاء النهائي</h3>${Object.keys(evc).length ? `<div class="kv">${Object.entries(evc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(evalName(k))}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    const oc = os.filter((r) => r.stage === 'closed'), opub = oc.filter((r) => r.outcome === 'ready').length, owhy = {};
    oc.filter((r) => r.outcome === 'unfit').forEach((r) => { const k = r.outcome_reason || 'من غير سبب'; owhy[k] = (owhy[k] || 0) + 1; });
    const oavg = avg(oc.filter((r) => r.closed_t).map((r) => r.closed_t - r.at));
    h += `<section class="card" data-fold="r_offers"><h3>عروض البائعين</h3><div class="kv">${[['وصل', os.length], ['مفتوح', os.length - oc.length], ['متأخر دلوقتي', os.filter(isLate).length], ['اتنشر', opub], ['اترفض', oc.filter((r) => r.outcome === 'unfit').length], ['اتشال من المسار', oc.filter((r) => r.outcome === 'dropped').length], ['متوسط المدة لحد النشر أو الرفض', oavg ? dur(oavg) : '—']].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <h3 style="font-size:14px">أسباب الرفض</h3>${Object.keys(owhy).length ? `<div class="kv">${Object.entries(owhy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>` : '<span class="sub">لسه مفيش.</span>'}</section>`;
    h += `<section class="card" data-fold="r_verify"><h3>توثيق القطع القديمة</h3><div class="kv">${[['إجمالي', vs.length], ['لسه متوزعتش', vs.filter((r) => r.stage === 'tl').length], ['في المسار', vs.filter((r) => r.stage !== 'closed' && r.stage !== 'tl').length], ['متأخر دلوقتي', vs.filter(isLate).length], ['اتوثقت', vs.filter((r) => r.outcome === 'sound' && r.stage === 'closed').length], ['مش سليمة واتخفت', vs.filter((r) => r.outcome === 'unsound' && r.stage === 'closed').length]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div></section>`;
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
  // The plot's public page (25/11), for the team to send to a buyer: only while it is published.
  const plotLink = (code) => (code && /^[A-Z]\d{4}-\d+$/.test(code) ? `<button class="btn sm" data-a="copy" data-v="${SITE}/plot/${esc(code)}">انسخ لينك القطعة</button>` : '');
  function unitBlock(r, d) {
    if (r.via === 'ask') return `<div class="blk" data-fold="q_unit"><h3>المطلوب</h3><div class="facts">${fact('المنطقة', esc(r.zone || '—'))}${fact('الحي', esc(r.district || '—'))}${fact('الميزانية', r.budget ? fmt(r.budget) + ' ج.م' : '—', 1)}</div></div>`;
    if (!d) return '<div class="blk" data-fold="q_unit"><h3>القطعة</h3><span class="sub">بنحمّل بيانات القطعة...</span></div>';
    const u = d.unit; if (!u) return '<div class="blk" data-fold="q_unit"><h3>القطعة</h3><span class="sub">القطعة دي اتشالت.</span></div>';
    const status = u.allocated === false ? `غير مخصصة · ${u.on_list ? 'على الكشف' : 'مش على الكشف'} · الشيك ${u.check_paid ? 'مدفوع' : 'مش مدفوع'}` : LSTAGE[u.stage] || 'مخصصة';
    const pay = ((u.pay && u.pay.items) || []).map((i) => fact('↳ ' + esc(PAY_TXT[i.k] || i.k), i.amt != null ? fmt(i.amt) + ' ج.م' : '—')).join('');
    const ph = photoImg(u.photo_path);
    return `<div class="blk" data-fold="q_unit"><h3>القطعة ${esc(u.code || '')}</h3>${ph}<div class="facts">
      ${fact('المنطقة', esc(u.zone || '—'))}${fact('الحي', esc(u.district || '—'))}
      ${fact('المجاورة / البلوك / القطعة', esc([u.neighborhood || '—', u.block || '—', u.plot || '—'].join(' / ')), 1)}
      ${fact('أصل المساحة', u.area_orig != null ? fmt(u.area_orig) + ' م²' : '—')}${fact('بعد التقنين', u.area_final != null ? fmt(u.area_final) + ' م²' : '—')}
      ${fact('الواجهة', esc(u.facade || '—'))}${fact('قدامها', esc(u.view_type || '—'))}
      ${fact('حالة القطعة', esc(status), 1)}
      ${fact('السعر الكلي', fmt(u.price) + ' ج.م')}${fact('المطلوب دفعه', fmt(u.paid) + ' ج.م')}
      ${fact('المتبقي', fmt(u.remaining) + ' ج.م')}${fact('الأقساط المتبقية', u.inst_left ?? '—')}${pay}${rangeFacts(u.zone, u.allocated !== false, u.pm, u)}${u.missing && u.missing.length ? `<div class="w upl"><span>بيانات ناقصة</span><b>${esc(u.missing.join('، '))} · كمّلها من "صلّح بيانات القطعة" قبل "تمام"</b></div>` : ''}
      ${u.description ? fact('الوصف', esc(u.description), 1) : ''}
      ${fact('البائع', esc(u.owner_name || '—'))}${fact('رقم البائع', `<span dir="ltr">${esc(u.owner_phone || '—')}</span>`)}${uploaderLine(u.uploader, u.phone2)}
      ${fact('خطاب التخصيص', u.letter_url ? `<a href="${esc(u.letter_url)}" target="_blank" rel="noopener">افتح خطاب التخصيص</a>` : u.has_letter ? 'موجود · بيتفتح من لوحة الإعلانات (للأدمن)' : 'مش مرفوع', 1)}</div>
      ${u.state === 'approved' ? plotLink(u.code) : ''}${r.listing_id ? mapBlock(r.listing_id) : ''}${u.owner_phone && !isOffer(r) ? `<div class="g2"><a class="btn sm" href="tel:${esc(u.owner_phone)}">كلّم البائع</a><a class="btn sm wa" href="https://wa.me/2${esc(u.owner_phone)}" target="_blank" rel="noopener">واتساب البائع</a></div>` : ''}${archBtn(r.listing_id, u.over_range, u.state)}</div>`;
  }
  // "القطعة اتباعت" while verifying / reviewing: tick it, then a button takes the plot off the site (marked sold, kept).
  const SOLDMARK = new Set();
  function soldBlock(r, can) {
    if (!can || !(isVerify(r) || isOffer(r)) || !r.listing_id) return '';
    const on = SOLDMARK.has(r.id);
    return `<button class="st${on ? ' on' : ''}" data-a="soldmark" data-id="${r.id}"><i>${on ? '✓' : ''}</i><span>القطعة اتباعت</span></button>${on ? `<button class="btn red" data-a="soldask" data-id="${r.id}">شيلها من الموقع</button>` : ''}`;
  }
  function vUnst(L) { const r = Rq(L.id), s0 = r && stList(r).find((x) => x[0] === L.k);
    return { t: 'تلغي الحالة دي؟', b: `<span class="sub">"${esc(s0 ? s0[1] : '')}" هتتشال من الحالات، ويتسجل في السجل إنها اتلغت. لو كانت آخر حالة، اللي قبلها ترجع هي الحالية.</span>`,
      f: `<button class="btn" data-a="back">لا، سيبها</button><button class="btn dark" data-a="unstgo"${busy ? ' disabled' : ''}>ألغِ الحالة</button>` }; }
  function vSold(L) { const r = Rq(L.id) || {};
    return { t: 'القطعة اتباعت؟', b: `<span class="sub">${esc(r.code || '')} هتتشال من الموقع وتتعلّم "اتباعت"، و${isOffer(r) ? 'المراجعة' : 'التوثيق'} هيتقفل بسبب "البائع باعها". هتفضل محفوظة في الداشبورد، والمشرف والتيم ليدر هيوصلهم تنبيه.</span>`,
      f: `<button class="btn" data-a="back">لا، سيبها</button><button class="btn dark" data-a="soldgo"${busy ? ' disabled' : ''}>شيلها من الموقع</button>` }; }
  // النطاق السعري: price per m² for every plot; for new ones (checked when the offer came in) the flag, the averages and the archive.
  // ---------- the price range by area (22/11) ----------
  const LEVEL = { normal: 'عادية', super: 'سوبر', supreme: 'سوبر سوبريم', bomb: 'قنبلة 💣' };
  // the legalized area the table is keyed on (same as _band_area in the database)
  const bandArea = (x) => { const a = Number(x.area_orig);
    if (x.allocated !== false) return [209, 276, 350, 400, 450, 500].includes(Number(x.area_final)) ? Number(x.area_final) : null;
    return !a ? null : a < 276 ? 209 : a < 375 ? 276 : a < 475 ? 350 : a < 525 ? 400 : a < 600 ? 450 : a <= 750 ? 500 : null; };
  const bandOf = (x) => { const ar = bandArea(x), al = x.allocated !== false;
    return S.bands.filter((b) => b.zone === x.zone && b.allocated === al && b.area === ar && (b.orig_upto == null || Number(x.area_orig) <= b.orig_upto))
      .sort((p, q) => (p.orig_upto == null) - (q.orig_upto == null))[0] || null; };
  const bandTxt = (b) => (b.min ? fmt(b.min) + ' – ' : 'لحد ') + fmt(b.max);
  // in a plot's details: price per m² (for reference), the range of its area, and its level
  function rangeFacts(zone, alloc, pm, x) {
    let h = fact('سعر المتر', pm ? fmt(pm) + ' ج.م' + (alloc ? '' : ' <span class="sub">(على أصل المساحة)</span>') : '—', 1);
    if (!x || x.paid == null) return h;
    const b = bandOf({ ...x, zone, allocated: alloc });
    h += fact('النطاق السعري', b ? `${bandTxt(b)} ج.م <span class="sub">(المطلوب دفعه · ${b.area} م²)</span>` : '<span class="rbad">المساحة مش في جدول النطاق</span>', 1);
    if (x.band_level === 'bomb') h += fact('المستوى', '<b>قنبلة 💣</b> <span class="sub">(فوق الحد الأقصى واتقبلت استثناء)</span>', 1);
    else if (x.price_hold) h += fact('المستوى', '<span class="rbad">مستنية مراجعة السعر (مش على الموقع)</span>', 1);
    else if (b && Number(x.paid) > b.max) h += fact('المستوى', `<span class="rbad">فوق الحد الأقصى (${fmt(b.max)})</span>`, 1);
    else if (x.band_level) h += fact('المستوى', LEVEL[x.band_level], 1);
    return h;
  }
  const archBtn = (lid, over, state) => (over === true && state !== 'archived' && canArchive && lid ? `<button class="btn red" data-a="arch" data-id="${lid}"${busy ? ' disabled' : ''}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${TAB_IC.archive}</svg> تحويل إلى الأرشيف</button>` : '');
  function vArch() { return { t: 'تحوّلها للأرشيف؟', b: '<span class="sub">القطعة هتختفي من الموقع، والمراجعة المفتوحة عليها هتتقفل. هتلاقيها في تبويب "القطع" تحت "الأرشيف".</span>',
    f: `<button class="btn" data-a="back">لا، سيبها</button><button class="btn dark" data-a="archgo"${busy ? ' disabled' : ''}>حوّلها للأرشيف</button>` }; }
  // the table: zone × allocated × area, lowest and highest amount the owner asks; the owner / GM / super admin edit it
  function vRanges() {
    const can = canManage, groups = [];
    S.bands.forEach((b) => { const k = b.zone + (b.allocated ? '1' : '0'); let g = groups.find((x) => x.k === k); if (!g) groups.push((g = { k, b, rows: [] })); g.rows.push(b); });
    return '<span class="sub">على <b>المطلوب دفعه</b> للمالك. المخصص بالمساحة بعد التقنين، وغير المخصص بالمساحة من جدول الجهاز. المخصص بيتقسم 3 مستويات بالتساوي: عادية، وسوبر، وسوبر سوبريم. اللي فوق الحد الأقصى بيتشال من الموقع ويروح "مراجعة السعر".</span>'
      + groups.map((g) => `<section class="card" data-fold="bd_${g.k}"><h3>${esc(g.b.zone)} · ${g.b.allocated ? 'مخصص' : 'غير مخصص'}</h3>${g.rows.map((b) => `
        <div class="bdrow"><b class="num">${b.area} م²${b.orig_upto ? ` <small>(أصل لحد ${b.orig_upto})</small>` : g.rows.some((o) => o.area === b.area && o.orig_upto) ? ' <small>(أصل أكبر)</small>' : ''}</b>
        <input type="text" inputmode="numeric" id="bdmin_${b.id}" value="${b.min ?? ''}" placeholder="الأدنى"${can ? '' : ' disabled'}>
        <input type="text" inputmode="numeric" id="bdmax_${b.id}" value="${b.max ?? ''}" placeholder="الأقصى"${can ? '' : ' disabled'}>
        ${can ? `<button class="btn sm" data-a="bdsave" data-v="${b.id}"${busy ? ' disabled' : ''}>احفظ</button>` : ''}</div>`).join('')}</section>`).join('');
  }
  // plots waiting for a decision because their price is over the range (or their area isn't in it)
  function vPrc() {
    if (!S.reviews.length) return '<div class="empty">مفيش قطع مستنية مراجعة السعر.</div>';
    return '<span class="sub">القطع دي سعرها فوق الحد الأقصى (أو مساحتها مش في الجدول)، واتشالت من الموقع لحد القرار.</span>' + S.reviews.map((x) => `<button class="rc ca" style="--st:var(--bad)" data-a="prcopen" data-id="${x.id}"><span class="cav">ج</span><span class="cb"><span class="rc-top"><b>${esc(x.zone || '')} · ${x.allocated ? 'مخصص' : 'غير مخصص'} · ${x.area || '—'} م²</b><span class="code">${esc(x.code || '')}</span></span>
      <span class="cw"><span class="who">المطلوب دفعه ${fmt(x.paid)} ج.م</span></span><span class="cx">${x.max ? 'الحد الأقصى ' + fmt(x.max) : 'المساحة مش في الجدول'}${x.requests ? ' · ' + x.requests + ' طلب عليها' : ''}</span></span></button>`).join('');
  }
  function vPrcOne(L) {
    const x = S.reviews.find((o) => o.id === L.id); if (!x) return { t: 'مراجعة السعر', b: '<div class="empty">القطعة دي اتقرر فيها خلاص.</div>', f: '' };
    return { t: 'مراجعة السعر · ' + (x.code || ''), b: `${photoImg(x.photo_path)}<div class="facts">${fact('المكان', esc(x.zone || '') + (x.district ? ' · الحي ' + x.district : ''))}${fact('النوع', x.allocated ? 'مخصص' : 'غير مخصص')}
      ${fact('المساحة', (x.area || '—') + ' م²' + (x.area_orig ? ` <span class="sub">(أصل ${fmt(x.area_orig)})</span>` : ''))}${fact('المطلوب دفعه', fmt(x.paid) + ' ج.م')}${fact('السعر الكلي', fmt(x.price) + ' ج.م')}
      ${fact('النطاق', x.max ? bandTxt(x) + ' ج.م' : '<span class="rbad">المساحة مش في الجدول</span>')}${x.max ? fact('فوق الأقصى بـ', '<span class="rbad">' + fmt(x.paid - x.max) + ' ج.م (' + Math.round((x.paid / x.max - 1) * 100) + '%)</span>') : ''}${fact('موثقة', x.verified ? 'أيوه ✓' : 'لأ')}</div>
      ${x.description ? `<p class="sub" style="white-space:pre-line">${esc(x.description)}</p>` : ''}
      <span class="sub"><b>قنبلة:</b> قطعة سعرها عالي بس مميزة جدًا وتستاهل، تتنشر على الموقع والعلامة في الداشبورد بس. <b>أرشيف:</b> متتنشرش.</span>`,
      f: `<button class="btn dark" data-a="prcgo" data-v="archive"${busy ? ' disabled' : ''}>أرشيف</button><button class="btn pri" data-a="prcgo" data-v="bomb"${busy ? ' disabled' : ''}>قنبلة 💣 انشرها</button>` };
  }
  // "رفع شيت" (23/11): plots from an Excel sheet (brokers' sheets), team leader and above.
  // The file is read in the browser, checked on the server (missing / over the band / maybe already here), then sent:
  // to the platform, to the team leaders, or to a salesperson. The source name shows in the desk only.
  let IMP = null;
  const impName = (id) => ((S.imports || []).find((i) => i.id === id) || {}).name || '';
  const IMP_DEST = [['publish', 'على المنصة على طول', 'تتنشر موثقة. اللي فوق النطاق السعري يروح "مراجعة السعر"، واللي بياناته ناقصة يروح للتيم ليدر.'],
    ['tl', 'للتيم ليدر', 'تنزل في "التوثيق" وهو يوزّعها.'], ['sales', 'للسيلز على طول', 'تنزل عنده طلب توثيق بمهلة 48 ساعة.']];
  function vImp() {
    const hist = (S.imports || []).slice(0, 30).map((i) => `<div class="rc" style="--st:var(--line)"><span class="cav">ش</span><span class="cb"><span class="rc-top"><b>${esc(i.name)}</b><span class="code">${when(T(i.created_at))}</span></span>
      <span class="cw"><span class="who">${i.total} قطعة · ${esc((IMP_DEST.find((d) => d[0] === i.dest) || [])[1] || '')}</span></span>
      <span class="cx">${[i.published ? 'اتنشر ' + i.published : '', i.review ? 'مراجعة السعر ' + i.review : '', i.to_tl ? 'للتيم ليدر ' + i.to_tl : '', i.to_sales ? 'للسيلز ' + i.to_sales : '', 'على الموقع دلوقتي ' + (i.live || 0), esc(i.by_name || '')].filter(Boolean).join(' · ')}</span></span></div>`).join('');
    return `<section class="card"><h3>ارفع قطع من شيت Excel</h3><span class="sub">نفس أعمدة الشيت الفاضي. هتشوف الأعداد والمشاكل قبل ما ترفع، وتختار تنزل فين.</span>
      <div class="g2"><label class="btn pri" style="text-align:center">اختار ملف Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-ch="impfile" hidden></label>
      <a class="btn ghost" href="/telad-template.xlsx" download="شيت-قطع-تلاد.xlsx" style="text-align:center">نزّل الشيت الفاضي</a></div></section>
      ${mapSection()}${hist ? `<div class="blk" data-fold="imp_hist" data-many><h3>اللي اترفع قبل كده</h3>${hist}</div>` : ''}`;
  }
  async function impOpen(file) {
    if (!file || busy) return;
    busy = true; toast('بنقرا الشيت...');
    try {
      const { rows, cols } = importRows(await readXlsx(file));
      if (!rows.length) { busy = false; return toast(cols.length ? 'الشيت مفيهوش صفوف.' : 'مش لاقي أعمدة الشيت. استخدم الشيت الفاضي.'); }
      if (rows.length > 500) { busy = false; return toast('الشيت فيه أكتر من 500 صف. قسّمه.'); }
      const { data, error } = await sb.rpc('desk_import_check', { p_rows: rows }); busy = false;
      if (error) return toast(errMsg(error));
      // the same plot twice inside the sheet
      const seenK = new Map(); rows.forEach((r, i) => { const ks = [r.phone && r.plot ? r.phone + '|' + r.block + '|' + r.plot : '', r.phone && r.paid !== '' ? r.phone + '|' + r.paid + '|' + (r.area_final || r.area_orig) : ''].filter(Boolean);
        const hit = ks.map((k) => seenK.get(k)).find((x) => x != null); if (hit != null) r.twin = rows[hit].row; ks.forEach((k) => { if (!seenK.has(k)) seenK.set(k, i); }); });
      const sales = allSales(), byName = (n) => { const k = nameKey(n); return k ? sales.find((p) => nameKey(p.name) === k) || sales.find((p) => nameKey(p.name).includes(k) || k.includes(nameKey(p.name))) : null; };
      rows.forEach((r, i) => { const c = (data || [])[i] || {}; r.missing = c.missing || null; r.over = !!c.over; r.dup = c.dup || null; const p = r.sales ? byName(r.sales) : null; r.sales_id = p ? p.id : null; });
      IMP = { file: file.name, rows, cols };
      push({ v: 'impv', f: { name: '', dest: 'publish', sales: '', skip: true } });
    } catch (e) { busy = false; toast(e && e.message === 'old_browser' ? 'المتصفح ده قديم ومش بيقرا Excel. حدّثه أو جرّب من كروم.' : 'مش قادر أقرا الملف ده. اتأكد إنه .xlsx'); }
  }
  const impUse = (f) => IMP.rows.filter((r) => !(f.skip && (r.dup || r.twin)));
  function vImpv(L) {
    if (!IMP) return { t: 'رفع شيت', b: '<div class="empty">الملف اتقفل. اختاره تاني من تبويب "رفع شيت".</div>', f: '' };
    const f = L.f, all0 = IMP.rows, use = impUse(f), miss = use.filter((r) => r.missing), over = use.filter((r) => !r.missing && r.over), ok = use.filter((r) => !r.missing && !r.over);
    const dups = all0.filter((r) => r.dup || r.twin), named = all0.filter((r) => r.sales), unmatched = [...new Set(named.filter((r) => !r.sales_id).map((r) => r.sales))];
    const kinds = {}; miss.forEach((r) => r.missing.forEach((k) => { kinds[k] = (kinds[k] || 0) + 1; }));
    const issues = all0.filter((r) => r.missing || r.over || r.dup || r.twin).slice(0, 60).map((r) => `<li>صف ${r.row}: ${[r.missing ? 'ناقص ' + r.missing.join(' و') : '', r.over ? 'فوق النطاق السعري' : '', r.dup ? 'ممكن تكون موجودة: ' + r.dup.map(esc).join('، ') : '', r.twin ? 'متكررة مع صف ' + r.twin : ''].filter(Boolean).join(' · ')}</li>`).join('');
    const fut = f.dest === 'publish' ? [['ok', ok.length, 'هتتنشر'], ['', over.length, 'مراجعة السعر'], ['bad', miss.length, 'ناقصة ← للتيم ليدر']]
      : f.dest === 'tl' ? [['', use.length, 'للتيم ليدر']] : (() => { const toS = use.filter((r) => r.sales_id || f.sales).length; return [['', toS, 'للسيلز'], ['bad', use.length - toS, 'من غير سيلز ← للتيم ليدر']]; })();
    let h = `<span class="sub">${esc(IMP.file)} · ${all0.length} قطعة</span>
      <div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[['ok', all0.filter((r) => !r.missing && !r.over).length, 'كاملة'], ['bad', all0.filter((r) => r.missing).length, 'بياناتها ناقصة'], ['', all0.filter((r) => !r.missing && r.over).length, 'فوق النطاق السعري'], ['bad', dups.length, 'ممكن تكون مكررة']].map((x) => `<div class="tl ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>
      ${Object.keys(kinds).length ? `<span class="sub">الناقص: ${Object.entries(kinds).map(([k, n]) => esc(k) + ' (' + n + ')').join('، ')}</span>` : ''}
      ${dups.length ? `<label class="sub" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-ch="impskip"${f.skip ? ' checked' : ''}> متنزّلش المكرر (${dups.length})</label>` : ''}
      <label class="fld"><span>اسم المصدر (بيظهر في الداشبورد بس)</span><input type="text" data-f="name" maxlength="80" value="${esc(f.name)}" placeholder="مثلًا: وسيط أحمد"></label>
      <div class="blk"><h3>تنزل فين؟</h3><div style="display:grid;gap:8px">${IMP_DEST.map((d) => `<button class="opt${f.dest === d[0] ? ' on' : ''}" data-a="impdest" data-v="${d[0]}"><i class="rd"></i><span class="tx"><b>${d[1]}</b><span>${d[2]}</span></span></button>`).join('')}</div>
      ${f.dest === 'sales' ? `<label class="fld"><span>${named.length ? `${named.length} صف فيهم اسم السيلز. الباقي يروح لـ:` : 'السيلز'}</span><select data-ch="impsales"><option value="">${named.length ? 'التيم ليدر' : 'اختار'}</option>${allSales().map((p) => `<option value="${p.id}"${String(f.sales) === String(p.id) ? ' selected' : ''}>${esc(p.name)} · ${ROLES[p.role]}</option>`).join('')}</select></label>
        ${unmatched.length ? `<span class="sub rbad">أسامي مش لاقيها في الفريق: ${unmatched.map(esc).join('، ')}</span>` : ''}` : ''}</div>
      <div class="blk"><h3>هيحصل إيه</h3><div class="tiles">${fut.map((x) => `<div class="tl ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div></div>
      ${issues ? `<div class="blk" data-fold="imp_issues"><h3>الصفوف اللي فيها حاجة</h3><ul class="sub">${issues}</ul></div>` : ''}`;
    const n = use.length, can = n > 0 && f.name.trim() && (f.dest !== 'sales' || f.sales || use.some((r) => r.sales_id));
    return { t: 'رفع شيت', b: h, f: `<button class="btn pri" data-a="impgo"${busy || !can ? ' disabled' : ''}>${busy ? 'بنرفع...' : 'ارفع ' + n + ' قطعة'}</button>` };
  }
  function vImpDone(L) {
    const r = L.r || {};
    return { t: 'اترفع ✓', b: `<div class="tiles">${[['ok', r.published, 'اتنشرت'], ['', r.review, 'مراجعة السعر'], ['', r.to_tl, 'للتيم ليدر'], ['', r.to_sales, 'للسيلز']].filter((x) => x[1]).map((x) => `<div class="tl ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>
      <span class="sub">${r.total} قطعة من شيت "${esc(r.name || '')}". تقدر تدوّر عليهم في تبويب القطع باسم المصدر.</span>`, f: '<button class="btn pri" data-a="close">تمام</button>' };
  }
  async function impGo(L) {
    if (!IMP || busy) return; const f = L.f;
    const rows = impUse(f).map((r) => ({ zone: r.zone, district: r.district, nb: r.nb, block: r.block, plot: r.plot, alloc: r.alloc, stage: r.stage, area_orig: r.area_orig, area_final: r.area_final,
      paid: r.paid, price: r.price, inst_left: r.inst_left, owner: r.owner, phone: r.phone, phone2: r.phone2, descr: r.descr, sales_id: f.dest === 'sales' ? r.sales_id : null }));
    const res = await rpcToast('desk_import', { p_rows: rows, p_dest: f.dest, p_name: f.name.trim(), p_sales: f.dest === 'sales' && f.sales ? Number(f.sales) : null });
    if (!res) return;
    IMP = null; UI.stack = [{ v: 'impdone', r: res }]; renderSheet(); await load(true);
  }
  // "حاسبة التقنين" (24/11, team lead and above): the whole legalization bill step by step, and the installment review that
  // compares what is recorded on each allocated plot with the formula. Nothing here changes a plot.
  const CALC = { mode: 'calc', f: { alloc: true, ao: '', pick: '', af: '', stage: 'not_completed', chkPaid: 'no', first: '', paid: '' }, o: { checkBy: 'orig', waiver: false },
    list: null, loading: false, flt: 'all', q: '', noLast: true };
  const MED_SHEET = 9; // the broker's sheet of 23/11, left out of the review by default (the owner's request)
  const f2 = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const jm = (n) => fmt(n) + ' <small>ج.م</small>';
  const STG3 = [['not_completed', 'غير مستكملة'], ['completed', 'مستكملة غير مستلمة'], ['received', 'مستلمة']];
  const calcToday = () => new Date().toISOString().slice(0, 7);
  const cRow = (k, how, v, cls) => `<div${cls ? ` class="${cls}"` : ''}><span>${k}${how ? `<small class="r">${how}</small>` : ''}</span><b>${v}</b></div>`;
  function calcSteps(c, o) {
    return `<div class="kv calc">
      ${cRow('1. خصم الترفيق', `${Math.round(c.cutPct * 100)}% من أصل المساحة ${f2(c.ao)} م² (${c.ao <= 300 ? 'لحد 300 م²' : 'فوق 300 م²'})`, f2(c.cut) + ' م²')}
      ${cRow('2. الصافي', `<bdi dir="ltr">${f2(c.ao)} − ${f2(c.cut)}</bdi>`, f2(c.net) + ' م²')}
      ${cRow('3. المساحة بعد التقنين', c.base ? (c.picked ? `نزلت من ${c.base} في جدول الجهاز` : 'من جدول الجهاز بأصل المساحة') : 'مكتوبة (أصل المساحة فوق 750 م²)', c.tier + ' م²')}
      ${cRow('4. تقنين الأمتار', `الأصغر من الصافي والمساحة بعد التقنين: ${f2(c.kept)} م² × ${fmt(c.perM)} (${c.tier <= 300 ? '209 و276' : '350 وطالع'})`, jm(c.legal))}
      ${c.missing ? cRow('5. شراء الناقص', `${f2(c.missing)} م² × ${fmt(3000)}`, '+ ' + jm(c.buy)) : ''}
      ${c.extra ? cRow('5. بيع الزيادة للجهاز', `${f2(c.extra)} م² × 700`, '− ' + jm(c.sell)) : ''}
      ${cRow('6. إجمالي التكلفة', '', jm(c.total))}
      ${cRow('7. مصاريف إدارية', '1.5%', '+ ' + jm(c.admin))}
      ${cRow('8. إجمالي التقنين', '', jm(c.grand), 'hl')}
      ${cRow('9. قيمة الشيك (الربع)', 'إجمالي التقنين ÷ 4', jm(c.quarter))}
      ${cRow('10. الشيك الأول', `حسب ${o.checkBy === 'tier' ? 'المساحة بعد التقنين' : 'أصل المساحة'}: 60,000 لحد 300، و100,000 لحد 500، و150,000 فوقها`, jm(c.check))}
      ${cRow('11. الاستكمال', c.completion < 0 ? `الشيك أكبر من الربع بـ${fmt(-c.completion)}، فالاستكمال صفر والفرق بيتخصم من الأقساط` : 'قيمة الشيك − الشيك الأول', jm(Math.max(0, c.completion)))}
      ${cRow('12. القسط السنوي', c.credit ? `قيمة الشيك − ${fmt(c.credit / 3)} خصم` : '3 أقساط سنوية، كل قسط = قيمة الشيك', jm(c.inst), 'hl')}
    </div>`;
  }
  function calcOut() {
    const f = CALC.f, o = CALC.o, c = calc(f, { ...o, today: calcToday() });
    if (c.err) return `<div class="empty">${esc(c.err)}</div>`;
    const tier = c.base && c.options.length > 1 ? `<div class="fld"><span>المساحة بعد التقنين (تنزل بس، متطلعش)</span><div class="rch">${c.options.slice().reverse().map((t0) => `<button data-a="cset" data-k="pick" data-v="${t0}" class="${c.tier === t0 ? 'on' : ''}">${t0}${t0 === c.base ? ' (الجدول)' : ''}</button>`).join('')}</div></div>` : '';
    const items = [c.checkItem ? ['شيك التقنين (مش مدفوع)', c.checkItem] : null, c.comp != null ? ['الاستكمال', c.comp] : null,
      c.left != null ? [`الأقساط (${c.left} × ${fmt(c.inst)})`, c.inst * c.left] : null, c.waiver ? ['التنازل', c.waiver] : null].filter(Boolean);
    const sched = c.sched ? `<div class="blk" data-fold="calc_sched"><h3>مواعيد الأقساط</h3><div class="kv">${c.sched.map((d, i) => cRow(`القسط ${i + 1}`, d, (d <= calcToday() ? '<span class="rok">اتدفع</span> · ' : '') + jm(c.inst))).join('')}</div></div>`
      : c.stage === 'received' ? '<span class="sub">اكتب موعد أول قسط علشان أعرف اتدفع كام.</span>' : '';
    return `${tier}
      <div class="tiles">${[['', c.comp != null ? fmt(c.comp) : '—', 'الاستكمال'], ['ok', fmt(c.inst), 'القسط السنوي'], ['', c.left ?? '—', 'أقساط متبقية']].map((x) => `<div class="tl ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>
      <div class="blk" data-fold="calc_steps"><h3>الحسبة خطوة بخطوة</h3>${calcSteps(c, o)}</div>${sched}
      <div class="blk" data-fold="calc_rem"><h3>المتبقي للجهاز</h3><div class="kv">${items.map((x) => cRow(x[0], '', jm(x[1]))).join('')}${c.remaining != null ? cRow('المتبقي', '', jm(c.remaining), 'hl') : ''}
        ${c.price != null ? cRow('المطلوب دفعه للبائع', '', jm(c.paid)) + cRow('السعر الكلي', 'المطلوب دفعه + المتبقي', jm(c.price), 'hl') + cRow('سعر المتر', `على ${c.alloc ? 'المساحة بعد التقنين' : 'أصل المساحة'}`, jm(c.pm)) : ''}</div>
        ${c.paid == null ? '<span class="sub">اكتب المطلوب دفعه علشان يطلع السعر الكلي وسعر المتر.</span>' : ''}</div>`;
  }
  function calcForm() {
    const f = CALC.f, o = CALC.o, ch = (k, opts, cur, src = 'f') => `<div class="rch">${opts.map(([v0, t0]) => `<button data-a="cset" data-s="${src}" data-k="${k}" data-v="${v0}" class="${String(cur) === String(v0) ? 'on' : ''}">${t0}</button>`).join('')}</div>`;
    const big = Number(f.ao) >= 751;
    return `<section class="card"><h3>بيانات القطعة</h3>
      ${ch('alloc', [['true', 'مخصصة'], ['false', 'غير مخصصة']], f.alloc)}
      <div class="g2"><label class="fld"><span>أصل المساحة م²</span><input type="text" inputmode="decimal" data-cf="ao" value="${esc(f.ao)}" placeholder="مثلًا 200"></label>
      <label class="fld"><span>المطلوب دفعه للبائع (اختياري)</span><input type="text" inputmode="numeric" data-cf="paid" value="${esc(f.paid)}" placeholder="مثلًا 900000"></label></div>
      <label class="fld" id="cf_af"${big ? '' : ' hidden'}><span>المساحة بعد التقنين م² (فوق 750 بتتكتب)</span><input type="text" inputmode="decimal" data-cf="af" value="${esc(f.af)}"></label>
      ${String(f.alloc) !== 'false' ? `<div class="fld"><span>المرحلة</span>${ch('stage', STG3, f.stage)}</div>
        ${f.stage === 'received' ? `<label class="fld"><span>موعد أول قسط</span><input type="month" data-cf="first" value="${esc(f.first)}"></label>` : ''}`
      : `<div class="fld"><span>شيك التقنين</span>${ch('chkPaid', [['yes', 'مدفوع'], ['no', 'مش مدفوع (على المشتري)']], f.chkPaid)}</div>`}
    </section>
    <div class="blk" data-fold="calc_opts"><h3>لحد ما يتحسم</h3><div class="fld"><span>الشيك الأول على</span>${ch('checkBy', [['orig', 'أصل المساحة (الحالي)'], ['tier', 'المساحة بعد التقنين']], o.checkBy, 'o')}</div>
      <div class="fld"><span>التنازل (المساحة بعد التقنين × 180)</span>${ch('waiver', [['false', 'من غير (الحالي)'], ['true', 'ضيفه']], o.waiver, 'o')}</div></div>
    <div id="calcout">${calcOut()}</div>`;
  }
  // ---- the installment review: each allocated plot, recorded vs. the formula ----
  function calcReview(x) {
    const items = x.items || [], amt = (k) => { const i = items.find((i0) => i0.k === k); return i && i.amt != null ? Number(i.amt) : null; };
    const base = (RULES.byArea.find(([lim]) => Number(x.area_orig) < lim) || [])[1], af = Number(x.area_final), notes = [];
    if (base && af && !tierOptions(Number(x.area_orig)).includes(af)) notes.push(`المساحة بعد التقنين المكتوبة ${f2(af)} مش في جدول الجهاز، اتحسبت ${base}`);
    if (!x.stage) notes.push('المرحلة مش مكتوبة، اتحسبت كغير مستكملة');
    const c = calc({ alloc: true, ao: x.area_orig, pick: af, af, stage: x.stage || 'not_completed', first: x.inst_first ? String(x.inst_first).slice(0, 7) : '' }, { ...CALC.o, today: calcToday() });
    if (c.err) return { x, c, err: c.err, notes };
    const left = x.stage === 'received' ? x.inst_left ?? c.left : 3;
    const sInst = x.inst_value != null ? Number(x.inst_value) : amt('inst') != null && x.inst_left ? amt('inst') / x.inst_left : null;
    const rem = left == null ? null : (c.comp || 0) + c.inst * left + (c.waiver || 0);
    if (x.stage === 'received' && left == null) notes.push('مستلمة وعدد الأقساط المتبقية مش مكتوب');
    return { x, c, notes, left, sInst, sComp: amt('comp'), rem, dInst: sInst != null ? c.inst - sInst : null, dRem: rem != null && x.remaining != null ? rem - Number(x.remaining) : null };
  }
  const dCls = (d) => (d == null ? '' : Math.abs(d) < 3000 ? 'rok' : Math.abs(d) < 10000 ? 'rwarn' : 'rbad');
  const dTxt = (d) => (d == null ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d)));
  const CALC_FLT = [['all', 'الكل'], ['big', 'فرق كبير (10,000+)'], ['mid', 'فرق متوسط'], ['close', 'قريبة'], ['noinst', 'من غير قسط مكتوب'], ['nostage', 'المرحلة مش مكتوبة']];
  const calcFltFn = { all: () => true, big: (v) => v.dInst != null && Math.abs(v.dInst) >= 10000, mid: (v) => v.dInst != null && Math.abs(v.dInst) >= 3000 && Math.abs(v.dInst) < 10000,
    close: (v) => v.dInst != null && Math.abs(v.dInst) < 3000, noinst: (v) => v.sInst == null, nostage: (v) => !v.x.stage };
  function calcRows() { return (CALC.list || []).filter((x) => !(CALC.noLast && x.import_id === MED_SHEET)).map(calcReview); }
  function calcList() {
    const q = CALC.q.trim().toLowerCase(), rows = calcRows().filter(calcFltFn[CALC.flt]).filter((v) => !q || [v.x.code, v.x.id, v.x.district].some((s) => String(s ?? '').toLowerCase().includes(q)))
      .sort((a, b) => Math.abs(b.dInst ?? -1) - Math.abs(a.dInst ?? -1));
    if (!rows.length) return '<div class="empty">مفيش قطع هنا.</div>';
    return rows.slice(0, 200).map((v) => { const x = v.x, col = v.dInst == null ? 'var(--line)' : Math.abs(v.dInst) < 3000 ? 'var(--ok)' : Math.abs(v.dInst) < 10000 ? 'var(--gold)' : 'var(--bad)';
      return `<button class="rc ca" style="--st:${col}" data-a="calcplot" data-id="${x.id}"><span class="cav">₤</span><span class="cb"><span class="rc-top"><b>${esc(x.code || '#' + x.id)}</b><span class="code">${esc(x.zone || '')}${x.district ? ' · الحي ' + esc(x.district) : ''}</span></span>
        <span class="cw"><span class="who">القسط: مسجل ${v.sInst != null ? fmt(v.sInst) : '—'} · محسوب ${v.err ? '—' : fmt(v.c.inst)}</span><span class="${dCls(v.dInst)}">${dTxt(v.dInst)}</span></span>
        <span class="cx">${esc([`${f2(x.area_orig)} ← ${x.area_final != null ? f2(x.area_final) : '—'} م²`, (STG3.find((s) => s[0] === x.stage) || [])[1] || 'المرحلة مش مكتوبة', PST[x.state] ? PST[x.state][0] : x.state, ...v.notes.slice(0, 1)].join(' · '))}</span></span></button>`; }).join('');
  }
  function calcLoad() {
    if (CALC.loading) return; CALC.loading = true;
    sb.rpc('desk_calc_plots').then(({ data, error }) => { CALC.loading = false; if (dead) return; if (error) { toast(errMsg(error)); return; } CALC.list = data || []; render(); });
  }
  function vCalcReview() {
    if (!CALC.list) { calcLoad(); return '<div class="empty">بنحمّل القطع...</div>'; }
    const all = calcRows(), n = (k) => all.filter(calcFltFn[k]).length;
    return `<span class="sub">القطع المخصصة اللي مكتوب فيها أصل المساحة. المسجل جنب المحسوب بالمعادلة. أخضر أقل من 3,000، وأصفر لحد 10,000، وأحمر أكتر.</span>
      <div class="rch">${CALC_FLT.map(([k, t0]) => `<button data-a="cflt" data-v="${k}" class="${CALC.flt === k ? 'on' : ''}">${t0} (${n(k)})</button>`).join('')}</div>
      <label class="sub" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-ch="cnolast"${CALC.noLast ? ' checked' : ''}> من غير شيت الوسيط</label>
      <input type="search" id="calcq" placeholder="دوّر بالكود أو الحي" value="${esc(CALC.q)}">
      <div id="calclist" style="display:grid;gap:8px">${calcList()}</div>`;
  }
  function vCalc() {
    return `<div class="rch" style="margin-bottom:10px">${[['calc', 'الحاسبة'], ['review', 'مراجعة الأقساط']].map(([k, t0]) => `<button data-a="cmode" data-v="${k}" class="${CALC.mode === k ? 'on' : ''}">${t0}</button>`).join('')}</div>
      ${CALC.mode === 'calc' ? calcForm() : vCalcReview()}`;
  }
  function vCalcPlot(L) {
    if (!CALC.list) { calcLoad(); return { t: 'مراجعة الأقساط', b: '<div class="empty">بنحمّل...</div>', f: '' }; }
    const x = CALC.list.find((p) => p.id === L.id); if (!x) return { t: 'مراجعة الأقساط', b: '<div class="empty">القطعة دي مش مخصصة أو مفيهاش أصل المساحة.</div>', f: '' };
    const v = calcReview(x), c = v.c;
    if (v.err) return { t: x.code || 'القطعة', b: `<div class="empty">${esc(v.err)}</div>`, f: '' };
    const row = (k, s, cc) => { const d = s != null && cc != null ? cc - s : null; return `<tr><td>${k}</td><td>${s != null ? fmt(s) : '—'}</td><td>${cc != null ? fmt(cc) : '—'}</td><td class="${dCls(d)}">${dTxt(d)}</td></tr>`; };
    let h = `<div class="tbl"><table><thead><tr><th></th><th>المسجل</th><th>المحسوب</th><th>الفرق</th></tr></thead><tbody>
      ${row('القسط', v.sInst, c.inst)}${row('الاستكمال', v.sComp, c.comp)}${row('الأقساط المتبقية', x.inst_left, v.left)}${row('المتبقي', x.remaining != null ? Number(x.remaining) : null, v.rem)}
      ${row('السعر الكلي', x.price != null ? Number(x.price) : null, v.rem != null && x.paid != null ? Number(x.paid) + v.rem : null)}</tbody></table></div>
      ${v.notes.length ? `<span class="sub rbad">${v.notes.map(esc).join(' · ')}</span>` : ''}
      <span class="sub">${esc([x.zone, x.district ? 'الحي ' + x.district : '', `أصل المساحة ${f2(x.area_orig)} م²`, `بعد التقنين ${x.area_final != null ? f2(x.area_final) : '—'} م²`, (STG3.find((s) => s[0] === x.stage) || [])[1] || 'المرحلة مش مكتوبة', 'المطلوب دفعه ' + fmt(x.paid)].filter(Boolean).join(' · '))}</span>
      <div class="blk" data-fold="calcp_steps"><h3>الحسبة خطوة بخطوة</h3>${calcSteps(c, CALC.o)}</div>
      <span class="sub">الأداة مبتغيّرش حاجة في القطعة. لو الأرقام المسجلة غلط، صلّحها من القطعة نفسها.</span>`;
    const ft = [`<button class="btn ghost" data-a="calcuse" data-id="${x.id}">افتحها في الحاسبة</button>`];
    if (canPlots && Pl(x.id)) ft.push(`<button class="btn pri" data-a="plotopen" data-id="${x.id}">افتح القطعة</button>`);
    return { t: 'مراجعة الأقساط · ' + (x.code || '#' + x.id), b: h, f: ft.join('') };
  }
  // "بطاقة القطعة" (23/11): every listing is matched on the server with the New Obour plan (plot_map). The site shows the
  // card only for a clean match; the desk shows why a plot has no card, and the owner uploads the plan file here.
  const MAPD = {}, MAPS = new Set(); // MAPS: shown before the last refresh, fetched again in the background
  const MAP_ST = { card: ['البطاقة ظاهرة على الموقع ✓', 'ok'], review: ['محتاجة مراجعة', 'bad'], nomatch: ['مش لاقيينها في المخطط', 'bad'], multi: ['متطابقة مع أكتر من قطعة', 'bad'],
    incomplete: ['بياناتها ناقصة', ''], nocard: ['المخطط مفيهوش مميزات كفاية', ''] };
  function mapBlock(lid) {
    if (MAPD[lid] === undefined || MAPS.has(lid)) { MAPS.delete(lid); if (MAPD[lid] === undefined) MAPD[lid] = null; Promise.all([sb.rpc('desk_plot_map', { p_listing: lid }), sb.from('listing_map_svg').select('svg').eq('listing_id', lid).maybeSingle()]).then(([{ data }, sv]) => { if (dead) return; const was = JSON.stringify(MAPD[lid]); MAPD[lid] = { ...(data || {}), svg: (sv && sv.data && sv.data.svg) || null }; const L = top(); if (was !== JSON.stringify(MAPD[lid]) && L && (L.id === lid || (Rq(L.id) || {}).listing_id === lid)) renderSheet(); }); }
    const m = MAPD[lid]; if (!m) return '<div class="blk" data-fold="map"><h3>بطاقة القطعة</h3><span class="sub">بنحمّل...</span></div>';
    const st = MAP_ST[m.state] || ['لسه متحسبتش', ''], c = m.card, p = m.plan;
    const fix = ['incomplete', 'nomatch', 'review', 'multi'].includes(m.state) ? ' · لو فيه غلط في الحي أو المجاورة أو البلوك أو رقم القطعة أو المساحة، صلّحه من "تعديل" والبطاقة هتتحسب تاني لوحدها.' : '';
    return `<div class="blk" data-fold="map"><h3>بطاقة القطعة</h3>${m.svg ? `<div class="mapw">${m.svg}</div>` : ''}<div class="facts">${fact('الحالة', `<span class="${st[1] === 'ok' ? 'rok' : st[1] === 'bad' ? 'rbad' : ''}">${st[0]}</span>`, 1)}
      ${m.note ? fact('السبب', esc(m.note) + `<span class="sub">${fix}</span>`, 1) : fix ? fact('', `<span class="sub">${fix}</span>`, 1) : ''}
      ${c ? fact('الواجهة', esc(c.facade), 1) + (c.feats || []).map((f) => fact('ميزة', esc(f), 1)).join('') + (c.dims ? fact('الأبعاد', esc(c.dims), 1) : '') : ''}
      ${p ? fact('في المخطط', esc(p.status || '') + (p.area ? ' · ' + fmt(p.area) + ' م²' : ''), 1) + fact('كل المميزات', (p.feats || []).map(esc).join('<br>') || '—', 1) : ''}</div></div>`;
  }
  const canMapLoad = R === 'owner' || !!me.can_act;
  function mapSection() {
    const m = S.mapst || {}, l = m.listings || {};
    const tiles = [['ok', m.live_cards || 0, 'بطاقة على الموقع'], ['bad', (l.review || 0) + (l.multi || 0), 'محتاجة مراجعة'], ['', l.nomatch || 0, 'مش في المخطط'], ['', l.incomplete || 0, 'بياناتها ناقصة']];
    return `<section class="card" data-fold="map_up"><h3>بطاقة القطعة · مخطط العبور الجديدة</h3>
      <span class="sub">${m.rows ? `${fmt(m.rows)} قطعة في المخطط · آخر تحديث ${when(T(m.loaded_at))}${m.loaded_by ? ' · ' + esc(m.loaded_by) : ''}` : 'المخطط لسه مترفعش.'} أي قطعة بياناتها كاملة ومطابقة للمخطط بتظهر على الموقع ببطاقة: المكان والواجهة وميزتين.</span>
      <div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))">${tiles.map((x) => `<div class="tl ${x[0]}"><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div>
      <span class="sub">الخريطة في البطاقة: ${m.geo_plots ? `${fmt(m.geo_plots)} قطعة و${fmt(m.geo_services || 0)} خدمة مرسومين · ${fmt(m.maps || 0)} بطاقة فيها خريطة` : 'ملفات الرسم لسه مترفعتش، فالبطاقات من غير خريطة.'}</span>
      ${canMapLoad ? `<label class="btn ghost" style="text-align:center">${m.rows ? 'حدّث المخطط (ملف CSV جديد)' : 'ارفع ملف المخطط (plot_features.csv)'}<input type="file" accept=".csv,text/csv" data-ch="mapfile" hidden></label>
      <label class="btn ghost" style="text-align:center">ارفع ملفات الرسم (05_plots و05_services)<input type="file" accept=".geojson,.json,application/geo+json,application/json" multiple data-ch="geofile" hidden></label>` : ''}</section>`;
  }
  let MAPF = null;
  async function mapOpen(file) {
    if (!file || busy) return; busy = true; toast('بنقرا الملف...');
    try { const rows = planRows(parseCsv(await file.text())); busy = false;
      if (!rows || !rows.length) return toast('ده مش ملف المخطط. لازم يبقى plot_features.csv بنفس الأعمدة.');
      MAPF = { name: file.name, rows }; push({ v: 'mapv', f: {} });
    } catch (e) { busy = false; toast('مش قادر أقرا الملف ده.'); }
  }
  function vMapv(L) {
    if (!MAPF) return { t: 'ملف المخطط', b: '<div class="empty">الملف اتقفل. اختاره تاني.</div>', f: '' };
    if (L.res) return { t: 'المخطط اترفع ✓', b: `<span class="sub">${fmt(L.res.rows)} قطعة في المخطط. كل القطع اتطابقت من جديد.</span><div class="tiles" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[['ok', L.res.live_cards, 'بطاقة على الموقع'], ['bad', ((L.res.listings || {}).review || 0) + ((L.res.listings || {}).multi || 0), 'محتاجة مراجعة'], ['', (L.res.listings || {}).nomatch || 0, 'مش في المخطط'], ['', (L.res.listings || {}).incomplete || 0, 'بياناتها ناقصة']].map((x) => `<div class="tl ${x[0]}"><b>${x[1] || 0}</b><span>${x[2]}</span></div>`).join('')}</div>`, f: '<button class="btn pri" data-a="close">تمام</button>' };
    return { t: 'ملف المخطط', b: `<span class="sub">${esc(MAPF.name)} · ${fmt(MAPF.rows.length)} قطعة.</span>
      <span class="sub">المخطط القديم هيتشال ويتحط ده مكانه، وبعدها كل القطع اللي عندنا هتتطابق معاه من جديد. الرفع بياخد دقيقة أو اتنين، متقفلش الصفحة.</span>
      ${L.prog != null ? `<div class="sub"><b>اترفع ${L.prog}%</b></div>` : ''}`,
      f: `<button class="btn pri" data-a="mapgo"${busy ? ' disabled' : ''}>${busy ? 'بنرفع...' : 'ارفع المخطط'}</button>` };
  }
  async function mapGo(L) {
    if (!MAPF || busy) return; busy = true; const rows = MAPF.rows, N = 2000; L.prog = 0; renderSheet();
    try {
      for (let i = 0; i < rows.length; i += N) {
        const { error } = await sb.rpc('desk_map_load', { p_rows: rows.slice(i, i + N), p_reset: i === 0 });
        if (error) throw error;
        L.prog = Math.min(100, Math.round(((i + N) / rows.length) * 100)); renderSheet();
      }
      const { data, error } = await sb.rpc('desk_map_finish'); if (error) throw error;
      busy = false; L.res = data; renderSheet(); await load(true);
    } catch (e) { busy = false; L.prog = null; toast(errMsg(e) + ' الرفع وقف، جرّبه تاني من الأول.'); renderSheet(); }
  }
  // the plan's drawing (05_plots / 05_services): the owner uploads both, the server draws each card's map
  let GEOF = null;
  async function geoOpen(files) {
    if (!files || !files.length || busy) return; busy = true; toast('بنقرا الملفات...');
    try { const got = {};
      for (const f of files) { const g = geoRows(JSON.parse(await f.text())); if (g && g.rows.length) got[g.kind] = { name: f.name, rows: g.rows }; }
      busy = false;
      if (!got.plots && !got.services) return toast('دي مش ملفات الرسم. اختار 05_plots_drawing_coords و05_services_drawing_coords.');
      GEOF = got; push({ v: 'geov', f: {} });
    } catch (e) { busy = false; toast('مش قادر أقرا الملف ده.'); }
  }
  function vGeov(L) {
    if (!GEOF) return { t: 'ملفات الرسم', b: '<div class="empty">الملفات اتقفلت. اختارها تاني.</div>', f: '' };
    if (L.res) return { t: 'الرسم اترفع ✓', b: `<span class="sub">${fmt(L.res.maps || 0)} قطعة على المنصة بقت بطاقتها فيها خريطة.</span>`, f: '<button class="btn pri" data-a="close">تمام</button>' };
    const ln = (k, t) => (GEOF[k] ? `<li>${t}: ${fmt(GEOF[k].rows.length)} (${esc(GEOF[k].name)})</li>` : `<li>${t}: <b class="rbad">مش مختار</b>، اللي قبل كده هيفضل زي ما هو</li>`);
    return { t: 'ملفات الرسم', b: `<ul class="sub">${ln('plots', 'حدود القطع')}${ln('services', 'الخدمات والحدايق')}</ul>
      <span class="sub">الرسم القديم هيتشال ويتحط ده مكانه، وبعدها كل البطاقات هتترسم من جديد. الرفع بياخد دقيقتين تلاتة، متقفلش الصفحة.</span>
      ${L.prog != null ? `<div class="sub"><b>اترفع ${L.prog}%</b></div>` : ''}`,
      f: `<button class="btn pri" data-a="geogo"${busy ? ' disabled' : ''}>${busy ? 'بنرفع...' : 'ارفع الرسم'}</button>` };
  }
  async function geoGo(L) {
    if (!GEOF || busy) return; busy = true; L.prog = 0; renderSheet();
    const jobs = ['plots', 'services'].filter((k) => GEOF[k]), total = jobs.reduce((a, k) => a + GEOF[k].rows.length, 0), N = 1500; let done = 0;
    try {
      for (const k of jobs) { const rows = GEOF[k].rows;
        for (let i = 0; i < rows.length; i += N) {
          const { error } = await sb.rpc('desk_geo_load', { p_kind: k, p_rows: rows.slice(i, i + N), p_reset: i === 0 }); if (error) throw error;
          done += Math.min(N, rows.length - i); L.prog = Math.round((done / total) * 100); renderSheet();
        } }
      const { data, error } = await sb.rpc('desk_map_finish'); if (error) throw error;
      busy = false; L.res = data; renderSheet(); await load(true);
    } catch (e) { busy = false; L.prog = null; toast(errMsg(e) + ' الرفع وقف، جرّبه تاني من الأول.'); renderSheet(); }
  }
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
    const who = isUnit(r) ? 'المشتري' : 'البائع';
    let h = `<div class="blk"><div class="facts">${fact(who, esc(r.name || '—'))}${fact('رقمه', `<span dir="ltr">${esc(r.phone || '—')}</span>`)}${fact('وصل', when(r.at))}${fact('من', isVerify(r) ? 'توثيق قطعة قديمة' : isOffer(r) ? 'عرض من "اعرض قطعتك"' : r.via === 'ask' ? 'طلب "بيدوّر على قطعة"' : '"اطلبها" من صفحة القطعة')}</div>
      ${r.phone ? `<div class="g2"><a class="btn sm" href="tel:${esc(r.phone)}">كلّم ${who}</a><a class="btn sm wa" href="https://wa.me/2${esc(r.phone)}" target="_blank" rel="noopener">واتساب ${who}</a></div>` : ''}</div>`;
    h += r.via === 'ask' ? `<div class="blk"><div class="chips" style="justify-content:center">${whereChip(r)}${timerChip(r)}${cxChip(r)}</div></div>` : `<div class="blk" data-fold="q_path"><h3>المسار</h3><div>${path(r)}</div><div class="chips" style="justify-content:center">${whereChip(r)}${timerChip(r)}${cxChip(r)}</div></div>`;
    if (r.cx_eval && r.cx_eval.length) h += `<div class="blk" data-fold="q_eval"><h3>تقييم الإلغاء</h3><div class="chips">${r.cx_eval.map((k) => `<span class="chip c-bad">${esc(evalName(k))}</span>`).join('')}</div></div>`;
    if (r.sales_id || r.via === 'ask') {
      const done = stDone(r), can = (mine && r.stage === 'sales') || (r.via === 'ask' && isSA && r.stage !== 'closed');
      h += `<div class="blk" data-fold="q_st"><h3>${isOffer(r) ? 'المراجعة' : isVerify(r) ? 'التوثيق' : 'حالة الطلب'}${r.sales_id ? ' مع ' + esc(P(r.sales_id).name) : ''}</h3><div class="sts">${stList(r).map((s) => { const x = done[s[0]];
        return `<button class="st${x ? ' on' : ''}"${can ? ` data-a="${x ? 'unst' : 'status'}" data-v="${s[0]}"` : ' disabled'}><i>${x ? '✓' : ''}</i><span>${s[1]}</span>${x ? `<small>${x.late ? '<span style="color:var(--bad)">متأخر · </span>' : ''}${when(x.at)}</small>` : ''}</button>`; }).join('')}</div>${can ? `<span class="sub">${r.batch ? 'المهلة 48 ساعة للمهمة كلها.' : `كل حالة ليها ${isVerify(r) ? '6 ساعات' : 'ساعتين'} من اللي قبلها.`}</span>` : ''}${mine && r.stage === 'sales' && curDue(r) && curDue(r) > now() ? `<button class="btn sm" data-a="sub" data-v="late">${isOffer(r) ? 'البائع' : 'العميل'} اتأخر في الرد</button>` : ''}${r.client_late ? `<span class="sub">${isOffer(r) ? 'البائع' : 'العميل'} اتأخر في الرد ${r.client_late} مرة، والمهلة اتمدّت.</span>` : ''}${soldBlock(r, can)}</div>`;
    }
    if (r.outcome) h += `<div class="blk"><div class="chips"><span class="chip ${r.outcome === 'sold' || r.outcome === 'ready' ? 'c-ok' : ''}">النتيجة: ${esc(OUT[r.outcome])}${r.outcome_reason ? ' · ' + esc(r.outcome_reason) : ''}</span></div>${r.outcome_summary ? `<div class="log"><div class="lg"><span><b>${esc(P(r.sales_id).name)}</b> — ملخص</span><span></span><q>${esc(r.outcome_summary)}</q></div></div>` : ''}</div>`;
    if (isUnit(r)) h += qlBlock(r);
    h += stepBlock(r);
    h += unitBlock(r, d);
    if (!isUnit(r) && r.stage !== 'closed' && d && d.unit && (isSA || isWeb || (isSales && mine && r.stage === 'sales'))) h += `<div class="blk" data-fold="q_fix"><h3>صلّح القطعة</h3><div class="chips"><button class="btn sm" data-a="sub" data-v="edit">صلّح بيانات القطعة</button>
      <label class="btn sm">${d.unit.photo_path ? 'غيّر صورة القطعة' : 'ارفع صورة القطعة'}<input type="file" accept="image/*" data-up="photo" hidden></label><label class="btn sm">${d.unit.has_letter ? 'غيّر خطاب التخصيص' : 'ارفع خطاب التخصيص'}<input type="file" accept="image/*" data-up="letter" hidden></label></div></div>`;
    if (isUnit(r) && d && d.unit && r.listing_id) {
      const rp = S.rem.find((x) => x.listing_id === r.listing_id && x.state === 'pending');
      if (d.unit.state === 'hidden') h += '<div class="chips"><span class="chip c-bad">القطعة اتشالت من الموقع</span></div>';
      else if (rp) h += `<div class="chips"><span class="chip c-warn">مستني موافقة على شيل القطعة من الموقع</span></div>`;
      else if (d.unit.state === 'approved' && canRmAsk) h += '<button class="btn sm" data-a="sub" data-v="rmask">اطلب شيل القطعة من الموقع</button>';
    }
    if ((canDrop && r.stage !== 'closed') || canDel) h += `<div class="blk" data-fold="q_admin"><h3>إدارة</h3><div class="chips">${canDrop && r.stage !== 'closed' ? '<button class="btn sm" data-a="sub" data-v="drop">شيله من المسار</button>' : ''}${canDel ? '<button class="btn sm red" data-a="rdel">امسحه نهائي</button>' : ''}</div></div>`;
    if (d) {
      const items = d.events.map((e) => ({ at: T(e.at), who: e.who, txt: e.body })).concat(d.notes.map((n) => ({ at: T(n.at), who: n.who, role: n.role, txt: n.kind === 'instr' ? 'تعليمات' : 'ملاحظة', note: n.body, instr: n.kind === 'instr' }))).sort((a, b) => b.at - a.at);
      h += `<div class="blk" data-fold="q_log"><h3>السجل</h3><div class="log">${items.map((x) => `<div class="lg"><span>${x.who ? `<b>${esc(x.who)}</b>${x.role ? ' <span class="sub">· ' + (ROLES[x.role] || '') + '</span>' : ''} — ` : ''}${esc(x.txt)}</span><time class="num">${when(x.at)}</time>${x.note ? `<q class="${x.instr ? 'instr' : ''}">${esc(x.note)}</q>` : ''}</div>`).join('')}</div></div>`;
    }
    const b = [];
    if (R !== 'gm' && r.stage !== 'closed') b.push('<button class="btn ghost" data-a="sub" data-v="note">ملاحظة</button>');
    if (R === 'tl' && r.tl_id === me.id && informed(r) && !r.tl_ack && r.stage !== 'closed') b.push(`<button class="btn" data-a="ack"${busy ? ' disabled' : ''}>شفته</button>`);
    if (mine) {
      const upLabel = r.stage === 'up_sup' && ((r.tl_id && !informed(r)) || isVerify(r)) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن';
      const A = r.via === 'ask' ? [['close', 'اقفل الطلب', 'pri']] : {
        new: [['fwd', 'حوّل', 'pri']], tl: isVerify(r) ? [['vassign1', 'وزّعه على مشرف', 'pri']] : [['confirm', 'أكّد وحوّل', 'pri']], sup: [['assign', 'اختار السيلز', 'pri']], sales: [['finish', 'خلّصت', 'pri']],
        up_sup: r.outcome === 'lost' || r.outcome === 'unfit' ? [['cx', 'اختار الإجراء', 'pri']] : [['down', 'رجّعه للسيلز', ''], ['up', upLabel, 'pri']], up_tl: [['down', 'رجّعه للمشرف', ''], isVerify(r) ? ['vclose', 'اعتمد', 'pri'] : ['up', 'ابعته للسيلز أدمن', 'pri']], up_sa: [['down', 'رجّعه', ''], ['close', isOffer(r) ? (r.outcome === 'ready' ? 'انشره' : 'اعتمد الرفض') : 'اقفل الطلب', 'pri']] }[r.stage] || [];
      A.forEach((a) => b.push(a[0] === 'vassign1' ? `<button class="btn ${a[2]}" data-a="vassign" data-id="${r.id}">${a[1]}</button>` : `<button class="btn ${a[2]}" data-a="sub" data-v="${a[0]}">${a[1]}</button>`));
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
  const unsoundPick = (f) => `<div class="fld"><span>السبب</span><div class="pick">${UNSOUND.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}${opt('reason', 'other', f.reason === 'other', 'أخرى')}</div>${f.reason === 'other' ? `<input type="text" data-f="other" maxlength="180" value="${esc(f.other || '')}" placeholder="اكتب السبب">` : ''}</div>`;
  const unfitReason = (f) => (f.reason === 'other' ? ((f.other || '').trim() ? 'أخرى: ' + f.other.trim() : '') : f.reason || '');
  const salesPick = (f) => { const sug = suggestSales(), team = allSales(); return `<div class="fld"><span>السيلز</span>${team.length ? `<div class="pick">${team.map((p) => { const c = counts(p.id), on = p.avail !== false; return opt('sales', p.id, f.sales === p.id, esc(p.name), (on ? 'متاح' : 'مش متاح') + ` · ${c.open} في إيده` + (c.late ? ` · ${c.late} متأخر` : ''), sug && sug.id === p.id ? ' <span class="tag-s">مقترح</span>' : '', !on, 1); }).join('')}</div>` : '<span class="sub">مفيش سيلز متسجلين.</span>'}</div>`; };
  // Editing a plot: everything the seller's form on the site has (place, state, area, details, the payment items
  // and dates, the seller). المتبقي = the items; السعر الكلي = المطلوب دفعه + المتبقي; the installments left follow the dates.
  const STG = [['not_completed', 'مخصصة، غير مستكملة'], ['completed', 'مستكملة، غير مستلمة'], ['received', 'مستلمة']];
  const K_INST = 3;
  function editInit(r) { const u = (DETAIL[r.id] || {}).unit || {}; return plotFields({ ...u, plot_number: u.plot, phone: u.owner_phone }); }
  const uploaderLine = (name, p2) => (name ? `<div class="w upl"><span>رفعها</span><b>${esc(name)} · التواصل مع البائع عن طريقه بس</b></div>` : p2 ? `<div class="w"><span>رقم تاني</span><b dir="ltr" style="text-align:right">${esc(p2)}</b></div>` : '');
  function plotFields(x) {
    const n = (v) => (v == null || v === '' ? '' : String(Number(v))), pay = x.pay || {}, it = (k) => { const i = (pay.items || []).find((y) => y.k === k); return i && i.amt != null ? String(Number(i.amt)) : ''; };
    let iv = pay.inst_value != null ? String(Number(pay.inst_value)) : '';
    if (!iv && it('inst') && Number(x.inst_left)) iv = String(Math.round(Number(it('inst')) / Number(x.inst_left)));
    return { zone: x.zone || 'القادسية', district: x.district ?? '', neighborhood: x.neighborhood ?? '', block: x.block || '', plot_number: x.plot_number || '', area_orig: n(x.area_orig), area_final: n(x.area_final),
      facade: x.facade || '', view_type: x.view_type || '', price: n(x.price), paid: n(x.paid), inst_left: x.inst_left ?? '', description: x.description || '', name: x.owner_name || '', phone: x.phone || '', phone2: x.phone2 || '',
      stage: x.stage || '', on_list: x.on_list == null ? '' : x.on_list ? 'yes' : 'no', check_paid: x.check_paid == null ? '' : x.check_paid ? 'yes' : 'no',
      it_check: it('check'), it_waiver: it('waiver'), it_comp: it('comp'), inst_value: iv, comp_due: pay.completion_due || '', inst_first: pay.inst_first || '', inst_last: pay.inst_last || '' };
  }
  const numOf = (x) => { const s0 = String(x ?? '').trim().replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/,/g, ''); return s0 === '' || isNaN(s0) ? null : Number(s0); };
  const ymN = (v) => (/^\d{4}-\d{2}$/.test(v || '') ? Number(v.slice(0, 4)) * 12 + Number(v.slice(5, 7)) - 1 : null);
  // what the payment part of the form works out to, the same way the site form does
  function editCalc(f) {
    const alloc = f.district !== '', received = alloc && f.stage === 'received';
    const showCheck = !alloc && f.check_paid === 'no', showComp = !alloc || f.stage === 'not_completed';
    const a = ymN(f.inst_first), b = ymN(f.inst_last), d0 = new Date(), nowN = d0.getFullYear() * 12 + d0.getMonth();
    const sched = a != null && b != null && b >= a ? Array.from({ length: K_INST }, (_, i) => Math.round(a + ((b - a) * i) / (K_INST - 1))) : null;
    const left = received ? (sched ? K_INST - sched.filter((m) => m <= nowN).length : (f.inst_left === '' ? null : Number(f.inst_left))) : K_INST;
    const iv = numOf(f.inst_value), items = [];
    if (showCheck) items.push(['check', 'شيك التقنين', numOf(f.it_check)]);
    items.push(['waiver', 'التنازل', numOf(f.it_waiver)]);
    if (showComp) items.push(['comp', 'الاستكمال', numOf(f.it_comp)]);
    items.push(['inst', 'الأقساط', iv != null && left != null ? Math.round(iv * left) : null]);
    const any = items.some((x) => x[2] != null), rem = any ? items.reduce((t, x) => t + (x[2] || 0), 0) : null, paid = numOf(f.paid);
    return { alloc, received, showCheck, showComp, sched, left, items, any, rem, price: any && paid != null ? paid + rem : numOf(f.price) };
  }
  const tx = (k, f, label, num) => `<label class="fld"><span>${label}</span><input type="text" data-f="${k}" value="${esc(f[k])}"${num ? ' inputmode="decimal" dir="ltr" style="text-align:right"' : ''}></label>`;
  const mo = (k, f, label) => `<label class="fld"><span>${label}</span><input type="month" data-f="${k}" value="${esc(f[k])}" dir="ltr"></label>`;
  const chips1 = (k, f, list, label) => `<div class="fld"><span>${label}</span><div class="rch">${list.map((x) => { const v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return `<button data-a="tg1" data-k="${k}" data-v="${esc(v)}" class="${String(f[k]) === String(v) ? 'on' : ''}">${esc(l)}</button>`; }).join('')}</div></div>`;
  function editTotals(f) {
    const c = editCalc(f);
    return `<div class="kv">${c.items.map(([, l, v]) => `<div><span>${l}</span><b>${v == null ? '—' : fmt(v) + ' ج.م'}</b></div>`).join('')}
      <div><span>المتبقي (للجهاز)</span><b>${c.rem == null ? '—' : fmt(c.rem) + ' ج.م'}</b></div><div><span>السعر الكلي</span><b>${c.price == null ? '—' : fmt(c.price) + ' ج.م'}</b></div>
      ${c.received ? `<div><span>الأقساط المتبقية</span><b>${c.left == null ? '—' : c.left + ' من ' + K_INST}</b></div>` : ''}</div>${c.any ? '<span class="sub">السعر الكلي بيتحسب لوحده: المطلوب دفعه + المتبقي.</span>' : ''}`;
  }
  // the parts that appear or go away while typing (manual installments left, manual total price)
  const editCondKey = (f) => { const c = editCalc(f); return (c.received && !c.sched ? 'L' : '') + (c.any ? '' : 'P'); };
  function editCond(f) { const c = editCalc(f);
    return (c.received && !c.sched ? chips1('inst_left', f, [0, 1, 2, 3], 'الأقساط المتبقية (أو اختار أول وآخر قسط وتتحسب لوحدها)') : '') + (c.any ? '' : tx('price', f, 'السعر الكلي (لو مفيش بنود)', 1)); }
  function editBody(f) {
    const c = editCalc(f);
    let h = `<section class="card" data-fold="e_place"><h3>المكان</h3><div><div class="seg">${Object.keys(ZONES).map((z) => `<button class="${f.zone === z ? 'on' : ''}" data-a="set" data-k="zone" data-v="${z}">${z}</button>`).join('')}</div>
      <div class="fld"><span>الحي</span><div class="rch"><button data-a="set" data-k="district" data-v="" class="${f.district === '' ? 'on' : ''}">غير مخصصة</button>${ZONES[f.zone].map((d) => `<button data-a="set" data-k="district" data-v="${d}" data-num="1" class="${Number(f.district) === d && f.district !== '' ? 'on' : ''}">${d}</button>`).join('')}</div></div>
      ${c.alloc ? chips1('neighborhood', f, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'المجاورة') + `<div class="g2">${tx('block', f, 'البلوك')}${tx('plot_number', f, 'رقم القطعة')}</div>` : ''}</div></section>`;
    h += `<section class="card" data-fold="e_state"><h3>حالة القطعة</h3><div>${c.alloc ? chips1('stage', f, STG, 'وصلت لفين؟') : chips1('on_list', f, [['yes', 'على الكشف'], ['no', 'مش على الكشف']], 'على الكشف؟') + chips1('check_paid', f, [['yes', 'مدفوع'], ['no', 'مش مدفوع']], 'شيك التقنين')}</div></section>`;
    h += `<section class="card" data-fold="e_area"><h3>المساحة</h3><div class="g2">${tx('area_orig', f, 'أصل المساحة (م²)', 1)}${tx('area_final', f, 'بعد التقنين (م²)', 1)}</div></section>`;
    if (c.alloc) h += `<section class="card" data-fold="e_more"><h3>تفاصيل القطعة</h3><div>${chips1('facade', f, FACADES, 'الواجهة')}${chips1('view_type', f, VIEW_TYPES, 'القطعة قدامها')}</div></section>`;
    h += `<section class="card" data-fold="e_money"><h3>الفلوس</h3><div>${tx('paid', f, 'المطلوب دفعه (للبائع)', 1)}
      <span class="sub">بنود المتبقي (للجهاز):</span>${c.showCheck ? tx('it_check', f, 'شيك التقنين', 1) : ''}${tx('it_waiver', f, 'التنازل', 1)}${c.showComp ? tx('it_comp', f, 'الاستكمال', 1) + mo('comp_due', f, 'موعد الاستكمال') : ''}
      ${tx('inst_value', f, 'قيمة القسط الواحد (' + K_INST + ' أقساط)', 1)}<div class="g2">${mo('inst_first', f, 'موعد أول قسط')}${mo('inst_last', f, 'موعد آخر قسط')}</div>
      <div id="edcond" data-k="${editCondKey(f)}">${editCond(f)}</div><div id="edtot">${editTotals(f)}</div></div></section>`;
    h += `<section class="card" data-fold="e_seller"><h3>البائع والوصف</h3><div><div class="g2">${tx('name', f, 'اسم البائع')}${tx('phone', f, 'رقم البائع', 1)}</div>${tx('phone2', f, 'رقم هاتف تاني (اختياري)', 1)}
      <label class="fld"><span>الوصف</span><textarea data-f="description" rows="3" maxlength="1000">${esc(f.description)}</textarea></label></div></section>`;
    return h;
  }
  function editPayload(f) {
    const c = editCalc(f), ao = numOf(f.area_orig), af = numOf(f.area_final), paid = numOf(f.paid), price = c.price;
    const phone = String(f.phone || '').trim().replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/\D/g, '');
    if (c.alloc && !ZONES[f.zone].includes(Number(f.district))) return 'اختار حي من أحياء ' + f.zone + '.';
    if (!(ao > 0) && !(af > 0)) return 'اكتب المساحة: أصل المساحة أو بعد التقنين.';
    if (paid == null || paid < 0) return 'اكتب المطلوب دفعه.';
    if (!(price > 0)) return 'اكتب بنود المتبقي أو السعر الكلي.';
    if (paid > price) return 'المطلوب دفعه أكبر من السعر الكلي.';
    if (c.received && c.left == null) return 'اختار أول وآخر قسط، أو عدد الأقساط المتبقية.';
    if ((f.name || '').trim().length < 2) return 'اكتب اسم البائع.';
    if (!/^01[0125]\d{8}$/.test(phone)) return 'رقم البائع مش صح.';
    const phone2 = String(f.phone2 || '').trim().replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/\D/g, '');
    if (phone2 && !/^01[0125]\d{8}$/.test(phone2)) return 'الرقم التاني مش صح، أو سيبه فاضي.';
    const p = { zone: f.zone, district: c.alloc ? Number(f.district) : '', neighborhood: c.alloc && f.neighborhood !== '' ? Number(f.neighborhood) : '', block: c.alloc ? f.block : '', plot_number: c.alloc ? f.plot_number : '',
      area_orig: ao, area_final: af, facade: c.alloc ? f.facade : '', view_type: c.alloc ? f.view_type : '', price, paid, inst_left: c.left == null ? '' : c.left, description: f.description || '', name: f.name.trim(), phone, phone2,
      stage: c.alloc ? f.stage || '' : '', on_list: c.alloc || !f.on_list ? null : f.on_list === 'yes', check_paid: c.alloc || !f.check_paid ? null : f.check_paid === 'yes' };
    if (c.any) p.pay = { items: c.items.filter((x) => x[2] != null).map((x) => ({ k: x[0], amt: x[2] })), inst_value: numOf(f.inst_value), inst_count: K_INST, inst_left: c.left, inst_paid: c.left == null ? null : K_INST - c.left,
      completion_due: c.showComp ? f.comp_due || null : null, inst_first: f.inst_first || null, inst_last: f.inst_last || null, auto: false };
    return p;
  }
  function suggestSales() { return allSales().filter((p) => p.avail !== false).sort((a, b) => counts(a.id).open - counts(b.id).open || counts(a.id).late - counts(b.id).late)[0] || null; }
  const ACT = {
    fwd: { t: 'حوّل الطلب',
      init: () => { const tls = byRole('tl'); return { mode: tls.length ? 'confirm' : 'info', tl: tls.length === 1 ? tls[0].id : null }; },
      body: (r, f) => { const hasTl = byRole('tl').length > 0; return (hasTl ? `<div class="pick">${opt('mode', 'confirm', f.mode === 'confirm', 'للتيم ليدر', 'هو يأكد ويحوّل للمشرف')}${opt('mode', 'info', f.mode === 'info', 'للمشرف على طول', 'والتيم ليدر يتبلّغ بس')}</div>` : '<span class="sub">مفيش تيم ليدر متسجل، فالطلب هيروح للمشرف على طول.</span>') + (hasTl ? tlPick(f) : '') + (f.mode === 'info' ? supPick(f) : '') + noteF(f) + minsPick(f); },
      ok: (f) => (f.mode === 'confirm' ? !!f.tl : !!f.sup) && !!f.mins, btn: (f) => (f.mode === 'info' ? (f.sup ? 'ابعته لـ' + P(f.sup).name : 'اختار المشرف') : f.tl ? 'ابعته للتيم ليدر' : 'اختار التيم ليدر'),
      run: (r, f) => act(r.id, { a: 'forward', tl_id: f.tl || null, sup_id: f.mode === 'info' ? f.sup : null, mode: f.mode, mins: f.mins, note: f.note }, 'اتحوّل', 2) },
    confirm: { t: 'أكّد وحوّل', init: () => ({ via: 'sup' }),
      body: (r, f) => `<div class="pick">${opt('via', 'sup', f.via === 'sup', 'لمشرف', 'المشرف يختار ' + (isOffer(r) ? 'العضو اللي يراجع' : 'السيلز'))}${opt('via', 'sales', f.via === 'sales', isOffer(r) ? 'لعضو على طول' : 'لسيلز على طول', 'وتختار المشرف اللي الرجوع هيعدّي عليه')}</div>`
        + (f.via === 'sales' ? salesPick(f) : '') + supPick(f) + noteF(f) + minsPick(f),
      ok: (f) => !!f.sup && !!f.mins && (f.via !== 'sales' || !!f.sales),
      btn: (f) => (f.via === 'sales' ? (f.sales ? 'اديه لـ' + P(f.sales).name : 'اختار ' + 'السيلز') : f.sup ? 'ابعته لـ' + P(f.sup).name : 'اختار المشرف'),
      run: (r, f) => act(r.id, { a: 'confirm', sup_id: f.sup, sales_id: f.via === 'sales' ? f.sales : null, mins: f.mins, note: f.note }, f.via === 'sales' ? 'اتبعت لـ' + P(f.sales).name : 'اتبعت للمشرف', 2) },
    assign: { t: 'اختار السيلز', init: () => { const s = suggestSales(); return { sales: s ? s.id : null }; },
      body: (r, f) => { const sug = suggestSales(), team = allSales(); return (team.length ? `<div class="pick">${team.map((p) => { const c = counts(p.id), on = p.avail !== false; return opt('sales', p.id, f.sales === p.id, esc(p.name), (on ? 'متاح' : 'مش متاح') + ` · ${c.open} في إيده` + (c.late ? ` · ${c.late} متأخر` : '') + (p.activated ? '' : ' · لسه ما فعّلش'), sug && sug.id === p.id ? ' <span class="tag-s">مقترح</span>' : '', !on, 1); }).join('')}</div><span class="sub">المقترح: المتاح اللي في إيده أقل شغل.</span>` : '<div class="empty">مفيش سيلز متسجلين.</div>') + noteF(f) + minsPick(f); },
      ok: (f) => !!f.sales && !!f.mins, btn: (f) => (f.sales ? 'اديه لـ' + P(f.sales).name : 'اختار'),
      run: (r, f) => act(r.id, { a: 'assign', sales_id: f.sales, mins: f.mins, note: f.note }, 'اتبعت لـ' + P(f.sales).name, 2) },
    finish: { t: 'خلّصت', body: (r, f) => (isVerify(r) ? `<div class="pick">${opt('out', 'sound', f.out === 'sound', 'تمام، توثّق')}${opt('out', 'unsound', f.out === 'unsound', 'مش سليمة')}</div>${f.out === 'unsound' ? unsoundPick(f) : ''}${noteF(f, 'ملاحظات (اختياري)')}${minsPick(f)}` : isOffer(r) ? `<div class="pick">${opt('out', 'ready', f.out === 'ready', 'جاهز للنشر')}${opt('out', 'unfit', f.out === 'unfit', 'مش مناسب')}</div>${f.out === 'unfit' ? unfitPick(f) : ''}${noteF(f, 'ملخص (اختياري)')}${minsPick(f)}` : `<div class="pick">${opt('out', 'sold', f.out === 'sold', 'اتباع')}${opt('out', 'lost', f.out === 'lost', 'ما اتباعش')}</div>${f.out === 'lost' ? `<div class="fld"><span>السبب</span><div class="pick">${LOST.map((w) => opt('reason', esc(w), f.reason === w, esc(w))).join('')}</div></div>` : ''}${noteF(f, 'ملخص (اختياري)')}${minsPick(f)}`),
      ok: (f, r) => (isVerify(r) ? (f.out === 'sound' || (f.out === 'unsound' && !!unfitReason(f))) : isOffer(r) ? (f.out === 'ready' || (f.out === 'unfit' && !!unfitReason(f))) : (f.out === 'sold' || (f.out === 'lost' && !!f.reason))) && !!f.mins, btn: () => 'ابعته للمشرف',
      run: (r, f) => act(r.id, { a: 'return', outcome: f.out, reason: f.out === 'lost' ? f.reason : f.out === 'unfit' || f.out === 'unsound' ? unfitReason(f) : '', summary: f.note, mins: f.mins }, 'اتبعت للمشرف', 2) },
    vclose: { t: 'اعتمد التوثيق', init: (r) => { const f = { out: r.outcome }; if (r.outcome === 'unsound' && r.outcome_reason) { if (UNSOUND.includes(r.outcome_reason)) f.reason = r.outcome_reason; else { f.reason = 'other'; f.other = r.outcome_reason.replace(/^أخرى: /, ''); } } return f; },
      body: (r, f) => `<div class="pick">${opt('out', 'sound', f.out === 'sound', 'القطعة سليمة', 'تبقى موثقة ✓')}${opt('out', 'unsound', f.out === 'unsound', 'مش سليمة', 'تختفي من الموقع (من غير ما تتمسح)')}</div>${f.out === 'unsound' ? unsoundPick(f) : ''}` + noteF(f),
      ok: (f) => f.out === 'sound' || (f.out === 'unsound' && !!unfitReason(f)), btn: (f) => (f.out === 'sound' ? 'اعتمد: موثقة' : 'اعتمد وخبّيها'),
      run: (r, f) => act(r.id, { a: 'close', outcome: f.out, reason: f.out === 'unsound' ? unfitReason(f) : '', note: f.note }, f.out === 'sound' ? 'القطعة بقت موثقة' : 'القطعة اتخفت من الموقع', 2) },
    drop: { t: 'شيله من المسار', body: (r, f) => `<span class="sub">${isOffer(r) ? 'العرض' : 'الطلب'} هيتقفل كـ"اتشال من المسار" ومش هيتحسب كبيعة اتلغت. اللي ماسكينه هيوصلهم تنبيه.</span>` + noteF(f, 'السبب (إجباري)'),
      ok: (f) => !!(f.note || '').trim(), btn: () => 'شيله من المسار',
      run: (r, f) => act(r.id, { a: 'drop', note: f.note.trim() }, 'اتشال من المسار', 1) },
    rmask: { t: 'اطلب شيل القطعة من الموقع', body: (r, f) => `<span class="sub">الطلب بيروح للويب أدمن والسيلز أدمن، ولو وافقوا القطعة بتختفي من الموقع من غير ما تتمسح، ويقدروا يرجّعوها.</span>` + noteF(f, 'السبب (إجباري)'),
      ok: (f) => !!(f.note || '').trim(), btn: () => 'ابعت الطلب',
      run: async (r, f) => { if (await rpcToast('listing_remove_ask', { p_listing: r.listing_id, p_reason: f.note.trim() }, 'اتبعت للويب أدمن والسيلز أدمن')) { UI.stack.pop(); await load(); } } },
    late: { t: 'اتأخر في الرد', body: (r, f) => `<span class="sub">بيتسجل في سجل ${isOffer(r) ? 'العرض' : 'الطلب'} والمشرف بيشوفه، والمهلة بتتمد ساعتين، والتأخير ده بيتحسب على ${isOffer(r) ? 'البائع' : 'العميل'} مش عليك.</span>` + noteF(f, 'حصل إيه؟ (اختياري)'),
      ok: () => true, btn: () => 'سجّل ومدّ المهلة ساعتين',
      run: (r, f) => act(r.id, { a: 'late', note: f.note }, 'اتسجل والمهلة اتمدّت ساعتين', 1) },
    edit: { t: 'صلّح بيانات القطعة', init: (r) => editInit(r), body: (r, f) => editBody(f), ok: () => true, btn: () => 'احفظ التعديلات',
      run: async (r, f) => { const p = editPayload(f); if (typeof p === 'string') { toast(p); return; }
        if (await rpcToast('admin_update_listing', { p_id: r.listing_id, p }, 'البيانات اتحفظت')) { UI.stack.pop(); delete DETAIL[r.id]; UI.stack.forEach((L) => { if (L.id === r.id) L.loading = false; }); await load(); } } },
    up: { t: 'وافق وابعته لفوق', body: (r, f) => noteF(f) + minsPick(f), ok: (f) => !!f.mins, btn: (f, r) => (r.stage === 'up_sup' && ((r.tl_id && !informed(r)) || isVerify(r)) ? 'ابعته للتيم ليدر' : 'ابعته للسيلز أدمن'),
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
  const noteKey = (b) => String(b || '').split(':')[0].replace(/\s*[A-Z]\d{4}-\d+\s*\(R-\d+\)|\s*[A-Z]\d{4}-\d+|\s*R-\d+/g, '').replace(/\s+/g, ' ').trim();
  function vBell(L) {
    const groups = [];
    S.notes.forEach((n) => { const k = noteKey(n.body), g = groups[groups.length - 1]; if (g && g.k === k) g.items.push(n); else groups.push({ k, items: [n] }); });
    const one = (n, sub) => `<button class="lg${n.read ? '' : ' new'}${sub ? ' sub1' : ''}" data-a="note" data-id="${n.id}" style="text-align:right"><span>${esc(n.body)}</span><time class="num">${when(T(n.at))}</time></button>`;
    const html = groups.map((g) => { if (g.items.length === 1) return one(g.items[0]);
      const id = g.items[0].id, open = L && L.exp && L.exp[id], unread = g.items.some((n) => !n.read);
      return `<button class="lg${unread ? ' new' : ''}" data-a="bellgrp" data-v="${id}" style="text-align:right"><span>${esc(g.k)} <b class="bcnt num">${g.items.length}</b> <small>${open ? '▴' : '▾'}</small></span><time class="num">${when(T(g.items[0].at))}</time></button>${open ? g.items.map((n) => one(n, true)).join('') : ''}`; }).join('');
    return { t: 'التنبيهات', b: (S.notes.some((n) => !n.read) ? '<button class="btn sm" data-a="readall" style="justify-self:start">علّم الكل اتقرا</button>' : '') + (S.notes.length ? `<div class="log">${html}</div>` : '<div class="empty">مفيش تنبيهات.</div>'), f: '' };
  }
  function vPerson(L) { const p = P(L.id); return { t: p.name + ' · ' + (ROLES[p.role] || ''), b: personDetail(L.id), f: '' }; }
  function vAdd(L) {
    return { t: 'ضيف عضو', b: `<label class="fld"><span>الاسم</span><input type="text" data-f="name" value="${esc(L.f.name || '')}"></label><label class="fld"><span>رقم الموبايل (بيدخل بيه)</span><input type="tel" inputmode="tel" data-f="phone" value="${esc(L.f.phone || '')}" placeholder="01xxxxxxxxx" dir="ltr" style="text-align:right"></label>
      <div class="fld"><span>الدور</span><div class="rch">${myRoles().map((x) => `<button data-a="set" data-k="role" data-v="${x}" class="${L.f.role === x ? 'on' : ''}">${ROLES[x]}</button>`).join('')}</div></div>`,
      f: `<button class="btn pri" data-a="addgo"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'ضيف واطلع كود التفعيل'}</button>` };
  }
  function vCode(L) {
    return { t: L.reset ? 'كود باسورد جديد' : 'كود التفعيل', b: `<div class="card" style="text-align:center"><span class="sub">ابعت الكود ده لـ${esc(L.name)} (صالح ${L.reset ? '24 ساعة' : '7 أيام'}):</span><b class="bigcode num">${esc(L.code)}</b><button class="btn sm" data-a="copy" data-v="${esc(L.code)}">انسخ الكود</button></div><span class="sub">${L.reset
      ? 'العضو يفتح www.telad-group.com/admin ويدوس "تفعيل أو باسورد جديد"، ويكتب رقمه والكود ده، ويختار باسورد جديد. حسابه وشغله وتنبيهاته زي ما هم، والباسورد القديم بيبطل.'
      : 'العضو يفتح www.telad-group.com/admin ويدوس "تفعيل أو باسورد جديد"، ويكتب رقمه والكود ده، ويختار باسورد لنفسه.'} الكود بيتقفل بعد 5 محاولات غلط.</span>`, f: '' };
  }
  function vMember(L) {
    const p = P(L.id);
    return { t: p.name, b: `<div class="kv"><div><span>الدور</span><b>${ROLES[p.role]}</b></div><div><span>الموبايل</span><b dir="ltr">${esc(p.phone || '')}</b></div><div><span>الحساب</span><b>${p.activated ? 'فعّله' : 'لسه ما فعّلش'}${p.active ? '' : ' · موقوف'}</b></div></div>
      <div class="fld"><label for="mname" style="font-size:13px;font-weight:600">الاسم</label><div style="display:flex;gap:8px"><input id="mname" type="text" data-f="name" maxlength="60" value="${esc(L.f.name ?? p.name)}" style="flex:1;min-width:0"><button class="btn sm" data-a="savename" data-id="${p.id}"${busy ? ' disabled' : ''}>احفظ</button></div></div>
      <div class="fld"><span>غيّر الدور</span><div class="rch">${myRoles().map((x) => `<button data-a="setrole" data-id="${p.id}" data-v="${x}" class="${p.role === x ? 'on' : ''}"${busy ? ' disabled' : ''}>${ROLES[x]}</button>`).join('')}</div><span class="sub">لو عنده طلبات مفتوحة لازم تتحوّل الأول.</span></div>
      <button class="btn" data-a="newcode" data-id="${p.id}">${p.activated ? 'نسي الباسورد؟ كود باسورد جديد' : 'كود تفعيل جديد'}</button>`,
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
  function vRdel(L) { const r = Rq(L.id) || {};
    return { t: 'تمسحه نهائي؟', b: `<span class="sub">R-${L.id}${r.code ? ' · ' + esc(r.code) : ''} هيتمسح نهائي هو وسجله وملاحظاته ومهلاته، ومش هيرجع تاني. لو عايز تقفله بس من غير ما يتمسح، استخدم "شيله من المسار".</span>`,
      f: `<button class="btn" data-a="back">لا، سيبه</button><button class="btn dark" data-a="rdelgo"${busy ? ' disabled' : ''}>امسح نهائي</button>` }; }
  const VIEWS = { geov: vGeov, mapv: vMapv, impv: vImpv, calcplot: vCalcPlot, impdone: vImpDone, prc: vPrcOne, altpw: vAltPw, unst: vUnst, sold: vSold, arch: vArch, lflt: vLFilter, vassign: vVAssign, plot: vPlot, plotedit: vPlotEdit, plotdel: vPlotDel, svc: vSvc, svcnote: vSvcNote, svcdel: vSvcDel, rdel: vRdel, req: vReq, sub: vSub, bell: vBell, person: vPerson, add: vAdd, code: vCode, member: vMember, del: vDel, wa: vWa };

  // ---------- render ----------
  // ---------- phone notifications (19/11) ----------
  // The device registers once ("فعّل الإشعارات"); the server (push_out → edge function push-send) does the rest.
  // On browsers that can't receive them (in-app browsers, an iPhone outside the home-screen app) nothing is shown.
  const PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const PUSH = { state: PUSH_OK ? 'unknown' : 'no', busy: false };
  const PUSH_LATER = 'telad.push.later';
  const u8 = (b) => { const s0 = atob((b + '='.repeat((4 - (b.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s0, (c) => c.charCodeAt(0)); };
  async function pushSave(sub) { const j = sub.toJSON(); const { error } = await sb.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }); if (error) throw error; }
  async function pushCheck() {
    if (!PUSH_OK) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js'), sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') { await pushSave(sub); PUSH.state = 'on'; } else PUSH.state = Notification.permission === 'denied' ? 'denied' : 'off';
    } catch (e) { PUSH.state = 'off'; }
    if (!dead) render();
  }
  async function pushEnable() {
    PUSH.busy = true; let step = 'permission';
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { PUSH.state = perm === 'denied' ? 'denied' : 'off'; return; }
      step = 'register'; const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      step = 'key'; const { data: key, error: ke } = await sb.rpc('push_public_key'); if (ke || !key) throw ke || new Error('no_key');
      step = 'subscribe'; let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const opt = { userVisibleOnly: true, applicationServerKey: u8(key) };
        try { sub = await reg.pushManager.subscribe(opt); } catch (e1) {
          // an old registration made with another key, or a one-off failure of the phone's push service: clean up, try once more
          const old = await reg.pushManager.getSubscription(); if (old) await old.unsubscribe().catch(() => {});
          await new Promise((res) => setTimeout(res, 1200));
          sub = await reg.pushManager.subscribe(opt);
        }
      }
      step = 'save'; await pushSave(sub); PUSH.state = 'on'; toast('الإشعارات اشتغلت على الموبايل ده');
    } catch (e) {
      const name = (e && e.name) || 'Error', msg = String((e && e.message) || e || '');
      sb.rpc('push_log_error', { p_step: step, p_name: name, p_message: msg, p_ua: navigator.userAgent }).then(() => {}, () => {});
      toast(step === 'subscribe' && (name === 'AbortError' || /push service/i.test(msg))
        ? 'خدمة الإشعارات في الموبايل ده مش شغالة. حدّث Chrome وGoogle Play services وجرّب تاني.'
        : 'مقدرناش نشغّل الإشعارات (' + step + '). جرّب تاني.');
    } finally { PUSH.busy = false; if (!dead) render(); }
  }
  // signing out stops this device getting this person's notifications
  async function pushOff() { try { if (!PUSH_OK) return; const reg = await navigator.serviceWorker.getRegistration('/sw.js'), sub = reg && (await reg.pushManager.getSubscription());
    if (sub) await sb.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); } catch (e) { /* nothing to undo */ } }
  function pushBanner() {
    if (PUSH.state === 'denied') return '<div class="pushb"><b>الإشعارات مقفولة على الموبايل ده</b><span class="sub">عشان تفتحها: إعدادات المتصفح ← الإشعارات ← telad-group.com ← اسمح، وبعدين حدّث الصفحة.</span></div>';
    if (PUSH.state !== 'off') return '';
    let later = 0; try { later = Number(localStorage.getItem(PUSH_LATER) || 0); } catch (e) { /* no storage */ }
    if (Date.now() - later < 3 * 24 * 3600e3) return '';
    return `<div class="pushb"><b>خلّي الإشعارات توصلك على الموبايل</b><span class="sub">الجديد واللي راجعلك وملخص المتأخر، حتى لو الداشبورد مقفول.</span><div class="g2"><button class="btn pri" data-a="pushon"${PUSH.busy ? ' disabled' : ''}>${PUSH.busy ? 'استنى...' : '🔔 فعّل الإشعارات'}</button><button class="btn" data-a="pushlater">مش دلوقتي</button></div></div>`;
  }
  // ---------- two linked accounts, one person (19/11: د غادة and ا رغده, supervisor + senior) ----------
  // Each login is kept on this phone only (localStorage, telad.alt); switching swaps the session, and the dashboard
  // reopens as the other account. The password is asked once, the first time.
  const ALT_KEY = 'telad.alt';
  const altGet = () => { try { return JSON.parse(localStorage.getItem(ALT_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const altSet = (o) => { try { localStorage.setItem(ALT_KEY, JSON.stringify(o)); } catch (e) { /* no storage */ } };
  async function altSwitch(password) {
    const a = me.alt; if (!a) return;
    const { data } = await sb.auth.getSession(), cur = data && data.session; if (!cur) return;
    const st = altGet(); st[me.id] = { access_token: cur.access_token, refresh_token: cur.refresh_token };
    if (!password) {
      const t = st[a.id]; if (!t) { UI.stack = UI.stack.filter((L) => L.v !== 'altpw'); push({ v: 'altpw', f: {} }); return; }
      altSet(st); save(); toast('بنبدّل...');
      const { error } = await sb.auth.setSession(t);
      if (error) { delete st[a.id]; altSet(st); await sb.auth.setSession(st[me.id]).catch(() => {}); if (!dead) push({ v: 'altpw', f: {} }); }
      return;
    }
    altSet(st); save();
    const { error } = await sb.auth.signInWithPassword({ email: a.phone + '@admin.telad.app', password });
    if (error) { if (!dead) { busy = false; toast('الباسورد مش صح.'); renderSheet(); } }
  }
  function vAltPw(L) {
    const a = me.alt || {};
    return { t: 'ادخل حسابك ك' + (ROLES[a.role] || ''), b: `<span class="sub">مرة واحدة بس. الموبايل هيفتكر الحساب، والمرة الجاية التبديل بدوسة.</span>
      <label class="fld"><span>الرقم</span><input type="tel" value="${esc(a.phone || '')}" disabled dir="ltr"></label>
      <label class="fld"><span>باسورد حساب ${esc(ROLES[a.role] || '')}</span><input type="password" data-f="pw" autocomplete="current-password" value=""></label>`,
      f: `<button class="btn pri" data-a="altpwgo"${busy ? ' disabled' : ''}>${busy ? 'استنى...' : 'ادخل وبدّل'}</button>` };
  }
  // a tap on a phone notification opens /admin?r=… (or ?svc=… / ?bell=1): open that once the data is in
  let urlOpened = false;
  function openFromUrl() {
    if (urlOpened) return; urlOpened = true;
    let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    const r = Number(q.get('r')), sv = Number(q.get('svc')), bell = q.get('bell'), acct = Number(q.get('acct'));
    if (acct && me.id !== acct) { if (me.alt && me.alt.id === acct) altSwitch(); return; }
    if (!r && !sv && !bell) { if (acct) try { history.replaceState(null, '', location.pathname); } catch (e) { /* keep */ } return; }
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* keep the address */ }
    if (r && Rq(r)) UI.stack = [{ v: 'req', id: r }];
    else if (sv && canSvc) UI.stack = [{ v: 'svc', id: sv }];
    else UI.stack = [{ v: 'bell' }];
    renderSheet();
  }
  function render() {
    if (dead) return;
    const y = window.scrollY;
    $('app').innerHTML = header() + '<main class="pg">' + pushBanner() + vMain() + '</main>'; foldify($('app'));
    window.scrollTo(0, y);
    renderSheet();
  }
  function renderSheet() {
    if (dead) return;
    const ov = $('ov'), L = top();
    if (!L) { if (!ov.hidden) { ov.hidden = true; document.body.style.overflow = ''; } return; }
    const v = S.loaded ? VIEWS[L.v](L) : { t: '', b: '<div class="empty">بنحمّل...</div>', f: '' }, b = $('shB'), st = b.scrollTop, same = ov.dataset.k === String(UI.stack.length) + L.v + (L.id || '');
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
      case 'tab': UI.tab = v; UI.stack = []; render(); window.scrollTo(0, 0); if (v === 'wa') load(); break;
      case 'flt': UI.flt = v; render(); break;
      case 'oflt': UI.oflt = v; render(); break;
      case 'sflt': UI.sflt = v; render(); break;
      case 'pflt': UI.pflt = v; render(); break;
      case 'mn': lt(UI.tab).mn = v; render(); break;
      case 'lfilter': push({ v: 'lflt', t: UI.tab }); break;
      case 'lfv': { const f0 = lt(L.t).f, a0 = f0[b.dataset.k] || (f0[b.dataset.k] = []), i0 = a0.indexOf(v); if (i0 > -1) a0.splice(i0, 1); else a0.push(v); renderSheet(); break; }
      case 'lfclear': lt(L.t).f = {}; renderSheet(); break;
      case 'lfdone': UI.stack.pop(); renderSheet(); render(); break;
      case 'vflt': UI.vflt = v; render(); break;
      case 'vall': { const w = vWait(); if (UI.vsel.size === w.length) UI.vsel.clear(); else w.forEach((r) => UI.vsel.add(r.id)); render(); break; }
      case 'vassign': push({ v: 'vassign', ids: id ? [id] : [...UI.vsel], f: { mins: 1440, note: '', via: 'sup' } }); break;
      case 'vassigngo': { const ids = L.ids, f = L.f, direct = f.via === 'sales'; if (!f.sup || (direct && !f.sales)) break; if (busy) break; busy = true; renderSheet();
        const { data, error } = await sb.rpc('desk_verify_assign', { p_ids: ids, p_sup: f.sup, p_mins: f.mins, p_note: f.note || null, p_sales: direct ? f.sales : null }); busy = false;
        if (error) { toast(errMsg(error)); renderSheet(); break; }
        toast(`اتبعت ${data} ${data === 1 ? 'قطعة' : 'قطع'} لـ${P(direct ? f.sales : f.sup).name}`); ids.forEach((x) => UI.vsel.delete(x)); UI.stack = []; await load(); break; }
      case 'plotopen': push({ v: 'plot', id }); break;
      case 'cmode': CALC.mode = v; render(); break;
      case 'cflt': CALC.flt = v; render(); break;
      case 'cset': { const k = b.dataset.k; if (b.dataset.s === 'o') CALC.o[k] = k === 'waiver' ? v === 'true' : v; else CALC.f[k] = v; render(); break; }
      case 'calcplot': push({ v: 'calcplot', id }); break;
      case 'calcuse': { const x = (CALC.list || []).find((p0) => p0.id === id); if (x) { CALC.f = { ...CALC.f, alloc: 'true', ao: String(x.area_orig ?? ''), pick: String(x.area_final ?? ''), af: String(x.area_final ?? ''),
        stage: x.stage || 'not_completed', first: x.inst_first ? String(x.inst_first).slice(0, 7) : '', paid: x.paid != null ? String(x.paid) : '' }; CALC.mode = 'calc'; UI.stack = []; UI.tab = 'calc'; render(); window.scrollTo(0, 0); } break; }
      case 'plotset': { const lbl = { approved: 'اتنشرت', sold: 'اتعلّمت اتباعت', hidden: 'اتخفت من الموقع' }[v]; if (await rpcToast('admin_set_state', { p_id: L.id, p_state: v }, lbl)) await load(); break; }
      case 'plotedit': { const x = Pl(L.id); if (x) push({ v: 'plotedit', id: L.id, f: plotInit(x) }); break; }
      case 'plotsave': { const pp = editPayload(L.f); if (typeof pp === 'string') return toast(pp); if (await rpcToast('admin_update_listing', { p_id: L.id, p: pp }, 'البيانات اتحفظت')) { UI.stack.pop(); await load(); } break; }
      case 'plotdel': push({ v: 'plotdel', id: L.id }); break;
      case 'arch': push({ v: 'arch', id }); break;
      case 'soldmark': if (SOLDMARK.has(id)) SOLDMARK.delete(id); else SOLDMARK.add(id); renderSheet(); break;
      case 'soldask': push({ v: 'sold', id }); break;
      case 'soldgo': if (await rpcToast('desk_plot_sold', { p_id: L.id }, 'القطعة اتشالت من الموقع')) { SOLDMARK.delete(L.id); UI.stack = []; await load(); } break;
      case 'archgo': if (await rpcToast('listing_archive', { p_listing: L.id }, 'اتحوّلت للأرشيف')) { UI.stack = []; await load(); } break;
      case 'bdsave': { const rd = (k) => { const t = String(($('bd' + k + '_' + v) || {}).value || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[,\s]/g, ''); return t === '' ? null : Number(t); };
        const mn = rd('min'), mx = rd('max'); if (!(mx > 0) || (mn != null && !(mn >= 0 && mn < mx))) return toast('اكتب أرقام صح: الأقصى أكبر من الأدنى.');
        if (await rpcToast('desk_band_set', { p_id: Number(v), p_min: mn, p_max: mx }, 'اتحفظ')) await load(true); break; }
      case 'prcopen': push({ v: 'prc', id }); break;
      case 'impdest': L.f.dest = v; renderSheet(); break;
      case 'impgo': await impGo(L); break;
      case 'mapgo': await mapGo(L); break;
      case 'geogo': await geoGo(L); break;
      case 'prcgo': { if (busy) break; const ok = await rpcToast('price_review_decide', { p_listing: L.id, p_choice: v }, v === 'bomb' ? 'اتنشرت كقنبلة 💣' : 'اتحوّلت للأرشيف'); if (ok) { UI.stack = []; await load(true); } break; }
      case 'plotdelgo': if (await rpcToast('admin_delete_listing', { p_id: L.id }, 'اتمسحت نهائي')) { UI.stack = []; await load(); } break;
      case 'svcopen': push({ v: 'svc', id }); break;
      case 'svcstate': { const x = Sv(L.id); if (!x || x.state === v) break; if (await rpcToast('desk_service_act', { p_id: L.id, p: { a: 'state', state: v } }, 'الحالة: ' + SV_ST[v][0])) await svcReload(L.id); break; }
      case 'svcnote': push({ v: 'svcnote', id: L.id, f: { note: '' } }); break;
      case 'svcnotego': { const n = (L.f.note || '').trim(); if (!n) return toast('اكتب الملاحظة.'); const sid = L.id; if (await rpcToast('desk_service_act', { p_id: sid, p: { a: 'note', note: n } }, 'الملاحظة اتسجلت')) { UI.stack.pop(); await svcReload(sid); } break; }
      case 'svcdel': push({ v: 'svcdel', id: L.id }); break;
      case 'svcdelgo': if (await rpcToast('desk_service_delete', { p_id: L.id }, 'اتمسح نهائي')) { UI.stack = []; await load(); } break;
      case 'rmok': if (await rpcToast('listing_remove_decide', { p_id: id, p_ok: true, p_note: null }, 'القطعة اتشالت من الموقع')) await load(); break;
      case 'rmno': if (await rpcToast('listing_remove_decide', { p_id: id, p_ok: false, p_note: null }, 'اترفض طلب الشيل')) await load(); break;
      case 'rmback': if (await rpcToast('listing_restore', { p_listing: id }, 'القطعة رجعت للموقع')) await load(); break;
      case 'rdel': push({ v: 'rdel', id: L.id }); break;
      case 'rdelgo': if (await rpcToast('desk_delete', { p_id: L.id }, 'اتمسح نهائي')) { UI.stack = []; await load(); } break;
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
      case 'reload': toast('بنحدّث...'); load(true); break;
      case 'signout': altSet({}); pushOff().finally(onSignOut); break;
      case 'altgo': altSwitch(); break;
      case 'altpwgo': { const pw = (L.f.pw || '').trim(); if (!pw) return toast('اكتب الباسورد.'); busy = true; renderSheet(); altSwitch(pw); break; }
      case 'pushon': pushEnable(); break;
      case 'pushlater': try { localStorage.setItem(PUSH_LATER, String(Date.now())); } catch (e) { /* no storage */ } render(); break;
      case 'bellgrp': L.exp = { ...(L.exp || {}), [v]: !(L.exp && L.exp[v]) }; renderSheet(); break;
      case 'listings': if (opts.onListings) opts.onListings(); break;
      case 'sub': { const r = Rq(L.id); if (v === 'close' && isOffer(r)) v2 = 'oclose'; else v2 = v; push({ v: 'sub', id: L.id, k: v2, f: Object.assign({ mins: 120, note: '' }, ACT[v2].init ? ACT[v2].init(r) : {}) }); break; }
      case 'tog': { const a0 = L.f[b.dataset.k] || (L.f[b.dataset.k] = []), i = a0.indexOf(v); if (i > -1) a0.splice(i, 1); else a0.push(v); renderSheet(); break; }
      case 'set': L.f[b.dataset.k] = b.dataset.num ? Number(v) : v; if (b.dataset.k === 'out') L.f.reason = null;
        if (b.dataset.k === 'zone' && L.f.district !== '' && !ZONES[v].includes(Number(L.f.district))) L.f.district = ZONES[v][0]; renderSheet(); break;
      case 'tg1': L.f[b.dataset.k] = L.f[b.dataset.k] === v ? '' : v; renderSheet(); break;
      case 'run': { const r = Rq(L.id), A = ACT[L.k]; if (!A.ok(L.f, r)) return; await A.run(r, L.f); break; }
      case 'status': { const r = Rq(L.id); await act(r.id, { a: 'status', key: v, mins: isVerify(r) ? V_MINS : ST_MINS }, 'اتسجلت الحالة', 0); break; }
      case 'unst': push({ v: 'unst', id: L.id, k: v }); break;
      case 'unstgo': { if (busy) break; busy = true; renderSheet(); const { error } = await sb.rpc('desk_status_undo', { p_id: L.id, p_key: L.k }); busy = false;
        if (error) { toast(errMsg(error)); renderSheet(); break; } const rid = L.id; UI.stack.pop(); delete DETAIL[rid]; UI.stack.forEach((x) => { if (x.id === rid) x.loading = false; }); toast('اتلغت الحالة'); await load(); break; }
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
      case 'newcode': { const c = await rpcToast('staff_new_code', { p_id: id }); if (c) push({ v: 'code', code: c, name: P(id).name, reset: !!P(id).activated }); break; }
      case 'copy': try { await navigator.clipboard.writeText(v); toast('اتنسخ'); } catch (e) { toast('الكود: ' + v); } break;
      default: break;
    }
  }, { signal: ac.signal });
  root.addEventListener('input', (ev) => {
    const t = ev.target, L = top();
    if (t.dataset.cf) { CALC.f[t.dataset.cf] = t.value.replace(/[٠-٩]/g, (c0) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c0)).replace(/[,،\s]/g, '');
      const out = $('calcout'); if (out) { out.innerHTML = calcOut(); foldify(out); } const afw = $('cf_af'); if (afw) afw.hidden = !(Number(CALC.f.ao) >= 751); return; }
    if (t.id === 'calcq') { CALC.q = t.value; const cl = $('calclist'); if (cl) cl.innerHTML = calcList(); return; }
    if (t.id === 'pq') { UI.pq = t.value; const pl = root.getElementById('llist'); if (pl && LTA[UI.tab]) pl.innerHTML = ltList(UI.tab); return; }
    if (t.dataset.f && L && L.f && root.getElementById('edtot')) { L.f[t.dataset.f] = t.value; root.getElementById('edtot').innerHTML = editTotals(L.f);
      const ec = root.getElementById('edcond'), key = editCondKey(L.f); if (ec && ec.dataset.k !== key) { ec.dataset.k = key; ec.innerHTML = editCond(L.f); } } if (!t.dataset.f || !L || !L.f) return; L.f[t.dataset.f] = t.value;
    if (L.v === 'sub') { const btn = root.querySelector('[data-a="run"]'), r = Rq(L.id); if (btn && r) btn.disabled = busy || !ACT[L.k].ok(L.f, r); }
    if (L.v === 'impv') $('shF').innerHTML = vImpv(L).f;
  }, { signal: ac.signal });
  root.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.ch === 'ms' || t.dataset.ch === 'rs') { UI[t.dataset.ch] = t.value; render(); return; }
    if (t.dataset.ch === 'lsort') { lt(UI.tab).sort = t.value; render(); return; }
    if (t.dataset.ch === 'geofile') { const fl = [...(t.files || [])]; t.value = ''; await geoOpen(fl); return; }
    if (t.dataset.ch === 'mapfile') { const f = t.files && t.files[0]; t.value = ''; await mapOpen(f); return; }
    if (t.dataset.ch === 'cnolast') { CALC.noLast = t.checked; render(); return; }
    if (t.dataset.ch === 'impfile') { const f = t.files && t.files[0]; t.value = ''; await impOpen(f); return; }
    if (t.dataset.ch === 'impskip' || t.dataset.ch === 'impsales') { const L = top(); if (L && L.v === 'impv') { if (t.dataset.ch === 'impskip') L.f.skip = t.checked; else L.f.sales = t.value; renderSheet(); } return; }
    if (t.dataset.vsel) { const vid = Number(t.dataset.vsel); if (t.checked) UI.vsel.add(vid); else UI.vsel.delete(vid); render(); return; }
    if (t.dataset.up) { const L = top(), r = L && Rq(L.id); const f = t.files && t.files[0]; t.value = ''; if (r && r.listing_id) await uploadFile(t.dataset.up, f, r.listing_id, r.id); return; }
    if (t.dataset.ch !== 'actas' || busy) return;
    busy = true; t.disabled = true;
    const { error } = await sb.rpc('desk_act_as', { p_staff: t.value ? Number(t.value) : null });
    busy = false;
    if (error) { toast(errMsg(error)); render(); return; }
    toast(t.value ? 'إنت دلوقتي شغال كأنك ' + P(Number(t.value)).name : 'رجعت الأدمن');
    if (opts.onActAs) opts.onActAs();
  }, { signal: ac.signal });
  // Phones drop a page in the background (switching to WhatsApp, the gallery…) and reload it on return. Where the user was
  // (tab, filters, open sheets, half-typed forms, scroll) is kept on this device for a few hours and put back on reload.
  const save = () => { if (dead) return; try {
    localStorage.setItem(KEEP_KEY, JSON.stringify({ at: Date.now(), tab: UI.tab, pq: UI.pq, lt: LT, y: window.scrollY,
      stack: UI.stack.filter((L) => !['altpw', 'impv', 'impdone', 'mapv', 'geov'].includes(L.v)).map((L) => { const o = { ...L }; delete o.loading; return o; }) }));
  } catch (e) { /* storage full or blocked: nothing to keep */ } };
  let saveT = null; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 300); };
  ['click', 'input', 'change'].forEach((k) => root.addEventListener(k, saveSoon, { signal: ac.signal }));
  window.addEventListener('scroll', saveSoon, { signal: ac.signal, passive: true });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); save(); }
    else { if (!me.acting && Date.now() - hiddenAt > 30000) sb.rpc('desk_seen').then(() => {}, () => {}); if (S.err || !S.loaded || Date.now() - hiddenAt > 30000) load(); }
  }, { signal: ac.signal });
  window.addEventListener('pagehide', save, { signal: ac.signal });
  const onKey = (e) => { if (e.key === 'Escape' && top()) { UI.stack.pop(); renderSheet(); } };
  document.addEventListener('keydown', onKey);
  const timer = setInterval(() => { if (document.visibilityState === 'hidden') return; seen(); if (!top()) load(); else sb.rpc('desk_notifications').then(({ data }) => { if (data && !dead) S.notes = data; }); }, 60000);
  try { const k = JSON.parse(localStorage.getItem(KEEP_KEY) || 'null');
    if (k && Date.now() - k.at < 6 * 3600e3) {
      if (k.tab) UI.tab = k.tab; UI.pq = k.pq || ''; Object.assign(LT, k.lt || {});
      if (Array.isArray(k.stack)) UI.stack = k.stack.filter((L) => L && VIEWS[L.v]);
      KEEP.y = k.y || 0;
    }
  } catch (e) { /* a broken saved state is ignored */ }
  const seen = () => { if (!me.acting && document.visibilityState !== 'hidden') sb.rpc('desk_seen').then(() => {}, () => {}); };
  render(); load(); pushCheck(); seen();
  return () => { dead = true; ac.abort(); clearInterval(timer); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
}
