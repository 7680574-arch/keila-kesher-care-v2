import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const CATEGORY_LABELS = {
  maintenance: 'אחזקה',
  switchboard: 'מרכזייה',
  computers: 'מחשבים',
  other: 'אחר'
};
const PRIORITY_LABELS = {
  low: 'נמוכה',
  medium: 'רגילה',
  high: 'גבוהה',
  urgent: 'דחופה'
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { title, description, category, priority, phone, address } = body;
    if (!title || !String(title).trim()) {
      return Response.json({ error: 'חובה להזין כותרת לקריאה' }, { status: 400 });
    }

    const record = await base44.entities.ServiceRequest.create({
      title: String(title).trim(),
      description: String(description || '').trim(),
      category: category || 'maintenance',
      priority: priority || 'medium',
      status: 'new',
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      notes: '',
      requester_name: user.full_name || '',
      requester_email: user.email || ''
    });

    // שליחת מייל לכל המנהלים על קריאה חדשה
    try {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const adminEmails = (users || [])
        .filter((u) => u.role === 'admin' && u.email)
        .map((u) => u.email);
      const catLabel = CATEGORY_LABELS[record.category] || record.category || '—';
      const priLabel = PRIORITY_LABELS[record.priority] || record.priority || '—';
      const html = `
        <div dir="rtl" style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
          <h2 style="color:#0c7a99;">קריאת שירות חדשה: ${escapeHtml(record.title)}</h2>
          <p><strong>פותח הקריאה:</strong> ${escapeHtml(record.requester_name || '—')} &lt;${escapeHtml(record.requester_email || '—')}&gt;</p>
          <p><strong>קטגוריה:</strong> ${escapeHtml(catLabel)} &nbsp; · &nbsp; <strong>דחיפות:</strong> ${escapeHtml(priLabel)}</p>
          <p><strong>טלפון:</strong> ${escapeHtml(record.phone || '—')}</p>
          <p><strong>כתובת:</strong> ${escapeHtml(record.address || '—')}</p>
          <p><strong>תיאור הבעיה:</strong></p>
          <div style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;">${escapeHtml(record.description || '—')}</div>
          <a href="https://keila-kesher-care.base44.app/service?open=${record.id}" style="display:inline-block;margin-top:14px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;">מעבר לקריאת השירות</a>
          <p style="color:#64748b;margin-top:16px;">הודעה זו נשלחה אוטומטית ממערכת ניהול הקהילה.</p>
        </div>`;
      for (const email of adminEmails) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `קריאת שירות חדשה: ${String(record.title)}`,
          html
        });
      }
    } catch (e) {
      // כשלון בשליחת מייל לא ימנע את יצירת הקריאה
    }

    return Response.json({ ok: true, request: record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}