import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'user') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const caseId = body.case_id;
    const email = (body.email || '').trim().toLowerCase();
    const action = body.action;
    if (!caseId || !email || !['add', 'remove'].includes(action)) {
      return Response.json({ error: 'חסרים פרמטרים' }, { status: 400 });
    }

    // Load the case via service role to read authorized_emails regardless of RLS
    const caseItem = await base44.asServiceRole.entities.Case.get(caseId);
    // Only the case owner (creator) or an admin may manage access to it.
    if (user.role !== 'admin' && caseItem.created_by_id !== user.id) {
      return Response.json({ error: 'Forbidden — not case owner' }, { status: 403 });
    }
    let list = Array.isArray(caseItem.authorized_emails)
      ? caseItem.authorized_emails.map((e) => (e || '').toLowerCase()).filter(Boolean)
      : [];

    if (action === 'add') {
      if (!list.includes(email)) list.push(email);
    } else {
      list = list.filter((e) => e !== email);
    }

    await base44.asServiceRole.entities.Case.update(caseId, { authorized_emails: list });
    const escapeHtml = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const caseTitle = escapeHtml(caseItem.title || 'תיק');
    const caseUrl = `https://keila-kesher-care.base44.app/cases/${caseId}`;

    // Find the target user by email (service role)
    let targetUser = null;
    try {
      const found = await base44.asServiceRole.entities.User.filter({ email });
      targetUser = Array.isArray(found) && found.length ? found[0] : null;
    } catch (e) {
      const all = await base44.asServiceRole.entities.User.list('-created_date', 5000);
      targetUser = all.find((u) => (u.email || '').toLowerCase() === email) || null;
    }

    if (action === 'add') {
      if (!targetUser) {
        // Provisioning a new app account is an admin-controlled action. A
        // non-admin case owner may only grant access to an existing user.
        if (user.role !== 'admin') {
          return Response.json(
            { error: 'המשתמש אינו רשום. פנה למנהל כדי להזמין משתמש חדש.' },
            { status: 403 }
          );
        }
        // התפקיד "cases" מוגדר אוטומטית בהתחברות הראשונה ע"י syncUserAuthorizedCases
        try {
          await base44.users.inviteUser(email, 'user');
        } catch (e) {
          return Response.json({ error: 'שגיאה בהזמנת המשתמש: ' + (e.message || '') }, { status: 500 });
        }
      } else {
        let ac = Array.isArray(targetUser.authorized_cases) ? [...targetUser.authorized_cases] : [];
        if (!ac.includes(caseId)) ac.push(caseId);
        await base44.asServiceRole.entities.User.update(targetUser.id, { authorized_cases: ac });
      }
    } else {
      if (targetUser) {
        let ac = Array.isArray(targetUser.authorized_cases)
          ? targetUser.authorized_cases.filter((c) => c !== caseId)
          : [];
        await base44.asServiceRole.entities.User.update(targetUser.id, { authorized_cases: ac });
      }
    }

    // שליחת מייל עדכון למשתמש שהוסר/נוסף לתיק
    try {
      const addedEmail = action === 'add';
      const plainTitle = String(caseItem.title || 'תיק').replace(/[\r\n]+/g, ' ').slice(0, 200);
      const subject = addedEmail
        ? `נוספה גישה לתיק: ${plainTitle}`
        : `הוסרה גישה לתיק: ${plainTitle}`;
      const html = `
        <div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2a37;">
          <h2 style="color:#0f6391;margin:0 0 12px;">${addedEmail ? 'קיבלת גישה לתיק' : 'הוסרה גישתך לתיק'}</h2>
          <p style="font-size:15px;margin:8px 0;">${addedEmail ? 'נוספה לך גישה לתיק' : 'הוסרה ממך הגישה לתיק'}: <strong>${caseTitle}</strong></p>
          ${addedEmail ? `<a href="${caseUrl}" style="display:inline-block;margin:18px 0 8px;background:#0f6391;color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:15px;font-weight:600;">פתיחת התיק</a>` : ''}
          <p style="font-size:13px;color:#888;margin-top:20px;">הודעה זו נשלחה אוטומטית ממערכת קהילה-קשר.</p>
        </div>`;
      await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, html });
    } catch (mailErr) {
      // אי-שליחת מייל לא תבטל את עדכון הגישה
    }

    return Response.json({ ok: true, authorized_emails: list });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}