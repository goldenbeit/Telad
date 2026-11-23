// Reads the first sheet of an .xlsx file in the browser, with no library (23/11): an .xlsx is a zip of XML files.
// The zip is walked through its central directory and each part is inflated with the browser's DecompressionStream.

const u16 = (d, o) => d.getUint16(o, true);
const u32 = (d, o) => d.getUint32(o, true);

async function unzip(buf) {
  const d = new DataView(buf), files = {};
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (u32(d, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not_xlsx');
  const n = u16(d, e + 10); let p = u32(d, e + 16);
  const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (u32(d, p) !== 0x02014b50) throw new Error('not_xlsx');
    const method = u16(d, p + 10), size = u32(d, p + 20), nl = u16(d, p + 28), xl = u16(d, p + 30), cl = u16(d, p + 32), lo = u32(d, p + 42);
    const name = dec.decode(new Uint8Array(buf, p + 46, nl));
    files[name] = { method, size, lo };
    p += 46 + nl + xl + cl;
  }
  return async (name) => {
    const f = files[name]; if (!f) return null;
    const start = f.lo + 30 + u16(d, f.lo + 26) + u16(d, f.lo + 28), raw = new Uint8Array(buf, start, f.size);
    if (f.method === 0) return dec.decode(raw);
    if (f.method !== 8) throw new Error('not_xlsx');
    const out = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return dec.decode(out);
  };
}

const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const all = (n, tag) => [...n.getElementsByTagNameNS('*', tag)];
const colOf = (ref) => { let c = 0; for (const ch of String(ref).replace(/[0-9]/g, '')) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };

// -> array of rows, each an array of cell texts (formulas give their saved value, or '' if none was saved)
export async function readXlsx(file) {
  if (typeof DecompressionStream === 'undefined') throw new Error('old_browser');
  const get = await unzip(await file.arrayBuffer());
  let path = 'xl/worksheets/sheet1.xml';
  const wb = await get('xl/workbook.xml'), rels = await get('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = all(xml(wb), 'sheet')[0], rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const rel = rid && all(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid);
    if (rel) { const t = rel.getAttribute('Target'); path = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, ''); }
  }
  const ssx = await get('xl/sharedStrings.xml');
  const ss = ssx ? all(xml(ssx), 'si').map((si) => all(si, 't').map((t) => t.textContent).join('')) : [];
  const sx = await get(path); if (!sx) throw new Error('not_xlsx');
  const rows = [];
  all(xml(sx), 'row').forEach((r) => {
    const ri = Number(r.getAttribute('r')) - 1, row = [];
    all(r, 'c').forEach((c, i) => {
      const t = c.getAttribute('t'), v = all(c, 'v')[0], ref = c.getAttribute('r'); let val = '';
      if (t === 's') val = v ? ss[Number(v.textContent)] ?? '' : '';
      else if (t === 'inlineStr') val = all(c, 't').map((x) => x.textContent).join('');
      else val = v ? v.textContent : '';
      row[ref ? colOf(ref) : i] = val;
    });
    rows[ri >= 0 ? ri : rows.length] = row;
  });
  return Array.from(rows, (r) => Array.from(r || [], (x) => (x == null ? '' : String(x))));
}

// ---------- the sheet's columns -> plot rows for desk_import ----------
const nrm = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْـ]/g, '').replace(/[^ء-يa-zA-Z0-9]/g, '');
const COLS = [
  ['zone', ['المنطقه']], ['district', ['الحي']], ['nb', ['المجاوره']], ['block', ['البلوك']], ['plot', ['رقمالقطعه', 'القطعه']],
  ['alloc', ['مخصصه', 'مخصص', 'النوع']], ['stage', ['المرحله', 'حالهالقطعه']],
  ['area_orig', ['اصلالمساحه', 'اصلالمساحهم2', 'اصلالمساحهم']], ['area_final', ['المساحهبعدالتقنين', 'المساحهبعدالتقنينم2', 'المساحهبعدالتقنينم', 'المساحه', 'المقاس']],
  ['paid', ['المطلوبدفعه', 'المطلوبدفعهجم', 'المقدم']], ['remaining', ['المتبقي', 'المتبقيجم']], ['total', ['السعرالكلي', 'السعرالكليجم', 'السعر']],
  ['inst_left', ['الاقساطالمتبقيه', 'عددالاقساطالمتبقيه', 'عددالاقساط']],
  ['owner', ['البائعالمعلن', 'البائع', 'المعلن', 'اسمالبائع', 'المالك']], ['phone', ['رقمالبائع', 'رقمالمعلن', 'الموبايل', 'رقمالموبايل', 'التليفون', 'رقمالتليفون']],
  ['phone2', ['رقمتاني', 'رقمثاني']], ['descr', ['الوصف', 'المميزات', 'ملاحظات']], ['sales', ['السيلز', 'اسمالسيلز']],
];
const COL_BY = new Map(COLS.flatMap(([k, a]) => a.map((x) => [x, k])));
const num = (s) => { const t = String(s ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[,\s،]|ج\.?م\.?|م2|م²|جنيه/g, ''); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
const digits = (s) => String(s ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\.0+$/, '').replace(/[^0-9]/g, '');

export function importRows(matrix) {
  let hi = -1, map = null;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const m = {}; (matrix[i] || []).forEach((h, j) => { const k = COL_BY.get(nrm(h)); if (k && m[k] == null) m[k] = j; });
    if (Object.keys(m).length >= 3) { hi = i; map = m; break; }
  }
  if (hi < 0) return { rows: [], cols: [] };
  const cell = (r, k) => (map[k] == null ? '' : String(r[map[k]] ?? '').trim());
  const rows = [];
  matrix.slice(hi + 1).forEach((r, i) => {
    if (!r) return;
    const paid = num(cell(r, 'paid')), rem = num(cell(r, 'remaining')), tot = num(cell(r, 'total'));
    const phone = digits(cell(r, 'phone')), af = num(cell(r, 'area_final')), ao = num(cell(r, 'area_orig'));
    if (paid == null && !phone && af == null && ao == null) return; // empty or a footer line
    const z = nrm(cell(r, 'zone')), al = nrm(cell(r, 'alloc')), sg = nrm(cell(r, 'stage'));
    rows.push({
      row: hi + i + 2,
      zone: z.includes('قادس') ? 'القادسية' : z.includes('امل') ? 'الأمل' : '',
      district: digits(cell(r, 'district')), nb: digits(cell(r, 'nb')), block: cell(r, 'block'), plot: cell(r, 'plot'),
      alloc: al.startsWith('غير') || al === 'لا' ? 'false' : al.includes('مخصص') || al === 'نعم' ? 'true' : '',
      stage: sg.includes('غيرمستكمل') ? 'not_completed' : sg.includes('غيرمستلم') ? 'completed' : sg.includes('مستلم') ? 'received' : '',
      area_orig: ao ?? '', area_final: af ?? '', paid: paid ?? '',
      price: paid != null && rem != null ? paid + rem : tot ?? '',
      inst_left: num(cell(r, 'inst_left')) ?? '', owner: cell(r, 'owner'), phone, phone2: digits(cell(r, 'phone2')),
      descr: cell(r, 'descr'), sales: cell(r, 'sales'),
    });
  });
  return { rows, cols: Object.keys(map) };
}
export const nameKey = nrm;

// ---------- CSV (the city plan file, plot_features.csv) ----------
export function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, ''), rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
// -> [[district, neighborhood, block_no, block_code, plot_no, status, area_m2, features_ar], ...] or null if the columns aren't there
export function planRows(matrix) {
  const h = (matrix[0] || []).map((x) => String(x).trim()), need = ['district', 'neighborhood', 'block_no', 'block_code', 'plot_no', 'status', 'area_m2', 'features_ar'];
  const ix = need.map((k) => h.indexOf(k)); if (ix.some((i) => i < 0)) return null;
  return matrix.slice(1).filter((r) => r && r.length > 1 && /^\d+$/.test(String(r[ix[0]]).trim())).map((r) => ix.map((i) => String(r[i] ?? '').trim()));
}
