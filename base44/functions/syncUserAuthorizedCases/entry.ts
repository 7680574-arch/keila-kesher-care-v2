import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const email = (user.email || '').trim().toLowerCase();
    if (!email) return Response.json({ authorized_cases: [] });

    const cases = await base44.asServiceRole.entities.Case.list('-created_date', 5000);
    const authorized = cases
      .filter((c) => Array.isArray(c.authorized_emails) && c.authorized_emails.map((e) => (e || '').toLowerCase()).includes(email))
      .map((c) => c.id);

    // עדכן authorized_cases, ובנוסף — אם המשתמש הוא "user" רגיל ללא לשוניות מורשות ויש לו תיקים מורשים,
    // הגדר את תפקידו ל-"cases" כדי שייראה רק את התיקים שלו.
    const update: any = { authorized_cases: authorized };
    let newRole = user.role;
    if (user.role === 'user' && !user.allowed_tabs && authorized.length > 0) {
      update.role = 'cases';
      newRole = 'cases';
    }
    await base44.asServiceRole.entities.User.update(user.id, update);
    return Response.json({ authorized_cases: authorized, role: newRole });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}