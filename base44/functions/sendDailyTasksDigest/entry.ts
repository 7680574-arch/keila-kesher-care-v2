import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Parse the request body once (used for both auth secret and optional date override).
    let body = null;
    try { body = await req.json?.(); } catch (_) {}

    // Authenticate the caller. Authenticated users must be admins.
    // Unauthenticated callers (e.g. a scheduled automation) must present the shared secret.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    if (user) {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      const expected = secrets.get('DAILY_DIGEST_SECRET');
      const given = req.headers.get('x-digest-secret') || (body && body.secret) || null;
      if (!expected || given !== expected) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const targetDate = (body && body.date) ? body.date : today;

    const [tasks, cases, users] = await Promise.all([
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.Case.list(),
      base44.asServiceRole.entities.User.list(),
    ]);

    const caseById = {};
    cases.forEach((c) => { caseById[c.id] = c; });

    const dueToday = tasks.filter((t) => {
      if (t.status === 'done') return false;
      return t.due_date === targetDate;
    });

    if (dueToday.length === 0) {
      return Response.json({ sent: 0, message: 'אין משימות להיום' });
    }

    const formattedDate = new Date(targetDate + 'T00:00:00').toLocaleDateString('he-IL');

    // Build per-recipient task lists respecting the app's RLS model:
    // admins and 'user' role can read all cases; guests only see cases they
    // are explicitly authorized for (authorized_emails), validated server-side.
    function authorizedCaseIdsFor(u) {
      if (u.role === 'admin' || u.role === 'user') return null; // null = all cases
      const ids = new Set();
      const email = (u.email || '').toLowerCase();
      cases.forEach((c) => {
        const ae = Array.isArray(c.authorized_emails)
          ? c.authorized_emails.map((e) => (e || '').toLowerCase())
          : [];
        if (ae.includes(email)) ids.add(c.id);
      });
      return ids;
    }

    function buildHtml(taskList) {
      if (!taskList.length) return null;
      const taskRows = taskList.map((t) => {
        const c = caseById[t.case_id] || {};
        const client = t.client_name || c.client_name || '—';
        const caseTitle = t.case_title || c.title || '—';
        const time = t.due_time ? ` · שעה ${t.due_time}` : '';
        const priority = t.priority === 'urgent' ? ' (דחוף)' : t.priority === 'high' ? ' (עדיפות גבוהה)' : '';
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(t.title)}${priority}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;direction:rtl">${escapeHtml(client)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;direction:rtl">${escapeHtml(caseTitle)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;direction:rtl">${escapeHtml(t.assigned_to || '—')}${time}</td>
        </tr>`;
      }).join('');
      return `
        <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
          <div style="background:#0c4a6e;padding:20px 24px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">משימות להיום · ${formattedDate}</h1>
            <p style="color:#bae6fd;margin:6px 0 0;font-size:14px">סיכום משימות מרכז קהילה</p>
          </div>
          <div style="background:#fff;padding:20px 24px;border-radius:0 0 12px 12px">
            <p style="font-size:15px;color:#334155">להלן ${taskList.length} משימות שנועדו להיום:</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a">
              <thead>
                <tr style="background:#f1f5f9;text-align:right">
                  <th style="padding:10px 12px">משימה</th>
                  <th style="padding:10px 12px">לקוח</th>
                  <th style="padding:10px 12px">תיק</th>
                  <th style="padding:10px 12px">אחראי</th>
                </tr>
              </thead>
              <tbody>${taskRows}</tbody>
            </table>
            <a href="https://keila-kesher-care.base44.app/cases" style="display:inline-block;margin-top:18px;background:#0c4a6e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">מעבר למערכת התיקים</a>
            <p style="font-size:12px;color:#64748b;margin-top:20px">הודעה אוטומטית ממערכת ניהול התיקים הקהילתית.</p>
          </div>
        </div>`;
    }

    const subject = `משימות להיום · ${formattedDate}`;

    let sent = 0;
    let recipients = 0;
    for (const u of users) {
      if (!u.email) continue;
      const scope = authorizedCaseIdsFor(u);
      const taskList = scope === null
        ? dueToday
        : dueToday.filter((t) => scope.has(t.case_id));
      const body = buildHtml(taskList);
      if (!body) continue;
      recipients += 1;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: `${subject} (${taskList.length})`,
          body,
          from_name: 'מרכז קהילה',
        });
        sent += 1;
      } catch (_) {}
    }

    return Response.json({ sent, recipients, dueToday: dueToday.length, date: targetDate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}