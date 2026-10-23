import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const STATUS_LABELS = {
  new: 'חדשה',
  in_progress: 'בטיפול',
  waiting: 'ממתין לתגובה',
  resolved: 'טופל',
  closed: 'סגורה'
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const parseMessages = (str) => {
  if (!str) return [];
  try {
    const arr = JSON.parse(str);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id, status, message, assignee_id, assignee_name } = body;
    if (!id) return Response.json({ error: 'חסר מזהה קריאה' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.ServiceRequest.get(id);
    if (!existing) return Response.json({ error: 'קריאה לא נמצאה' }, { status: 404 });

    const isAdmin = user.role === 'admin';
    const isOwner = existing.created_by_id === user.id;
    if (!isAdmin && !isOwner) {
      return Response.json({ error: 'אין הרשאה לעדכן קריאה זו' }, { status: 403 });
    }

    // משתמש רגיל יכול להוסיף הודעות בלבד — לא לשנות סטטוס/אחראי
    if (!isAdmin && (status !== undefined || assignee_id !== undefined)) {
      return Response.json({ error: 'אין הרשאה לשנות שדות אלה' }, { status: 403 });
    }

    const update = {};
    if (status !== undefined && status !== existing.status) update.status = status;
    if (assignee_id !== undefined) {
      update.assignee_id = assignee_id || '';
      update.assignee_name = assignee_name || '';
    }

    let newMessage = null;
    const msgText = message != null ? String(message).trim() : '';
    if (msgText) {
      const messages = parseMessages(existing.messages);
      newMessage = {
        id: uid(),
        author_id: user.id,
        author_name: user.full_name || '',
        author_role: isAdmin ? 'admin' : 'user',
        content: msgText,
        at: new Date().toISOString()
      };
      messages.push(newMessage);
      update.messages = JSON.stringify(messages);
    }

    let updated = existing;
    if (Object.keys(update).length > 0) {
      updated = await base44.asServiceRole.entities.ServiceRequest.update(id, update);
    }

    // שליחת מייל לצד השני על כל שינוי
    try {
      const changes = [];
      if (update.status) changes.push(`סטטוס עודכן ל: <strong>${escapeHtml(STATUS_LABELS[update.status] || update.status)}</strong>`);
      if (assignee_id !== undefined && assignee_name) changes.push(`אחראי מקושר: <strong>${escapeHtml(assignee_name)}</strong>`);
      if (newMessage) changes.push(`<div style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;margin-top:6px;"><strong>${escapeHtml(newMessage.author_name)}</strong>: ${escapeHtml(newMessage.content)}</div>`);

      if (changes.length > 0) {
        const actorName = escapeHtml(user.full_name || 'משתמש');
        const title = escapeHtml(existing.title);

        if (isAdmin) {
          // מנהל עדכן → שולחים לפותח הקריאה
          const to = existing.requester_email;
          if (to) {
            const html = `
              <div dir="rtl" style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
                <h2 style="color:#0c7a99;">עדכון בקריאת השירות שלך: ${title}</h2>
                <p><strong>עודכן על ידי:</strong> ${actorName} (מנהל)</p>
                ${changes.map((c) => `<p>${c}</p>`).join('')}
                <a href="https://keila-kesher-care.base44.app/service?open=${id}" style="display:inline-block;margin-top:14px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;">מעבר לקריאת השירות</a>
                <p style="color:#64748b;margin-top:16px;">הודעה זו נשלחה אוטומטית ממערכת ניהול הקהילה.</p>
              </div>`;
            await base44.asServiceRole.integrations.Core.SendEmail({
              to, subject: `עדכון בקריאת השירות שלך: ${existing.title}`, html
            });
          }
        } else {
          // פותח הקריאה עדכן → שולחים למנהלים + אחראי מקושר
          const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
          const recipients = new Set();
          (users || []).forEach((u) => { if (u.role === 'admin' && u.email) recipients.add(u.email); });
          if (updated.assignee_id) {
            const assignee = (users || []).find((u) => u.id === updated.assignee_id);
            if (assignee && assignee.email && assignee.role !== 'admin') recipients.add(assignee.email);
          }
          const html = `
            <div dir="rtl" style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
              <h2 style="color:#0c7a99;">עדכון בקריאת שירות: ${title}</h2>
              <p><strong>עודכן על ידי:</strong> ${actorName} (פותח הקריאה)</p>
              ${changes.map((c) => `<p>${c}</p>`).join('')}
              <a href="https://keila-kesher-care.base44.app/service?open=${id}" style="display:inline-block;margin-top:14px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;">מעבר לקריאת השירות</a>
              <p style="color:#64748b;margin-top:16px;">הודעה זו נשלחה אוטומטית ממערכת ניהול הקהילה.</p>
            </div>`;
          for (const email of recipients) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email, subject: `עדכון בקריאת שירות: ${existing.title}`, html
            });
          }
        }
      }
    } catch (e) {
      // כשלון בשליחת מייל לא ימנע את העדכון
    }

    return Response.json({ ok: true, request: updated, message: newMessage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}