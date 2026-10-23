import { base44 } from "@/api/base44Client";
import { memberAddress } from "@/lib/communityFields";

// Member fields kept in a locked holiday-support distribution.
const SNAP_FIELDS = [
  "id", "name", "first_name", "last_name", "id_number", "phone", "mobile",
  "city", "street", "house_number", "apartment", "address", "neighborhood",
  "family_size", "children_count",
];

export const parseSnapshot = (s) => {
  try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
};

// The snapshot is too big for a record field, so it lives in a private file
// and the field keeps only the file URI ("private://..." style value).
const isFileRef = (s) => typeof s === "string" && s.length > 0 && !s.trim().startsWith("[");

/** Returns the distribution with its snapshot loaded inline (fetches the stored file when needed). */
export async function hydrateSnapshot(dist) {
  if (!dist?.data_locked || !isFileRef(dist.members_snapshot)) return dist;
  const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: dist.members_snapshot });
  const res = await fetch(signed_url);
  const text = await res.text();
  return { ...dist, members_snapshot: text };
}

async function saveSnapshotFile(members) {
  const file = new File([JSON.stringify(snapshotOf(members))], "members_snapshot.json", { type: "application/json" });
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

const snapshotOf = (members) =>
  members.map((m) => Object.fromEntries(SNAP_FIELDS.map((k) => [k, m[k] ?? null])));

/** Members list a distribution should work with: frozen snapshot when locked, live list otherwise. */
export const membersForDist = (dist, liveMembers) => {
  if (!dist?.data_locked) return liveMembers;
  const snap = parseSnapshot(dist.members_snapshot);
  return snap.length ? snap : liveMembers;
};

/** Freezes the distribution's data as it is right now. */
export async function lockDistribution(dist, recipients, liveMembers) {
  const patch = { data_locked: true, locked_at: new Date().toISOString() };
  if (dist.type === "holiday_support") {
    patch.members_snapshot = await saveSnapshotFile(liveMembers);
  } else {
    const byId = new Map(liveMembers.map((m) => [m.id, m]));
    const updates = recipients.filter((r) => byId.has(r.member_id)).map((r) => {
      const m = byId.get(r.member_id);
      return {
        id: r.id,
        name: m.name || r.name,
        id_number: m.id_number || r.id_number || "",
        phone: m.mobile || m.phone || r.phone || "",
        address: memberAddress(m) || m.address || r.address || "",
        neighborhood: m.neighborhood || r.neighborhood || "",
        family_size: m.family_size ?? r.family_size ?? 0,
        children_count: m.children_count ?? r.children_count ?? 0,
      };
    });
    if (updates.length) await base44.entities.DistributionRecipient.bulkUpdate(updates);
  }
  await base44.entities.Distribution.update(dist.id, patch);
  return patch;
}

export async function lockMany(list, recipients, liveMembers) {
  for (const d of list) {
    await lockDistribution(d, recipients.filter((r) => r.distribution_id === d.id), liveMembers);
  }
}

/** Releases the freeze so the distribution follows the community list again. */
export async function unlockDistribution(dist) {
  const patch = { data_locked: false, locked_at: "", members_snapshot: "" };
  await base44.entities.Distribution.update(dist.id, patch);
  return patch;
}