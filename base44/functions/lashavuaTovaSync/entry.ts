import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// סנכרון היסטוריית עסקאות אשראי מקופה שנייה בנדרים פלוס (MosadId שונה) למעקב "לשבוע מטובה".
// משתמש באותו סוד NEDARIM_API_PASSWORD. קוד הקופה (mosadId) מגיע מהלקוח (מתוך הגדרות הטאב).
// מוגבל ל-admin בלבד.
const ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const PAGE = 2000;
const MAX_CALLS = 3;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // קופת "לשבוע מטובה" משתמשת במפתח API ייעודי; אם לא מוגדר — נופל בחזרה למפתח הראשי.
    const apiPassword = secrets.get('NEDARIM_LASHAVUA_API_PASSWORD') || secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר מפתח API — הגדר/י את הסוד NEDARIM_LASHAVUA_API_PASSWORD (או NEDARIM_API_PASSWORD)' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    let mosadId = String(body.mosadId || '').trim();
    // כשהקריאה מגיעה מוורקפלואו (ללא mosadId) — נקרא את קוד הקופה מההגדרות במסד הנתונים
    let settingRec = null;
    if (!mosadId) {
      const setPage = await base44.asServiceRole.entities.LashavuaTovaSetting.filter(
        {}, { sort: '-created_date', limit: 1 }
      );
      settingRec = setPage?.items?.[0] || null;
      mosadId = String(settingRec?.mosad_id || '').trim();
    }
    if (!mosadId) return Response.json({ error: 'חסר קוד קופה (mosadId) — הזן/י אותו בהגדרות הטאב' }, { status: 400 });

    // נקודת עגינה: מזהה העסקה הגבוה ביותר שכבר מאוחסן מקומית לקופה זו
    const top = await base44.asServiceRole.entities.LashavuaTovaTransaction.filter(
      { source: 'nedarim', nedarim_transaction_num: { $gt: 0 } },
      { sort: '-nedarim_transaction_num', limit: 1, fields: ['nedarim_transaction_num'] }
    );
    let lastId = 0;
    for (const it of top.items || []) {
      if (it.nedarim_transaction_num) { lastId = Number(it.nedarim_transaction_num); break; }
    }

    let newCount = 0;
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
      newCount += mapped.length;
      lastId = Math.max(...records.map((r) => Number(r.TransactionId || 0)));
      calls++;
      if (records.length < PAGE) break;
    }
    // עדכון חותמת סנכרון אחרון (רק כשה-mosadId נקרא מההגדרות — מצב וורקפלואו)
    if (settingRec?.id) {
      await base44.asServiceRole.entities.LashavuaTovaSetting.update(settingRec.id, {
        last_synced_at: new Date().toISOString(),
        last_synced_count: newCount
      });
    }
    return Response.json({ ok: true, newCount, calls, lastId });
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
    signal: AbortSignal.timeout(20000)
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