// "حاسبة التقنين" (24/11): the whole legalization bill, step by step, for the desk calculator and the installment review.
// Same rules as the site's offer form (legalSize in market-ui.js), with the area after legalization kept to two decimals
// like the authority's table (208.25, not 208.3). Two open questions are switches until the owner decides:
//   checkBy: 'orig' (the first check by أصل المساحة, the current rule) or 'tier' (by the area after legalization)
//   waiver:  add التنازل (area after legalization × 180) to what is left, or not (the owner said it isn't counted)

export const RULES = {
  minArea: 100, autoBelow: 751, buyPerM: 3000, sellPerM: 700, adminFee: 0.015, waiverPerM: 180, instCount: 3,
  // أصل المساحة below each limit → the area after legalization from the authority's table
  byArea: [[276, 209], [375, 276], [475, 350], [525, 400], [600, 450], [751, 500]],
};
const r2 = (n) => Math.round(n * 100) / 100;
export const cutFor = (a) => (a <= 300 ? 0.15 : 0.2);
export const perMFor = (tier) => (tier <= 300 ? 1200 : 1400);
export const checkFor = (a) => (a <= 300 ? 60000 : a <= 500 ? 100000 : 150000);
export const baseTier = (a) => (RULES.byArea.find(([lim]) => a < lim) || [])[1] || null;
export const tierOptions = (a) => { const b = baseTier(a); return b ? RULES.byArea.map(([, t]) => t).filter((t) => t <= b) : []; };

// f: { alloc, ao, pick (a smaller area after legalization), af (typed, above 750 م²), stage, chkPaid, first (YYYY-MM of the
//      first installment, received plots), paid (the seller's price) }  ·  o: { checkBy, waiver, today: 'YYYY-MM' }
export function calc(f, o = {}) {
  const ao = Number(f.ao);
  if (!(ao >= RULES.minArea)) return { err: 'اكتب أصل المساحة (100 م² أو أكتر).' };
  const cutPct = cutFor(ao), cut = r2(ao * cutPct), net = r2(ao - cut);
  const base = baseTier(ao), options = tierOptions(ao);
  let tier, picked = false;
  if (base) { tier = base; const p = Number(f.pick); if (p && options.includes(p) && p !== base) { tier = p; picked = true; } }
  else { tier = Number(f.af); if (!(tier > 0 && tier <= net)) return { err: 'أصل المساحة فوق 750 م²: اكتب المساحة بعد التقنين (أقل من الصافي ' + net + ' م²).', net, cut, cutPct }; }
  const perM = perMFor(tier), kept = Math.min(net, tier), missing = r2(Math.max(0, tier - net)), extra = r2(Math.max(0, net - tier));
  const legal = r2(kept * perM), buy = r2(missing * RULES.buyPerM), sell = r2(extra * RULES.sellPerM);
  const total = r2(legal + buy - sell), admin = r2(total * RULES.adminFee), grand = r2(total + admin), quarter = r2(grand / 4);
  const check = o.checkBy === 'tier' ? checkFor(tier) : checkFor(ao);
  const completion = r2(quarter - check), credit = completion < 0 ? -completion : 0;
  const alloc = f.alloc !== false && f.alloc !== 'false';
  const stage = alloc ? f.stage || 'not_completed' : '';
  const showComp = !alloc || stage === 'not_completed';
  const inst = r2(quarter - (showComp ? credit / RULES.instCount : 0));
  // the three yearly installments: from the first installment's month for a received plot
  let sched = null, left = RULES.instCount;
  if (alloc && stage === 'received') {
    const m = /^(\d{4})-(\d{2})$/.exec(f.first || '');
    if (m) {
      sched = [0, 1, 2].map((i) => `${Number(m[1]) + i}-${m[2]}`);
      const today = o.today || new Date().toISOString().slice(0, 7);
      left = sched.filter((d) => d > today).length;
    } else left = null;
  }
  const waiver = o.waiver ? r2(tier * RULES.waiverPerM) : 0;
  const checkItem = !alloc && !(f.chkPaid === true || f.chkPaid === 'yes') ? check : 0;
  const remaining = left == null ? null : r2(checkItem + waiver + (showComp ? Math.max(0, completion) : 0) + inst * left);
  const paid = Number(f.paid) > 0 ? Number(f.paid) : null;
  const price = paid != null && remaining != null ? r2(paid + remaining) : null;
  const pm = price != null ? Math.round(price / (alloc ? tier : ao)) : null;
  return { ao, cutPct, cut, net, base, options, tier, picked, perM, kept, missing, extra, legal, buy, sell, total, admin, grand, quarter,
    check, completion, comp: showComp ? Math.max(0, completion) : null, credit: showComp ? credit : 0, inst, left, sched, stage, alloc,
    waiver, checkItem, remaining, paid, price, pm };
}
