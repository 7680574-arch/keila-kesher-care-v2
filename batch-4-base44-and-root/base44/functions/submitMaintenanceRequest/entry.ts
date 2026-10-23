import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/[&<>"']/g, (c) => ({
    '&': '\u0026amp;',
    '<': '\u0026lt;',
    '>': '\u0026gt;',
    '"': '\u0026quot;',
    "'": '\u0026#39;'
  }[c]));

const URGENCY_LABELS = { low: 'נמוכה', medium: 'רגילה', high: 'גבוהה', urgent: 'דחופה' };
const URGENCIES = ['low', 'medium', 'high', 'urgent'];
const APP_URL = 'https://keila-kesher-care.base44.app';

const clamp = (s, n) => String(s == null ? '' : s).slice(0, n).trim();

// נקודת קצה להגשת קריאות אחזקה — מחייבת התחברות (הטופס נגיש רק למשתמשי המערכת).
// הקלט מוגבל ומאומת, ורק טקסט מאוקיין (HTML-escaped) מוכנס למייל ההתראה למנהלים.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const title = clamp(body.title, 200);
    const description = clamp(body.description, 4000);
    if (!title) return Response.json({ error: 'חובה להזין כותרת לקריאה' }, { status: 400 });
    if (!description) return Response.json({ error: 'חובה לתאר את התקלה' }, { status: 400 });

    const urgency = URGENCIES.includes(body.urgency) ? body.urgency : 'medium';
    const location = clamp(body.location, 200);
    const requester_name = clamp(body.requester_name, 100);
    const requester_phone = clamp(body.requester_phone, 30);
    const requester_email = clamp(body.requester_email, 200);
    const image_uri = clamp(body.image_uri, 500);

    // השלמת שם/אימייל אוטומטית מהמשתמש המחובר
    const submitterName = requester_name || clamp(user.full_name, 100);
    const submitterEmail = requester_email || clamp(user.email, 200);

    const record = await base44.asServiceRole.entities.MaintenanceRequest.create({
      title,
      description,
      location,
      urgency,
      image_uri,
      requester_name: submitterName,
      requester_phone: requester_phone,
      requester_email: submitterEmail,
      status: 'new',
      notes: ''
    });

    // שליחת מייל התראה לכל מנהלי המערכת (כשלון כאן לא ימנע את יצירת הקריאה)
    try {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const adminEmails = (users || [])
        .filter((u) => u.role === 'admin' && u.email)
        .map((u) => u.email);
      const urgLabel = URGENCY_LABELS[record.urgency] || record.urgency;
      const contactBits = [
        record.requester_name || '—',
        record.requester_phone ? '· ' + record.requester_phone : '',
        record.requester_email ? '· ' + record.requester_email : ''
      ].filter(Boolean).join(' ');
      const html = `
        <div dir="rtl" style="font-family:'Heebo',Arial,sans-serif;line-height:1.6;color:#1f2937;background:#fbfcfd;padding:24px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe5ec;border-radius:12px;overflow:hidden;">
            <div style="background:#14688f;color:#ffffff;padding:20px 24px;">
              <h2 style="margin:0;font-size:20px;font-weight:700;">קריאת אחזקה חדשה בבית הספר</h2>
            </div>
            <div style="padding:24px;">
              <p style="margin:0 0 8px;"><strong>כותרת:</strong> ${escapeHtml(record.title)}</p>
              <p style="margin:0 0 8px;"><strong>דחיפות:</strong> ${escapeHtml(urgLabel)}</p>
              <p style="margin:0 0 8px;"><strong>מיקום:</strong> ${escapeHtml(record.location || '—')}</p>
              <p style="margin:0 0 8px;"><strong>פותח הקריאה:</strong> ${escapeHtml(contactBits)}</p>
              <p style="margin:12px 0 4px;"><strong>תיאור התקלה:</strong></p>
              <div style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;">${escapeHtml(record.description)}</div>
              <a href="${APP_URL}/invoices" style="display:inline-block;margin-top:18px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;">מעבר לטיפול בקריאה</a>
            </div>
          </div>
          <p style="color:#65758b;font-size:12px;text-align:center;margin-top:16px;">הודעה זו נשלחה אוטומטית ממערכת אחזקת בית הספר.</p>
        </div>`;
      for (const email of adminEmails) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `קריאת אחזקה חדשה: ${record.title}`,
          html
        });
      }
    } catch (_) { /* שליחת מייל נכשלה — הקריאה נשמרה בכל זאת */ }

    return Response.json({ ok: true, id: record.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}