import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const to = (body.email || '').trim();
    const fullName = (body.full_name || '').trim() || 'משתמש/ת';
    const allowedLabels: string[] = Array.isArray(body.allowed_labels) ? body.allowed_labels : [];
    const changedLabel = (body.changed_label || '').trim();
    const added = !!body.added;
    const isApproval = !!body.is_approval;

    if (!to) return Response.json({ error: 'missing email' }, { status: 400 });

    const list = allowedLabels.length > 0
      ? `<ul style="margin:8px 0;padding-right:20px;">${allowedLabels.map((l) => `<li style="margin:4px 0;font-size:15px;">${l}</li>`).join('')}</ul>`
      : '<p style="color:#888;margin:8px 0;">אין הרשאות גישה פעילות כרגע.</p>';

    const changeLine = changedLabel
      ? `<p style="margin:8px 0;font-size:15px;">${added ? 'נוספה גישה ל:' : 'הוסרה גישה מ:'} <strong>${changedLabel}</strong></p>`
      : '';

    const subject = isApproval ? 'אישור גישה למערכת קהילה-קשר' : 'עדכון הרשאות גישה — מערכת קהילה-קשר';
    const html = `
      <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2a37;">
        <h2 style="color:#0f6391;margin:0 0 12px;">${isApproval ? 'ברוכים הבאים!' : 'שלום ' + fullName + ','}</h2>
        <p style="font-size:15px;margin:8px 0;">${isApproval ? 'אושרה גישתך למערכת קהילה-קשר.' : 'הרשאות הגישה שלך במערכת קהילה-קשר עודכנו.'}</p>
        ${changeLine}
        <p style="font-size:15px;margin:16px 0 4px;font-weight:600;">הרשאות הגישה הנוכחיות שלך:</p>
        ${list}
        <a href="https://keila-kesher-care.base44.app" style="display:inline-block;margin:18px 0 8px;background:#0f6391;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:15px;font-weight:600;">כניסה למערכת</a>
        <p style="font-size:13px;color:#888;margin-top:20px;">הודעה זו נשלחה אוטומטית ממערכת קהילה-קשר.</p>
      </div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      html,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}