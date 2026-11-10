// Telad public page (approved "الشكل ب"). Reads published listings from Supabase and
// sends offers and requests through the submit_offer / submit_request RPCs.
import { SVC, SVC_ORDER, WHY, LINE, ART } from './solutions';

export function mount(sb, root) {
'use strict';
const WA = '201024151524';
const ZONES = { 'القادسية': [8, 9, 10, 12, 17, 20, 22, 23], 'الأمل': [28, 29, 30, 31, 32, 33, 35, 36] };
const FACADES = ['بحري', 'قبلي', 'شرقي', 'غربي', 'ناصية'];
const VIEWS = ['شارع رئيسي', 'حديقة', 'خدمات', 'داخلي'];

/* ---------- helpers ---------- */
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toEn = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const num = (v) => { const s = toEn(v).replace(/[,\s]/g, ''); return s === '' || isNaN(Number(s)) ? null : Number(s); };
const zoneOf = (n) => Object.keys(ZONES).find((z) => ZONES[z].includes(n)) || '';
const jm = (n) => `<span class="num">${fmt(n)}</span> <small>ج.م</small>`;
const instTxt = (n) => (n === 0 ? 'الأقساط خلصت' : n === 1 ? 'قسط واحد' : n === 2 ? 'قسطين' : `${n} أقساط`);
// Where a unit is: its district, or "غير مخصصة" (no district yet).
const where = (x) => (x.alloc ? `الحي ${x.d}` : 'غير مخصصة');
const STAGE_TXT = { not_completed: 'مخصصة، غير مستكملة', completed: 'مستكملة، غير مستلمة', received: 'مستلمة' };
const PAY_TXT = { check: 'شيك التقنين', waiver: 'التنازل', comp: 'الاستكمال', inst: 'الأقساط' };
const unitStatus = (x) => (x.alloc ? STAGE_TXT[x.stage] || 'مخصصة' : `غير مخصصة · ${x.onList ? 'على الكشف' : 'مش على الكشف'} · الشيك ${x.chk ? 'مدفوع' : 'مش مدفوع'}`);
const ago = (h) => (h < 2 ? 'من ساعة' : h < 24 ? `من ${h} ساعات` : h < 48 ? 'امبارح' : `من ${Math.round(h / 24)} أيام`);
const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Sellers give the original area, the area after legalization, or both.
const areaOf = (x) => x.af || x.ao;
function svcs(x) { const o = []; if (x.v === 'حديقة') o.push('قدام حديقة'); if (x.v === 'خدمات') o.push('قدام خدمات'); if (x.v === 'شارع رئيسي') o.push('على شارع رئيسي'); if (x.f === 'ناصية') o.push('ناصية'); return o; }
function tags(x) { const t = svcs(x).map((s) => `<span class="tag svc">${s}</span>`); if (x.v === 'داخلي') t.push('<span class="tag">داخلي</span>'); if (x.f && x.f !== 'ناصية') t.push(`<span class="tag">واجهة ${x.f}</span>`); return t.length ? `<div class="tags">${t.join('')}</div>` : ''; }

const LOGO = '<svg viewBox="0 0 210 200" aria-hidden="true"><defs><clipPath id="tlc"><rect x="0" y="0" width="210" height="196"/></clipPath></defs><g clip-path="url(#tlc)" fill="none" stroke="currentColor" stroke-width="15"><path d="M12 212 L138 64 A42 42 0 0 1 192 102 L192 212"/><path d="M60 212 L158 97"/><path d="M108 212 L172 137"/></g><g fill="currentColor"><path d="M118 36 L130 22 H158 L146 36 Z"/><path d="M162 36 L174 22 H202 L190 36 Z"/></g></svg>';
const SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
const FILT = '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const BACK = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const XI = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const COPY = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
const WAI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';
const wa = (text, cls, label) => `<a class="${cls}" href="https://wa.me/${WA}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" aria-label="${label || 'تواصل واتساب'}">${WAI}${label || ''}</a>`;
const waUnit = (x) => `السلام عليكم، أنا مهتم بالقطعة ${x.code} ${x.alloc ? 'في الحي ' + x.d : 'غير المخصصة في ' + x.zone} (${areaOf(x)} م²، السعر الكلي ${fmt(x.price)} جنيه).`;
const codeChip = (x) => `<button class="code-chip" data-a="copy" data-code="${esc(x.code)}" aria-label="انسخ كود القطعة ${esc(x.code)}"><span class="num">${esc(x.code)}</span>${COPY}</button>`;

/* ---------- data ---------- */
let U = [], LOADED = false, LOADERR = false;
const toUnit = (r) => ({ id: r.id, code: r.code || '#' + r.id, zone: r.zone, d: r.district, nb: r.neighborhood || '', block: r.block || '',
  ao: r.area_orig == null ? null : Number(r.area_orig), af: r.area_final == null ? null : Number(r.area_final),
  f: r.facade || '', v: r.view_type || '', price: Number(r.price), paid: Number(r.paid), rem: Number(r.remaining), inst: r.inst_left,
  alloc: r.allocated !== false, onList: !!r.on_list, chk: !!r.check_paid, stage: r.stage || '', pay: r.pay || {},
  photo: r.photo_path ? sb.storage.from('listing-photos').getPublicUrl(r.photo_path).data.publicUrl : '',
  h: Math.max(0, Math.round((Date.now() - new Date(r.published_at || r.created_at).getTime()) / 36e5)) });
async function load() {
  const { data, error } = await sb.from('listings')
    .select('id,code,zone,district,neighborhood,block,area_orig,area_final,facade,view_type,price,paid,remaining,inst_left,photo_path,allocated,on_list,check_paid,stage,pay,published_at,created_at')
    .eq('state', 'approved').order('published_at', { ascending: false });
  LOADED = true; LOADERR = !!error; U = (data || []).map(toUnit); render();
}
const ERR = { invalid_phone: 'اكتب رقم موبايل مصري صح، زي 01012345678.', invalid_name: 'اكتب اسمك.', invalid_area: 'اكتب المساحة: أصل المساحة أو بعد التقنين أو الاتنين.',
  too_many_offers: 'بعت إعلانات كتير النهارده من الرقم ده. جرب بكرة أو كلمنا واتساب.', too_many_requests: 'بعت طلبات كتير النهارده. كلمنا واتساب.',
  listing_not_found: 'القطعة دي مش متاحة دلوقتي.', busy: 'فيه ضغط دلوقتي. جرب كمان شوية.' };
const errMsg = (err, fb) => { const m = err?.message || ''; const k = Object.keys(ERR).find((key) => m.includes(key)); return k ? ERR[k] : fb; };

/* ---------- state ---------- */
const S = { zone: 'القادسية', dist: 0, sort: 'price', cmp: [], pick: null };
const CMP_MAX = 4;
const F0 = () => ({ pmax: '', paidMax: '', inst: [], view: [], facade: [] });
let F = F0(), REQ = null, intro = true;
const SORTS = [['price', 'الأرخص أولاً', (a, b) => a.price - b.price], ['priceD', 'الأغلى أولاً', (a, b) => b.price - a.price], ['paid', 'أقل مطلوب دفعه', (a, b) => a.paid - b.paid],
  ['rem', 'أقل متبقي', (a, b) => a.rem - b.rem], ['area', 'الأكبر مساحة', (a, b) => areaOf(b) - areaOf(a)], ['new', 'الأحدث', (a, b) => a.h - b.h]];

/* ---------- حلول تِلاد: services strip, service page (#invest, #develop, ...), two-step request ---------- */
let VIEW = null, SF = null;
const startSF = (k) => { SF = { k, step: 0, a: {}, name: '', phone: '', ch: 'واتساب', time: '', err: '', done: '' }; };
const LEGAL = '<p class="legal">تِلاد كيان عقاري مستقل، غير تابع لجهاز مدينة العبور الجديدة أو أي جهة حكومية.</p>';
function solutionsHTML() {
  const d = S.pick ? SVC[S.pick] : null;
  return `<section class="sol in" id="solutions"><div class="solcard"><h2 class="sol-t">حلول تِـــــــــلاد</h2><p class="sol-s">حلول عقارية متكاملة، في مكان واحد</p><p class="sol-h">اضغط على أي خدمة لعرض تفاصيلها.</p>
    <div class="pkwrap">${SCROLL_ARROWS}<div class="picker" id="picker">${SVC_ORDER.map((k) => `<button class="pk" data-a="pick" data-k="${k}" aria-pressed="${S.pick === k}" aria-expanded="${S.pick === k}"><span class="art">${ART[k]}</span>${SVC[k].short}</button>`).join('')}</div></div>
    ${d ? `<div class="sdetail"><h3>${d.n}</h3><p>${d.promise}</p><div class="soffer">${d.offer.map((o) => `<div>${LINE.tick}<span>${o}</span></div>`).join('')}</div><button class="btn primary" data-a="svc" data-k="${S.pick}">ابدأ طلب ${d.n}</button></div>` : ''}</div></section>`;
}
function whyHTML() {
  return `<section class="sol in"><div class="solcard why"><h2 class="sol-t">لماذا تِـــــــــلاد؟</h2><p class="sol-s">أربعة أسباب تجعل قرارك معنا أوضح</p>
    <div class="why4">${WHY.map(([i, b, s]) => `<div><span class="wic">${LINE[i]}</span><b>${b}</b><small>${s}</small></div>`).join('')}</div>
    <div class="snote"><b>لا تعرف من أين تبدأ؟</b><span>أخبرنا بموقفك، ونحدد معك الخدمة الأنسب.</span><button class="btn primary" data-a="svc" data-k="consult">${LINE.talk}اطلب استشارة</button></div></div>${LEGAL}</section>`;
}
function svcPageHTML(k) {
  const d = SVC[k];
  return `<nav class="nav in" id="nav"><button class="brand" data-a="home" aria-label="تِلاد">${LOGO}<span class="wm">تِـــــــــلاد</span></button><button class="sback" data-a="home">${BACK}الرئيسية</button></nav>
    <header class="svc-hero in"><span class="sic">${ART[k]}</span><span class="eyebrow">حلول تِلاد</span><h1>${d.n}</h1><p>${d.promise}</p></header>
    <div class="in"><section class="sol"><h2 class="s-h2">ما الذي نقدّمه لك</h2><div class="soffer">${d.offer.map((o) => `<div>${LINE.tick}<span>${o}</span></div>`).join('')}</div></section>
    <section class="sol"><h2 class="s-h2">كيف نعمل</h2><div class="how"><div><b>نستمع</b>نفهم موقفك وهدفك</div><div><b>ندرس</b>نحلّل ونقارن بالأرقام</div><div><b>نرافقك</b>حتى إتمام الخطوة</div></div></section>
    <section class="sol" id="sform">${svcFormHTML()}</section>${LEGAL}</div>`;
}
function svcFormHTML() {
  const d = SVC[SF.k];
  if (SF.done) return `<div class="sform sok"><span class="ring">${LINE.tick}</span><h3>تم استلام طلبك</h3><p>سيتواصل معك أحد مستشاري تِلاد عبر ${SF.ch} لاستكمال التفاصيل.</p><span class="lbl">رقم الطلب</span><span class="sref num">${SF.done}</span>${wa(`السلام عليكم، أرسلت طلب ${d.n} رقم ${SF.done}.`, 'btn primary swa', 'تابع طلبك عبر واتساب')}<button class="btn ghost" data-a="home">العودة للرئيسية</button></div>`;
  const head = `<div class="fhead"><b>${SF.step ? 'بيانات التواصل' : 'طلب ' + d.n}</b><span class="fsteps" aria-hidden="true"><i class="on"></i><i class="${SF.step ? 'on' : ''}"></i></span></div>`;
  const err = SF.err ? `<p class="ferr" role="alert">${SF.err}</p>` : '';
  if (!SF.step) {
    return `<div class="sform">${head}${d.q.map((q, i) => (q.area
      ? `<label class="sq"><span>${q.t} <small>(اختياري)</small></span><textarea class="inp" data-sa="${i}" maxlength="500" placeholder="مثال: هل سعر القطعة مناسب لموقعها؟">${esc(SF.a[i] || '')}</textarea></label>`
      : `<div class="sq"><span>${q.t}</span><div class="sopts">${q.o.map((o) => `<button class="sopt" data-a="sq" data-i="${i}" data-v="${esc(o)}" aria-pressed="${SF.a[i] === o}">${o}</button>`).join('')}</div></div>`)).join('')}${err}<button class="btn dark" data-a="snext">متابعة</button></div>`;
  }
  return `<div class="sform">${head}<div class="two"><label class="sq"><span>الاسم</span><input class="inp" data-sf="name" value="${esc(SF.name)}" autocomplete="name" maxlength="80"></label><label class="sq"><span>رقم الهاتف</span><input class="inp num" data-sf="phone" value="${esc(SF.phone)}" type="tel" inputmode="tel" placeholder="01xxxxxxxxx" autocomplete="tel"></label></div>
    <div class="sq"><span>وسيلة التواصل المفضلة</span><div class="sopts">${['واتساب', 'مكالمة هاتفية'].map((o) => `<button class="sopt" data-a="sch" data-v="${o}" aria-pressed="${SF.ch === o}">${o}</button>`).join('')}</div></div>
    <div class="sq"><span>الوقت المناسب للتواصل <small>(اختياري)</small></span><div class="sopts">${['صباحاً', 'مساءً', 'أي وقت'].map((o) => `<button class="sopt" data-a="stime" data-v="${o}" aria-pressed="${SF.time === o}">${o}</button>`).join('')}</div></div>
    ${err}<p class="fnote">${LINE.lock}<span>بياناتك لا يطّلع عليها إلا فريق تِلاد، وتُستخدم للتواصل بشأن طلبك فقط.</span></p>
    <div class="srow"><button class="btn ghost" data-a="sback">رجوع</button><button class="btn primary" data-a="ssend">إرسال الطلب</button></div></div>`;
}
const redrawSF = () => { const f = document.getElementById('sform'); if (f) f.innerHTML = svcFormHTML(); };
function openSvc(k, push = true) {
  startSF(k); VIEW = k; close();
  if (push) history.pushState({ svc: k }, '', '#' + k);
  render(); window.scrollTo(0, 0);
}
function goHome(push = true) {
  if (!VIEW) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  VIEW = null;
  if (push && location.hash) history.pushState({}, '', location.pathname + location.search);
  render(); setTimeout(() => document.getElementById('solutions')?.scrollIntoView({ block: 'start' }), 0);
}
window.addEventListener('popstate', () => {
  const k = location.hash.slice(1);
  if (SVC[k]) { if (VIEW !== k) openSvc(k, false); } else if (VIEW) { VIEW = null; render(); }
});
function svcNext() {
  const d = SVC[SF.k], i = d.q.findIndex((q, j) => !q.area && !SF.a[j]);
  if (i >= 0) { SF.err = 'يرجى اختيار: ' + d.q[i].t + '.'; redrawSF(); return; }
  SF.err = ''; SF.step = 1; redrawSF(); document.getElementById('sform')?.scrollIntoView({ block: 'start' });
}
const svcErr = (err) => { const m = err?.message || '';
  if (m.includes('too_many')) return 'تم إرسال عدد كبير من الطلبات من هذا الرقم اليوم. يمكنك التواصل معنا عبر واتساب.';
  if (m.includes('busy')) return 'هناك ضغط حالياً. يرجى المحاولة بعد قليل.';
  if (m.includes('invalid_phone')) return 'يرجى كتابة رقم هاتف مصري صحيح.';
  return 'تعذّر إرسال الطلب. يرجى المحاولة مرة أخرى.'; };
function svcSend(btn) {
  if (SF.name.trim().length < 2) { SF.err = 'يرجى كتابة الاسم.'; redrawSF(); return; }
  const phone = toEn(SF.phone).replace(/\D/g, '');
  if (!/^01[0125]\d{8}$/.test(phone)) { SF.err = 'يرجى كتابة رقم هاتف مصري صحيح، مثل 01012345678.'; redrawSF(); return; }
  const d = SVC[SF.k], answers = {};
  d.q.forEach((q, i) => { const v = String(SF.a[i] || '').trim(); if (v) answers[q.t] = v.slice(0, 500); });
  const cur = SF; SF.err = ''; btn.disabled = true; btn.textContent = 'جارٍ الإرسال...';
  sb.rpc('submit_service_request', { p: { service: SF.k, answers, name: SF.name.trim(), phone, channel: SF.ch, contact_time: SF.time } }).then(({ data, error }) => {
    if (SF !== cur) return;
    if (error) { SF.err = svcErr(error); redrawSF(); return; }
    SF.done = 'T-' + data; redrawSF(); document.getElementById('sform')?.scrollIntoView({ block: 'start' });
  });
}
const fCount = () => ['pmax', 'paidMax'].filter((k) => num(F[k]) != null).length + ['inst', 'view', 'facade'].filter((k) => F[k].length).length;
const applyF = (l) => l.filter((x) => (num(F.pmax) == null || x.price <= num(F.pmax)) && (num(F.paidMax) == null || x.paid <= num(F.paidMax)) &&
  (!F.inst.length || F.inst.includes(x.inst)) && (!F.view.length || F.view.includes(x.v)) && (!F.facade.length || F.facade.includes(x.f)));
const inZone = () => U.filter((x) => x.zone === S.zone && (!S.dist || (S.dist === 'u' ? !x.alloc : x.d === S.dist)));
const ucnt = (z) => U.filter((x) => x.zone === z && !x.alloc).length;
const distTitle = () => (S.dist === 'u' ? 'غير المخصصة في ' + S.zone : S.dist ? 'الحي ' + S.dist : '');
const cnt = (d) => U.filter((x) => x.d === d).length;
const zcnt = (z) => U.filter((x) => x.zone === z).length;

/* ---------- shell ---------- */
root.innerHTML = `<div id="shell" class="shell intro"><div id="app"></div><div class="dock"><div class="dock-in" id="dock"></div></div>
  <div class="sheet" id="sheet" hidden><div class="scrim" data-a="close"></div><div class="panel" role="dialog" aria-modal="true" aria-labelledby="pT"><div class="p-h"><button class="back" data-a="back" id="pBack"></button><b id="pT"></b></div><div class="p-b" id="pB"></div><div class="p-f" id="pF" hidden></div></div></div>
  <div class="okpop" id="pop" hidden><div class="pop-scrim" data-a="popclose"></div><div class="pop-card" role="dialog" aria-modal="true" aria-labelledby="popT" id="popC"></div></div>
  <div class="toast" id="toast" hidden><span></span></div></div>`;
const $ = (id) => document.getElementById(id);
const shell = $('shell'), app = $('app'), dock = $('dock'), sheet = $('sheet'), pT = $('pT'), pB = $('pB'), pF = $('pF'), pBack = $('pBack');
setTimeout(() => { intro = false; shell.classList.remove('intro'); }, 1400);

/* ---------- cards ---------- */
const cmpBtn = (x) => `<button class="cmpbtn" data-a="cmp" data-id="${x.id}" aria-pressed="${S.cmp.includes(x.id)}"><i></i>قارن</button>`;
function card(x, i) {
  const pct = Math.round((x.paid / x.price) * 100);
  // Compact card: one header row (district + code), price with area, payment bar, tags, then one row of actions.
  const sv = svcs(x).map((s) => `<span class="tag svc">${s}</span>`);
  if (x.v === 'داخلي') sv.push('<span class="tag">داخلي</span>');
  if (x.f && x.f !== 'ناصية') sv.push(`<span class="tag">واجهة ${x.f}</span>`);
  const inst = `<span class="tag inst"><span class="dots" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= x.inst ? 'on' : ''}"></i>`).join('')}</span>${instTxt(x.inst)}</span>`;
  if (!x.alloc) sv.unshift(`<span class="tag">${x.onList ? 'على الكشف' : 'مش على الكشف'}</span>`); else if (x.stage) sv.unshift(`<span class="tag">${STAGE_TXT[x.stage]}</span>`);
  return `<article class="card${S.cmp.includes(x.id) ? ' on' : ''}" style="--i:${i}">
  <div class="c-head"><button class="dbadge${x.alloc ? '' : ' ua'}" data-a="unit" data-id="${x.id}">${x.alloc ? `<span>الحي</span><b class="num">${x.d}</b>${x.nb ? `<small>مجاورة ${x.nb}</small>` : ''}` : `<span>${esc(x.zone)}</span><b>غير مخصصة</b>`}</button>${codeChip(x)}</div>
  <button class="c-top" data-a="unit" data-id="${x.id}" aria-label="افتح تفاصيل القطعة ${esc(x.code)}"><span class="c-price"><span class="lbl">السعر الكلي</span><span class="price"><span class="num" data-count="${x.price}">${fmt(x.price)}</span> <small>ج.م</small></span></span><span class="area"><b class="num">${areaOf(x)}</b><small>م²${x.af ? '' : ' أصل'}</small></span></button>
  <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
  <div class="bar-l"><span>المطلوب دفعه <b class="num" data-count="${x.paid}">${fmt(x.paid)}</b></span><span class="r">المتبقي <b class="num" data-count="${x.rem}">${fmt(x.rem)}</b></span></div>
  <div class="tags">${sv.join('')}${x.inst != null ? inst : ''}</div>
  <div class="acts3"><button class="btn dark" data-a="req" data-id="${x.id}">اطلبها</button>${wa(waUnit(x), 'btn ghost wa-ic', '')}${cmpBtn(x)}</div>
  </article>`;
}

/* ---------- page ---------- */
function countUp() {
  if (RM()) return;
  const els = [...app.querySelectorAll('[data-count]')], t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3); els.forEach((el) => { el.textContent = fmt(Number(el.dataset.count) * (0.8 + 0.2 * e)); }); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -30px 0px' }) : null;
function reveal() { if (!io || RM()) return; app.querySelectorAll('.card').forEach((c) => { if (c.getBoundingClientRect().top > window.innerHeight) { c.classList.add('pre'); io.observe(c); } }); }

function render() {
  if (VIEW) { app.innerHTML = svcPageHTML(VIEW); renderDock(); return; }
  const us = applyF(inZone()).sort(SORTS.find((s) => s[0] === S.sort)[2]), fc = fCount(), zd = ZONES[S.zone];
  const zi = Object.keys(ZONES).indexOf(S.zone);
  const zoneTabs = Object.keys(ZONES).map((z) => `<button role="tab" data-a="zone" data-z="${z}" aria-pressed="${S.zone === z}">${z}<small class="num">${zcnt(z)}</small></button>`).join('');
  let body;
  if (!LOADED) body = '<div class="empty"><b>بنحمّل القطع...</b></div>';
  else if (LOADERR) body = '<div class="empty"><b>مقدرناش نحمّل القطع.</b><button class="btn primary" data-a="reload">جرب تاني</button></div>';
  else if (us.length) body = us.map(card).join('');
  else if (fc) body = '<div class="empty"><b>مفيش قطع بالفلاتر دي.</b><span>وسّع الفلاتر أو امسحها.</span><button class="btn primary" data-a="fclear">امسح الفلاتر</button></div>';
  else body = `<div class="empty"><b>مفيش قطع معروضة ${S.dist === 'u' ? 'غير مخصصة في ' + S.zone : S.dist ? 'في الحي ' + S.dist : 'في ' + S.zone} دلوقتي.</b><span>سيب رقمك ونكلمك أول ما تنزل قطعة.</span><button class="btn primary" data-a="ask">بلّغني لما تنزل قطعة</button></div>`;
  app.innerHTML = `<nav class="nav in" id="nav"><button class="brand" data-a="top" aria-label="تِلاد">${LOGO}<span class="wm">تِـــــــــلاد</span></button><button class="iconbtn" data-a="search" aria-label="ابحث برقم الحي أو كود القطعة">${SEARCH}</button><button class="cta" data-a="offer"><span class="plus">+</span>اعرض قطعتك</button></nav>
    <header class="band in"><h1>العقار <em>قرارٌ</em> لا صفقةٌ</h1><p>أراضي التقنين في القادسية والأمل، وحلول عقارية متكاملة.</p></header>
    <div class="scard"><div class="ztabs" role="tablist" aria-label="التقسيم">${zoneTabs}<i class="zink" style="right:${zi * 50}%"></i></div>
      <p class="pills-l">الحي</p>
      <div class="pkwrap pl">${SCROLL_ARROWS}<div class="pills" role="group" aria-label="أحياء ${S.zone}"><button class="${zcnt(S.zone) ? 'has' : ''}" data-a="dist" data-d="0" aria-pressed="${!S.dist}"><b>الكل</b><small class="num">${zcnt(S.zone)} قطعة</small></button>${zd.map((n) => `<button class="${cnt(n) ? 'has' : 'none'}" data-a="dist" data-d="${n}" aria-pressed="${S.dist === n}" aria-label="الحي ${n}، ${cnt(n)} قطعة"><b class="num">${n}</b><small>${cnt(n) ? cnt(n) + ' قطعة' : 'فاضي'}</small></button>`).join('')}</div></div></div>
    ${solutionsHTML()}
    <div class="in" id="units"><div class="toolbar"><h2>${distTitle() || 'كل أحياء ' + S.zone}</h2><span class="count"><span class="num">${us.length}</span> ${us.length === 1 ? 'قطعة' : 'قطع'}</span></div>
    <div class="lv-ctrl"><button class="lv-fbtn" data-a="filters" aria-pressed="${fc > 0}">${FILT}الفلاتر${fc ? ` <span class="num">(${fc})</span>` : ''}</button><label class="lv-sort"><span>ترتيب حسب</span><select data-sortsel aria-label="ترتيب حسب">${SORTS.map(([k, t]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
    <section class="list in" aria-live="polite">${body}</section>${whyHTML()}`;
  renderDock(); countUp(); reveal(); pkInit();
}
// Services row: animated arrows on both sides hint that it scrolls; each hides at its end.
const SCROLL_ARROWS = '<button class="pk-ar r" data-a="pkscroll" data-dir="1" aria-label="مرّر للسابق" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button><button class="pk-ar l" data-a="pkscroll" data-dir="-1" aria-label="مرّر لعرض المزيد"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>';
function pkSync() {
  app.querySelectorAll('.pkwrap').forEach((w) => {
    const p = w.querySelector('.picker,.pills'); if (!p) return; const max = p.scrollWidth - p.clientWidth, pos = Math.abs(p.scrollLeft);
    const r = w.querySelector('.pk-ar.r'), l = w.querySelector('.pk-ar.l');
    if (r) r.hidden = pos < 24; if (l) l.hidden = max - pos < 24;
  });
}
function pkInit() { app.querySelectorAll('.pkwrap .picker, .pkwrap .pills').forEach((p) => p.addEventListener('scroll', pkSync, { passive: true })); pkSync(); }
function renderDock() {
  const n = S.cmp.length;
  const tray = n ? `<div class="tray" role="status"><span>${n === 1 ? 'اختار قطعة تانية أو أكتر للمقارنة' : `<span class="num">${n}</span> قطع في المقارنة${n >= CMP_MAX ? ' (الحد الأقصى)' : ''}`}</span><button class="btn ghost" data-a="cmpclear">مسح</button>${n >= 2 ? '<button class="btn primary" data-a="compare">قارن</button>' : ''}</div>` : '';
  dock.innerHTML = tray + `<div class="dockrow"><button class="cta big" data-a="offer"><span class="plus">+</span>اعرض قطعتك</button>${wa('السلام عليكم، عايز أستفسر عن أراضي القادسية والأمل.', 'wa-round', '')}</div>`;
}
function syncCmp() {
  app.querySelectorAll('.card').forEach((c) => { const b = c.querySelector('.cmpbtn'); if (!b) return; const on = S.cmp.includes(Number(b.dataset.id)); c.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  renderDock();
}

/* ---------- sheet with a back stack ---------- */
let stack = [];
function draw() {
  const top = stack[stack.length - 1], deep = stack.length > 1;
  pT.textContent = top.title; pB.innerHTML = top.body; pF.innerHTML = top.foot || ''; pF.hidden = !top.foot;
  pBack.innerHTML = deep ? BACK + 'رجوع' : XI; pBack.classList.toggle('x', !deep); pBack.setAttribute('aria-label', deep ? 'رجوع' : 'قفل');
  pB.classList.remove('swap'); void pB.offsetWidth; pB.classList.add('swap'); pB.scrollTop = 0;
  if (top.after) top.after();
}
function push(title, body, foot, after) {
  stack.push({ title, body, foot, after });
  if (sheet.hidden) { sheet.hidden = false; document.body.classList.add('lock'); void sheet.offsetWidth; sheet.classList.add('open'); }
  draw();
}
function replace(title, body, foot, after) { stack = []; push(title, body, foot, after); }
function back() { stack.pop(); if (!stack.length) return close(); draw(); }
function close() { sheet.classList.remove('open'); stack = []; O = null; document.body.classList.remove('lock'); setTimeout(() => { if (!stack.length) sheet.hidden = true; }, 300); }

function openUnit(id) {
  const x = U.find((u) => u.id === id); if (!x) return;
  const pct = Math.round((x.paid / x.price) * 100), sv = svcs(x);
  replace(`${where(x)} · ${areaOf(x)} م²`, `${x.photo ? `<img class="uphoto" src="${esc(x.photo)}" alt="صورة القطعة ${esc(x.code)}" loading="lazy">` : ''}<div class="hero-box"><span class="lbl">السعر الكلي</span><span class="price">${jm(x.price)}</span>
    <div class="bar"><i style="width:${pct}%"></i></div><div class="bar-l"><span>المطلوب دفعه<b class="num">${fmt(x.paid)}</b></span><span class="r">المتبقي<b class="num">${fmt(x.rem)}</b></span></div>
    <span>${codeChip(x)}</span></div>
    <div class="kv"><div><span>المطلوب دفعه <small>(اللي هيتدفع للبائع)</small></span><b>${jm(x.paid)}</b></div><div><span>المتبقي <small>(اللي هيتدفع للجهاز)</small></span><b class="r">${jm(x.rem)}</b></div>${x.inst != null ? `<div><span>الأقساط المتبقية</span><b>${instTxt(x.inst)}</b></div>` : ''}</div>
    ${(x.pay.items || []).length ? `<details class="ri ri-u"><summary><span>بنود المتبقي</span><b>${jm(x.rem)}</b></summary><div class="ri-d">${x.pay.items.map((i) => `<div><span>${PAY_TXT[i.k] || i.k}${i.k === 'inst' && x.inst ? ` (${instTxt(x.inst)})` : ''}</span><b>${i.amt != null ? jm(i.amt) : '—'}</b></div>`).join('')}<p>أسعار استرشادية، والنهائية بيحددها جهاز مدينة العبور الجديدة.</p></div></details>` : ''}
    <div class="kv"><div><span>المكان</span><b>${esc(x.zone)} · ${where(x)}</b></div><div><span>الحالة</span><b>${unitStatus(x)}</b></div>${x.nb || x.block ? `<div><span>المجاورة والبلوك</span><b>${x.nb ? 'مجاورة ' + x.nb : '—'}${x.block ? ' · بلوك <span class="num">' + esc(x.block) + '</span>' : ''}</b></div>` : ''}
      ${x.af ? `<div><span>المساحة بعد التقنين</span><b><span class="num">${x.af}</span> م²</b></div>` : ''}${x.ao ? `<div><span>أصل المساحة</span><b><span class="num">${x.ao}</span> م²</b></div>` : ''}</div>
    ${sv.length || x.f || x.v ? `<div class="badges">${sv.map((t) => `<span class="bdg svc">${t}</span>`).join('')}${x.v === 'داخلي' ? '<span class="bdg">داخلي</span>' : ''}${x.f && x.f !== 'ناصية' ? `<span class="bdg">واجهة ${x.f}</span>` : ''}</div>` : ''}
    <div class="ctx"><button data-a="svc" data-k="valuation">${LINE.value}<span><b>هل السعر مناسب؟</b>اطلب تقييم تِلاد قبل أن تقرر.</span></button><button data-a="svc" data-k="develop">${LINE.build}<span><b>تنوي البناء عليها؟</b>نطوّرها معك أو نشاركك فيها.</span></button></div>
`,
  `<button class="btn ghost" data-a="cmp" data-id="${id}">${S.cmp.includes(id) ? 'شيلها من المقارنة' : 'ضيفها للمقارنة'}</button><button class="btn primary" data-a="req" data-id="${id}">اطلب القطعة</button>${wa(waUnit(x), 'btn ghost wa-ic', '')}`);
}
// Compare 2 to CMP_MAX units side by side; the table scrolls sideways on a phone.
function openCompare() {
  const us = S.cmp.map((id) => U.find((u) => u.id === id)).filter(Boolean); if (us.length < 2) return;
  const rows = [['السعر الكلي', (x) => x.price, 'min', 1], ['المطلوب دفعه', (x) => x.paid, 'min', 1], ['المتبقي', (x) => x.rem, 'min', 1], ['الأقساط', (x) => x.inst ?? '—', '', 0], ['المساحة', (x) => areaOf(x), 'max', 0], ['سعر المتر', (x) => x.price / areaOf(x), 'min', 1]];
  const cell = (x, [, f, best, m]) => { const vals = us.map(f), v = f(x), top = best === 'min' ? Math.min(...vals) : Math.max(...vals);
    const g = best && v === top && vals.filter((w) => w === top).length < vals.length;
    return `<td class="${g ? 'best' : ''}">${m ? `<span class="num">${fmt(v)}</span>` : `<span class="num">${v}</span>${best === 'max' ? ' م²' : ''}`}</td>`; };
  replace(`مقارنة ${us.length} قطع`, `<div class="cmpw"><table class="cmpt"><thead><tr><th></th>${us.map((x) => `<th><button data-a="unit" data-id="${x.id}">${x.alloc ? `الحي <b class="num">${x.d}</b>` : `${esc(x.zone)} <b>غير مخصصة</b>`}<small class="num">${esc(x.code)}</small></button></th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><th>${r[0]}</th>${us.map((x) => cell(x, r)).join('')}</tr>`).join('')}<tr><th>الخدمات</th>${us.map((x) => `<td>${svcs(x).join('، ') || '—'}</td>`).join('')}</tr></tbody></table></div>
    <p class="note">الخانة الملوّنة هي الأفضل في صفّها. المبالغ بالجنيه. اضغط على رقم الحي لفتح القطعة.</p>`, '');
}
const contactFields = '<div class="field"><label for="rqN">اسمك</label><input id="rqN" autocomplete="name" maxlength="80"></div><div class="field"><label for="rqP">رقم موبايلك</label><input id="rqP" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx"></div><p class="err" id="rqE" hidden></p>';
function openReq(id) {
  const x = U.find((u) => u.id === id); if (!x) return; REQ = { listing_id: id };
  push('اطلب القطعة', `<p style="margin:0">قطعة <b class="num">${esc(x.code)}</b> ${x.alloc ? 'في الحي ' + x.d : 'غير مخصصة في ' + esc(x.zone)}. سيب اسمك ورقمك، وفريق تِلاد هيكلمك.</p>${contactFields}`, '<button class="btn primary" data-a="send">ابعت الطلب</button>', () => $('rqN').focus());
}
function openAsk() {
  REQ = { d: typeof S.dist === 'number' ? S.dist : 0, zone: S.zone };
  replace('بلّغني', `<p style="margin:0">${S.dist === 'u' ? 'عايز قطعة غير مخصصة في ' + S.zone + '؟' : S.dist ? 'عايز قطعة في الحي ' + S.dist + '؟' : 'مش لاقي اللي يناسبك في ' + S.zone + '؟'} قولنا وإحنا ندوّرلك.</p><div class="field money"><label for="akB">ميزانيتك التقريبية <span class="opt">اختياري</span></label><input id="akB" inputmode="numeric" placeholder="مثلاً 1000000"></div>${contactFields}`, '<button class="btn primary" data-a="send">ابعت</button>');
}
function openSearch() { replace('ابحث', '<div class="field"><label for="sq">رقم الحي أو كود القطعة</label><input id="sq" inputmode="search" autocomplete="off" placeholder="مثلاً 12 أو Q2611-103"></div><div class="sugg" id="sg"></div>', '', () => $('sq').focus()); }
function suggestions(text) {
  const t = toEn(text).trim(); if (!t) return '';
  const byCode = U.find((x) => x.code.toLowerCase() === t.toLowerCase());
  const n = (t.match(/\d+/g) || []).pop(); if (!n && !byCode) return '<p class="note">اكتب رقم الحي أو كود القطعة.</p>';
  const d = Number(n), out = [];
  if (!byCode && zoneOf(d)) out.push(`<button data-a="goDist" data-d="${d}"><span class="n num">${d}</span><span>الحي ${d}<small>${zoneOf(d)} · ${cnt(d) ? cnt(d) + ' قطعة' : 'مفيش قطع دلوقتي'}</small></span></button>`);
  const u = byCode || U.find((x) => x.id === d);
  if (u) out.push(`<button data-a="unit" data-id="${u.id}"><span class="n num">${u.alloc ? u.d : '—'}</span><span>القطعة ${esc(u.code)}<small>${areaOf(u)} م² · ${where(u)} · ${fmt(u.price)} ج.م</small></span></button>`);
  return out.join('') || `<p class="note">الرقم ${esc(n)} مش من أحياء القادسية ولا الأمل.</p>`;
}
function filterBody() {
  const ch = (k, opts) => `<div class="chips">${opts.map((v) => `<button class="chip" data-a="fchip" data-k="${k}" data-v="${v}" aria-pressed="${F[k].includes(v)}">${v}</button>`).join('')}</div>`;
  return `<div class="two"><div class="field money"><label for="f-pmax">السعر الكلي لحد</label><input id="f-pmax" data-f="pmax" inputmode="numeric" placeholder="أي مبلغ" value="${esc(F.pmax)}"></div><div class="field money"><label for="f-paidMax">المطلوب دفعه لحد</label><input id="f-paidMax" data-f="paidMax" inputmode="numeric" placeholder="أي مبلغ" value="${esc(F.paidMax)}"></div></div>
  <div class="field"><span class="flbl">الأقساط المتبقية</span>${ch('inst', [1, 2, 3])}</div><div class="field"><span class="flbl">القطعة قدامها</span>${ch('view', VIEWS)}</div><div class="field"><span class="flbl">الواجهة</span>${ch('facade', FACADES)}</div>`;
}
const fGo = () => `اعرض ${applyF(inZone()).length} قطعة`;
function openFilters() { replace('الفلاتر', filterBody(), `<button class="btn ghost" data-a="fclear">مسح الكل</button><button class="btn primary" data-a="close" id="fGo">${fGo()}</button>`); }
const fRefresh = () => { const b = $('fGo'); if (b) b.textContent = fGo(); render(); };

/* ---------- offer: two pages, two paths (مخصصة / غير مخصصة) ---------- */
// Legalization rules and guide prices, from the Golden Beit platform (the city authority sets the final ones).
const SIZE_RULES = { minArea: 150, autoBelow: 500, roadCut: (a) => (a <= 300 ? 0.15 : 0.2), buyPerM: 3000, sellPerM: 700,
  pricePerM: (a) => (a <= 345 ? 1200 : 1400), adminFee: 0.015, waiverPerM: 180, instCount: 3, tiers: [209, 276, 300, 350, 400, 450, 500] };
const r1 = (n) => Math.round(n * 10) / 10;
// شيك التقنين حسب أصل المساحة.
const checkFor = (a) => (!(a >= SIZE_RULES.minArea) ? null : a < 350 ? 60000 : a < 500 ? 100000 : 150000);
// أصل المساحة → net after the road cut → official size (between two sizes the seller chooses down or up) → the authority's bill.
// any: accept any official size as the pick (allocated plots already have their size).
function legalSize(a, pick, any) {
  if (!(a >= SIZE_RULES.minArea && a < SIZE_RULES.autoBelow)) return null;
  const cutPct = SIZE_RULES.roadCut(a), net = r1(a - a * cutPct);
  const up = SIZE_RULES.tiers.find((t) => t >= net), down = [...SIZE_RULES.tiers].reverse().find((t) => t <= net);
  let tier, options = [];
  if (up == null) tier = down;
  else if (down == null || up === net) tier = up;
  else { tier = up - net <= net - down ? up : down; options = [down, up]; }
  if (options.includes(Number(pick)) || (any && SIZE_RULES.tiers.includes(Number(pick)))) tier = Number(pick);
  const missing = r1(Math.max(0, tier - net)), extra = r1(Math.max(0, net - tier));
  const buy = r1(missing * SIZE_RULES.buyPerM), sell = r1(extra * SIZE_RULES.sellPerM), perM = SIZE_RULES.pricePerM(a);
  const legal = r1(net * perM), total = r1(legal + buy - sell), admin = r1(total * SIZE_RULES.adminFee), grand = r1(total + admin);
  const quarter = r1(grand / 4), check = checkFor(a);
  return { a, cutPct, net, tier, options, missing, extra, buy, sell, perM, legal, total, admin, grand, quarter, check, completion: r1(quarter - check) };
}
// The legalized size has to fit أصل المساحة: one of the sizes its net (after the road cut) lands between, or less than it from 500 م² up.
function afCheck() {
  const a = num(O.ao), f = num(O.af); if (!(a >= SIZE_RULES.minArea) || !(f > 0)) return '';
  const c = legalSize(a);
  if (c) { const ok = c.options.length ? c.options : [c.tier]; return ok.includes(f) ? '' : `أصل المساحة ${a} م² بعد خصم الطرق والخدمات (${c.cutPct * 100}%) صافيها ${c.net} م²، فالمساحة بعد التقنين بتبقى ${ok.join(' أو ')} م² بس. راجع المساحة بعد التقنين أو أصل المساحة.`; }
  return f < a ? '' : 'المساحة بعد التقنين لازم تكون أقل من أصل المساحة، لأن جزء منها بيتخصم للطرق والخدمات. راجع الرقمين.';
}
const afWarn = () => { const m = afCheck(); return m ? `<p class="afwarn" role="alert">${m}</p>` : ''; };
let O = null, totPrev = 0, raf;
const blankO = () => ({ step: 0, alloc: '', onList: '', chk: '', stage: '', instPaid: '', zone: S.zone, d: typeof S.dist === 'number' ? S.dist : 0, nb: '', block: '', plot: '',
  ao: '', tier: '', af: '', afOther: false, f: '', v: '', seller: '', compM: '', instM: '', name: '', phone: '', desc: '', photo: null, letter: null, itemsOpen: false, err: '' });
const isU = () => O.alloc === 'no';
// The plot's size after legalization: chosen from أصل المساحة (غير مخصصة) or typed/picked (مخصصة).
const oArea = () => { if (!isU()) return num(O.af); const c = legalSize(num(O.ao), O.tier); return c ? c.tier : num(O.af); };
// The authority's bill, when it can be worked out from أصل المساحة.
const oCalc = () => (isU() ? legalSize(num(O.ao), O.tier) : num(O.ao) ? legalSize(num(O.ao), num(O.af), true) : null);
const ocalcFits = (c) => c && (isU() || c.tier === num(O.af));
const instLeft = () => (!isU() && O.stage === 'received' ? SIZE_RULES.instCount - Number(O.instPaid || 0) : SIZE_RULES.instCount);
const STAGES = [['not_completed', 'مخصصة، غير مستكملة', 'لسه دفعة الاستكمال ما اتدفعتش.'], ['completed', 'مستكملة، غير مستلمة', 'الاستكمال اتدفع، ولسه القطعة ما اتستلمتش.'], ['received', 'مستلمة', 'القطعة اتستلمت والأقساط بدأت.']];
const stageTxt = (k) => (STAGES.find((s) => s[0] === k) || [])[1] || '';
const statusTxt = () => (isU() ? `غير مخصصة · ${O.onList === 'yes' ? 'على الكشف' : 'مش على الكشف'} · الشيك ${O.chk === 'paid' ? 'مدفوع' : 'مش مدفوع'}` : stageTxt(O.stage));
const m2 = (n) => `<span class="num">${n}</span> م²`;
const jn = (n) => `<span class="num">${fmt(n)}</span>`;
// Items of المتبقي (paid to the authority). amt null = the seller still has to type it.
function remItems() {
  const c = oCalc(), fits = ocalcFits(c), area = oArea(), out = [], n = instLeft();
  if (isU() && O.chk === 'unpaid') { const ck = checkFor(num(O.ao)); out.push({ k: 'check', t: 'شيك التقنين', amt: ck, det: [['حسب أصل المساحة', m2(num(O.ao))]], note: 'الشيك ما اتدفعش، فبيدفعه المشتري.' }); }
  if (area) out.push({ k: 'waiver', t: 'التنازل', amt: r1(area * SIZE_RULES.waiverPerM), det: [[`${m2(area)} × ${SIZE_RULES.waiverPerM} ج.م للمتر`, jn(area * SIZE_RULES.waiverPerM)]] });
  const bill = fits ? [[`الصافي ${m2(c.net)} × ${fmt(c.perM)} ج.م`, jn(c.legal)], ...(c.missing ? [[`شراء ${m2(c.missing)} من الجهاز`, '+' + jn(c.buy)]] : []), ...(c.extra ? [[`بيع ${m2(c.extra)} للجهاز`, '−' + jn(c.sell)]] : []),
    ['مصاريف إدارية 1.5%', '+' + jn(c.admin)], ['إجمالي التقنين', jn(c.grand)], ['ربع الإجمالي', jn(c.quarter)]] : [];
  if (isU() || O.stage === 'not_completed') {
    out.push(fits ? { k: 'comp', t: 'الاستكمال', amt: c.completion, det: [...bill, ['ناقص شيك التقنين', '−' + jn(c.check)]] }
      : { k: 'comp', t: 'الاستكمال', amt: num(O.compM), manual: 'compM', ml: 'قيمة الاستكمال', note: isU() ? 'للمساحات من 500 م² فأكثر اكتب القيمة بنفسك.' : 'اكتب أصل المساحة في الصفحة الأولى علشان تتحسب تلقائي، أو اكتبها بنفسك.' });
  }
  if (n > 0) {
    const v = fits ? c.quarter : num(O.instM);
    out.push({ k: 'inst', t: `الأقساط (${instTxt(n)})`, amt: v != null ? r1(v * n) : null, manual: fits ? '' : 'instM', ml: 'قيمة القسط الواحد',
      det: fits ? [[`${n} × ربع الإجمالي`, jn(c.quarter)]] : [], note: !isU() && O.stage === 'received' ? `اتدفع ${O.instPaid || 0} من ${SIZE_RULES.instCount} أقساط.` : '' });
  }
  return out;
}
const remTotal = () => { const it = remItems(); return it.some((i) => i.amt == null) ? null : r1(it.reduce((s, i) => s + i.amt, 0)); };
const oTotal = () => { const s = num(O.seller), g = remTotal(); return s != null && g != null ? s + g : null; };
function legalBox() {
  const a = num(O.ao), c = legalSize(a, O.tier);
  if (!a) return '';
  if (!c) return `<p class="note">${a < SIZE_RULES.minArea ? `أقل أصل مساحة ${SIZE_RULES.minArea} م².` : 'للمساحات من 500 م² فأكثر، اكتب المساحة بعد التقنين بنفسك.'}</p>${a >= SIZE_RULES.autoBelow ? `<div class="field"><label for="o-af">المساحة بعد التقنين (م²)</label><input id="o-af" data-o="af" inputmode="decimal" placeholder="مثلاً 400" value="${esc(O.af)}"></div><div id="afWarn">${afWarn()}</div>` : ''}`;
  const opt = (t) => `<button class="lgo" data-a="otier" data-t="${t}" aria-pressed="${c.tier === t}"><b>${c.options.length ? (t > c.net ? 'تطلع لـ ' : 'تنزل لـ ') : ''}<span class="num">${t}</span> م²</b></button>`;
  return `<div class="lgl">
    <span class="flbl">المساحة بعد التقنين</span><div class="lgl-o">${(c.options.length ? c.options : [c.tier]).map(opt).join('')}</div>
    ${c.options.length ? '<p class="lgl-n">صافيك بين مقاسين رسميين: تنزل للأصغر وتبيع الزيادة للجهاز، أو تطلع للأكبر وتشتري الناقص.</p>' : ''}
    <p class="lgl-n">الأسعار استرشادية، والنهائية بيحددها جهاز مدينة العبور الجديدة.</p></div>`;
}
function summaryHTML() {
  const s = num(O.seller), g = remTotal(), t = oTotal(), ar = oArea(), row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<span class="flbl">ملخص للمراجعة</span><div class="rsum-l">
    ${row('المكان', `${esc(O.zone)} · ${isU() ? 'غير مخصصة' : 'الحي ' + O.d}`)}
    ${row('الحالة', isU() ? `${O.onList === 'yes' ? 'على الكشف' : 'مش على الكشف'} <small>· الشيك ${O.chk === 'paid' ? 'مدفوع' : 'مش مدفوع'}</small>` : esc(stageTxt(O.stage)))}
    ${row('المساحة', ar ? `${m2(ar)}${num(O.ao) && num(O.ao) !== ar ? ` <small>من <span class="num">${num(O.ao)}</span></small>` : ''}` : '—')}
    ${row('للبائع', s != null ? jn(s) : '—')}
    ${row('للجهاز', g != null ? `${jn(g)}${instLeft() ? ` <small>${instTxt(instLeft())}</small>` : ''}` : '—')}
    ${row('السعر الكلي', t != null ? jn(t) : '—')}
    ${row('سعر المتر', t != null && ar ? jn(t / ar) : '—')}</div>`;
}
const pBox = (k, l, sub, ph) => { const v = num(O[k]); return `<label class="pbox" for="o-${k}"><span>${l} <small>(${sub})</small></span><input id="o-${k}" data-o="${k}" class="num" inputmode="numeric" placeholder="${ph}" value="${esc(O[k])}"><em class="echo" id="e-${k}">${v != null ? fmt(v) + ' ج.م' : ''}</em></label>`; };
// The price as a tree, like the Golden Beit platform: إجمالي السعر → (للبائع) + (للجهاز) → بنود المتبقي → how each item was worked out.
const riAmt = (i) => (i.amt != null ? jn(i.amt) + ' <small>ج.م</small>' : '<span class="ri-q">اكتبها</span>');
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
// السعر الكلي: a plain label with "(للبائع) + (للجهاز)" under each other beside it, and the amount in a box next to them.
function ptotHTML() {
  const t = oTotal();
  return `<div class="ptl"><b>السعر الكلي</b><span class="pfx"><span>(اللي هيتدفع للبائع)</span><i aria-hidden="true">+</i><span>(اللي هيتدفع للجهاز)</span></span></div>
    <div class="ptbox"><span class="num" id="totN">${t != null ? fmt(t) : '—'}</span>${t != null ? ' <small>ج.م</small>' : ''}</div>`;
}
// Each item shows its amount; it opens only when there is a note or something to type.
function itemsHTML() {
  return remItems().map((i) => {
    const head = `<span class="pi-n">${i.t}</span><b class="pi-a" id="ra-${i.k}">${riAmt(i)}</b>`;
    if (!i.manual && !i.note) return `<div class="br pi"><div class="pi-s">${head}</div></div>`;
    return `<details class="br pi"${i.manual && i.amt == null ? ' open' : ''}><summary>${head}${CHEV}</summary><div class="pi-b">
      ${i.manual ? `<label class="pi-m"><span>${i.ml}</span><input data-o="${i.manual}" class="num" inputmode="numeric" placeholder="بالجنيه" value="${esc(O[i.manual])}"></label>` : ''}
      ${i.note ? `<p>${i.note}</p>` : ''}</div></details>`;
  }).join('');
}
function remHTML() {
  const g = remTotal(), open = O.itemsOpen || g == null;
  return `<div class="br-h"><span>المتبقي <small>(اللي هيتدفع للجهاز)</small></span><b id="remN">${g != null ? jn(g) + ' <small>ج.م</small>' : '—'}</b></div>
    <small class="br-s">المتبقي من إجمالي السعر، بيتحسب تلقائي من البنود.</small>
    <button type="button" class="items-btn" data-a="oitems" aria-expanded="${open}"><b>البنود</b><small>${open ? 'اضغط لإخفاء البنود' : 'اضغط لإظهار البنود'}</small>${CHEV}</button>
    ${open ? `<div class="ptree sub">${itemsHTML()}</div>` : ''}`;
}
const fileBox = (k, title, sub) => `<label class="fbox${O[k] ? ' has' : ''}"><input type="file" accept="image/*" data-file="${k}" hidden><span class="fic">${O[k] ? '✓' : '+'}</span><span><b>${title}</b><small>${O[k] ? esc(O[k].name) : sub}</small></span>${O[k] ? `<button type="button" class="fx" data-a="ofile-x" data-k="${k}" aria-label="شيل الصورة">×</button>` : ''}</label>`;
// One question of the path: big tappable options with a line of explanation each.
const pathQ = (n, title, k, opts, hint) => `<div class="pq"><span class="pq-t"><i class="num">${n}</i>${title}</span>${hint ? `<small class="pq-h">${hint}</small>` : ''}<div class="pq-o${opts.length > 3 ? ' sm' : ''}">${opts.map(([v, b, s]) => `<button class="popt" data-a="oset" data-k="${k}" data-v="${v}" aria-pressed="${String(O[k]) === String(v)}"><b>${b}</b>${s ? `<small>${s}</small>` : ''}</button>`).join('')}</div></div>`;
const zoneSeg = () => `<div class="field"><span class="flbl">المنطقة</span><div class="seg">${Object.keys(ZONES).map((z) => `<button data-a="ozone" data-z="${z}" aria-pressed="${O.zone === z}">${z}</button>`).join('')}</div></div>`;
function pathUnallocated() {
  let h = pathQ(2, 'القطعة على الكشف؟', 'onList', [['yes', 'على الكشف', 'اسمك نزل في كشف المستحقين.'], ['no', 'مش على الكشف', 'لسه ما نزلتش في الكشف.']]);
  if (!O.onList) return h;
  h += pathQ(3, 'شيك التقنين مدفوع؟', 'chk', [['paid', 'مدفوع', 'داخل في المطلوب دفعه للبائع.'], ['unpaid', 'مش مدفوع', 'بيتحسب على المشتري ضمن المتبقي.']],
    O.onList === 'no' ? 'غالبًا القطعة اللي مش على الكشف بيبقى شيكها مش مدفوع.' : '');
  if (!O.chk) return h;
  return h + `<div class="pq"><span class="pq-t"><i class="num">4</i>المنطقة والمساحة</span><small class="pq-h">القطعة غير المخصصة بتتعرض بالمنطقة والمساحة بس، من غير رقم حي أو تفاصيل.</small>
    ${zoneSeg()}
    <div class="field"><label for="o-ao">أصل المساحة (م²) <span class="req">إجباري</span></label><input id="o-ao" data-o="ao" inputmode="decimal" placeholder="مثلاً 300" value="${esc(O.ao)}"></div>
    <div id="lglBox">${legalBox()}</div>
    <p class="pq-h">الاستكمال والأقساط في الصفحة التالية.</p></div>`;
}
function pathAllocated() {
  let h = pathQ(2, 'القطعة وصلت لفين؟', 'stage', STAGES);
  if (!O.stage) return h;
  let n = 3;
  if (O.stage === 'received') {
    h += pathQ(n++, 'اتدفع كام قسط من الـ 3 أقساط؟', 'instPaid', [0, 1, 2, 3].map((k) => [k, k === 0 ? 'ولا قسط' : k === 3 ? 'الـ 3 كلهم' : `${k === 1 ? 'قسط واحد' : 'قسطين'}`, '']));
    if (O.instPaid === '') return h;
  }
  const afOn = (t) => !O.afOther && num(O.af) === t;
  return h + `<div class="pq"><span class="pq-t"><i class="num">${n++}</i>مكان القطعة</span>${zoneSeg()}
    <div class="field"><span class="flbl">رقم الحي</span><div class="dgrid">${ZONES[O.zone].map((d) => `<button class="num" data-a="od" data-d="${d}" aria-pressed="${O.d === d}">${d}</button>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="o-nb">المجاورة <span class="opt">اختياري</span></label><select id="o-nb" data-o="nb"><option value="">اختار</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${String(O.nb) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div><div class="field"><label for="o-block">البلوك <span class="opt">اختياري</span></label><input id="o-block" data-o="block" maxlength="40" value="${esc(O.block)}"></div></div>
    <div class="field"><label for="o-plot">رقم القطعة <span class="opt">اختياري، لفريق تِلاد بس</span></label><input id="o-plot" data-o="plot" maxlength="40" value="${esc(O.plot)}"></div></div>
    <div class="pq"><span class="pq-t"><i class="num">${n++}</i>المساحة</span>
    <div class="field"><span class="flbl">المساحة بعد التقنين</span><div class="chips">${SIZE_RULES.tiers.map((t) => `<button class="chip num" data-a="oaf" data-v="${t}" aria-pressed="${afOn(t)}">${t} م²</button>`).join('')}<button class="chip" data-a="oaf" data-v="other" aria-pressed="${O.afOther}">مساحة تانية</button></div></div>
    ${O.afOther ? `<div class="field"><label for="o-af">اكتب المساحة (م²)</label><input id="o-af" data-o="af" inputmode="decimal" placeholder="مثلاً 320" value="${esc(O.af)}"></div>` : ''}
    <div class="field"><label for="o-ao">أصل المساحة (م²) <span class="opt">اختياري</span></label><input id="o-ao" data-o="ao" inputmode="decimal" placeholder="مثلاً 300" value="${esc(O.ao)}"><small class="pq-h">لو كتبتها، بنحسب ${O.stage === 'not_completed' ? 'الاستكمال والأقساط' : 'الأقساط'} تلقائي.</small></div><div id="afWarn">${afWarn()}</div></div>
    <div class="pq"><span class="pq-t"><i class="num">${n++}</i>تفاصيل القطعة <span class="opt">اختياري</span></span>
    <div class="field"><span class="flbl">الواجهة</span><div class="chips">${FACADES.map((v) => `<button class="chip" data-a="ochip" data-k="f" data-v="${v}" aria-pressed="${O.f === v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span class="flbl">القطعة قدامها إيه؟</span><div class="chips">${VIEWS.map((v) => `<button class="chip" data-a="ochip" data-k="v" data-v="${v}" aria-pressed="${O.v === v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span class="flbl">الصور</span><div class="fboxes">${fileBox('photo', 'صورة القطعة', 'تظهر للناس بعد المراجعة')}${fileBox('letter', 'صورة جواب التخصيص', 'لفريق تِلاد فقط، ومش بتظهر للناس')}</div></div></div>`;
}
function offerBody() {
  const top = `<div class="steps"><i class="${O.step > 0 ? 'done' : 'on'}"></i><i class="${O.step === 1 ? 'on' : ''}"></i></div><p class="step-n">صفحة <span class="num">${O.step + 1}</span> من <span class="num">2</span>: <b>${O.step ? 'السعر وبياناتك' : 'القطعة'}</b></p>`;
  const err = O.err ? `<p class="err" role="alert">${esc(O.err)}</p>` : '';
  if (O.step === 0) {
    return top + pathQ(1, 'القطعة مخصصة؟', 'alloc', [['yes', 'مخصصة', 'طلع لها جواب تخصيص، وليها رقم حي وقطعة.'], ['no', 'غير مخصصة', 'لسه ما اتخصصتش، ومالهاش رقم حي.']])
      + (O.alloc === 'no' ? pathUnallocated() : O.alloc === 'yes' ? pathAllocated() : '') + err;
  }
  return top + `<div class="pchip">${esc(statusTxt())}<button data-a="oback">تعديل</button></div>
    <div class="ptrow" id="ptot">${ptotHTML()}</div>
    <div class="ptree"><div class="br br-paid">${pBox('seller', 'المطلوب دفعه', 'اللي هيتدفع للبائع', 'اكتب المبلغ')}</div><div class="br br-rem" id="remBox">${remHTML()}</div></div>
    <p class="lgl-n">بنود المتبقي محسوبة بأسعار استرشادية، والنهائية بيحددها جهاز مدينة العبور الجديدة.</p>
    <div class="two"><div class="field"><label for="o-name">اسمك</label><input id="o-name" data-o="name" autocomplete="name" maxlength="80" value="${esc(O.name)}"></div><div class="field"><label for="o-phone">رقم موبايلك</label><input id="o-phone" data-o="phone" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx" value="${esc(O.phone)}"></div></div>
    <div class="field"><label for="o-desc">وصف <span class="opt">اختياري</span></label><textarea id="o-desc" data-o="desc" maxlength="1000">${esc(O.desc)}</textarea></div>
    <div class="field rsum" id="psum">${summaryHTML()}</div>` + err;
}
const offerFoot = () => `${O.step ? '<button class="btn ghost" data-a="oback">رجوع</button>' : ''}<button class="btn primary" data-a="onext">${O.step ? 'ابعت للمراجعة' : 'التالي'}</button>`;
function drawOffer(keepScroll) { const st = pB.scrollTop, top = stack[stack.length - 1]; top.body = offerBody(); top.foot = offerFoot(); pB.innerHTML = top.body; pF.innerHTML = top.foot; if (keepScroll) pB.scrollTop = st; }
function openOffer() { O = blankO(); totPrev = 0; replace('اعرض قطعتك', offerBody(), offerFoot()); }
function validate() {
  const n = (k) => num(O[k]);
  if (O.step === 0) {
    if (!O.alloc) return 'اختار: القطعة مخصصة ولا غير مخصصة؟';
    if (isU()) {
      if (!O.onList) return 'اختار: القطعة على الكشف ولا لأ؟'; if (!O.chk) return 'اختار: شيك التقنين مدفوع ولا لأ؟';
      if (!(n('ao') > 0)) return 'اكتب أصل المساحة.'; if (n('ao') < SIZE_RULES.minArea) return `أقل أصل مساحة ${SIZE_RULES.minArea} م².`;
      if (n('ao') >= SIZE_RULES.autoBelow && !(n('af') > 0)) return 'اكتب المساحة بعد التقنين.'; return afCheck();
    }
    if (!O.stage) return 'اختار القطعة وصلت لفين.'; if (O.stage === 'received' && O.instPaid === '') return 'اختار اتدفع كام قسط.';
    if (!O.d) return 'اختار رقم الحي.'; if (!(n('af') > 0)) return 'اختار المساحة بعد التقنين.';
    if (n('ao') > 0 && n('ao') < SIZE_RULES.minArea) return `أقل أصل مساحة ${SIZE_RULES.minArea} م².`; return afCheck();
  }
  if (!(n('seller') > 0)) return 'اكتب المطلوب دفعه (اللي هيتدفع للبائع).';
  const miss = remItems().find((i) => i.amt == null); if (miss) return `اكتب ${miss.ml} في بند ${miss.t.replace(/ \(.*/, '')}.`;
  if (O.name.trim().length < 2) return 'اكتب اسمك.'; if (!/^01[0125]\d{8}$/.test(toEn(O.phone).replace(/\D/g, ''))) return 'اكتب رقم موبايل مصري صح، زي 01012345678.'; return '';
}
// Live total + summary while typing.
function refreshPrice() {
  remItems().forEach((i) => { const b = $('ra-' + i.k); if (b) b.innerHTML = riAmt(i); });
  const rn = $('remN'); if (rn) { const g = remTotal(); rn.innerHTML = g != null ? jn(g) + ' <small>ج.م</small>' : '—'; }
  const ps = $('psum'); if (ps) ps.innerHTML = summaryHTML();
  const box = $('ptot'); if (!box) return; const t = oTotal(); box.innerHTML = ptotHTML(); if (t == null) { totPrev = 0; return; }
  box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  const el = $('totN'), from = totPrev, to = t, t0 = performance.now(); cancelAnimationFrame(raf);
  const step = (tt) => { const k = Math.min(1, (tt - t0) / 350), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
  if (RM()) el.textContent = fmt(to); else raf = requestAnimationFrame(step);
  totPrev = to;
}
// Photos: shrink on the phone before upload (max 1600px JPEG), then store under incoming/.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file); const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
  } catch (e) { return file.size <= 3e6 && /^image\/(jpeg|png|webp)$/.test(file.type) ? file : null; }
}
async function uploadTo(bucket, file) {
  if (!file) return null; const blob = await shrink(file); if (!blob) return null;
  const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
  const path = `incoming/${id}.jpg`;
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  return error ? null : path;
}
async function submitOffer(btn) {
  btn.disabled = true; btn.textContent = O.photo || O.letter ? 'بنرفع الصور...' : 'بيتبعت...';
  const cur = O;
  const [photo, letter] = await Promise.all([uploadTo('listing-photos', O.photo), uploadTo('allocation-letters', O.letter)]);
  if (O !== cur) return;
  btn.textContent = 'بيتبعت...';
  const area = oArea(), ao = num(O.ao), u = isU(), items = remItems(), c = oCalc(), fits = ocalcFits(c), n = instLeft();
  const instV = n ? (fits ? c.quarter : num(O.instM)) : 0;
  const pay = { v: 1, items: items.map((i) => ({ k: i.k, amt: i.amt })), inst_value: instV, inst_count: SIZE_RULES.instCount, inst_left: n,
    inst_paid: u ? 0 : Number(O.instPaid || 0), auto: !!fits, ...(fits ? { net: c.net, tier: c.tier, check: c.check } : {}) };
  const p = { allocated: !u, on_list: u ? O.onList === 'yes' : null, check_paid: u ? O.chk === 'paid' : null, stage: u ? '' : O.stage, pay,
    zone: O.zone, district: u ? null : O.d, neighborhood: u ? '' : O.nb, block: u ? '' : O.block, plot_number: u ? '' : O.plot, area_orig: ao, area_final: area,
    facade: u ? '' : O.f, view_type: u ? '' : O.v, price: oTotal(), paid: num(O.seller), inst_left: n, description: O.desc, name: O.name.trim(),
    phone: toEn(O.phone).replace(/D/g, ''), photo: u ? null : photo, letter: u ? null : letter };
  sb.rpc('submit_offer', { p }).then(({ data, error }) => {
    if (!O) return;
    if (error) { O.err = errMsg(error, 'مقدرناش نبعت الإعلان. جرب تاني.'); drawOffer(true); pB.scrollTop = 1e6; return; }
    const failed = !!((O.photo && !photo) || (O.letter && !letter));
    close(); showPop(String(data), failed);
  });
}
// Success popup after an offer: formal Arabic, with the unit code ready to copy.
function showPop(code, photoFailed) {
  const c = esc(code);
  $('popC').innerHTML = `<div class="pop-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h3 id="popT">تم استلام إعلانك بنجاح</h3>
    <p>شكرًا لك. سيراجع فريق تِلاد بيانات قطعتك، وستُنشر فور اعتمادها.</p>${photoFailed ? '<p class="pop-hint">تعذّر رفع إحدى الصور. يمكنك إرسالها لنا عبر واتساب مع كود الوحدة.</p>' : ''}
    <span class="pop-lbl">كود وحدتك</span>
    <button class="pop-code" data-a="copy" data-code="${c}" aria-label="نسخ كود الوحدة ${c}"><span class="num">${c}</span><span class="cp">${COPY}<span class="cp-l">نسخ</span></span></button>
    <p class="pop-hint">احتفظ بهذا الكود، واذكره عند التواصل مع فريق تِلاد بخصوص إعلانك.</p>
    <div class="pop-acts">${wa(`السلام عليكم، أضفت قطعتي على تِلاد، وكود الوحدة ${code}.`, 'btn ghost', 'تواصل عبر واتساب')}<button class="btn dark" data-a="popclose">تم</button></div>`;
  const p = $('pop'); p.hidden = false; document.body.classList.add('lock');
  void p.offsetWidth; p.classList.add('open');
}
function closePop() { const p = $('pop'); p.classList.remove('open'); document.body.classList.remove('lock'); setTimeout(() => { p.hidden = true; }, 250); }
function sendRequest(btn) {
  const n = $('rqN'), p = $('rqP'), e = $('rqE');
  const name = n ? n.value.trim() : '', phone = p ? toEn(p.value).replace(/\D/g, '') : '';
  if (name.length < 2) { e.hidden = false; e.textContent = 'اكتب اسمك.'; return; }
  if (!/^01[0125]\d{8}$/.test(phone)) { e.hidden = false; e.textContent = 'اكتب رقم موبايل مصري صح، زي 01012345678.'; return; }
  const payload = { name, phone };
  if (REQ?.listing_id) payload.listing_id = REQ.listing_id;
  else { if (REQ?.zone) payload.zone = REQ.zone; if (REQ?.d) payload.district = REQ.d; const b = num($('akB')?.value); if (b != null) payload.budget = b; }
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'بيتبعت...';
  sb.rpc('submit_request', { p: payload }).then(({ error }) => {
    if (error) { btn.disabled = false; btn.textContent = label; e.hidden = false; e.textContent = errMsg(error, 'مقدرناش نبعت الطلب. جرب تاني.'); return; }
    doneSheet('وصل طلبك', 'فريق تِلاد هيكلمك قريب.');
  });
}
function doneSheet(t, s) { replace('تمام', `<div class="done"><i><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i><b>${t}</b><span>${s}</span></div>`, '<button class="btn primary" data-a="close">تمام</button>'); }
function copyCode(btn) {
  const c = btn.dataset.code;
  const lab = btn.querySelector('.cp-l');
  const ok = () => { toast('تم نسخ الكود ' + c); btn.classList.add('copied'); if (lab) lab.textContent = 'تم النسخ';
    setTimeout(() => { btn.classList.remove('copied'); if (lab) lab.textContent = 'نسخ'; }, 1600); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(btn.querySelector('.num')); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('الكود محدد، يمكنك نسخه الآن'); };
  try { navigator.clipboard.writeText(c).then(ok, fallback); } catch (e) { fallback(); }
}
let tT;
function toast(m) { const t = $('toast'); t.querySelector('span').textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => { t.hidden = true; }, 2200); }

/* ---------- events ---------- */
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-a]'); if (!t || !root.contains(t)) return;
  const a = t.dataset.a, id = Number(t.dataset.id);
  switch (a) {
    case 'top': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
    case 'zone': S.zone = t.dataset.z; S.dist = 0; render(); break;
    case 'dist': S.dist = t.dataset.d === 'u' ? 'u' : Number(t.dataset.d); render(); $('units')?.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); break;
    case 'pkscroll': t.closest('.pkwrap')?.querySelector('.picker,.pills')?.scrollBy({ left: Number(t.dataset.dir) * 180, behavior: RM() ? 'auto' : 'smooth' }); break;
    case 'pick': {
      const sl = $('picker')?.scrollLeft || 0;
      S.pick = S.pick === t.dataset.k ? null : t.dataset.k; render();
      const pr = $('picker'); if (pr) { pr.scrollLeft = sl; pkSync(); }
      document.querySelector('.sdetail')?.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' }); break;
    }
    case 'svc': openSvc(t.dataset.k); break;
    case 'home': goHome(); break;
    case 'sq': SF.a[t.dataset.i] = t.dataset.v; SF.err = ''; redrawSF(); break;
    case 'sch': SF.ch = t.dataset.v; redrawSF(); break;
    case 'stime': SF.time = SF.time === t.dataset.v ? '' : t.dataset.v; redrawSF(); break;
    case 'snext': svcNext(); break;
    case 'sback': SF.step = 0; SF.err = ''; redrawSF(); break;
    case 'ssend': svcSend(t); break;
    case 'goDist': S.dist = Number(t.dataset.d); S.zone = zoneOf(S.dist); close(); render(); break;
    case 'sort': S.sort = t.dataset.s; render(); break;
    case 'reload': LOADED = false; render(); load(); break;
    case 'copy': ev.stopPropagation(); copyCode(t); break;
    case 'unit': openUnit(id); break;
    case 'cmp': {
      if (S.cmp.includes(id)) S.cmp = S.cmp.filter((v) => v !== id); else { if (S.cmp.length >= CMP_MAX) S.cmp.shift(); S.cmp.push(id); }
      if (stack.length) { const b = pF.querySelector('[data-a="cmp"]'); if (b) { b.textContent = S.cmp.includes(id) ? 'شيلها من المقارنة' : 'ضيفها للمقارنة'; stack[stack.length - 1].foot = pF.innerHTML; } }
      syncCmp(); toast(S.cmp.includes(id) ? 'اتضافت للمقارنة' : 'اتشالت من المقارنة'); break;
    }
    case 'cmpclear': S.cmp = []; syncCmp(); break;
    case 'compare': openCompare(); break;
    case 'req': openReq(id); break;
    case 'ask': openAsk(); break;
    case 'search': openSearch(); break;
    case 'filters': openFilters(); break;
    case 'fchip': { const k = t.dataset.k, v = /^\d+$/.test(t.dataset.v) ? Number(t.dataset.v) : t.dataset.v; F[k] = F[k].includes(v) ? F[k].filter((x) => x !== v) : [...F[k], v]; t.setAttribute('aria-pressed', F[k].includes(v)); fRefresh(); break; }
    case 'fclear': F = F0(); if ($('fGo')) { pB.innerHTML = filterBody(); stack[stack.length - 1].body = pB.innerHTML; } fRefresh(); break;
    case 'offer': openOffer(); break;
    case 'ozone': if (O.zone !== t.dataset.z) { O.zone = t.dataset.z; O.d = 0; } drawOffer(true); break;
    case 'od': O.d = Number(t.dataset.d); O.err = ''; drawOffer(true); break;
    case 'oset': { const k = t.dataset.k, v = t.dataset.v; if (String(O[k]) === v) break; O[k] = k === 'instPaid' ? Number(v) : v; O.err = '';
      if (k === 'alloc') { O.onList = ''; O.chk = ''; O.stage = ''; O.instPaid = ''; O.tier = ''; O.af = ''; O.afOther = false; }
      if (k === 'stage') O.instPaid = '';
      drawOffer(true); requestAnimationFrame(() => { const q = pB.querySelectorAll('.pq'), last = q[q.length - 1]; if (last && last.getBoundingClientRect().bottom > pB.getBoundingClientRect().bottom) last.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' }); }); break; }
    case 'oitems': O.itemsOpen = !(O.itemsOpen || remTotal() == null); { const rb = $('remBox'); if (rb) rb.innerHTML = remHTML(); } stack[stack.length - 1].body = offerBody(); break;
    case 'oaf': if (t.dataset.v === 'other') { O.afOther = true; O.af = ''; } else { O.afOther = false; O.af = t.dataset.v; } O.err = ''; drawOffer(true); if (O.afOther) $('o-af')?.focus(); break;
    case 'ochip': O[t.dataset.k] = O[t.dataset.k] === t.dataset.v ? '' : t.dataset.v; drawOffer(true); break;
    case 'otier': O.tier = Number(t.dataset.t); { const lb = $('lglBox'); if (lb) lb.innerHTML = legalBox(); } stack[stack.length - 1].body = offerBody(); break;
    case 'ofile-x': ev.preventDefault(); O[t.dataset.k] = null; drawOffer(true); break;
    case 'oback': O.step = 0; O.err = ''; drawOffer(); pB.scrollTop = 0; break;
    case 'onext': {
      const e = validate(); O.err = e;
      if (e) { drawOffer(true); pB.scrollTop = 1e6; break; }
      if (O.step === 0) { O.step = 1; totPrev = 0; drawOffer(); pB.scrollTop = 0; pB.classList.remove('swap'); void pB.offsetWidth; pB.classList.add('swap'); break; }
      submitOffer(t); break;
    }
    case 'send': sendRequest(t); break;
    case 'popclose': closePop(); break;
    case 'back': back(); break;
    case 'close': close(); break;
  }
});
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!root.contains(el)) return;
  if (el.dataset.sf !== undefined && SF) { SF[el.dataset.sf] = el.value; return; }
  if (el.dataset.sa !== undefined && SF) { SF.a[el.dataset.sa] = el.value; return; }
  if (el.id === 'sq') { $('sg').innerHTML = suggestions(el.value); return; }
  if (el.dataset.f) { F[el.dataset.f] = el.value; fRefresh(); return; }
  if (el.dataset.o && O) {
    const k = el.dataset.o; O[k] = el.value;
    if (k === 'ao') { O.tier = ''; const lb = $('lglBox'); if (lb) lb.innerHTML = legalBox(); }
    if (k === 'ao' || k === 'af') { const w = $('afWarn'); if (w) w.innerHTML = afWarn(); }
    stack[stack.length - 1].body = offerBody();
    const e = $('e-' + k); if (e) { const v = num(el.value); e.textContent = v != null ? fmt(v) + ' ج.م' : ''; }
    if (k === 'seller' || k === 'compM' || k === 'instM') refreshPrice();
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!root.contains(el)) return;
  if (el.dataset.file && O) { const f = el.files && el.files[0]; if (f) { O[el.dataset.file] = f; drawOffer(true); } return; }
  if (el.dataset.sortsel === undefined) return;
  S.sort = el.value; render(); $('units')?.scrollIntoView({ block: 'start' });
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !$('pop').hidden) { closePop(); return; }
  if (ev.key === 'Escape' && !sheet.hidden) back();
  if (ev.key === 'Enter' && ev.target.id === 'sq') { const b = document.querySelector('#sg button'); if (b) b.click(); }
});
let lastY = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY, n = $('nav'); if (n) n.classList.toggle('scrolled', y > 30);
  // The bottom bar steps aside while scrolling down so it never sits on top of a card.
  if (y > lastY + 6 && y > 220 && !S.cmp.length) dock.classList.add('away');
  else if (y < lastY - 6 || y < 220) dock.classList.remove('away');
  lastY = y;
}, { passive: true });

// A shared link like telad.vercel.app/#invest opens that service page directly.
if (SVC[location.hash.slice(1)]) { startSF(location.hash.slice(1)); VIEW = location.hash.slice(1); }
render(); load();
}
