import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ROOT_FOLDER_NAME = "קהילה-קשר - מסמכי תיקים";

// Only file URLs produced by the platform's own file storage may be fetched
// server-side. Anything else (internal IPs, cloud metadata, arbitrary hosts)
// is rejected to prevent SSRF.
const ALLOWED_STORAGE_HOSTS = [
  "media.base44.com",
  "static.wixstatic.com",
  "files.base44.com",
];

function isSafeStorageUrl(raw) {
  let url;
  try { url = new URL(String(raw || "")); } catch (_) { return false; }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_STORAGE_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

function sanitizeFolderName(name) {
  return String(name || "").replace(/[\/:*?"<>|]/g, "_").trim().slice(0, 100) || "תיק ללא שם";
}

async function findFolder(accessToken, name, parentId) {
  const escaped = String(name).replace(/'/g, "\\'");
  let q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escaped}'`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Drive query failed: ${res.status}`);
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function createFolder(accessToken, name, parentId) {
  const body = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive create folder failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function findOrCreateFolder(accessToken, name, parentId) {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;
  return createFolder(accessToken, name, parentId);
}

async function uploadFileToDrive(accessToken, name, mimeType, parentFolderId, contentBytes) {
  const boundary = "base44drive_" + Math.random().toString(36).slice(2);
  const encoder = new TextEncoder();
  const metadata = JSON.stringify({ name, parents: [parentFolderId] });
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const bytes = new Uint8Array(contentBytes);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Drive upload failed: ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.id;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const caseId = body.case_id || null;

    // Bulk sync (no case_id) is an admin-only maintenance operation.
    if (!caseId && user.role !== "admin") {
      return Response.json({ error: "Forbidden — bulk sync is admin-only" }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    if (!accessToken) return Response.json({ error: "Google Drive not connected" }, { status: 400 });

    const rootFolderId = await findOrCreateFolder(accessToken, ROOT_FOLDER_NAME, null);

    let cases = [];
    if (caseId) {
      const c = await base44.asServiceRole.entities.Case.get(caseId);
      // Only the case owner (creator) or an admin may sync a case's documents.
      if (user.role !== "admin" && c.created_by_id !== user.id) {
        return Response.json({ error: "Forbidden — not case owner" }, { status: 403 });
      }
      cases = [c];
    } else {
      cases = await base44.asServiceRole.entities.Case.list("-created_date", 500);
    }

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const c of cases) {
      const caseLabel = sanitizeFolderName(
        `${c.case_number ? c.case_number + " - " : ""}${c.title || c.client_name || c.id}`
      );
      const caseFolderId = await findOrCreateFolder(accessToken, caseLabel, rootFolderId);

      const docs = await base44.asServiceRole.entities.CaseDocument.filter({ case_id: c.id });
      for (const doc of docs) {
        if (doc.drive_file_id) { skipped++; continue; }
        if (!doc.file_url) { failed++; errors.push({ id: doc.id, error: "missing file_url" }); continue; }
        if (!isSafeStorageUrl(doc.file_url)) {
          failed++;
          errors.push({ id: doc.id, error: "file_url is not a trusted app-storage URL" });
          continue;
        }
        try {
          const fileRes = await fetch(doc.file_url);
          if (!fileRes.ok) { failed++; errors.push({ id: doc.id, error: `fetch ${fileRes.status}` }); continue; }
          const contentBytes = await fileRes.arrayBuffer();
          const fileName = doc.file_name || `${doc.title || "document"}`;
          const driveId = await uploadFileToDrive(accessToken, fileName, doc.file_type, caseFolderId, contentBytes);
          await base44.asServiceRole.entities.CaseDocument.update(doc.id, { drive_file_id: driveId });
          synced++;
        } catch (e) {
          failed++;
          errors.push({ id: doc.id, error: e.message });
        }
      }
    }

    return Response.json({ synced, skipped, failed, errors, rootFolderId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}