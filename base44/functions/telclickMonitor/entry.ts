import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchMonitor } from '../../shared/telclick.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    // צפייה בנציגים מותרת לכל משתמש מחובר; שמירת לוגים מותרת רק למנהל או מנהלת משרד טלקליק.
    const canLog = user.role === "admin" || user.role === "telclick_manager";
    const reps = await fetchMonitor();
    const fetchedAt = new Date().toISOString();
    if (body.log && canLog) {
      try {
        await base44.asServiceRole.entities.TelclickLog.create({
          fetched_at: fetchedAt,
          reps: JSON.stringify(reps),
          count: reps.length,
        });
      } catch (e) { /* ignore log save errors */ }
    }
    return Response.json({ reps, fetchedAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}