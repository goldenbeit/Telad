// "حلول تِلاد": service copy, request questions and illustrated icons.
// Copy is formal Arabic on purpose; it never says whether a service is paid or free.
const ZOPTS = ['القادسية', 'الأمل'];

export const SVC = {
  invest: { n: 'الاستثمار العقاري', short: 'استثمار', promise: 'نساعدك تختار القطعة الأنسب لرأس مالك وهدفك، بأرقام واضحة.',
    offer: ['نرشّح لك قطعاً تناسب المبلغ المتاح معك وطريقة السداد التي تفضّلها.', 'نوضح لك إجمالي ما ستدفعه: المقدم للبائع، والأقساط السنوية للجهاز.', 'نقارن معك بين أكثر من قطعة من حيث السعر والموقع والمساحة.', 'نعطيك رأينا بصراحة في الأنسب لهدفك، سواء إعادة البيع أو البناء.'],
    q: [{ t: 'رأس المال المتاح', o: ['حتى 500 ألف', '500 ألف – مليون', 'أكثر من مليون'] }, { t: 'طريقة السداد المفضلة', o: ['نقداً', 'مقدم وأقساط'] }, { t: 'هدفك من الاستثمار', o: ['إعادة البيع', 'البناء والتأجير', 'الاحتفاظ طويل الأجل'] }, { t: 'الأفق الزمني', o: ['أقل من سنة', 'من سنة إلى 3 سنوات', 'أكثر من 3 سنوات'] }] },
  develop: { n: 'التطوير العقاري', short: 'تطوير', promise: 'لديك أرض في القادسية أو الأمل؟ نساعدك تبني عليها خطوة بخطوة.',
    offer: ['نقترح عليك أفضل استخدام لأرضك: سكن خاص، أو وحدات للبيع أو للإيجار.', 'نضع معك تصوراً مبدئياً للتكلفة والمدة قبل البدء.', 'ننفّذ البناء أو نتابعه مع المقاول حتى التسليم.', 'نساعدك في بيع الوحدات أو تأجيرها بعد الانتهاء إن رغبت.'],
    q: [{ t: 'موقع الأرض', o: ZOPTS }, { t: 'مساحة الأرض', o: ['أقل من 250 م²', '250 – 350 م²', 'أكثر من 350 م²'] }, { t: 'الغرض من البناء', o: ['سكن خاص', 'وحدات للبيع', 'وحدات للإيجار'] }, { t: 'نموذج التعاون المفضل', o: ['مقاولة', 'شراكة', 'أحتاج إلى توصية'] }] },
  partner: { n: 'الشراكة العقارية', short: 'شراكة', promise: 'تملك أرضاً أو رأس مال؟ نبحث معك عن الشريك والصيغة المناسبة.',
    offer: ['نجمع صاحب الأرض مع صاحب رأس المال المناسب له.', 'نتفق معك على صيغة واضحة للحصص والمسؤوليات قبل أي خطوة.', 'نتابع المشروع ونوافيك بموقفه أولاً بأول.'],
    q: [{ t: 'ماذا تملك؟', o: ['قطعة أرض', 'رأس مال', 'الاثنين معاً'] }, { t: 'الحجم التقريبي', o: ['أقل من مليون', 'مليون – 3 ملايين', 'أكثر من 3 ملايين'] }, { t: 'المدة المتوقعة للشراكة', o: ['أقل من سنتين', 'من سنتين إلى 5 سنوات', 'لم أحدد بعد'] }] },
  assets: { n: 'إدارة الأصول', short: 'إدارة أصول', promise: 'نتولى متابعة عقارك نيابةً عنك، وتبقى على اطلاع دائم.',
    offer: ['نبحث لك عن مستأجر مناسب ونتابع التعاقد.', 'نتابع مواعيد الأقساط السنوية للجهاز حتى لا تتأخر عليك.', 'نتابع الصيانة وأي مشكلة تخص العقار.', 'نتواصل معك دورياً بموقف عقارك.'],
    q: [{ t: 'نوع الأصل', o: ['أرض', 'وحدة سكنية', 'مبنى كامل'] }, { t: 'عدد الأصول', o: ['واحد', 'من 2 إلى 5', 'أكثر من 5'] }, { t: 'ما الذي تحتاجه؟', o: ['تأجير', 'صيانة', 'بيع', 'متابعة كاملة'] }] },
  valuation: { n: 'التقييم العقاري', short: 'تقييم', promise: 'اعرف سعر قطعتك الحقيقي قبل أن تبيع أو تشتري.',
    offer: ['نقارن قطعتك بالقطع المعروضة في نفس الحي، وبأسعار البيع التي نعرفها في السوق.', 'نوضح لك ما يرفع السعر أو يخفضه: الموقع، والواجهة، والمساحة.', 'نقترح عليك سعراً مناسباً للعرض، والتوقيت الأنسب للبيع.'],
    q: [{ t: 'موقع القطعة', o: ZOPTS }, { t: 'المساحة التقريبية', o: ['أقل من 250 م²', '250 – 350 م²', 'أكثر من 350 م²'] }, { t: 'الغرض من التقييم', o: ['البيع', 'الشراء', 'معرفة القيمة فقط'] }, { t: 'متى تحتاج القرار؟', o: ['خلال شهر', 'خلال 3 أشهر', 'غير محدد'] }] },
  consult: { n: 'الاستشارات العقارية', short: 'استشارات', promise: 'عندك سؤال قبل أن تتخذ قرارك؟ اسأل فريق تِلاد.',
    offer: ['إجابة واضحة عن أي سؤال في الشراء أو البيع أو الأقساط.', 'شرح خطوات نقل الملكية وما تحتاجه لإتمامها.', 'رأي صريح يساعدك تحدد خطوتك التالية.'],
    q: [{ t: 'موضوع الاستشارة', o: ['الشراء', 'البيع', 'الأقساط', 'نقل الملكية', 'البناء', 'موضوع آخر'] }, { t: 'اكتب سؤالك باختصار', area: true }] },
};
export const SVC_ORDER = ['invest', 'develop', 'partner', 'assets', 'valuation', 'consult'];

export const WHY = [
  ['eye', 'أرقام واضحة', 'ما تدفعه للبائع، وما تسدده للجهاز سنوياً، أمامك من البداية.'],
  ['pin', 'تخصص في العبور الجديدة', 'نعمل في القادسية والأمل بالعبور الجديدة، ونعرف تفاصيل كل حي فيهما.'],
  ['talk', 'رأي صريح', 'نرشّح لك الأنسب لك، لا الأعلى سعراً.'],
  ['lock', 'خصوصيتك محفوظة', 'رقم القطعة وهاتف صاحبها لا يطّلع عليهما إلا فريق تِلاد.'],
];

const svg = (d) => `<svg class="ln" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const LINE = {
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  pin: svg('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  talk: svg('<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  value: svg('<path d="M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>'),
  build: svg('<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>'),
  tick: '<svg class="tk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/* Illustrated icons in Telad's night/amber/sand with soft gradients and a ground shadow. */
const G = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const SH = '<ellipse cx="32" cy="58" rx="21" ry="3" fill="#15213B" opacity=".13"/>';
export const ART = {
  invest: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('ivA', '#FFD08A', '#E08A12')}${G('ivB', '#2B4170', '#15213B')}</defs>${SH}
  <rect x="32" y="36" width="7" height="20" rx="2" fill="url(#ivB)" opacity=".75"/><rect x="42" y="28" width="7" height="28" rx="2" fill="url(#ivB)" opacity=".9"/><rect x="52" y="19" width="7" height="37" rx="2" fill="url(#ivB)"/>
  ${[0, 1, 2, 3].map((i) => { const y = 48 - i * 6; return `<rect x="6" y="${y}" width="22" height="5" fill="#C97A0A"/><ellipse cx="17" cy="${y + 5}" rx="11" ry="3.6" fill="#B86E08"/><ellipse cx="17" cy="${y}" rx="11" ry="3.6" fill="url(#ivA)"/>`; }).join('')}
  <path d="M8 24l11-9 8 6 17-14" fill="none" stroke="#F0A63A" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M37 7h8v8" fill="none" stroke="#F0A63A" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  develop: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('dvA', '#FFD08A', '#E08A12')}${G('dvB', '#2B4170', '#15213B')}</defs>${SH}
  <rect x="27" y="25" width="26" height="32" rx="2.5" fill="url(#dvB)"/>
  ${[29, 36, 43].map((y) => [31, 38, 45].map((x) => `<rect x="${x}" y="${y}" width="4.5" height="4.5" rx="1" fill="${(x + y) % 3 ? '#FFD08A' : '#F6F2EA'}"/>`).join('')).join('')}
  <rect x="37" y="49" width="6" height="8" rx="1" fill="#F0A63A"/>
  <rect x="11" y="9" width="4.5" height="48" fill="url(#dvA)"/><path d="M11 15l4.5 5M11 25l4.5 5M11 35l4.5 5M11 45l4.5 5" stroke="#B86E08" stroke-width="1.4"/>
  <rect x="5" y="8" width="38" height="4" rx="1.5" fill="url(#dvA)"/><rect x="3" y="7" width="7" height="7" rx="1.5" fill="#22335A"/>
  <path d="M38 12v8" stroke="#15213B" stroke-width="1.6"/><rect x="33.5" y="19.5" width="9" height="5.5" rx="1.2" fill="#E08A12"/></svg>`,
  partner: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('ptA', '#FFD08A', '#E08A12')}${G('ptB', '#2B4170', '#15213B')}</defs>${SH}
  <path d="M6 18h23v9.5a5.5 5.5 0 1 1 0 11V48H6z" fill="url(#ptA)"/>
  <path d="M34 18h24v30H34v-9.5a5.5 5.5 0 1 0 0-11z" fill="url(#ptB)"/>
  <path d="M10 22h8" stroke="#FFF3DC" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
  <path d="M46 9l1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#F0A63A"/></svg>`,
  assets: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('asA', '#FFD08A', '#E08A12')}${G('asB', '#2B4170', '#15213B')}</defs>${SH}
  <rect x="9" y="14" width="28" height="43" rx="2.5" fill="url(#asB)"/><rect x="7" y="11" width="32" height="5" rx="2" fill="#22335A"/>
  ${[19, 27, 35, 43].map((y) => [13, 21, 29].map((x) => `<rect x="${x}" y="${y}" width="4.5" height="4.5" rx="1" fill="${(x * y) % 7 > 3 ? '#FFD08A' : '#F6F2EA'}"/>`).join('')).join('')}
  <circle cx="46" cy="38" r="8.5" fill="none" stroke="url(#asA)" stroke-width="4.5"/><circle cx="46" cy="38" r="2.6" fill="#FFF3DC"/>
  <path d="M52 44l8 8M55.5 47.5l-3 3M58.5 50.5l-3 3" stroke="url(#asA)" stroke-width="4.2" stroke-linecap="round"/></svg>`,
  valuation: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('vlA', '#FFD08A', '#E08A12')}${G('vlB', '#2B4170', '#15213B')}</defs>${SH}
  <path d="M8 31L27 15l19 16v25H8z" fill="#FBF6EC"/>
  <path d="M4.5 32L27 13l22.5 19" fill="none" stroke="url(#vlB)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M8 31v25h38V31" fill="none" stroke="#15213B" stroke-width="2.5"/>
  <rect x="22" y="41" width="10" height="15" rx="1.5" fill="url(#vlB)"/><rect x="12" y="35" width="7" height="6" rx="1" fill="#FFD08A"/>
  <g transform="rotate(-18 48 40)"><path d="M41 30h17v21H41l-7-10.5z" fill="url(#vlA)"/><circle cx="40" cy="40.5" r="2.2" fill="#FBF6EC"/><path d="M45 36h9M45 41h9M45 46h6" stroke="#15213B" stroke-width="2.2" stroke-linecap="round"/></g></svg>`,
  consult: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${G('csA', '#FFD08A', '#E08A12')}${G('csB', '#2B4170', '#15213B')}</defs>${SH}
  <path d="M9 10h30a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H21l-9 8v-8H9a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="url(#csB)"/>
  <circle cx="15" cy="23.5" r="2.8" fill="#F0A63A"/><circle cx="24" cy="23.5" r="2.8" fill="#F0A63A"/><circle cx="33" cy="23.5" r="2.8" fill="#F0A63A"/>
  <path d="M31 30h25a5.5 5.5 0 0 1 5.5 5.5v11A5.5 5.5 0 0 1 56 52h-2v8l-9-8H31a5.5 5.5 0 0 1-5.5-5.5v-11A5.5 5.5 0 0 1 31 30z" fill="url(#csA)"/>
  <path d="M33 38h20M33 44h13" stroke="#15213B" stroke-width="2.6" stroke-linecap="round"/></svg>`,
};
