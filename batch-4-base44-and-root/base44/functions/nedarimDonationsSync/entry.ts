import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// סנכרון תרומות נדרים פלוס למסד המקומי.
// שני מקורות:
//   1) אשראי (GetHistoryJson, Manage3.aspx) — כרטיסי אשראי, ביט, העברה בקליק, קריפטו, והו"ק אשראי.
//   2) מס"ב / הו"ק בנקאי (GetMasavHistoryNew, Masav3.aspx) — חיובי הוראת קבע בנקאית.
// מופעל על ידי workflow שעתי (ללא משתמש) או ידנית על ידי admin.
// ה-API של אשראי מחזיר רשומות מהישן לחדש (מזהה עולה). מתקדמים מנקודת העגינה ומעלה.
// ה-API של מס"ב מחזיר את כל החיובים בטווח תאריכים בבת אחת — לכן כל הרצה מושכת חלון מתגלגל.
const MOSAD_ID = '7001539';
const CREDIT_ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const MASAV_ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Masav3.aspx';
const MAX_CALLS = 3;   // עד 6000 רשומות אשראי בכל הרצה
const PAGE = 2000;
// חלון מס"ב: מושך 3 שנים אחורה בכל הרצה — מכסה ייבוא היסטוריה מלא בהרצה הראשונה ושומר על סנכרון שוטף.
const MASAV_YEARS_BACK = 3;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const apiPassword = secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר מפתח API — הגדר/י את הסוד NEDARIM_API_PASSWORD' }, { status: 500 });

    const body = await req.json().catch(() => ({}));

    // --- סנכרון אשראי ---
    const creditResult = await syncCredit(base44, apiPassword);

    // --- סנכרון מס"ב (הו"ק בנקאי) ---
    const masavResult = await syncMasav(base44, apiPassword, body);

    // --- פיולט: תרומות שהת"ז שלהן נוספה לרשימת הקהילה עוברות אוטומטית מתורם לחבר קהילה ---
    const reconcileResult = await reconcileDonorToCommunity(base44);

    // --- ירושת שיוך: חיובים חדשים עם מס' הו"ק שכבר שויך מקבלים אוטומטית את אותו שיוך ---
    const kevaResult = await inheritKevaAssignment(base44);

    return Response.json({ ok: true, credit: creditResult, masav: masavResult, reconcile: reconcileResult, keva: kevaResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ---- אשראי ----
async function syncCredit(base44, apiPassword) {
  // נקודת עגינה: מזהה העסקה הגבוה ביותר שכבר מאוחסן מקומית (אשראי בלבד — ללא תחילית MASAV_)
  const creditTop = await base44.asServiceRole.entities.NedarimDonation.filter(
    {}, { sort: '-transaction_id_num', limit: 1, fields: ['transaction_id_num', 'transaction_id'] }
  );
  const creditTopItems = creditTop.items || [];
  let lastId = 0;
  for (const it of creditTopItems) {
    if (it.transaction_id && String(it.transaction_id).startsWith('MASAV_')) continue;
    if (it.transaction_id_num) { lastId = Number(it.transaction_id_num); break; }
  }

  let newCount = 0;
  let calls = 0;
  while (calls < MAX_CALLS) {
    const records = await fetchCreditPage(apiPassword, lastId, PAGE);
    if (!Array.isArray(records) || !records.length) break;
    const mapped = records.map(mapCreditRecord).filter(Boolean);
    if (mapped.length) {
      for (let i = 0; i < mapped.length; i += 500) {
        await base44.asServiceRole.entities.NedarimDonation.upsert(mapped.slice(i, i + 500), { key: 'transaction_id' });
      }
    }
    newCount += mapped.length;
    lastId = Math.max(...records.map((r) => Number(r.TransactionId || 0)));
    calls++;
    if (records.length < PAGE) break;
  }
  return { newCount, calls, lastId };
}

async function fetchCreditPage(apiPassword, lastId, maxId) {
  const params = new URLSearchParams();
  params.append('Action', 'GetHistoryJson');
  params.append('MosadId', MOSAD_ID);
  params.append('ApiPassword', apiPassword);
  params.append('MaxId', String(maxId));
  params.append('LastId', String(lastId));
  const res = await fetch(CREDIT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString()
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { throw new Error('תשובה לא תקינה מנדרים פלוס (אשראי): ' + txt.slice(0, 200)); }
  if (Array.isArray(data)) return data;
  if (data && data.Result === 'Error') throw new Error(data.Message || 'שגיאה מנדרים פלוס (אשראי)');
  throw new Error((data && data.Message) || 'תשובה לא צפויה מנדרים פלוס (אשראי)');
}

function mapCreditRecord(r) {
  const tid = r.TransactionId;
  if (!tid) return null;
  const num = Number(tid);
  const datePart = String(r.TransactionTime || '').split(' ')[0];
  let transactionDate = '';
  const m = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) transactionDate = `${m[3]}-${m[2]}-${m[1]}`;
  return {
    transaction_id: String(tid),
    transaction_id_num: isNaN(num) ? 0 : num,
    transaction_time: r.TransactionTime || '',
    transaction_date: transactionDate,
    client_name: r.ClientName || '',
    zeout: r.Zeout || '',
    phone: r.Phone || '',
    mail: r.Mail || '',
    address: r.Adresse || '',
    amount: Number(r.Amount) || 0,
    currency: r.Currency === '2' ? 2 : 1,
    groupe: r.Groupe || '',
    comments: r.Comments || '',
    transaction_type: r.TransactionType || '',
    confirmation: r.Confirmation || '',
    last_num: r.LastNum || '',
    keva_id: r.KevaId || '',
    masof_name: r.MasofName || '',
    tashloumim: Number(r.Tashloumim) || 0,
    kabala_id: r.KabalaId || '',
    invoice_data2: r.InvoiceData2 || ''
  };
}

// ---- מס"ב (הו"ק בנקאי) ----
async function syncMasav(base44, apiPassword, body) {
  // חלון תאריכים: ברירת מחדל = 3 שנים אחורה עד היום. אפשר להעביר masavFrom/masavTo (dd/MM/yyyy) ידנית.
  const today = new Date();
  const from = body.masavFrom || formatDdMmYyyy(addYears(today, -MASAV_YEARS_BACK));
  const to = body.masavTo || formatDdMmYyyy(today);

  const params = new URLSearchParams();
  params.append('Action', 'GetMasavHistoryNew');
  params.append('MosadId', MOSAD_ID);
  params.append('ApiPassword', apiPassword);
  params.append('From', from);
  params.append('To', to);
  const res = await fetch(MASAV_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString()
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { return { error: 'תשובה לא תקינה מנדרים פלוס (מס"ב): ' + txt.slice(0, 200), from, to }; }
  if (data && data.Result === 'Error') return { error: data.Message || 'שגיאה מנדרים פלוס (מס"ב)', from, to };
  const rows = Array.isArray(data.data) ? data.data : [];
  // מייבא רק חיובים (סכום חיובי). מדלגים על החזרות (סכום שלילי) ועמלות.
  // API מס"ב אינו מחזיר תעודת זהות — השיוך לחבר נעשה ידנית מתוך דף תרומות נדרים, ולכן zeout נשמר ריק.
  const mapped = rows.map((r) => mapMasavRecord(r)).filter(Boolean);
  let upserted = 0;
  if (mapped.length) {
    for (let i = 0; i < mapped.length; i += 500) {
      await base44.asServiceRole.entities.NedarimDonation.upsert(mapped.slice(i, i + 500), { key: 'transaction_id' });
    }
    upserted = mapped.length;
  }
  return { from, to, totalRows: rows.length, upserted, totals: { shidurim: data.TotalShidurim, ahzarot: data.TotalAhzarot, lezikuy: data.TotalLezikuy } };
}

function mapMasavRecord(r) {
  // שדות מס"ב: "2"=מזהה הוראה, "3"=שם לקוח, "4"=תאריך חיוב, "5"=סכום, "6"=סוג תנועה, "7"=שם מסוף, "8"=קטגוריה. DT_RowId=מזהה שורה.
  const rowId = String(r.DT_RowId || '');
  if (!rowId) return null;
  const amount = Number(r['5']) || 0;
  if (amount <= 0) return null; // מדלגים על החזרות/עמלות (סכום שלילי/אפס)
  const datePart = String(r['4'] || '').split(' ')[0];
  let transactionDate = '';
  const m = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) transactionDate = `${m[3]}-${m[2]}-${m[1]}`;
  const num = Number(rowId);
  return {
    transaction_id: 'MASAV_' + rowId,
    transaction_id_num: isNaN(num) ? 0 : num,
    transaction_time: String(r['4'] || ''),
    transaction_date: transactionDate,
    client_name: r['3'] || '',
    // מס"ב אינו מספק ת"ז; לא דורסים שיוך ידני שנשמר ברשומה קיימת.
    phone: '',
    mail: '',
    address: '',
    amount: amount,
    currency: 1,
    groupe: r['8'] || '',
    comments: r['6'] || '',
    transaction_type: 'הו"ק בנקאי',
    confirmation: '',
    last_num: '',
    keva_id: String(r['2'] || ''),
    masof_name: r['7'] || '',
    tashloumim: 0,
    kabala_id: '',
    invoice_data2: ''
  };
}

// ---- פיולט: תרומות מתורם לחבר קהילה ----
// כשתרומה משויכת לתורם (donor_id) אך הת"ז שלה כבר קיימת ברשימת הקהילה,
// מסירים את השיוך לתורם — התרומה מזוהה אוטומטית כחבר הקהילה לפי הת"ז.
async function reconcileDonorToCommunity(base44) {
  const mp = await base44.asServiceRole.entities.CommunityMember.filter(
    {}, { limit: 3000, fields: ['id_number', 'spouse_id'] }
  );
  const ids = [...new Set(
    (mp.items || [])
      .flatMap((m) => [m.id_number, m.spouse_id])
      .filter((id) => id && String(id).trim())
      .map((id) => String(id).trim())
  )];
  if (!ids.length) return { reconciled: 0 };
  const query = { zeout: { $in: ids }, donor_id: { $nin: ["", null] } };
  let count = 0;
  try {
    count = await base44.asServiceRole.entities.NedarimDonation.count(query);
  } catch {
    return { reconciled: 0 };
  }
  if (count > 0) {
    let more = true;
    let guard = 0;
    while (more && guard < 10) {
      const res = await base44.asServiceRole.entities.NedarimDonation.updateMany(query, { $unset: { donor_id: 1 } });
      more = !!res?.has_more;
      guard++;
    }
  }
  return { reconciled: count };
}

// ---- ירושת שיוך לפי מספר הו"ק ----
// שיוך ידני (manual_assigned = true) הוא המקור האמין: הוא דורס את ה-zeout שה-API מחזיר,
// כך שכל חיוב עם אותו מס' הו"ק משויך לאותו נמען. אם יש כמה שיוכים ידניים שונים לאותו הו"ק — מדלגים.
// עבור הו"ק ללא שיוך ידני — ממלאים רשומות ריקות מתוך שיוכי API קיימים (התנהגות ישנה).
async function inheritKevaAssignment(base44) {
  const NS = base44.asServiceRole.entities.NedarimDonation;

  // שלב א: בנה שיוך קנוני ידני מתוך רשומות שסומנו manual_assigned = true.
  const manualByKeva = {}; // keva -> { donor: {id: count}, zeout: {z: count} }
  {
    let cursor; let guard = 0;
    do {
      const page = await NS.filter(
        { keva_id: { $nin: ['', null] }, manual_assigned: true },
        { limit: 1000, cursor, fields: ['keva_id', 'zeout', 'donor_id'] }
      );
      for (const r of page.items || []) {
        const k = String(r.keva_id);
        if (!manualByKeva[k]) manualByKeva[k] = { donor: {}, zeout: {} };
        if (r.donor_id) manualByKeva[k].donor[r.donor_id] = (manualByKeva[k].donor[r.donor_id] || 0) + 1;
        else if (r.zeout) manualByKeva[k].zeout[r.zeout] = (manualByKeva[k].zeout[r.zeout] || 0) + 1;
      }
      cursor = page.has_more ? page.next_cursor : null;
      guard++;
    } while (cursor && guard < 20);
  }

  // canonical: keva -> { donor_id } | { zeout }. קונפליקט (כמה שיוכים ידניים שונים) -> מדלגים.
  const canonical = {};
  for (const [keva, a] of Object.entries(manualByKeva)) {
    const dKeys = Object.keys(a.donor);
    const zKeys = Object.keys(a.zeout);
    if (dKeys.length === 1) canonical[keva] = { donor_id: dKeys[0] };
    else if (dKeys.length === 0 && zKeys.length === 1) canonical[keva] = { zeout: zKeys[0] };
  }

  // שלב ב: החל שיוך קנוני ידני על כל הרשומות עם אותו keva שלא תואמות.
  // מקבצים kevas לפי ערך קנוני כדי לצמצם קריאות. מדלגים על רשומות עם שיוך ידני אחר (manual_assigned = true).
  const donorGroups = {}; // donor_id -> [keva, ...]
  const zeoutGroups = {};  // zeout -> [keva, ...]
  for (const [keva, c] of Object.entries(canonical)) {
    if (c.donor_id) (donorGroups[c.donor_id] ||= []).push(keva);
    else (zeoutGroups[c.zeout] ||= []).push(keva);
  }
  let updated = 0;
  for (const [donorId, kevas] of Object.entries(donorGroups)) {
    const q = { keva_id: { $in: kevas }, donor_id: { $ne: donorId }, manual_assigned: { $ne: true } };
    let more = true; let g = 0;
    while (more && g < 10) {
      const res = await NS.updateMany(q, { $set: { donor_id: donorId, manual_assigned: true } });
      more = !!res?.has_more; g++;
    }
  }
  for (const [zeout, kevas] of Object.entries(zeoutGroups)) {
    const q = { keva_id: { $in: kevas }, zeout: { $ne: zeout }, donor_id: { $in: ['', null] }, manual_assigned: { $ne: true } };
    let more = true; let g = 0;
    while (more && g < 10) {
      const res = await NS.updateMany(q, { $set: { zeout, manual_assigned: true } });
      more = !!res?.has_more; g++;
    }
  }
  updated = Object.keys(canonical).length; // דיווח מספר הו"ק שטופלו

  // שלב ג: עבור kevas ללא שיוך ידני, מלא רשומות ריקות מתוך שיוכי API קיימים.
  const manualKevaSet = new Set(Object.keys(canonical));
  const unassigned = [];
  {
    let cursor; let guard = 0;
    do {
      const page = await NS.filter(
        { keva_id: { $nin: ['', null] }, donor_id: { $in: ['', null] }, zeout: { $in: ['', null] } },
        { limit: 1000, cursor, fields: ['id', 'keva_id'] }
      );
      for (const r of page.items || []) {
        if (!manualKevaSet.has(String(r.keva_id))) unassigned.push(r);
      }
      cursor = page.has_more ? page.next_cursor : null;
      guard++;
    } while (cursor && guard < 10);
  }
  if (unassigned.length) {
    const kevaIds = [...new Set(unassigned.map((r) => String(r.keva_id)))];
    const map = {}; // keva_id -> 'd:id' | 'z:zeout' או null אם קונפליקט
    for (let i = 0; i < kevaIds.length; i += 100) {
      const chunk = kevaIds.slice(i, i + 100);
      let c; let g = 0;
      do {
        const page = await NS.filter(
          { keva_id: { $in: chunk } },
          { limit: 1000, cursor: c, fields: ['keva_id', 'donor_id', 'zeout'] }
        );
        for (const r of page.items || []) {
          const key = String(r.keva_id);
          let val = null;
          if (r.donor_id) val = 'd:' + r.donor_id;
          else if (r.zeout) val = 'z:' + r.zeout;
          if (!val) continue;
          if (map[key] === undefined) map[key] = val;
          else if (map[key] !== val) map[key] = null;
        }
        c = page.has_more ? page.next_cursor : null;
        g++;
      } while (c && g < 10);
    }
    for (const kevaId of kevaIds) {
      const val = map[kevaId];
      if (!val) continue;
      const set = val.startsWith('d:') ? { donor_id: val.slice(2) } : { zeout: val.slice(2) };
      const q = { keva_id: kevaId, donor_id: { $in: ['', null] }, zeout: { $in: ['', null] } };
      let more = true; let g = 0;
      while (more && g < 10) {
        const res = await NS.updateMany(q, { $set: set });
        more = !!res?.has_more; g++;
      }
      updated += unassigned.filter((r) => String(r.keva_id) === kevaId).length;
    }
  }

  return { updated };
}

// ---- עזר תאריכים ----
function formatDdMmYyyy(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
function addYears(d, years) {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + years);
  return r;
}