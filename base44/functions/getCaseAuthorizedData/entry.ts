import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Returns the documents, notes and tasks for a case to a caller who is
// authorized to see it. Authorization is validated server-side against the
// Case record's `authorized_emails` (or ownership / privileged role) — never
// against the client-self-writable `authorized_cases` User field.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = null;
    try { body = await req.json?.(); } catch (_) {}
    const caseId = body && body.case_id;
    if (!caseId) return Response.json({ error: 'case_id required' }, { status: 400 });

    const caseItem = await base44.asServiceRole.entities.Case.get(caseId);
    if (!caseItem) return Response.json({ error: 'Not found' }, { status: 404 });

    const isPrivileged = user.role === 'admin' || user.role === 'user';
    if (!isPrivileged) {
      const email = (user.email || '').toLowerCase();
      const authorized = Array.isArray(caseItem.authorized_emails) &&
        caseItem.authorized_emails.map((e) => (e || '').toLowerCase()).includes(email);
      const isOwner = caseItem.created_by_id === user.id;
      if (!authorized && !isOwner) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const [documents, notes, tasks] = await Promise.all([
      base44.asServiceRole.entities.CaseDocument.filter({ case_id: caseId }, '-uploaded_date'),
      base44.asServiceRole.entities.CaseNote.filter({ case_id: caseId }, '-created_date'),
      base44.asServiceRole.entities.Task.filter({ case_id: caseId }, 'due_date'),
    ]);

    return Response.json({ documents, notes, tasks });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}