import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const MOSAD_ID = '7001539';
const ENDPOINT = 'https://matara.pro/nedarimplus/Forms/Manage.aspx';

// ריענון אוטומטי של טפסים: מופעל על ידי workflow שעתי (ללא משתמש) או ידנית על ידי admin.
// לכל טופס עם auto_refresh=true בודק שורות חדשות מאז last_seen_id, ומעדכן את new_count (תג ההתראה).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = await base44.asServiceRole.entities.FormConfig.filter(
      { auto_refresh: true },
      { limit: 200 }
    );
    const configs = page.items || page;

    const results = [];
    for (const cfg of configs) {
      try {
        const apiPassword = cfg.api_password || secrets.get('NEDARIM_API_PASSWORD');
        if (!apiPassword) {
          results.push({ id: cfg.id, name: cfg.name, error: "חסר מפתח API" });
          continue;
        }

        const lastSeen = parseInt(cfg.last_seen_id, 10) || 0;

        // אתחול: טופס חדש שלא נבדק מעולם — קובעים את המזהה האחרון הנוכחי מבלי לספור כחדש
        if (!lastSeen) {
          const maxId = await fetchNewestId(cfg.tofes_id, apiPassword);
          if (maxId > 0) {
            await base44.asServiceRole.entities.FormConfig.update(cfg.id, { last_seen_id: String(maxId) });
          }
          results.push({ id: cfg.id, name: cfg.name, newCount: 0, initialized: true });
          continue;
        }

        // ספירת שורות חדשות מאז lastSeen (עמוד אחר עמוד, עד 5000)
        let newCount = 0;
        let maxId = lastSeen;
        let cursor = lastSeen;
        for (let p = 0; p < 10; p++) {
          const data = await fetchIds(cfg.tofes_id, apiPassword, cursor, 500);
          if (!Array.isArray(data) || !data.length) break;
          newCount += data.length;
          for (const r of data) { const id = Number(r.ID); if (id > maxId) maxId = id; }
          cursor = Number(data[data.length - 1].ID);
          if (data.length < 500) break;
        }

        if (newCount > 0) {
          await base44.asServiceRole.entities.FormConfig.update(cfg.id, {
            new_count: (cfg.new_count || 0) + newCount,
            last_seen_id: String(maxId),
          });
        }
        results.push({ id: cfg.id, name: cfg.name, newCount });
      } catch (e) {
        results.push({ id: cfg.id, name: cfg.name, error: e.message });
      }
    }
    return Response.json({ ok: true, checked: configs.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function fetchNewestId(tofesId, apiPassword) {
  const params = new URLSearchParams();
  params.append('Action', 'GetJson');
  params.append('MosadId', MOSAD_ID);
  params.append('ApiPassword', apiPassword);
  params.append('TofesId', String(tofesId));
  params.append('MaxId', '1');
  params.append('Order', 'Desc');
  params.append('GetJsonParam', JSON.stringify({ ID: 'ID' }));
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => null);
  return Array.isArray(data) && data.length ? Number(data[0].ID) : 0;
}

async function fetchIds(tofesId, apiPassword, lastId, maxId) {
  const params = new URLSearchParams();
  params.append('Action', 'GetJson');
  params.append('MosadId', MOSAD_ID);
  params.append('ApiPassword', apiPassword);
  params.append('TofesId', String(tofesId));
  params.append('MaxId', String(maxId));
  params.append('LastId', String(lastId));
  params.append('GetJsonParam', JSON.stringify({ ID: 'ID' }));
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString(),
  });
  return res.json().catch(() => null);
}