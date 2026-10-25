import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Returns only name + email of app users so any signed-in staff member can pick a responsible person.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'user') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const users = await base44.asServiceRole.entities.User.list();
    const list = (users || [])
      .filter((u) => u.email && u.role !== 'guest')
      .map((u) => ({ id: u.id, email: u.email, name: u.full_name || u.email }));
    return Response.json({ users: list });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}