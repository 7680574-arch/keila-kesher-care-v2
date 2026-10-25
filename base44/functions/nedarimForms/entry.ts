import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const MOSAD_ID = '7001539';
const DEFAULT_TOFES_ID = '4655';
const ENDPOINT = 'https://matara.pro/nedarimplus/Forms/Manage.aspx';

// רשימת שדות מלאה - כל השדות האפשריים בנדרים פלוס (Field1..Field100 + Max + UpdateDate)
// כך המערכת מייבאת את כל הנתונים מכל טופס, גם אם משתמש בשדות שאינם נפוצים.
const DEFAULT_FIELDS = (() => {
  const map = {};
  for (let i = 1; i <= 100; i++) map[`Field${i}`] = `Field${i}`;
  for (let i = 1; i <= 7; i++) map[`Field${i}Max`] = `Field${i}Max`;
  map['UpdateDate'] = 'UpdateDate';
  return map;
})();

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // כל משתמש מחובר יכול לשלוף רשומות טפסים (כדי לפתוח טפסים מרשימת הקהילה).
    // המפתח נלקח מ-FormConfig או מהסוד הגלובלי בלבד, כך שאין חשיפת סוד ללקוח.
    if (user.role !== 'admin' && user.role !== 'user') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const tofesId = String(body.tofesId || DEFAULT_TOFES_ID);

    // מותר לשלוף רק את הטופס ברירת המחדל או טפסים שהוגדרו במערכת (FormConfig) —
    // כך משתמש לא יכול לבקש טופס שרירותי עם מפתח ה-API של המערכת.
    if (tofesId !== DEFAULT_TOFES_ID) {
      const known = await base44.asServiceRole.entities.FormConfig.list('-created_date', 200);
      const configs = Array.isArray(known) ? known : (known && known.items) || [];
      if (!configs.some((c) => String(c.tofes_id) === tofesId)) {
        return Response.json({ error: 'Forbidden — unknown form' }, { status: 403 });
      }
    }

    // לכל טופס מפתח API משלו בנדרים פלוס. נשלף מרשומת ה-FormConfig של הטופס;
    // אם לא הוגדר — נופל לסוד הגלובלי (תאימות לטפסים ישנים).
    let apiPassword = '';
    if (body.configId) {
      try {
        const cfg = await base44.entities.FormConfig.get(String(body.configId));
        if (cfg && cfg.api_password) apiPassword = String(cfg.api_password);
      } catch (_) { /* התעלם — נפילה לסוד הגלובלי */ }
    }
    if (!apiPassword) apiPassword = secrets.get('NEDARIM_API_PASSWORD');
    if (!apiPassword) return Response.json({ error: 'חסר מפתח API לנדרים פלוס — הגדר/י אותו בכרטיס הטופס או בסוד NEDARIM_API_PASSWORD' }, { status: 500 });

    const maxId = Math.min(parseInt(body.maxId, 10) || 500, 500);
    const lastId = parseInt(body.lastId, 10) || 0;
    const order = body.order === 'Desc' ? 'Desc' : '';
    const fields = (body.fields && typeof body.fields === 'object' && Object.keys(body.fields).length)
      ? body.fields : DEFAULT_FIELDS;

    const params = new URLSearchParams();
    params.append('Action', 'GetJson');
    params.append('MosadId', MOSAD_ID);
    params.append('ApiPassword', apiPassword);
    params.append('TofesId', tofesId);
    params.append('MaxId', String(maxId));
    params.append('LastId', String(lastId));
    if (order) params.append('Order', order);
    params.append('GetJsonParam', JSON.stringify(fields));

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: params.toString()
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return Response.json({ error: 'תשובה לא תקינה מנדרים פלוס', raw: text.slice(0, 500) }, { status: 502 }); }

    if (Array.isArray(data)) {
      const newLastId = data.length ? Number(data[data.length - 1].ID) : lastId;
      return Response.json({
        records: data,
        lastId: newLastId,
        hasMore: data.length === maxId
      });
    }
    return Response.json({ error: data.Message || 'שגיאה לא ידועה מנדרים פלוס' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}