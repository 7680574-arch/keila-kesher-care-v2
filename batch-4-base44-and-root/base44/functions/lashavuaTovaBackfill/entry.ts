import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// שחזור חד-פעמי: ייבוא היסטוריה מלאה של עסקאות אשראי מקופת "לשבוע מטובה" בנדרים פלוס,
// החל מ-TransactionId 0 (כדי להחזיר רשומות ישנות שנמחקו). מבוסס על lashavuaTovaSync אך ללא נקודת עגינה.
// מוגבל ל-admin בלבד. upsert לפי nedarim_transaction_id — רשומות קיימות רק מתעדכנות, נמחקות משתחזרות.
const ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const PAGE = 2000;
const MAX_CALLS = 30; // עד 60,000 רשומות — מספיק להיסטוריה מלאה

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const apiPassword = secrets.get('NEDARIM_LASHAVUA_API_PASSWORD') || secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר מפתח API' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    let mosadId = String(body.mosadId || '').trim();
    if (!mosadId) {
      const setPage = await base44.asServiceRole.entities.LashavuaTovaSetting.filter(
        {}, { sort: '-created_date', limit: 1 }
      );
      mosadId = String(setPage?.items?.[0]?.mosad_id || '').trim();
    }
    if (!mosadId) return Response.json({ error: 'חסר קוד קופה (mosadId)' }, { status: 400 });

    let lastId = 0;
    let total = 0;
    let calls = 0;
    while (calls < MAX_CALLS) {
      const records = await fetchPage(apiPassword, mosadId, lastId, PAGE);
      if (!Array.isArray(records) || !records.length) break;
      const mapped = records.map(mapRecord).filter(Boolean);
      if (mapped.length) {
        for (let i = 0; i < mapped.length; i += 500) {
          await base44.asServiceRole.entities.LashavuaTovaTransaction.upsert(
            mapped.slice(i, i + 500), { key: 'nedarim_transaction_id' }
          );
        }
      }
      total += mapped.length;
      lastId = Math.max(...records.map((r) => Number(r.TransactionId || 0)));
      calls++;
      if (records.length < PAGE) break;
    }
    return Response.json({ ok: true, imported: total, calls, lastId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function fetchPage(apiPassword, mosadId, lastId, maxId) {
  const params = new URLSearchParams();
  params.append('Action', 'GetHistoryJson');
  params.append('MosadId', mosadId);
  params.append('ApiPassword', apiPassword);
  params.append('MaxId', String(maxId));
  params.append('LastId', String(lastId));
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString(),
    signal: AbortSignal.timeout(30000)
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { throw new Error('תשובה לא תקינה מנדרים פלוס: ' + txt.slice(0, 200)); }
  if (Array.isArray(data)) return data;
  if (data && data.Result === 'Error') throw new Error(data.Message || 'שגיאה מנדרים פלוס');
  throw new Error((data && data.Message) || 'תשובה לא צפויה מנדרים פלוס');
}

function mapRecord(r) {
  const tid = r.TransactionId;
  if (!tid) return null;
  const num = Number(tid);
  const datePart = String(r.TransactionTime || '').split(' ')[0];
  let date = '';
  const m = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) date = `${m[3]}-${m[2]}-${m[1]}`;
  const category = r.Groupe || '';
  const isSupermarket = category.includes('חדר הסופרים') || category.includes('חדר סופרים');
  return {
    bucket: isSupermarket ? 'supermarket' : 'lashavua',
    kind: 'income',
    date,
    description: r.ClientName || '',
    amount: Number(r.Amount) || 0,
    commission: Math.round((Number(r.Amount) || 0) * 0.03 * 100) / 100,
    category,
    source: 'nedarim',
    nedarim_transaction_id: String(tid),
    nedarim_transaction_num: isNaN(num) ? 0 : num,
    masof_name: r.MasofName || '',
    notes: r.Comments || ''
  };
}