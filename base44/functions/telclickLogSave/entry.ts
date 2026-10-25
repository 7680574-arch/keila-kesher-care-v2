import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { fetchMonitor } from '../../shared/telclick.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Admin users may trigger manually; unauthenticated calls come from the scheduled workflow.
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user) {
      const expected = secrets.get('TELCLICK_WORKFLOW_SECRET');
      const body = await req.json().catch(() => ({}));
      const given = req.headers.get('x-telclick-secret') || (body && body.secret) || null;
      if (!expected || given !== expected) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    const reps = await fetchMonitor();
    const fetchedAt = new Date().toISOString();
    await base44.asServiceRole.entities.TelclickLog.create({
      fetched_at: fetchedAt,
      reps: JSON.stringify(reps),
      count: reps.length,
    });
    return Response.json({ ok: true, count: reps.length, fetchedAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}