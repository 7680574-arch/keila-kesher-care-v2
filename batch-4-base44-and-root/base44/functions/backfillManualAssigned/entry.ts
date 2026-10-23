import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// שחזור דגל manual_assigned לשיוכים ידניים היסטוריים שבוצעו לפני שהשדה נוסף.
// משוו�ה את ה-zeout המקומי מול ה-zeout המקורי מה-API של נדרים פלוס:
//   - אם הם שונים (או שהמקורי ריק והמקומי מלא) → שיוך ידני → מסמן manual_assigned = true.
//   - אם זהים → שיוך טבעי מה-API → לא מסמן.
// חיובי מס"ב (MASAV_) כבר סומנו בשלב קודם (ה-API של מס"ב אינו מחזיר ת"ז).
const MOSAD_ID = '7001539';
const CREDIT_ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const PAGE = 2000;
const MAX_CALLS = 20; // מספיק כדי לכסות את כל ההיסטוריה עד למזהה המקסימלי המקומי

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const apiPassword = secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר NEDARIM_API_PASSWORD' }, { status: 500 });

    const NS = base44.asServiceRole.entities.NedarimDonation;

    // 1) בניית מפת מקור: transaction_id -> zeout מקורי מה-API
    // עוצרים כשעברנו את המזהה המקומי הגבוה ביותר — לא צריך למשוך יותר מה-API.
    const topResult = await NS.aggregate({ max: 'transaction_id_num' });
    const maxLocalId = Number(topResult.rows[0]?.max_transaction_id_num || 0);
    const sourceMap = {};
    let lastId = 0;
    let calls = 0;
    let totalApiRecords = 0;
    let reached = false;
    while (calls < MAX_CALLS && !reached) {
      const params = new URLSearchParams();
      params.append('Action', 'GetHistoryJson');
      params.append('MosadId', MOSAD_ID);
      params.append('ApiPassword', apiPassword);
      params.append('MaxId', String(PAGE));
      params.append('LastId', String(lastId));
      params.append('Order', 'Asc');
      const res = await fetch(CREDIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
        body: params.toString(),
        signal: AbortSignal.timeout(30000),
      });
      const txt = await res.text();
      let data;
      try { data = JSON.parse(txt); }
      catch { return Response.json({ error: 'תשובה לא תקינה מנדרים פלוס: ' + txt.slice(0, 200) }, { status: 502 }); }
      if (!Array.isArray(data)) {
        return Response.json({ error: (data && data.Message) || 'שגיאה מנדרים פלוס' }, { status: 502 });
      }
      if (!data.length) break;
      for (const r of data) {
        const tid = String(r.TransactionId || '');
        if (tid) sourceMap[tid] = String(r.Zeout || '').replace(/\D/g, '').replace(/^0+/, '');
      }
      totalApiRecords += data.length;
      const pageMax = Math.max(...data.map((r) => Number(r.TransactionId || 0)));
      lastId = pageMax;
      calls++;
      if (pageMax >= maxLocalId) reached = true;
      if (data.length < PAGE) break;
    }

    // 2) סריקת רשומות מקומיות עם zeout שלא מסומנות ידניות
    let cursor = undefined;
    let marked = 0;
    let natural = 0;
    let missingSource = 0;
    let batches = 0;
    do {
      const page = await NS.filter(
        { manual_assigned: { $ne: true }, zeout: { $exists: true, $nin: ['', null] } },
        { sort: 'created_date', limit: 500, cursor, fields: ['transaction_id', 'zeout'] }
      );
      const items = page.items || [];
      const updates = [];
      for (const r of items) {
        const tid = String(r.transaction_id || '');
        if (tid.startsWith('MASAV_')) continue; // כבר טופלו
        const localZeout = String(r.zeout || '').replace(/\D/g, '').replace(/^0+/, '');
        const nativeZeout = sourceMap[tid];
        if (nativeZeout === undefined) { missingSource++; continue; }
        if (localZeout && localZeout !== nativeZeout) {
          updates.push({ id: r.id, manual_assigned: true });
          marked++;
        } else {
          natural++;
        }
      }
      if (updates.length) {
        await NS.bulkUpdate(updates);
        batches++;
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);

    return Response.json({ ok: true, apiCalls: calls, totalApiRecords, marked, natural, missingSource, batches });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}