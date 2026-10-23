import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// נדרים פלוס — היסטוריית עסקאות אשראי (תרומות ששולמו בכרטיס / ביט / העברה בקליק / קריפטו).
// תיעוד: Reports/Manage3.aspx · Action=GetHistoryJson · מוגבל ל-20 קריאות בשעה.
const MOSAD_ID = '7001539';
const ENDPOINT = 'https://matara.pro/nedarimplus/Reports/Manage3.aspx';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const apiPassword = secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר מפתח API לנדרים פלוס — הגדר/י את הסוד NEDARIM_API_PASSWORD' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    // MaxId מוגבל ל-2000 בשרת של נדרים פלוס; ממליצים להקטין כדי לזרז.
    const maxId = Math.min(parseInt(body.maxId, 10) || 200, 2000);
    const lastId = parseInt(body.lastId, 10) || 0;
    // ברירת מחדל: מהחדש לישן (LastId הוא התקרה). Asc = מהישן לחדש (LastId הוא הרצפה).
    const order = body.order === 'Asc' ? 'Asc' : 'Desc';

    const params = new URLSearchParams();
    params.append('Action', 'GetHistoryJson');
    params.append('MosadId', MOSAD_ID);
    params.append('ApiPassword', apiPassword);
    params.append('MaxId', String(maxId));
    params.append('LastId', String(lastId));
    params.append('Order', order);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: params.toString()
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return Response.json({ error: 'תשובה לא תקינה מנדרים פלוס', raw: text.slice(0, 500) }, { status: 502 }); }

    // היסטוריית העסקאות חוזרת כמערך רשומות. שגיאות חוזרות כ-{Result, Message} או כטקסט.
    if (Array.isArray(data)) {
      const idKey = (r) => Number(r.TransactionId || r.ID || 0);
      const edge = data.length
        ? (order === 'Desc' ? Math.min(...data.map(idKey)) : Math.max(...data.map(idKey)))
        : lastId;
      return Response.json({
        records: data,
        lastId: edge,
        hasMore: data.length === maxId
      });
    }
    if (data && data.Result === 'Error') {
      return Response.json({ error: data.Message || 'שגיאה מנדרים פלוס' }, { status: 502 });
    }
    return Response.json({ error: (data && data.Message) || text.slice(0, 300) || 'שגיאה לא ידועה מנדרים פלוס' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}