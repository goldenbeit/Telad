// Telad public page, ported from the approved mockup ("الشكل التاني"). Data and actions go through Supabase.
export function mount(sb){

'use strict';
const r1 = n => Math.round((Number(n)||0)*10)/10;
const money = n => r1(n).toLocaleString('en',{maximumFractionDigits:1});
const toEn = v => String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const num = v => { const s = toEn(v).replace(/[,\s]/g,''); return s==='' || isNaN(Number(s)) ? null : Number(s); };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jm = n => `<span class="num">${money(n)}</span> <span class="cur">ج.م</span>`;
const FACADES = ['بحري','قبلي','شرقي','غربي','ناصية'];
const VIEWS = ['شارع رئيسي','حديقة','خدمات','داخلي'];
const NEIGHBORHOODS = Array.from({length:10},(_,i)=>'المجاورة '+(i+1));
const ZONES = { 'القادسية':[8,9,10,12,17,20,21,22,23], 'الأمل':[28,29,30,32,33,34,35,36] };
const zoneOf = n => Object.keys(ZONES).find(z=>ZONES[z].includes(n)) || '';

/* ---------- data: published listings from Supabase ---------- */
let UNITS = [], LOADED = false, LOADERR = false;
const toUnit = r => ({ id:r.id, code:r.code||('#'+r.id), d:r.district, zone:r.zone, area_orig:Number(r.area_orig), area_final:Number(r.area_final),
  price:Number(r.price), paid:Number(r.paid), over:Number(r.over_amount), remaining:Number(r.remaining), instLeft:r.inst_left,
  nb:r.neighborhood?('المجاورة '+r.neighborhood):'', f:r.facade||'', v:r.view_type||'', block:r.block||'',
  hours: Math.max(0, Math.round((Date.now() - new Date(r.published_at||r.created_at).getTime())/36e5)), desc:r.description||'' });
async function load(){
  const { data, error } = await sb.from('listings').select('id,code,zone,district,neighborhood,block,area_orig,area_final,facade,view_type,price,paid,over_amount,remaining,inst_left,description,published_at,created_at').eq('state','approved').order('published_at',{ascending:false});
  LOADED = true; LOADERR = !!error; UNITS = (data||[]).map(toUnit); render();
}
const ERR = { invalid_phone:'اكتب رقم موبايل مصري صح، زي 01012345678.', invalid_name:'اكتب اسمك.', too_many_offers:'بعت إعلانات كتير النهارده من الرقم ده. جرب بكرة أو كلمنا واتساب.',
  too_many_requests:'بعت طلبات كتير النهارده. كلمنا واتساب.', listing_not_found:'القطعة دي مش متاحة دلوقتي.', busy:'فيه ضغط دلوقتي. جرب كمان شوية.' };
const errMsg = (err, fb) => { const m = err?.message||''; const k = Object.keys(ERR).find(k=>m.includes(k)); return k ? ERR[k] : fb; };
let REQ = null;
const unitsIn = d => UNITS.filter(x=>x.d===d);
const ago = h => h<2?'من ساعة':h<24?`من ${h} ساعات`:h<48?'امبارح':`من ${Math.round(h/24)} أيام`;
const LOGO = '<svg viewBox="0 0 120 112" aria-hidden="true"><g fill="none" stroke="#B08D57" stroke-width="10"><path d="M10 108 L64 46 A26 26 0 0 1 108 64 L108 108"/><path d="M36 108 L76 62"/><path d="M62 108 L84 83"/></g><g fill="#B08D57"><path d="M52 6h20l-7 10H45z"/><path d="M80 6h20l-7 10H73z"/></g></svg>';
const WM = 'تِـــــلاد';
const BACK = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
function services(x){
  const out = [];
  if(x.v==='حديقة') out.push(['قدام حديقة','svc']); if(x.v==='خدمات') out.push(['قدام خدمات','svc']); if(x.v==='شارع رئيسي') out.push(['على شارع رئيسي','svc']);
  if(x.f==='ناصية') out.push(['ناصية','svc']);
  if(!out.length) out.push(['من غير خدمات قريبة','no']);
  if(x.f && x.f!=='ناصية') out.push([`واجهة ${x.f}`,'']);
  return out;
}

/* ---------- state ---------- */
let zone = 'القادسية', dist = 0, sort = 'price', cmp = [];
const SORTS = [['price','الأرخص الأول',(a,b)=>a.price-b.price],['rem','أقل متبقي',(a,b)=>a.remaining-b.remaining],['area','الأكبر مساحة',(a,b)=>b.area_final-a.area_final],['new','الأحدث',(a,b)=>a.hours-b.hours]];
const app = document.getElementById('app'), dock = document.querySelector('#dock>div');

function ticket(x){
  const svc = services(x).filter(s=>s[1]==='svc').map(s=>s[0]), on = cmp.includes(x.id);
  return `<article class="tk${on?' sel':''}">
    <button class="stub" data-a="unit" data-id="${x.id}" aria-label="افتح القطعة في الحي ${x.d}"><small>الحي</small><b class="num">${x.d}</b><i>${esc(x.nb.replace('المجاورة','مجاورة'))}</i></button>
    <div class="tb" data-a="unit" data-id="${x.id}" role="button" tabindex="0">
      <div class="t1"><span class="p"><span>السعر الكلي</span><b>${jm(x.price)}</b></span><span class="area"><b class="num">${x.area_final}</b><small>م²</small></span></div>
      <div class="t2"><div class="pd"><span>المطلوب دفعه</span><b class="num">${money(x.paid)}</b></div><div class="rm"><span>المتبقي</span><b class="num">${money(x.remaining)}</b></div><div class="in"><span>أقساط</span><b class="num">${x.instLeft}</b></div></div>
      <div class="t3">${svc.length?`<span class="svc">${svc.join(' · ')}</span>`:'<span>من غير خدمات قريبة</span>'}
        <button class="cmpb" data-a="cmp" data-id="${x.id}" aria-pressed="${on}"><i></i>قارن</button></div>
      <div class="t4"><button class="pb sm ink" data-a="req" data-id="${x.id}">اطلبها</button>${waBtn(`السلام عليكم، أنا مهتم بالقطعة ${x.code} في الحي ${x.d} (${x.area_final} م²، السعر الكلي ${money(x.price)} جنيه).`, 'pb sm wa', 'واتساب')}</div>
    </div></article>`;
}
// WhatsApp: Telad's number (01024151524).
const WA_NUMBER = '201024151524';
const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';
const waBtn = (text, cls, label) => WA_NUMBER
  ? `<a class="${cls}" href="https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${WA_ICON}${label}</a>`
  : `<button class="${cls}" data-a="wa">${WA_ICON}${label}</button>`;

/* ---------- filters ---------- */
const F0 = () => ({ pmin:'', pmax:'', paidMax:'', remMax:'', area:[], inst:[], view:[], facade:[], nb:[] });
let F = F0();
const fCount = () => ['pmin','pmax','paidMax','remMax'].filter(k=>num(F[k])!=null).length + ['area','inst','view','facade','nb'].filter(k=>F[k].length).length;
function applyF(list){
  const n = k => num(F[k]);
  return list.filter(x => (n('pmin')==null || x.price>=n('pmin')) && (n('pmax')==null || x.price<=n('pmax')) &&
    (n('paidMax')==null || x.paid<=n('paidMax')) && (n('remMax')==null || x.remaining<=n('remMax')) &&
    (!F.area.length || F.area.includes(x.area_final)) && (!F.inst.length || F.inst.includes(x.instLeft)) &&
    (!F.view.length || F.view.includes(x.v)) && (!F.facade.length || F.facade.includes(x.f)) &&
    (!F.nb.length || F.nb.includes(x.nb)));
}
const inZone = () => UNITS.filter(x=>x.zone===zone && (!dist || x.d===dist));
function filterBody(){
  const chips = (k, opts, lab=v=>v) => `<div class="chips">${opts.map(v=>`<button class="chip" data-a="fchip" data-k="${k}" data-v="${esc(v)}" aria-pressed="${F[k].includes(v)}">${lab(v)}</button>`).join('')}</div>`;
  const mIn = (k, ph) => `<input id="f-${k}" data-f="${k}" inputmode="numeric" placeholder="${ph}" value="${esc(F[k])}">`;
  return `
    <div class="field money"><span class="lbl">السعر الكلي</span><div class="two">${mIn('pmin','من')}${mIn('pmax','لحد')}</div></div>
    <div class="two"><div class="field money"><label for="f-paidMax">المطلوب دفعه لحد</label>${mIn('paidMax','أي مبلغ')}</div><div class="field money"><label for="f-remMax">المتبقي لحد</label>${mIn('remMax','أي مبلغ')}</div></div>
    <div class="field"><span class="lbl">المساحة بعد التقنين</span>${chips('area',[209,276,300,350,400,450,500],v=>`<span class="num">${v}</span> م²`)}</div>
    <div class="field"><span class="lbl">الأقساط المتبقية</span>${chips('inst',[1,2,3])}</div>
    <div class="field"><span class="lbl">القطعة قدامها</span>${chips('view',VIEWS)}</div>
    <div class="field"><span class="lbl">الواجهة</span>${chips('facade',FACADES)}</div>
    <div class="field"><span class="lbl">المجاورة</span>${chips('nb',NEIGHBORHOODS,v=>v.replace('المجاورة ',''))}</div>`;
}
function openFilters(){
  popAll();
  push('الفلاتر', filterBody(), `<button class="pb" data-a="fclear">مسح الكل</button><button class="pb ink" data-a="fapply" id="fGo">اعرض ${applyF(inZone()).length} قطعة</button>`);
}
const fRefresh = () => { const b = document.getElementById('fGo'); if(b) b.textContent = `اعرض ${applyF(inZone()).length} قطعة`; };
function render(){
  const zd = ZONES[zone], us = applyF(inZone()).sort(SORTS.find(s=>s[0]===sort)[2]), fc = fCount();
  app.innerHTML = `<header class="head">
      <div class="bar"><button class="logo" data-a="top" aria-label="تلاد">${LOGO}<span class="wm">${WM}</span></button><button class="ic" data-a="search" aria-label="ابحث برقم الحي أو كود الوحدة">${SEARCH}</button></div>
      <p class="slogan">العقار <em>قرارٌ</em> لا صفقةٌ</p>
      <div class="zsw" role="group" aria-label="التقسيم">${Object.keys(ZONES).map(z=>`<button data-a="zone" data-z="${z}" aria-pressed="${zone===z}"><b>${z}</b><small><span class="num">${UNITS.filter(x=>x.zone===z).length}</span> قطعة</small></button>`).join('')}</div>
      <p class="dstrip-l">اختار رقم الحي</p>
      <div class="dstrip" role="group" aria-label="أحياء ${zone}">
        <button class="dn all" data-a="dist" data-d="0" aria-pressed="${!dist}"><b>الكل</b><small class="num">${UNITS.filter(x=>x.zone===zone).length}</small></button>
        ${zd.map(n=>{ const c = unitsIn(n).length; return `<button class="dn${c?'':' empty'}" data-a="dist" data-d="${n}" aria-pressed="${dist===n}" aria-label="الحي ${n}، ${c?c+' قطعة':'مفيش قطع'}"><b class="num">${n}</b><small>${c?c+' قطعة':'—'}</small></button>`; }).join('')}
      </div>
    </header>
    <section class="list" aria-live="polite">
      <div class="lh"><h2>${dist?`الحي ${dist}`:`كل أحياء ${zone}`}</h2><span class="cur"><span class="num">${us.length}</span> ${us.length===1?'قطعة':'قطع'}</span></div>
      <div class="sorts" role="group" aria-label="الترتيب والفلاتر"><button class="chip fbtn" data-a="filters" aria-pressed="${fc>0}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>الفلاتر${fc?` <span class="num">(${fc})</span>`:''}</button>${SORTS.map(([k,t])=>`<button class="chip" data-a="sort" data-s="${k}" aria-pressed="${sort===k}">${t}</button>`).join('')}</div>
      ${!LOADED ? '<div class="empty"><b>بنحمّل القطع...</b></div>' : LOADERR ? '<div class="empty"><b>مقدرناش نحمّل القطع.</b><button class="pb ink" data-a="reload">جرب تاني</button></div>' : us.length ? us.map(ticket).join('') : fc ? `<div class="empty"><b>مفيش قطع بالفلاتر دي.</b><span>جرّب توسّع الفلاتر أو امسحها.</span><button class="pb ink" data-a="fclear">امسح الفلاتر</button></div>`
        : `<div class="empty"><b>مفيش قطع معروضة ${dist?`في الحي ${dist}`:`في ${zone}`} دلوقتي.</b><span>سيب رقمك ونكلمك أول ما تنزل قطعة هنا.</span><button class="pb ink" data-a="ask" data-d="${dist}">بلّغني لما تنزل قطعة</button></div>`}
    </section>
    <div class="trust"><div><b>كل إعلان بيتراجع</b> قبل ما ينزل على تِلاد.</div><div><b>رقم القطعة وتليفون صاحبها</b> مش بيظهروا لحد غير فريق تِلاد.</div><div><b>الأسعار استرشادية</b>، والنهائية بيحددها جهاز مدينة العبور الجديدة.</div></div>`;
  renderDock();
}
function renderDock(){
  dock.innerHTML = `${cmp.length?`<div class="cmpbar" role="status"><span>${cmp.length===1?'اختار قطعة تانية للمقارنة':'قطعتين جاهزين للمقارنة'}</span><button class="pb sm" data-a="cmpclear">مسح</button>${cmp.length===2?'<button class="pb sm ink" data-a="compare">قارن</button>':''}</div>`:''}
    <div class="row2"><button class="pb ink" data-a="offer">اعرض قطعتك</button>${waBtn('السلام عليكم، عايز أستفسر عن أراضي القادسية والأمل.', 'pb wa', 'تواصل واتساب')}</div>`;
}

/* ---------- nested sheets (max 3, one back button) ---------- */
const stack = document.getElementById('stack'), levels = [];
function push(title, body, foot=''){
  if(levels.length>=3) pop();
  const d = levels.length+1, lv = document.createElement('div');
  lv.className = `lvl d${d}`; lv.setAttribute('role','dialog'); lv.setAttribute('aria-label', title.replace(/<[^>]+>/g,''));
  lv.innerHTML = `<div class="l-h"><button class="back" data-a="pop">${BACK}${d===1?'قفل':'رجوع'}</button><b>${title}</b><span class="depth" aria-label="المستوى ${d} من 3">${[1,2,3].map(i=>`<i class="${i<=d?'on':''}"></i>`).join('')}</span></div><div class="l-b">${body}</div><div class="l-f"${foot?'':' hidden'}>${foot}</div>`;
  stack.appendChild(lv); levels.push(lv); stack.classList.add('on'); document.body.classList.add('lock'); shade();
  lv.querySelector('.back').focus({preventScroll:true}); return lv;
}
function pop(){ const lv = levels.pop(); if(lv) lv.remove(); if(!levels.length){ stack.classList.remove('on'); document.body.classList.remove('lock'); O = null; } shade(); }
function popAll(){ while(levels.length) pop(); }
function shade(){ levels.forEach((l,i)=>{ const k = levels.length-1-i; l.classList.toggle('under',k===1); l.classList.toggle('under2',k>=2); }); }
const topLvl = () => levels[levels.length-1];

function openUnit(id){
  const x = UNITS.find(u=>u.id===id), pct = Math.round(x.paid/x.price*100);
  popAll();
  push(`الحي ${x.d} · ${x.area_final} م²`, `
    <div class="uhero"><span>السعر الكلي</span><b class="big">${jm(x.price)}</b>
      <div class="split"><i style="width:${pct}%"></i></div><div class="leg"><span>المطلوب دفعه ${money(x.paid)}</span><span>المتبقي ${money(x.remaining)}</span></div>
      <span class="code num">${x.code} · ${ago(x.hours)}</span></div>
    <div class="kv pd"><div><span>المطلوب دفعه</span><b>${jm(x.paid)}</b></div><div><span>منه الأوفر</span><b>${jm(x.over)}</b></div></div>
    <div class="kv rm"><div><span>المتبقي</span><b>${jm(x.remaining)}</b></div><div><span>الأقساط المتبقية</span><b><span class="num">${x.instLeft}</span> ${x.instLeft===1?'قسط':'أقساط'}</b></div></div>
    <div class="kv"><div><span>المكان</span><b>${esc(x.zone)} · الحي ${x.d}</b></div><div><span>المجاورة والبلوك</span><b>${esc(x.nb||'—')}${x.block?` · بلوك <span class="num">${esc(x.block)}</span>`:''}</b></div>
      <div><span>المساحة بعد التقنين</span><b><span class="num">${x.area_final}</span> م²</b></div><div><span>أصل المساحة</span><b><span class="num">${x.area_orig}</span> م²</b></div></div>
    <div class="badges">${services(x).map(([t,c])=>`<span class="bdg ${c}">${t}</span>`).join('')}</div>
    <p class="note">الأرقام دي كتبها صاحب القطعة وراجعها فريق تِلاد. والأسعار استرشادية.</p>`,
    `<button class="pb" data-a="cmp" data-id="${id}">${cmp.includes(id)?'شيلها من المقارنة':'ضيفها للمقارنة'}</button><button class="pb ink" data-a="req" data-id="${id}">اطلب القطعة</button>`);
}
function openCompare(){
  const [a,b] = cmp.map(id=>UNITS.find(u=>u.id===id));
  const rows = [['السعر الكلي',x=>x.price,'min',1],['المطلوب دفعه',x=>x.paid,'min',1],['الأوفر',x=>x.over,'min',1],['المتبقي',x=>x.remaining,'min',1],['الأقساط المتبقية',x=>x.instLeft,'',0],['المساحة',x=>x.area_final,'max',0],['السعر الكلي للمتر',x=>x.price/x.area_final,'min',1]];
  const cell = (x,[,f,best,m],o) => { const v = f(x), w = f(o), good = best==='min'?v<w:best==='max'?v>w:false; return `<div class="${good?'best':''}">${m?jm(v):`<span class="num">${v}</span>${best==='max'?' م²':''}`}</div>`; };
  popAll();
  push('مقارنة قطعتين', `<div class="cmp"><div class="k"></div><div class="h">الحي ${a.d}</div><div class="h">الحي ${b.d}</div>
    ${rows.map(r=>`<div class="k">${r[0]}</div>${cell(a,r,b)}${cell(b,r,a)}`).join('')}
    <div class="k">الخدمات</div><div>${services(a).filter(s=>s[1]==='svc').map(s=>s[0]).join('، ')||'—'}</div><div>${services(b).filter(s=>s[1]==='svc').map(s=>s[0]).join('، ')||'—'}</div></div>
    <p class="note">الخانة المميزة هي الأفضل في كل صف.</p>`,
    `<button class="pb" data-a="unit" data-id="${a.id}">افتح الحي ${a.d}</button><button class="pb" data-a="unit" data-id="${b.id}">افتح الحي ${b.d}</button>`);
}
function openReq(id){
  const x = UNITS.find(u=>u.id===id); REQ = { listing_id:id };
  push('اطلب القطعة', `<p style="margin:0;font-size:14px">قطعة <span class="num">${x.code}</span> في الحي ${x.d}. سيب اسمك ورقمك، وفريق تِلاد هيكلمك ويرتب المعاينة.</p>
    <div class="field"><label for="rqN">اسمك</label><input id="rqN" autocomplete="name" maxlength="80"></div>
    <div class="field"><label for="rqP">رقم موبايلك</label><input id="rqP" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx"></div><p class="err" id="rqE" hidden></p>`,
    `<button class="pb ink" data-a="send">ابعت الطلب</button>`);
}
function openAsk(d){
  popAll(); REQ = { d };
  push('اطلب قطعة', `<p style="margin:0;font-size:14px">${d?`عايز قطعة في الحي ${d}؟`:'مش لاقي اللي يناسبك؟'} قولنا بتدوّر على إيه، وإحنا ندوّرلك.</p>
    <div class="field"><span class="lbl">التقسيم</span><div class="seg">${Object.keys(ZONES).map(z=>`<button data-a="tog1" aria-pressed="${(d?zoneOf(d):zone)===z}">${z}</button>`).join('')}</div></div>
    <div class="field money"><label for="akB">ميزانيتك التقريبية <span class="opt">اختياري</span></label><input id="akB" inputmode="numeric" placeholder="مثلاً 1000000"></div>
    <div class="field"><label for="rqN">اسمك</label><input id="rqN" autocomplete="name" maxlength="80"></div>
    <div class="field"><label for="rqP">رقم موبايلك</label><input id="rqP" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx"></div><p class="err" id="rqE" hidden></p>`,
    `<button class="pb ink" data-a="send">ابعت</button>`);
}
function openSearch(){
  popAll();
  push('ابحث', `<div class="field"><label for="sq">رقم الحي أو كود الوحدة</label><input id="sq" inputmode="search" autocomplete="off" placeholder="مثلاً 12 أو Q2611-103"></div><div class="sugg" id="sg"></div>`);
  document.getElementById('sq').focus();
}
function suggestions(text){
  const t = toEn(text).trim(); if(!t) return '';
  const n = (t.match(/\d+/g)||[]).pop(); if(!n) return '<p class="note">اكتب رقم الحي (زي 12 أو 29) أو كود الوحدة.</p>';
  const d = Number(n), out = [];
  if(zoneOf(d)) out.push(`<button data-a="goDist" data-d="${d}"><span class="n num">${d}</span><span>الحي ${d}<small>${zoneOf(d)} · ${unitsIn(d).length?unitsIn(d).length+' قطعة':'مفيش قطع دلوقتي'}</small></span></button>`);
  const u = UNITS.find(x=>x.id===d); if(u) out.push(`<button data-a="unit" data-id="${u.id}"><span class="n num" style="font-size:12px">${u.id}</span><span>الوحدة ${u.code}<small>${u.area_final} م² · الحي ${u.d} · ${money(u.price)} ج.م</small></span></button>`);
  return out.join('') || `<p class="note">الرقم ${esc(n)} مش من أحياء القادسية ولا الأمل. القادسية: ${ZONES['القادسية'].join('، ')}. الأمل: ${ZONES['الأمل'].join('، ')}.</p>`;
}

/* ---------- offer: one sheet, 5 steps ---------- */
const OSTEPS = ['القطعة','الأسعار وبياناتك'];
let O = null;
const blankO = () => ({ step:0, zone, d:dist||0, nb:'', block:'', plot:'', area_orig:'', area_final:'', f:'', v:'', price:'', paid:'', over:'', remaining:'', instLeft:'', name:'', phone:'', desc:'', err:'' });
function openOffer(){ popAll(); O = blankO(); push('اعرض قطعتك', '', ''); drawOffer(); }
function moneyField(k, label){ const v = num(O[k]);
  return `<div class="field money"><label for="o-${k}">${label}</label><input id="o-${k}" data-o="${k}" inputmode="numeric" placeholder="اكتب المبلغ" value="${esc(O[k])}"><span class="echo" id="e-${k}">${v!=null?`${money(v)} ج.م`:''}</span></div>`; }
// المتبقي = السعر الكلي − المطلوب دفعه (الأوفر جزء من المطلوب دفعه).
const autoRemaining = () => { const p = num(O.price), d = num(O.paid); return p!=null && d!=null ? p - d : null; };
function remainingBox(){ const r = autoRemaining();
  return `<span class="lbl">المتبقي <span class="auto">تلقائي</span></span><div class="autobox${r==null?' empty':''}${r!=null&&r<0?' bad':''}">${r==null?'بيتحسب لما تكتب السعر الكلي والمطلوب دفعه':`${money(r)} <span class="cur">ج.م</span>`}</div>`; }
function priceWarnings(){
  const p = num(O.price), d = num(O.paid), o = num(O.over), w = [];
  if(p!=null && d!=null && d>p) w.push('المطلوب دفعه أكبر من السعر الكلي. راجع الرقمين.');
  if(o!=null && d!=null && o>d) w.push('الأوفر أكبر من المطلوب دفعه. الأوفر جزء من المطلوب دفعه، راجع الرقمين.');
  return w;
}
function offerStep(){
  const s = O.step;
  const s0 = `
    <div class="field"><span class="lbl">التقسيم</span><div class="seg">${Object.keys(ZONES).map(z=>`<button data-a="ozone" data-z="${z}" aria-pressed="${O.zone===z}">${z}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">رقم الحي</span><div class="dgrid">${ZONES[O.zone].map(n=>`<button data-a="od" data-d="${n}" aria-pressed="${O.d===n}" class="num">${n}</button>`).join('')}</div></div>
    <div class="field"><label for="o-nb">المجاورة <span class="opt">اختياري</span></label><select id="o-nb" data-o="nb"><option value="">اختار</option>${NEIGHBORHOODS.map(n=>`<option ${O.nb===n?'selected':''}>${n}</option>`).join('')}</select></div>
    <div class="two"><div class="field"><label for="o-block">البلوك <span class="opt">اختياري</span></label><input id="o-block" data-o="block" maxlength="40" value="${esc(O.block)}"></div>
      <div class="field"><label for="o-plot">رقم القطعة <span class="opt">لو موجود</span></label><input id="o-plot" data-o="plot" maxlength="40" value="${esc(O.plot)}"></div></div>`;
  if(s===0) return `${s0}
    <div class="two"><div class="field"><label for="o-area_orig">أصل المساحة (م²)</label><input id="o-area_orig" data-o="area_orig" inputmode="decimal" placeholder="مثلاً 300" value="${esc(O.area_orig)}"></div>
      <div class="field"><label for="o-area_final">المساحة بعد التقنين (م²)</label><input id="o-area_final" data-o="area_final" inputmode="decimal" placeholder="مثلاً 276" value="${esc(O.area_final)}"></div></div>
    <div class="field"><span class="lbl">الواجهة</span><div class="chips">${FACADES.map(v=>`<button class="chip" data-a="ochip" data-k="f" data-v="${v}" aria-pressed="${O.f===v}">${v}</button>`).join('')}</div></div>
    <div class="field"><span class="lbl">القطعة قدامها إيه؟</span><div class="chips">${VIEWS.map(v=>`<button class="chip" data-a="ochip" data-k="v" data-v="${v}" aria-pressed="${O.v===v}">${v}</button>`).join('')}</div></div>`;
  return `
    <div class="kv"><div><span>قطعتك</span><b>${esc([O.zone, 'الحي '+O.d, O.nb].filter(Boolean).join(' · '))} · <span class="num">${esc(O.area_final)}</span> م²</b></div></div>
    ${moneyField('price','السعر الكلي')}
    <div class="two">${moneyField('paid','المطلوب دفعه')}${moneyField('over','الأوفر')}</div>
    <div class="two"><div class="field" id="o-rem">${remainingBox()}</div>
      <div class="field"><label for="o-instLeft">الأقساط المتبقية</label><select id="o-instLeft" data-o="instLeft"><option value="" ${O.instLeft===''?'selected':''} disabled>اختار</option>${[1,2,3].map(n=>`<option value="${n}" ${String(O.instLeft)===String(n)?'selected':''}>${n}</option>`).join('')}</select></div></div>
    <div id="o-warn">${priceWarnings().map(w=>`<p class="warn">${esc(w)}</p>`).join('')}</div>
    <div class="two"><div class="field"><label for="o-name">اسمك</label><input id="o-name" data-o="name" autocomplete="name" maxlength="80" value="${esc(O.name)}"></div>
      <div class="field"><label for="o-phone">رقم موبايلك</label><input id="o-phone" data-o="phone" class="num" type="tel" inputmode="tel" placeholder="01xxxxxxxxx" value="${esc(O.phone)}"></div></div>
    <div class="field"><label for="o-desc">وصف <span class="opt">اختياري</span></label><textarea id="o-desc" data-o="desc" maxlength="1000">${esc(O.desc)}</textarea></div>`;
}
function drawOffer(){
  const lv = levels[0]; if(!lv || !O) return;
  const last = O.step===OSTEPS.length-1;
  lv.querySelector('.l-b').innerHTML = `<div class="steps" aria-hidden="true">${OSTEPS.map((_,i)=>`<i class="${i<O.step?'done':i===O.step?'on':''}"></i>`).join('')}</div>
    <p class="step-n">خطوة <span class="num">${O.step+1}</span> من <span class="num">${OSTEPS.length}</span>: <b>${OSTEPS[O.step]}</b></p>${offerStep()}${O.err?`<p class="err" role="alert">${esc(O.err)}</p>`:''}`;
  const f = lv.querySelector('.l-f'); f.hidden = false;
  f.innerHTML = `${O.step?'<button class="pb" data-a="oback">رجوع</button>':''}<button class="pb ink" data-a="onext">${last?'ابعت للمراجعة':'التالي'}</button>`;
}
function validateOffer(){
  const s = O.step, n = k => num(O[k]);
  if(s===0){ if(!O.d) return 'اختار رقم الحي.'; if(!(n('area_orig')>0)) return 'اكتب أصل المساحة بالأرقام.'; if(!(n('area_final')>0)) return 'اكتب المساحة بعد التقنين بالأرقام.'; }
  if(s===1){ if(!(n('price')>0)) return 'اكتب السعر الكلي.'; if(n('paid')==null) return 'اكتب المطلوب دفعه.'; if(n('over')==null) return 'اكتب الأوفر.'; if(autoRemaining()<0) return 'المطلوب دفعه أكبر من السعر الكلي. راجع الرقمين.'; if(!O.instLeft) return 'اختار عدد الأقساط المتبقية.';
    if(O.name.trim().length<2) return 'اكتب اسمك.'; if(!/^01[0125]\d{8}$/.test(toEn(O.phone).replace(/\D/g,''))) return 'اكتب رقم موبايل مصري صح، زي 01012345678.'; }
  return '';
}

/* ---------- events ---------- */
let tT; const toast = m => { const t = document.getElementById('toast'); t.querySelector('span').textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(()=>t.hidden=true, 2600); };
const doneSheet = (title, text) => { popAll(); push('تمام', `<div class="done"><i><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i><b style="font-family:var(--f-d);font-size:19px;color:var(--ink)">${title}</b><span class="cur" style="font-size:14px">${text}</span></div>`); };
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a]'); if(!t) return;
  const a = t.dataset.a, id = Number(t.dataset.id);
  if(a==='cmp') ev.stopPropagation();
  switch(a){
    case 'top': window.scrollTo({top:0, behavior:'smooth'}); break;
    case 'zone': zone = t.dataset.z; dist = 0; render(); break;
    case 'dist': dist = Number(t.dataset.d); render(); break;
    case 'goDist': popAll(); dist = Number(t.dataset.d); zone = zoneOf(dist); render(); break;
    case 'sort': sort = t.dataset.s; render(); break;
    case 'unit': openUnit(id); break;
    case 'cmp': { if(cmp.includes(id)) cmp = cmp.filter(v=>v!==id); else { if(cmp.length>=2) cmp.shift(); cmp.push(id); }
      if(levels.length){ const b = topLvl().querySelector('[data-a="cmp"]'); if(b) b.textContent = cmp.includes(id)?'شيلها من المقارنة':'ضيفها للمقارنة'; }
      render(); toast(cmp.includes(id)?'اتضافت للمقارنة':'اتشالت من المقارنة'); break; }
    case 'cmpclear': cmp = []; render(); break;
    case 'compare': openCompare(); break;
    case 'req': openReq(id); break;
    case 'ask': openAsk(Number(t.dataset.d)||0); break;
    case 'wa': toast('رقم واتساب تِلاد لسه هيتحدد. لما يتحط، الزرار هيفتح المحادثة ومعاها بيانات القطعة.'); break;
    case 'filters': openFilters(); break;
    case 'reload': LOADED = false; render(); load(); break;
    case 'fchip': { const k = t.dataset.k, raw = t.dataset.v, v = /^\d+$/.test(raw) ? Number(raw) : raw;
      F[k] = F[k].includes(v) ? F[k].filter(x=>x!==v) : [...F[k], v]; t.setAttribute('aria-pressed', F[k].includes(v)); fRefresh(); break; }
    case 'fclear': F = F0(); if(levels.length && topLvl().querySelector('#fGo')){ topLvl().querySelector('.l-b').innerHTML = filterBody(); fRefresh(); } render(); break;
    case 'fapply': popAll(); render(); break;
    case 'search': openSearch(); break;
    case 'offer': openOffer(); break;
    case 'ozone': if(O.zone!==t.dataset.z){ O.zone = t.dataset.z; O.d = 0; } drawOffer(); break;
    case 'od': O.d = Number(t.dataset.d); O.err=''; drawOffer(); break;
    case 'ochip': O[t.dataset.k] = O[t.dataset.k]===t.dataset.v ? '' : t.dataset.v; drawOffer(); break;
    case 'oback': O.err=''; O.step--; drawOffer(); break;
    case 'onext': { const e = validateOffer(); O.err = e; if(e){ drawOffer(); levels[0].querySelector('.l-b').scrollTop = 1e6; break; }
      if(O.step===OSTEPS.length-1){ const p = { zone:O.zone, district:O.d, neighborhood:O.nb?O.nb.replace('المجاورة ',''):'', block:O.block, plot_number:O.plot,
          area_orig:num(O.area_orig), area_final:num(O.area_final), facade:O.f, view_type:O.v, price:num(O.price), paid:num(O.paid), over_amount:num(O.over),
          inst_left:Number(O.instLeft), description:O.desc, name:O.name.trim(), phone:toEn(O.phone).replace(/\D/g,'') };
        t.disabled = true; t.textContent = 'بيتبعت...';
        sb.rpc('submit_offer', { p }).then(({ data, error }) => {
          if(error){ O.err = errMsg(error, 'مقدرناش نبعت الإعلان. جرب تاني.'); drawOffer(); return; }
          doneSheet('وصلنا إعلانك', `رقمه المرجعي <b class="num">#${data}</b>. فريق تِلاد هيراجعه وينشره بكود وحدة ثابت.`); });
        break; }
      O.step++; drawOffer(); levels[0].querySelector('.l-b').scrollTop = 0; break; }
    case 'tog1': t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', b===t)); break;
    case 'send': { const n = document.getElementById('rqN'), p = document.getElementById('rqP'), e = document.getElementById('rqE');
      const name = n ? n.value.trim() : '', phone = p ? toEn(p.value).replace(/\D/g,'') : '';
      if(name.length<2){ e.hidden = false; e.textContent = 'اكتب اسمك.'; break; }
      if(!/^01[0125]\d{8}$/.test(phone)){ e.hidden = false; e.textContent = 'اكتب رقم موبايل مصري صح، زي 01012345678.'; break; }
      const payload = { name, phone };
      if(REQ?.listing_id) payload.listing_id = REQ.listing_id;
      else { const z = topLvl().querySelector('[data-a="tog1"][aria-pressed="true"]'); if(z) payload.zone = z.textContent.trim(); if(REQ?.d) payload.district = REQ.d;
        const b = num(document.getElementById('akB')?.value); if(b!=null) payload.budget = b; }
      const label = t.textContent; t.disabled = true; t.textContent = 'بيتبعت...';
      sb.rpc('submit_request', { p: payload }).then(({ error }) => {
        if(error){ t.disabled = false; t.textContent = label; e.hidden = false; e.textContent = errMsg(error, 'مقدرناش نبعت الطلب. جرب تاني.'); return; }
        doneSheet('وصل', 'فريق تِلاد هيكلمك قريب.'); });
      break; }
    case 'pop': case 'scrim': pop(); break;
  }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if(el.id==='sq'){ document.getElementById('sg').innerHTML = suggestions(el.value); return; }
  if(el.dataset.o && O){ O[el.dataset.o] = el.value;
    const e = document.getElementById('e-'+el.dataset.o); if(e){ const v = num(el.value); e.textContent = v!=null ? `${money(v)} ج.م` : ''; }
    const w = document.getElementById('o-warn'); if(w) w.innerHTML = priceWarnings().map(x=>`<p class="warn">${esc(x)}</p>`).join('');
    const rb = document.getElementById('o-rem'); if(rb){ O.remaining = autoRemaining() ?? ''; rb.innerHTML = remainingBox(); } return; }
  if(el.dataset.f){ F[el.dataset.f] = el.value; fRefresh(); }
});
document.addEventListener('keydown', ev => {
  if(ev.key==='Escape' && levels.length) pop();
  if(ev.key==='Enter' && ev.target.matches && ev.target.matches('.tb')) openUnit(Number(ev.target.dataset.id));
  if(ev.key==='Enter' && ev.target.id==='sq'){ const b = document.querySelector('#sg button'); if(b) b.click(); }
});
render(); load();

}
