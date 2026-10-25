import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ROOT_FOLDER_NAME = "קהילה-קשר - גיבויים";

// All app tables to back up, including User (email, role, allowed_tabs, authorized_cases; no passwords are exposed by the entity).
const ENTITIES = [
  "Case", "CaseDocument", "CaseNote", "CaseTransaction", "Task", "Client", "Worker",
  "CommunityMember", "CommunityFinance",
  "Distribution", "DistributionGroup", "DistributionRecipient",
  "Collection", "Deposit", "DepositTransaction",
  "Donation", "FundraisingEvent", "FundraisingInvitee", "Donor", "NedarimDonation",
  "FormConfig", "TelclickLog",
  "ServiceRequest", "MaintenanceRequest",
  "Product", "SalesTransaction",
  "CleaningBuilding", "CleaningVolunteer", "CleaningCommitteeMember",
  "CleaningMeeting", "CleaningTask", "MeetingItem",
  "User",
];

const BUILTIN_COLS = ["id", "created_date", "updated_date", "created_by_id"];

function csvCell(v) {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows) {
  const cols = [...BUILTIN_COLS];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!cols.includes(k)) cols.push(k);
    }
  }
  const lines = [cols.map(csvCell).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(","));
  // BOM so Excel opens Hebrew correctly
  return "\uFEFF" + lines.join("\r\n");
}

async function fetchAll(base44, name) {
  const all = [];
  const PAGE = 500;
  for (let skip = 0; skip < 200000; skip += PAGE) {
    const items = await base44.asServiceRole.entities[name].list("created_date", PAGE, skip);
    const arr = Array.isArray(items) ? items : (items?.items || []);
    all.push(...arr);
    if (arr.length < PAGE) break;
  }
  return all;
}

async function createFolder(accessToken, name, parentId) {
  const body = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) body.parents = [parentId];
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Drive create folder failed: ${res.status}`);
  return (await res.json()).id;
}

async function findFolder(accessToken, name, parentId) {
  const escaped = String(name).replace(/'/g, "\\'");
  let q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${escaped}'`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Drive query failed: ${res.status}`);
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function uploadCsv(accessToken, name, parentId, text) {
  const boundary = "base44backup_" + Math.random().toString(36).slice(2);
  const encoder = new TextEncoder();
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n`
  );
  const content = encoder.encode(text);
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + content.length + tail.length);
  body.set(head, 0);
  body.set(content, head.length);
  body.set(tail, head.length + content.length);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(60000),
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Drive upload failed: ${res.status} ${errText.slice(0, 150)}`);
  }
  return (await res.json()).id;
}

async function listBackupFolders(accessToken, rootId) {
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${rootId}' in parents`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=1000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  return (await res.json()).files || [];
}

async function trashFile(accessToken, id) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Drive delete failed: ${res.status}`);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = ["drive", "list_old", "delete_old"].includes(body.mode) ? body.mode : "csv";

    // Old backups: list / move to Drive trash every backup folder except the newest one.
    if (mode === "list_old" || mode === "delete_old") {
      const { accessToken: tok } = await base44.asServiceRole.connectors.getConnection("googledrive");
      if (!tok) return Response.json({ error: "Google Drive not connected" }, { status: 400 });
      const root = await findFolder(tok, ROOT_FOLDER_NAME, null);
      if (!root) return Response.json({ total: 0, old: [], deleted: 0 });
      const folders = await listBackupFolders(tok, root);
      const keep = Math.max(1, Math.min(100, parseInt(body.keep, 10) || 1)); // always keep at least the newest
      const old = folders.slice(keep); // newest first -> keep the first `keep`
      if (mode === "list_old") {
        return Response.json({ total: folders.length, old: old.map((f) => f.name) });
      }
      let deleted = 0;
      for (const f of old) {
        await trashFile(tok, f.id);
        deleted++;
      }
      return Response.json({ total: folders.length, deleted, kept: folders[0]?.name || null });
    }

    // Mode "csv": return one entity's CSV text (client zips/downloads). Mode "drive": backup everything to Drive.
    if (mode === "csv") {
      const name = String(body.entity || "");
      if (!ENTITIES.includes(name)) return Response.json({ error: "Unknown entity" }, { status: 400 });
      const rows = await fetchAll(base44, name);
      return Response.json({ entity: name, count: rows.length, csv: toCsv(rows) });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
    if (!accessToken) return Response.json({ error: "Google Drive not connected" }, { status: 400 });

    let rootId = await findFolder(accessToken, ROOT_FOLDER_NAME, null);
    if (!rootId) rootId = await createFolder(accessToken, ROOT_FOLDER_NAME, null);

    const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" }).replace(/[: ]/g, "-").slice(0, 16);
    const folderId = await createFolder(accessToken, `גיבוי ${stamp}`, rootId);

    const results = [];
    const queue = [...ENTITIES];
    const worker = async () => {
      while (queue.length) {
        const name = queue.shift();
        try {
          const rows = await fetchAll(base44, name);
          await uploadCsv(accessToken, `${name}.csv`, folderId, toCsv(rows));
          results.push({ entity: name, count: rows.length, ok: true });
        } catch (e) {
          results.push({ entity: name, ok: false, error: e.message });
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    results.sort((a, b) => a.entity.localeCompare(b.entity));
    return Response.json({
      folderName: `גיבוי ${stamp}`,
      rootFolder: ROOT_FOLDER_NAME,
      folderId,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}