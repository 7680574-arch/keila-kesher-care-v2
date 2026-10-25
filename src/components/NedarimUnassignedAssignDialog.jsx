import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, LinkIcon, UserPlus } from "lucide-react";
import MemberPicker from "@/components/MemberPicker";
import { cn } from "@/lib/utils";
import { bestEntityMatch } from "@/lib/nedarimMatch";

const fmtAmount = (n, currency) => {
  const sym = currency === 2 ? "$" : "₪";
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString("he-IL");
};
const fmtDate = (s) => (s || "").replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}):\d{2}/, "$1 $2");

// דיאלוג מרוכז לשיוך כל החיובים ללא ת"ז. כל שורה מקבלת בורר חבר וכפתור שיוך.
// שיוך חיוב עם הו"ק משייך אוטומטית את כל החיובים עם אותו מספר הו"ק שעדיין לא שויכו.
export default function NedarimUnassignedAssignDialog({ open, onOpenChange, onAssigned }) {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [donors, setDonors] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [picks, setPicks] = useState({}); // rowId -> entityId
  const [pickKind, setPickKind] = useState({}); // rowId -> "member" | "donor"
  const [suggestedIds, setSuggestedIds] = useState({}); // rowId -> true (הצעה אוטומטית)
  const [reasons, setReasons] = useState({}); // rowId -> סיבת ההתאמה
  const [lastNumMap, setLastNumMap] = useState({}); // 4 ספרות כרטיס -> ת"ז שויכה
  const manualRef = useRef({}); // rowId -> entityId שנבחרו ידנית (לא לדרוס)
  const [chargeFilter, setChargeFilter] = useState("all"); // all | keva | single

  // ריכוז חיובים: כל הו"ק → קבוצה אחת, חיובים בודדים → כל אחד נפרד.
  const groups = useMemo(() => {
    const byKeva = {};
    const singles = [];
    for (const r of rows) {
      if (r.keva_id) {
        const k = `keva:${r.keva_id}`;
        if (!byKeva[k]) byKeva[k] = { key: k, keva_id: r.keva_id, rows: [], rep: r };
        byKeva[k].rows.push(r);
      } else {
        singles.push({ key: `row:${r.id}`, rows: [r], rep: r });
      }
    }
    return [...Object.values(byKeva), ...singles];
  }, [rows]);
  const kevaGroupCount = groups.filter((g) => g.keva_id).length;
  const singleCount = groups.length - kevaGroupCount;
  const visibleGroups = useMemo(() => {
    if (chargeFilter === "keva") return groups.filter((g) => g.keva_id);
    if (chargeFilter === "single") return groups.filter((g) => !g.keva_id);
    return groups;
  }, [groups, chargeFilter]);

  // רשימה משולבת לבורר: חברי קהילה + תורמים (עם תג "תורם")
  const combined = useMemo(
    () => [
      ...members.map((m) => ({ ...m, _tag: null })),
      ...donors.map((d) => ({ ...d, _tag: "תורם" })),
    ],
    [members, donors]
  );

  const [communityIds, setCommunityIds] = useState([]);

  const loadMembers = useCallback(async () => {
    try {
      const p = await base44.entities.CommunityMember.filter(
        {}, { limit: 3000, fields: ["name", "id_number", "spouse_id", "phone", "mobile"] }
      );
      const items = p.items || [];
      setMembers(items);
      return items;
    } catch { return []; }
  }, []);

  const loadDonors = useCallback(async () => {
    try {
      const p = await base44.entities.Donor.filter(
        {}, { sort: "name", limit: 3000, fields: ["name", "id_number", "phone", "mobile", "address"] }
      );
      const items = p.items || [];
      setDonors(items);
      return items;
    } catch { return []; }
  }, []);

  // טוען חיובים לא משויכים: ללא תורם, והת"ז אינה מופיעה ברשימת הקהילה.
  // כולל חיובים ללא ת"ז כלל וגם חיובים עם ת"ז שאינה בקהילה (לשיוך לתורם / הוספה לתורמים).
  const loadPage = useCallback(async (cur, ids) => {
    const query = { donor_id: { $in: ["", null] } };
    if (ids && ids.length) query.zeout = { $nin: ids };
    const page = await base44.entities.NedarimDonation.filter(
      query, { sort: "-transaction_id_num", limit: 100, cursor: cur }
    );
    return page;
  }, []);

  const reload = useCallback(async (ids) => {
    setLoading(true);
    try {
      const page = await loadPage(null, ids);
      setRows(page.items || []);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [loadPage, toast]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    manualRef.current = {};
    setPicks({});
    setPickKind({});
    setSuggestedIds({});
    setReasons({});
    (async () => {
      const [mems] = await Promise.all([loadMembers(), loadDonors()]);
      if (cancelled) return;
      const ids = [...new Set(
        (mems || []).flatMap((m) => [m.id_number, m.spouse_id]).filter(Boolean).map((s) => String(s).trim())
      )];
      setCommunityIds(ids);
      await reload(ids);
    })();
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // בונה מפת 4 ספרות כרטיס -> ת"ז מתוך חיובים שכבר שויכו, לכרטיסים שמופיעים בשורות הנוכחיות.
  useEffect(() => {
    if (!open) return;
    const nums = Array.from(new Set(rows.map((r) => r.last_num).filter(Boolean)));
    if (!nums.length) { setLastNumMap({}); return; }
    base44.entities.NedarimDonation.filter(
      { last_num: { $in: nums }, zeout: { $nin: ["", null] } },
      { fields: ["last_num", "zeout"], limit: 500 }
    )
      .then((p) => {
        const m = {};
        (p.items || []).forEach((r) => { if (r.last_num && r.zeout && !m[r.last_num]) m[r.last_num] = r.zeout; });
        setLastNumMap(m);
      })
      .catch(() => setLastNumMap({}));
  }, [open, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // ממלא אוטומטית את ההצעה הכי מתאימה לכל שורה (חבר קהילה או תורם), תוך שמירת בחירות ידניות.
  // מחשב מחדש את כל השורות בכל ריצה כדי שהתגים והסיבות יישארו עקביים גם אחרי טעינת lastNumMap.
  useEffect(() => {
    if ((!members.length && !donors.length) || !groups.length) return;
    const next = {};
    const kind = {};
    const sug = {};
    const rsn = {};
    for (const g of groups) {
      let entityId = null, k = "member";
      if (manualRef.current[g.key]) {
        entityId = manualRef.current[g.key];
        k = donors.some((d) => d.id === entityId) ? "donor" : "member";
      } else {
        const res = bestEntityMatch(g.rep, members, donors, lastNumMap);
        if (res) { entityId = res.entity.id; k = res.kind; sug[g.key] = true; rsn[g.key] = res.reason; }
      }
      if (entityId) { next[g.key] = entityId; kind[g.key] = k; }
    }
    setPicks(next);
    setPickKind(kind);
    setSuggestedIds(sug);
    setReasons(rsn);
  }, [members, donors, groups, lastNumMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(cursor, communityIds);
      setRows((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoadingMore(false); }
  };

  // מוסיף את התורם שמאחורי החיוב לרשימת התורמים ובוחר אותו אוטומטית לשיוך.
  const addDonorFromRow = async (group) => {
    const row = group.rep;
    const parts = [];
    if (row.last_num) parts.push(`כרטיס ••${row.last_num}`);
    if (row.keva_id) parts.push(`הו"ק ${row.keva_id}`);
    try {
      const d = await base44.entities.Donor.create({
        name: row.client_name || "תורם ללא שם",
        id_number: row.zeout || null,
        phone: row.phone || null,
        address: row.address || null,
        notes: parts.join(" · ") || null,
        source: "nedarim",
      });
      setDonors((prev) => [d, ...prev]);
      manualRef.current = { ...manualRef.current, [group.key]: d.id };
      setPicks((p) => ({ ...p, [group.key]: d.id }));
      setPickKind((p) => ({ ...p, [group.key]: "donor" }));
      setSuggestedIds((s) => { const n = { ...s }; delete n[group.key]; return n; });
      setReasons((s) => { const n = { ...s }; delete n[group.key]; return n; });
      toast({ title: "נוסף לרשימת התורמים", description: d.name });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    }
  };

  const assignRow = async (group) => {
    const row = group.rep;
    const gkey = group.key;
    const entityId = picks[gkey];
    const kind = pickKind[gkey] || "member";
    if (!entityId) return;
    const member = kind === "member" ? members.find((m) => m.id === entityId) : null;
    const donor = kind === "donor" ? donors.find((d) => d.id === entityId) : null;
    const assignName = member?.name || donor?.name;
    if (!assignName) return;
    if (kind === "member" && !member.id_number) {
      toast({ title: "חסר ת\"ז", description: "חבר הקהילה שנבחר אינו מכיל תעודת זהות. נא להשלים ת\"ז בכרטיס החבר ולנסות שוב.", variant: "destructive" });
      return;
    }
    setSavingId(gkey);
    try {
      // שאילתת בלק לפי סוג שיוך (זהה לדיאלוג הבודד):
      // - תורם: כל חיובי ההו"ק ללא תורם, כולל אחים עם אותה ת"ז (שומרים את הת"ז — לא מוחקים).
      // - חבר קהילה: רק חיובים ללא ת"ז וללא תורם (מציבים את ת"ז חבר הקהילה).
      const donorBulk = row.keva_id
        ? (row.zeout
            ? { keva_id: row.keva_id, donor_id: { $in: ["", null] }, $or: [{ zeout: { $in: ["", null] } }, { zeout: row.zeout }] }
            : { keva_id: row.keva_id, donor_id: { $in: ["", null] } })
        : null;
      const memberBulk = row.keva_id
        ? { keva_id: row.keva_id, zeout: { $in: ["", null] }, donor_id: { $in: ["", null] } }
        : null;
      const bulkQuery = kind === "donor" ? donorBulk : memberBulk;
      let bulkCount = group.rows.length;
      if (bulkQuery) {
        try {
          const c = await base44.entities.NedarimDonation.count(bulkQuery);
          bulkCount = Math.max(Number(c) || 1, group.rows.length);
        } catch {}
      }
      const groupIds = new Set(group.rows.map((r) => r.id));
      if (kind === "donor") {
        const donorId = donor.id;
        await base44.entities.NedarimDonation.update(row.id, { donor_id: donorId, manual_assigned: true });
        if (donorBulk) {
          let more = true;
          let guard = 0;
          while (more && guard < 10) {
            const res = await base44.entities.NedarimDonation.updateMany(donorBulk, { $set: { donor_id: donorId, manual_assigned: true } });
            more = !!res?.has_more;
            guard++;
          }
        }
        setRows((prev) => prev.filter((r) => !groupIds.has(r.id)));
        setPicks((prev) => { const n = { ...prev }; delete n[gkey]; return n; });
        setPickKind((prev) => { const n = { ...prev }; delete n[gkey]; return n; });
        manualRef.current = { ...manualRef.current };
        delete manualRef.current[gkey];
        onAssigned?.(row.id, null, donor.name, row.keva_id, bulkCount, "donor", donorId);
      } else {
        const zeout = member.id_number;
        await base44.entities.NedarimDonation.update(row.id, { zeout, manual_assigned: true });
        if (memberBulk) {
          let more = true;
          let guard = 0;
          while (more && guard < 10) {
            const res = await base44.entities.NedarimDonation.updateMany(memberBulk, { $set: { zeout, manual_assigned: true } });
            more = !!res?.has_more;
            guard++;
          }
        }
        setRows((prev) => prev.filter((r) => !groupIds.has(r.id)));
        setPicks((prev) => { const n = { ...prev }; delete n[gkey]; return n; });
        setPickKind((prev) => { const n = { ...prev }; delete n[gkey]; return n; });
        manualRef.current = { ...manualRef.current };
        delete manualRef.current[gkey];
        onAssigned?.(row.id, zeout, member.name, row.keva_id, bulkCount, "member", null);
      }
      toast({
        title: "החיוב שויך",
        description: row.keva_id
          ? `שויך ל${assignName} · ${bulkCount} חיובים עם הו״ק ${row.keva_id} עודכנו`
          : `שויך ל${assignName}`,
      });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך תרומות ({rows.length} חיובים)</DialogTitle>
        </DialogHeader>
        {!loading && groups.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={chargeFilter === "all" ? "default" : "outline"} onClick={() => setChargeFilter("all")}>הכל ({groups.length})</Button>
            <Button size="sm" variant={chargeFilter === "keva" ? "default" : "outline"} onClick={() => setChargeFilter("keva")}>הו״ק ({kevaGroupCount})</Button>
            <Button size="sm" variant={chargeFilter === "single" ? "default" : "outline"} onClick={() => setChargeFilter("single")}>חיובים בודדים ({singleCount})</Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : visibleGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <LinkIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>{rows.length > 0 ? "אין חיובים בסינון הנוכחי" : "אין חיובים לשיוך כרגע 🎉"}</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  {["תאריך", "תורם", "סכום", "הו״ק", "כרטיס", "חבר קהילה", ""].map((h) => (
                    <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((g, idx) => {
                  const row = g.rep;
                  const multi = g.rows.length > 1;
                  return (
                    <tr key={g.key} className={cn("border-t border-border align-middle", idx % 2 && "bg-muted/10", g.keva_id && "bg-primary/5")}>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(row.transaction_time)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={row.client_name || ""}>
                        {row.client_name || "—"}
                        {multi && <span className="text-xs text-muted-foreground mr-1">({g.rows.length} חיובים)</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmtAmount(row.amount, row.currency)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {g.keva_id ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="tabular-nums text-primary font-medium">{g.keva_id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{g.rows.length} חיובים</span>
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.last_num ? `••${row.last_num}` : "—"}</td>
                      <td className="px-3 py-2 min-w-[220px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <div className="flex-1">
                              <MemberPicker
                                value={picks[g.key] || null}
                                onChange={(mid) => {
                                  const isDonor = donors.some((d) => d.id === mid);
                                  manualRef.current = { ...manualRef.current, [g.key]: mid };
                                  setPicks((p) => ({ ...p, [g.key]: mid }));
                                  setPickKind((p) => ({ ...p, [g.key]: isDonor ? "donor" : "member" }));
                                  setSuggestedIds((s) => { const n = { ...s }; delete n[g.key]; return n; });
                                  setReasons((s) => { const n = { ...s }; delete n[g.key]; return n; });
                                }}
                                members={combined}
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() => addDonorFromRow(g)}
                              title="הוסף לרשימת התורמים"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          </div>
                          {suggestedIds[g.key] && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 bg-primary/5 rounded px-1.5 py-0.5">
                              ✨ הצעה אוטומטית{reasons[g.key] ? ` — ${reasons[g.key]}` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          disabled={!picks[g.key] || savingId === g.key}
                          onClick={() => assignRow(g)}
                        >
                          {savingId === g.key ? <Loader2 className="w-4 h-4 animate-spin" /> : multi ? `שייך ${g.rows.length}` : "שייך"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && hasMore && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "טוען..." : "טען עוד חיובים"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}