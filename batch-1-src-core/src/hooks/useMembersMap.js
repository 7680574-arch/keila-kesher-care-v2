import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";

// Module-level cache shared across all pages so the member list is fetched once.
let cache = null;
let loadPromise = null;
const listeners = new Set();

function sortMembers(m) {
  return [...m].sort((a, b) =>
    (a.last_name || "").localeCompare(b.last_name || "", "he") ||
    (a.first_name || "").localeCompare(b.first_name || "", "he") ||
    (a.name || "").localeCompare(b.name || "", "he")
  );
}

function fetchMembers() {
  if (cache) return Promise.resolve(cache);
  if (!loadPromise) {
    loadPromise = base44.entities.CommunityMember
      .list("-created_date", 5000)
      .then((m) => { cache = sortMembers(m); listeners.forEach((fn) => fn(cache)); return cache; })
      .catch(() => { loadPromise = null; return []; });
  }
  return loadPromise;
}

function setMembers(m) {
  cache = sortMembers(m);
  listeners.forEach((fn) => fn(cache));
}

/**
 * Loads all community members once (cached app-wide) and keeps them fresh in
 * realtime via entity subscriptions. Returns a map keyed by member id plus the
 * raw list. Every page that displays member-derived data should use this so a
 * change in the community list propagates everywhere automatically.
 */
export function useMembersMap() {
  const [members, setMembersState] = useState(cache || []);

  useEffect(() => {
    let active = true;
    const update = (m) => { if (active) setMembersState(m); };
    listeners.add(update);
    fetchMembers().then((m) => { if (active) setMembersState(m); });

    // realtime: any create/update/delete on CommunityMember re-fetches the list
    const unsub = base44.entities.CommunityMember.subscribe(() => {
      base44.entities.CommunityMember
        .list("-created_date", 5000)
        .then((m) => { if (active) setMembers(m); })
        .catch(() => {});
    });

    return () => { active = false; listeners.delete(update); if (typeof unsub === "function") unsub(); };
  }, []);

  const map = useMemo(() => {
    const m = new Map();
    (members || []).forEach((mem) => m.set(mem.id, mem));
    return m;
  }, [members]);

  return { members: members || [], map, loading: !cache && members.length === 0 };
}

/**
 * Overlays live community-member fields onto a row that carries a `member_id`.
 * Falls back to the row's own stored value when no member is linked or found, so
 * records without a linked member keep working unchanged.
 */
export function withMember(row, map) {
  if (!row || !row.member_id) return row;
  const m = map.get(row.member_id);
  if (!m) return row;
  const pick = (live, stored) => {
    if (live !== undefined && live !== null && live !== "") return live;
    return stored;
  };
  return {
    ...row,
    name: pick(m.name, row.name),
    first_name: pick(m.first_name, row.first_name),
    last_name: pick(m.last_name, row.last_name),
    id_number: pick(m.id_number, row.id_number),
    phone: pick(m.phone || m.mobile, row.phone),
    address: pick(m.address || [m.city, m.street, m.house_number].filter(Boolean).join(" "), row.address),
    neighborhood: pick(m.neighborhood, row.neighborhood),
    city: pick(m.city, row.city),
    family_size: m.family_size != null && m.family_size !== "" ? m.family_size : row.family_size,
    children_count: m.children_count != null && m.children_count !== "" ? m.children_count : row.children_count,
  };
}

/** Enriches an array of rows in place (returns a new array) with live member data. */
export function enrichRows(rows, map) {
  if (!map || map.size === 0) return rows;
  return rows.map((r) => withMember(r, map));
}