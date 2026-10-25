import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// The only tab paths an admin may assign to a user. Anything else is rejected.
// כל הנתיבים שניתנים להקצאה למשתמש (כולל adminOnly, למעט ניהול גישות עצמו).
// חייב להישאר מסונכרן עם NAV_ITEMS ב-src/lib/userTabs.js.
const VALID_TAB_PATHS = [
  '/cases',
  '/tasks',
  '/projects',
  '/distributions',
  '/community',
  '/finance',
  '/collections',
  '/deposits',
  '/donations',
  '/forms',
  '/nedarim-donations',
  '/donors',
  '/telclick',
  '/service',
  '/invoices',
  '/cleaning',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Only admins may change which tabs a user is allowed to see.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = body.user_id;
    const tabs = Array.isArray(body.allowed_tabs) ? body.allowed_tabs : null;
    if (!userId || !tabs) {
      return Response.json({ error: 'חסרים פרמטרים' }, { status: 400 });
    }

    // Drop anything that isn't a known tab path — never trust client input.
    const clean = tabs
      .map((t) => String(t || ''))
      .filter((t) => VALID_TAB_PATHS.includes(t));

    await base44.asServiceRole.entities.User.update(userId, {
      allowed_tabs: JSON.stringify(clean),
    });

    return Response.json({ ok: true, allowed_tabs: clean });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}