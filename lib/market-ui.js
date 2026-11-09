// Telad public page (approved "الشكل ب"). Reads published listings from Supabase and
// sends offers and requests through the submit_offer / submit_request RPCs.
import { SVC, SVC_ORDER, WHY, LINE, ART } from './solutions';

export function mount(sb, root) {
'use strict';
const WA = '201024151524';
const ZONES = { 'القادسية': [8, 9, 10, 12, 17, 20, 21, 22, 23], 'الأمل': [28, 29, 30, 32, 33, 34, 35, 36] };
const FACADES = ['بحري', 'قبلي', 'شرقي', 'غربي', 'ناصية'];
const VIEWS = ['شارع رئيسي', 'حديقة', 'خدمات', 'داخلي'];

/* ---------- helpers ---------- */
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toEn = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const num = (v) => { const s = toEn(v).replace(/[,\s]/g, ''); return s === '' || isNaN(Number(s)) ? null : Number(s); };
const zoneOf = (n) => Object.keys(ZONES).find((z) => ZONES[z].includes(n)) || '';
const jm = (n) => `<span class="num">${fmt(n)}</span> <small>ج.م</small>`;
const instTxt = (n) => (n === 1 ? 'قسط واحد' : `${n} أقساط`);
const ago = (h) => (h < 2 ? 'من ساعة' : h < 24 ? `من ${h} ساعات` : h < 48 ? 'امبارح' : `من ${Math.round(h / 24)} أيام`);
const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Sellers give the original area, the area after legalization, or both.
const areaOf = (x) => x.af || x.ao;
function svcs(x) { const o = []; if (x.v === 'حديقة') o.push('قدام حديقة'); if (x.v === 'خدمات') o.push('قدام خدمات'); if (x.v === 'شارع رئيسي') o.push('على شارع رئيسي'); if (x.f === 'ناصية') o.push('ناصية'); return o; }
function tags(x) { const t = svcs(x).map((s) => `<span class="tag svc">${s}</span>`); if (x.v === 'داخلي') t.push('<span class="tag">داخلي</span>'); if (x.f && x.f !== 'ناصية') t.push(`<span class="tag">واجهة ${x.f}</span>`); return t.length ? `<div class="tags">${t.join('')}</div>` : ''; }

const LOGO = '<svg viewBox="0 0 120 112" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="10"><path d="M10 108 L64 46 A26 26 0 0 1 108 64 L108 108"/><path d="M36 108 L76 62"/><path d="M62 108 L84 83"/></g><g fill="currentColor"><path d="M52 6h20l-7 10H45z"/><path d="M80 6h20l-7 10H73z"/></g></svg>';
const SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
const FILT = '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const BACK = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const XI = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const COPY = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
const WAI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';
const wa = (text, cls, label) => `<a class="${cls}" href="https://wa.me/${WA}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" aria-label="${label || 'تواصل واتساب'}">${WAI}${label || ''}</a>`;
const waUnit = (x) => `السلام عليكم، أنا مهتم بالقطعة ${x.code} في الحي ${x.d} (${areaOf(x)} م²، السعر الكلي ${fmt(x.price)} جنيه).`;
const codeChip = (x) => `<button class="code-chip" data-a="copy" data-code="${esc(x.code)}" aria-label="انسخ كود القطعة ${esc(x.code)}"><span class="num">${esc(x.code)}</span>${COPY}</button>`;

/* ---------- data ---------- */
let U = [], LOADED = false, LOADERR = false;
const toUnit = (r) => ({ id: r.id, code: r.code || '#' + r.id, zone: r.zone, d: r.district, nb: r.neighborhood || '', block: r.block || '',
  ao: r.area_orig == null ? null : Number(r.area_orig), af: r.area_final == null ? null : Number(r.area_final),
  f: r.facade || '', v: r.view_type || '', price: Number(r.price), paid: Number(r.paid), rem: Number(r.remaining), inst: r.inst_left,
  h: Math.max(0, Math.round((Date.now() - new Date(r.published_at || r.created_at).getTime()) / 36e5)) });
async function load() {
  const { data, error } = await sb.from('listings')
    .select('id,code,zone,district,neighborhood,block,area_orig,area_final,facade,view_type,price,paid,remaining,inst_left,published_at,created_at')
    .eq('state', 'approved').order('published_at', { ascending: false });
  LOADED = true; LOADERR = !!error; U = (data || []).map(toUnit); render();
}
const ERR = { invalid_phone: 'اكتب رقم موبايل مصري صح، زي 01012345678.', invalid_name: 'اكتب اسمك.', invalid_area: 'اكتب المساحة: أصل المساحة أو بعد التقنين أو الاتنين.',
  too_many_offers: 'بعت إعلانات كتير النهارده من الرقم ده. جرب بكرة أو كلمنا واتساب.', too_many_requests: 'بعت طلبات كتير النهارده. كلمنا واتساب.',
  listing_not_found: 'القطعة دي مش متاحة دلوقتي.', busy: 'فيه ضغط دلوقتي. جرب كمان شوية.' };
const errMsg = (err, fb) => { const m = err?.message || ''; const k = Object.keys(ERR).find((key) => m.includes(key)); return k ? ERR[k] : fb; };

/* ---------- state ---------- */
const S = { zone: 'القادسية', dist: 0, sort: 'price', cmp: [], pick: null };
const F0 = () => ({ pmax: '', paidMax: '', inst: [], view: [], facade: [] });
let F = F0(), REQ = null, intro = true;
const SORTS = [['price', 'الأرخص أولاً', (a, b) => a.price - b.price], ['priceD', 'الأغلى أولاً', (a, b) => b.price - a.price], ['paid', 'أقل مطلوب + أوفر', (a, b) => a.paid - b.paid],
  ['rem', 'أقل متبقي', (a, b) => a.rem - b.rem], ['area', 'الأكبر مساحة', (a, b) => areaOf(b) - areaOf(a)], ['new', 'الأحدث', (a, b) => a.h - b.h]];

/* ---------- حلول تِلاد: services strip, service page (#invest, #develop, ...), two-step request ---------- */
let VIEW = null, SF = null;
const startSF = (k) => { SF = { k, step: 0, a: {}, name: '', phone: '', ch: 'واتساب', time: '', err: '', done: '' }; };
const LEGAL = '<p class="legal">تِلاد كيان عقاري مستقل، غير تابع لجهاز مدينة العبور الجديدة أو أي جهة حكومية.</p>';
function solutionsHTML() {
  const d = S.pick ? SVC[S.pick] : null;
  return `<section class="sol in" id="solutions"><div class="solcard"><h2 class="sol-t">حلول تِـــــــــلاد</h2><p class="sol-s">حلول عقارية متكاملة، في مكان واحد</p><p class="sol-h">اضغط على أي خدمة لعرض تفاصيلها.</p>
    <div class="picker" id="picker">${SVC_ORDER.map((k) => `<button class="pk" data-a="pick" data-k="${k}" aria-pressed="${S.pick === k}" aria-expanded="${S.pick === k}"><span class="art">${ART[k]}</span>${SVC[k].short}</button>`).join('')}</div>
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
const inZone = () => U.filter((x) => x.zone === S.zone && (!S.dist || x.d === S.dist));
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
  return `<article class="card${S.cmp.includes(x.id) ? ' on' : ''}" style="--i:${i}">
  <div class="c-head"><button class="dbadge" data-a="unit" data-id="${x.id}"><span>الحي</span><b class="num">${x.d}</b>${x.nb ? `<small>مجاورة ${x.nb}</small>` : ''}</button>${codeChip(x)}</div>
  <button class="c-top" data-a="unit" data-id="${x.id}" aria-label="افتح تفاصيل القطعة ${esc(x.code)}"><span class="c-price"><span class="lbl">السعر الكلي</span><span class="price"><span class="num" data-count="${x.price}">${fmt(x.price)}</span> <small>ج.م</small></span></span><span class="area"><b class="num">${areaOf(x)}</b><small>م²${x.af ? '' : ' أصل'}</small></span></button>
  <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
  <div class="bar-l"><span>المطلوب + الأوفر <b class="num" data-count="${x.paid}">${fmt(x.paid)}</b></span><span class="r">المتبقي <b class="num" data-count="${x.rem}">${fmt(x.rem)}</b></span></div>
  <div class="tags">${sv.join('')}${inst}</div>
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
  else body = `<div class="empty"><b>مفيش قطع معروضة ${S.dist ? 'في الحي ' + S.dist : 'في ' + S.zone} دلوقتي.</b><span>سيب رقمك ونكلمك أول ما تنزل قطعة.</span><button class="btn primary" data-a="ask">بلّغني لما تنزل قطعة</button></div>`;
  app.innerHTML = `<nav class="nav in" id="nav"><button class="brand" data-a="top" aria-label="تِلاد">${LOGO}<span class="wm">تِـــــــــلاد</span></button><button class="iconbtn" data-a="search" aria-label="ابحث برقم الحي أو كود القطعة">${SEARCH}</button><button class="cta" data-a="offer"><span class="plus">+</span>اعرض قطعتك</button></nav>
    <header class="band in"><h1>العقار <em>قرارٌ</em> لا صفقةٌ</h1><p>أراضي التقنين في القادسية والأمل، وحلول عقارية متكاملة.</p></header>
    <div class="scard"><div class="ztabs" role="tablist" aria-label="التقسيم">${zoneTabs}<i class="zink" style="right:${zi * 50}%"></i></div>
      <p class="pills-l">الحي</p>
      <div class="pills" role="group" aria-label="أحياء ${S.zone}"><button class="${zcnt(S.zone) ? 'has' : ''}" data-a="dist" data-d="0" aria-pressed="${!S.dist}"><b>الكل</b><small class="num">${zcnt(S.zone)} قطعة</small></button>${zd.map((n) => `<button class="${cnt(n) ? 'has' : 'none'}" data-a="dist" data-d="${n}" aria-pressed="${S.dist === n}" aria-label="الحي ${n}، ${cnt(n)} قطعة"><b class="num">${n}</b><small>${cnt(n) ? cnt(n) + ' قطعة' : 'فاضي'}</small></button>`).join('')}</div></div>
    ${solutionsHTML()}
    <div class="in" id="units"><div class="toolbar"><h2>${S.dist ? 'الحي ' + S.dist : 'كل أحياء ' + S.zone}</h2><span class="count"><span class="num">${us.length}</span> ${us.length === 1 ? 'قطعة' : 'قطع'}</span></div>
    <div class="lv-ctrl"><button class="lv-fbtn" data-a="filters" aria-pressed="${fc > 0}">${FILT}الفلاتر${fc ? ` <span class="num">(${fc})</span>` : ''}</button><label class="lv-sort"><span>ترتيب حسب</span><select data-sortsel aria-label="ترتيب حسب">${SORTS.map(([k, t]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
    <section class="list in" aria-live="polite">${body}</section>${whyHTML()}`;
  renderDock(); countUp(); reveal();
}
function renderDock() {
  const tray = S.cmp.length ? `<div class="tray" role="status"><span>${S.cmp.length === 1 ? 'اختار قطعة تانية للمقارنة' : 'قطعتين جاهزين'}</span><button class="btn ghost" data-a="cmpclear">مسح</button>${S.cmp.length === 2 ? '<button class="btn primary" data-a="compare">قارن</button>' : ''}</div>` : '';
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
  replace(`الحي ${x.d} · ${areaOf(x)} م²`, `<div class="hero-box"><span class="lbl">السعر الكلي</span><span class="price">${jm(x.price)}</span>
    <div class="bar"><i style="width:${pct}%"></i></div><div class="bar-l"><span>المطلوب دفعه + الأوفر<b class="num">${fmt(x.paid)}</b></span><span class="r">المتبقي<b class="num">${fmt(x.rem)}</b></span></div>
    <span>${codeChip(x)}</span></div>
    <div class="kv"><div><span>المطلوب دفعه + الأوفر</span><b>${jm(x.paid)}</b></div><div><span>المتبقي</span><b class="r">${jm(x.rem)}</b></div><div><span>الأقساط المتبقية</span><b>${instTxt(x.inst)}</b></div></div>
    <div class="kv"><div><span>المكان</span><b>${esc(x.zone)} · الحي ${x.d}</b></div>${x.nb || x.block ? `<div><span>المجاورة والبلوك</span><b>${x.nb ? 'مجاورة ' + x.nb : '—'}${x.block ? ' · بلوك <span class="num">' + esc(x.block) + '</span>' : ''}</b></div>` : ''}
      ${x.af ? `<div><span>المساحة بعد التقنين</span><b><span class="num">${x.af}</span> م²</b></div>` : ''}${x.ao ? `<div><span>أصل المساحة</span><b><span class="num">${x.ao}</span> م²</b></div>` : ''}</div>
    ${sv.length || x.f || x.v ? `<div class="badges">${sv.map((t) => `<span class="bdg svc">${t}</span>`).join('')}${x.v === 'داخلي' ? '<span class="bdg">داخلي</span>' : ''}${x.f && x.f !== 'ناصية' ? `<span class="bdg">واجهة ${x.f}</span>` : ''}</div>` : ''}
    <div class="ctx"><button data-a="svc" data-k="valuation">${LINE.value}<span><b>هل السعر مناسب؟</b>اطلب تقييم تِلاد قبل أن تقرر.</span></button><button data-a="svc" data-k="develop">${LINE.build}<span><b>تنوي البناء عليها؟</b>نطوّرها معك أو نشاركك فيها.</span></button></div>
`,
  `<button class="btn ghost" data-a="cmp" data-id="${id}">${S.cmp.includes(id) ? 'شيلها من المقارنة' : 'ضيفها للمقارنة'}</button><button class="btn primary" data-a="req" data-id="${id}">اطلب القطعة</button>${wa(waUnit(x), 'btn ghost wa-ic', '')}`);
}
function openCompare() {
  const [a, b] = S.cmp.map((id) => U.find((u) => u.id === id)); if (!a || !b) return;
  const rows = [['السعر الكلي', (x) => x.price, 'min', 1], ['المطلوب + الأوفر', (x) => x.paid, 'min', 1], ['المتبقي', (x) => x.rem, 'min', 1], ['الأقساط', (x) => x.inst, '', 0], ['المساحة', (x) => areaOf(x), 'max', 0], ['سعر المتر', (x) => x.price / areaOf(x), 'min', 1]];
  const cell = (x, [, f, best, m], o) => { const v = f(x), w = f(o), g = best === 'min' ? v < w : best === 'max' ? v > w : false; return `<div class="${g ? 'best' : ''}">${m ? `<span class="num">${fmt(v)}</span>` : `<span class="num">${v}</span>${best === 'max' ? ' م²' : ''}`}</div>`; };
  replace('مقارنة قطعتين', `<div class="cmp"><div class="k"></div><div class="h">الحي ${a.d}</div><div class="h">الحي ${b.d}</div>${rows.map((r) => `<div class="k">${r[0]}</div>${cell(a, r, b)}${cell(b, r, a)}`).join('')}
    <div class="k">الخدمات</div><div>${svcs(a).join('، ') || '—'}</div><div>${svcs(b).join('، ') || '—'}</div></div><p class="note">الخانة الملوّنة هي الأحسن في الصف بتاعها. المبالغ بالجنيه.</p>`,
  `<button class="btn ghost" data-a="unit" data-id="${a.id}">افتح الحي ${a.d}</button><button class="btn ghost" data-a="unit" data-id="${b.id}">افتح الحي ${b.d}</button>`);
}
const contactFields = '<div class="field"><label for="rqN">اسمك</label><input id="rqN" autocomplete="name" maxlength="80"></div><div class="field"><label for="rqP">رقم موبايلك</label><input id="rqP" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx"></div><p class="err" id="rqE" hidden></p>';
function openReq(id) {
  const x = U.find((u) => u.id === id); if (!x) return; REQ = { listing_id: id };
  push('اطلب القطعة', `<p style="margin:0">قطعة <b class="num">${esc(x.code)}</b> في الحي ${x.d}. سيب اسمك ورقمك، وفريق تِلاد هيكلمك.</p>${contactFields}`, '<button class="btn primary" data-a="send">ابعت الطلب</button>', () => $('rqN').focus());
}
function openAsk() {
  REQ = { d: S.dist, zone: S.zone };
  replace('بلّغني', `<p style="margin:0">${S.dist ? 'عايز قطعة في الحي ' + S.dist + '؟' : 'مش لاقي اللي يناسبك في ' + S.zone + '؟'} قولنا وإحنا ندوّرلك.</p><div class="field money"><label for="akB">ميزانيتك التقريبية <span class="opt">اختياري</span></label><input id="akB" inputmode="numeric" placeholder="مثلاً 1000000"></div>${contactFields}`, '<button class="btn primary" data-a="send">ابعت</button>');
}
function openSearch() { replace('ابحث', '<div class="field"><label for="sq">رقم الحي أو كود القطعة</label><input id="sq" inputmode="search" autocomplete="off" placeholder="مثلاً 12 أو Q2611-103"></div><div class="sugg" id="sg"></div>', '', () => $('sq').focus()); }
function suggestions(text) {
  const t = toEn(text).trim(); if (!t) return '';
  const byCode = U.find((x) => x.code.toLowerCase() === t.toLowerCase());
  const n = (t.match(/\d+/g) || []).pop(); if (!n && !byCode) return '<p class="note">اكتب رقم الحي أو كود القطعة.</p>';
  const d = Number(n), out = [];
  if (!byCode && zoneOf(d)) out.push(`<button data-a="goDist" data-d="${d}"><span class="n num">${d}</span><span>الحي ${d}<small>${zoneOf(d)} · ${cnt(d) ? cnt(d) + ' قطعة' : 'مفيش قطع دلوقتي'}</small></span></button>`);
  const u = byCode || U.find((x) => x.id === d);
  if (u) out.push(`<button data-a="unit" data-id="${u.id}"><span class="n num">${u.d}</span><span>القطعة ${esc(u.code)}<small>${areaOf(u)} م² · الحي ${u.d} · ${fmt(u.price)} ج.م</small></span></button>`);
  return out.join('') || `<p class="note">الرقم ${esc(n)} مش من أحياء القادسية ولا الأمل.</p>`;
}
function filterBody() {
  const ch = (k, opts) => `<div class="chips">${opts.map((v) => `<button class="chip" data-a="fchip" data-k="${k}" data-v="${v}" aria-pressed="${F[k].includes(v)}">${v}</button>`).join('')}</div>`;
  return `<div class="two"><div class="field money"><label for="f-pmax">السعر الكلي لحد</label><input id="f-pmax" data-f="pmax" inputmode="numeric" placeholder="أي مبلغ" value="${esc(F.pmax)}"></div><div class="field money"><label for="f-paidMax">المطلوب + الأوفر لحد</label><input id="f-paidMax" data-f="paidMax" inputmode="numeric" placeholder="أي مبلغ" value="${esc(F.paidMax)}"></div></div>
  <div class="field"><span class="flbl">الأقساط المتبقية</span>${ch('inst', [1, 2, 3])}</div><div class="field"><span class="flbl">القطعة قدامها</span>${ch('view', VIEWS)}</div><div class="field"><span class="flbl">الواجهة</span>${ch('facade', FACADES)}</div>`;
}
const fGo = () => `اعرض ${applyF(inZone()).length} قطعة`;
function openFilters() { replace('الفلاتر', filterBody(), `<button class="btn ghost" data-a="fclear">مسح الكل</button><button class="btn primary" data-a="close" id="fGo">${fGo()}</button>`); }
const fRefresh = () => { const b = $('fGo'); if (b) b.textContent = fGo(); render(); };

/* ---------- offer: 2 steps, المتبقي is computed ---------- */
let O = null, remPrev = 0, raf;
const blankO = () => ({ step: 0, zone: S.zone, d: S.dist || 0, nb: '', block: '', plot: '', ao: '', af: '', f: '', v: '', price: '', paid: '', inst: '', name: '', phone: '', desc: '', err: '' });
const autoRem = () => { const p = num(O.price), d = num(O.paid); return p != null && d != null ? p - d : null; };
const mField = (k, l) => { const v = num(O[k]); return `<div class="field money"><label for="o-${k}">${l}</label><input id="o-${k}" data-o="${k}" inputmode="numeric" placeholder="اكتب المبلغ" value="${esc(O[k])}"><span class="echo" id="e-${k}">${v != null ? fmt(v) + ' ج.م' : ''}</span></div>`; };
function remBox() { const r = autoRem(); return `<div class="autobox${r == null ? ' empty' : ''}${r != null && r < 0 ? ' bad' : ''}" id="remBox">${r == null ? 'بيتحسب لوحده من السعر الكلي' : `<span class="num" id="remN">${fmt(r)}</span> <small>ج.م</small>`}</div>`; }
function warns() { const p = num(O.price), d = num(O.paid); return p != null && d != null && d > p ? '<p class="warn">المطلوب دفعه + الأوفر أكبر من السعر الكلي.</p>' : ''; }
function offerBody() {
  const top = `<div class="steps"><i class="${O.step > 0 ? 'done' : 'on'}"></i><i class="${O.step === 1 ? 'on' : ''}"></i></div><p class="step-n">خطوة <span class="num">${O.step + 1}</span> من <span class="num">2</span>: <b>${O.step ? 'الأسعار وبياناتك' : 'القطعة'}</b></p>`;
  const err = O.err ? `<p class="err" role="alert">${esc(O.err)}</p>` : '';
  if (O.step === 0) return top + `<div class="field"><span class="flbl">التقسيم</span><div class="seg">${Object.keys(ZONES).map((z) => `<button data-a="ozone" data-z="${z}" aria-pressed="${O.zone === z}">${z}</button>`).join('')}</div></div>
    <div class="field"><span class="flbl">رقم الحي</span><div class="dgrid">${ZONES[O.zone].map((n) => `<button class="num" data-a="od" data-d="${n}" aria-pressed="${O.d === n}">${n}</button>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="o-nb">المجاورة <span class="opt">اختياري</span></label><select id="o-nb" data-o="nb"><option value="">اختار</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${String(O.nb) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div><div class="field"><label for="o-block">البلوك <span class="opt">اختياري</span></label><input id="o-block" data-o="block" maxlength="40" value="${esc(O.block)}"></div></div>
    <div class="field"><label for="o-plot">رقم القطعة <span class="opt">اختياري</span></label><input id="o-plot" data-o="plot" maxlength="40" value="${esc(O.plot)}"></div>
    <span class="flbl" style="margin-bottom:-8px">المساحة <span class="opt">اكتب واحدة منهم أو الاتنين</span></span>
    <div class="two"><div class="field"><label for="o-ao">أصل المساحة (م²)</label><input id="o-ao" data-o="ao" inputmode="decimal" placeholder="مثلاً 300" value="${esc(O.ao)}"></div><div class="field"><label for="o-af">بعد التقنين (م²)</label><input id="o-af" data-o="af" inputmode="decimal" placeholder="مثلاً 276" value="${esc(O.af)}"></div></div>
    <div class="field"><span class="flbl">الواجهة <span class="opt">اختياري</span></span><div class="chips">${FACADES.map((v) => `<button class="chip" data-a="ochip" data-k="f" data-v="${v}" aria-pressed="${O.f === v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span class="flbl">القطعة قدامها إيه؟ <span class="opt">اختياري</span></span><div class="chips">${VIEWS.map((v) => `<button class="chip" data-a="ochip" data-k="v" data-v="${v}" aria-pressed="${O.v === v}">${v}</button>`).join('')}</div></div>` + err;
  return top + mField('price', 'السعر الكلي') + mField('paid', 'المطلوب دفعه + الأوفر') + `
    <div class="two"><div class="field"><span class="flbl">المتبقي <span class="auto">تلقائي</span></span>${remBox()}</div><div class="field"><label for="o-inst">الأقساط المتبقية</label><select id="o-inst" data-o="inst"><option value="" disabled ${O.inst ? '' : 'selected'}>اختار</option>${[1, 2, 3].map((n) => `<option value="${n}" ${String(O.inst) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div id="oWarn">${warns()}</div>
    <div class="two"><div class="field"><label for="o-name">اسمك</label><input id="o-name" data-o="name" autocomplete="name" maxlength="80" value="${esc(O.name)}"></div><div class="field"><label for="o-phone">رقم موبايلك</label><input id="o-phone" data-o="phone" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx" value="${esc(O.phone)}"></div></div>
    <div class="field"><label for="o-desc">وصف <span class="opt">اختياري</span></label><textarea id="o-desc" data-o="desc" maxlength="1000">${esc(O.desc)}</textarea></div>` + err;
}
const offerFoot = () => `${O.step ? '<button class="btn ghost" data-a="oback">رجوع</button>' : ''}<button class="btn primary" data-a="onext">${O.step ? 'ابعت للمراجعة' : 'التالي'}</button>`;
function drawOffer(keepScroll) { const st = pB.scrollTop, top = stack[stack.length - 1]; top.body = offerBody(); top.foot = offerFoot(); pB.innerHTML = top.body; pF.innerHTML = top.foot; if (keepScroll) pB.scrollTop = st; }
function openOffer() { O = blankO(); remPrev = 0; replace('اعرض قطعتك', offerBody(), offerFoot()); }
function validate() {
  const n = (k) => num(O[k]);
  if (O.step === 0) { if (!O.d) return 'اختار رقم الحي.'; if (!(n('ao') > 0) && !(n('af') > 0)) return 'اكتب المساحة: أصل المساحة أو بعد التقنين أو الاتنين.'; return ''; }
  if (!(n('price') > 0)) return 'اكتب السعر الكلي.'; if (n('paid') == null) return 'اكتب المطلوب دفعه + الأوفر.'; if (autoRem() < 0) return 'المطلوب دفعه + الأوفر أكبر من السعر الكلي.'; if (!O.inst) return 'اختار عدد الأقساط المتبقية.';
  if (O.name.trim().length < 2) return 'اكتب اسمك.'; if (!/^01[0125]\d{8}$/.test(toEn(O.phone).replace(/\D/g, ''))) return 'اكتب رقم موبايل مصري صح، زي 01012345678.'; return '';
}
function countRem() {
  const box = $('remBox'); if (!box) return; const r = autoRem();
  box.outerHTML = remBox(); const nb = $('remBox'), el = $('remN');
  if (r == null || !el) { remPrev = 0; return; }
  nb.classList.add('pop'); const from = remPrev, to = r, t0 = performance.now(); cancelAnimationFrame(raf);
  const step = (t) => { const k = Math.min(1, (t - t0) / 350), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
  if (RM()) el.textContent = fmt(to); else raf = requestAnimationFrame(step);
  remPrev = to;
}
function submitOffer(btn) {
  const p = { zone: O.zone, district: O.d, neighborhood: O.nb, block: O.block, plot_number: O.plot, area_orig: num(O.ao), area_final: num(O.af), facade: O.f, view_type: O.v,
    price: num(O.price), paid: num(O.paid), inst_left: Number(O.inst), description: O.desc, name: O.name.trim(), phone: toEn(O.phone).replace(/\D/g, '') };
  btn.disabled = true; btn.textContent = 'بيتبعت...';
  sb.rpc('submit_offer', { p }).then(({ data, error }) => {
    if (!O) return;
    if (error) { O.err = errMsg(error, 'مقدرناش نبعت الإعلان. جرب تاني.'); drawOffer(true); pB.scrollTop = 1e6; return; }
    close(); showPop(String(data));
  });
}
// Success popup after an offer: formal Arabic, with the unit code ready to copy.
function showPop(code) {
  const c = esc(code);
  $('popC').innerHTML = `<div class="pop-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h3 id="popT">تم استلام إعلانك بنجاح</h3>
    <p>شكرًا لك. سيراجع فريق تِلاد بيانات قطعتك، وستُنشر فور اعتمادها.</p>
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
    case 'dist': S.dist = Number(t.dataset.d); render(); $('units')?.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }); break;
    case 'pick': {
      const sl = $('picker')?.scrollLeft || 0;
      S.pick = S.pick === t.dataset.k ? null : t.dataset.k; render();
      const pr = $('picker'); if (pr) pr.scrollLeft = sl;
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
      if (S.cmp.includes(id)) S.cmp = S.cmp.filter((v) => v !== id); else { if (S.cmp.length >= 2) S.cmp.shift(); S.cmp.push(id); }
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
    case 'ochip': O[t.dataset.k] = O[t.dataset.k] === t.dataset.v ? '' : t.dataset.v; drawOffer(true); break;
    case 'oback': O.step = 0; O.err = ''; drawOffer(); pB.scrollTop = 0; break;
    case 'onext': {
      const e = validate(); O.err = e;
      if (e) { drawOffer(true); pB.scrollTop = 1e6; break; }
      if (O.step === 0) { O.step = 1; remPrev = 0; drawOffer(); pB.scrollTop = 0; pB.classList.remove('swap'); void pB.offsetWidth; pB.classList.add('swap'); break; }
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
    O[el.dataset.o] = el.value; stack[stack.length - 1].body = offerBody();
    const e = $('e-' + el.dataset.o); if (e) { const v = num(el.value); e.textContent = v != null ? fmt(v) + ' ج.م' : ''; }
    if (el.dataset.o === 'price' || el.dataset.o === 'paid') { const w = $('oWarn'); if (w) w.innerHTML = warns(); countRem(); }
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target; if (!root.contains(el) || el.dataset.sortsel === undefined) return;
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
