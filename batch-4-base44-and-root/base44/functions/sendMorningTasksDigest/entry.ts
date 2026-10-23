import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const PAGE = 500;
async function fetchAll(entity, query) {
  const all = [];
  for (let skip = 0; skip < 50000; skip += PAGE) {
    const res = await entity.filter(query, 'created_date', PAGE, skip);
    const arr = Array.isArray(res) ? res : (res?.items || []);
    all.push(...arr);
    if (arr.length < PAGE) break;
  }
  return all;
}

function section(title, color, rows) {
  if (!rows.length) return '';
  const body = rows.map((r) => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee">${esc(r.title)}${r.priority === 'urgent' ? ' <b style="color:#dc2626">(דחוף)</b>' : r.priority === 'high' ? ' (עדיפות גבוהה)' : ''}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap">${esc(r.when || '—')}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee">${esc(r.where || '')}</td>
  </tr>`).join('');
  return `<h2 style="font-size:16px;color:${color};margin:22px 0 8px">${title} (${rows.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a">
      <thead><tr style="background:#f1f5f9;text-align:right">
        <th style="padding:8px 12px">פריט</th><th style="padding:8px 12px">מועד</th><th style="padding:8px 12px">הקשר</th>
      </tr></thead><tbody>${body}</tbody></table>`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
    const sr = base44.asServiceRole.entities;

    const [reminders, caseTasks, users] = await Promise.all([
      fetchAll(sr.Reminder, { status: { $ne: 'done' } }),
      fetchAll(sr.Task, { status: { $ne: 'done' } }),
      sr.User.list(),
    ]);

    const emailByName = {};
    users.forEach((u) => {
      if (u.email && u.full_name) emailByName[u.full_name.trim()] = u.email.toLowerCase();
    });

    // email -> { dueTodayTasks, remindersToday }
    // נשלח רק פריטים שהגיע מועדם (היום או בעבר — כולל איחור), לא עתידיים.
    const buckets = {};
    const bucket = (email) => (buckets[email] ||= { dueToday: [], remToday: [] });
    const when = (d, t) => [d, t].filter(Boolean).join(' ') || '—';

    for (const r of reminders) {
      if (!r.due_date) continue;
      const email = (r.assignee_email || '').toLowerCase();
      if (!email) continue;
      if (r.due_date > today) continue; // עתידי — לא נשלח
      const row = { title: r.title, priority: r.priority, when: when(r.due_date, r.due_time), where: r.kind === 'reminder' ? 'תזכורת' : 'משימה כללית' };
      if (r.kind === 'reminder') bucket(email).remToday.push(row);
      else bucket(email).dueToday.push(row);
    }

    for (const t of caseTasks) {
      if (!t.due_date) continue;
      if (t.due_date > today) continue; // עתידי — לא נשלח
      const email = emailByName[(t.assigned_to || '').trim()];
      if (!email) continue;
      const row = {
        title: t.title, priority: t.priority, when: when(t.due_date, t.due_time),
        where: [t.client_name, t.case_title].filter(Boolean).join(' · ') || 'משימת תיק',
      };
      bucket(email).dueToday.push(row);
    }

    const formatted = new Date(today + 'T00:00:00').toLocaleDateString('he-IL');
    let sent = 0;
    const failed = [];
    for (const [email, b] of Object.entries(buckets)) {
      const total = b.dueToday.length + b.remToday.length;
      if (!total) continue;
      const html = `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px">
        <div style="background:#14688f;padding:20px 24px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">בוקר טוב · ${formatted}</h1>
          <p style="color:#d6eef9;margin:6px 0 0;font-size:14px">סיכום משימות ותזכורות שהגיע מועדן</p>
        </div>
        <div style="background:#fff;padding:20px 24px;border-radius:0 0 12px 12px">
          ${section('תזכורות שהגיע מועדן', '#b45309', b.remToday)}
          ${section('משימות שהגיע מועדן', '#14688f', b.dueToday)}
          <a href="https://keila-kesher-care.base44.app/tasks" style="display:inline-block;margin-top:20px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">מעבר למשימות ותזכורות</a>
          <p style="font-size:12px;color:#64748b;margin-top:20px">הודעה אוטומטית ממערכת קהילה-קשר.</p>
        </div></div>`;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `משימות ותזכורות · ${formatted} (${total})`,
          body: html,
          from_name: 'קהילה-קשר',
        });
        sent += 1;
      } catch (e) {
        failed.push({ email, error: e.message });
      }
    }

    return Response.json({ sent, failed, date: today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}