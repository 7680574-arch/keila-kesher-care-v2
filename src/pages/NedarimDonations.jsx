import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, RefreshCw, AlertCircle, Link as LinkIcon, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import NedarimAssignMemberDialog from "@/components/NedarimAssignMemberDialog";
import NedarimUnassignedAssignDialog from "@/components/NedarimUnassignedAssignDialog";
import ManualAssignmentUndo from "@/components/nedarim/ManualAssignmentUndo";
import ExportActiveKevaButton from "@/components/ExportActiveKevaButton";
import NedarimFilters, { filtersToQuery } from "@/components/NedarimFilters";

const RANGES = [
  { key: "week", label: "השבוע האחרון", days: 7 },
  { key: "month", label: "החודש האחרון", days: 30 },
  { key: "year", label: "השנה האחרונה", days: 365 },
  { key: "all", label: "הכל", days: null },
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtAmount(n, currency) {
  const sym = currency === 2 ? "$" : "₪";
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString("he-IL");
}
function fmtDateTime(s) {
  // "dd/MM/yyyy HH:mm:ss" → "dd/MM/yyyy HH:mm"
  if (!s) return "—";
  return s.replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}):\d{2}/, "$1 $2");
}

export default function NedarimDonations() {
  const { toast } = useToast();
  const [range, setRange] = useState("month");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assignFilter, setAssignFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [assignRecord, setAssignRecord] = useState(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategory(category.trim()), 400);
    return () => clearTimeout(t);
  }, [category]);
  const [stats, setStats] = useState({ count: 0, total: 0, totalUsd: 0 });
  const [usdRate, setUsdRate] = useState(null);
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => setUsdRate(Number(d?.rates?.ILS) || null))
      .catch(() => setUsdRate(null));
  }, []);
  const [donorsMap, setDonorsMap] = useState({});
  const [membersByIdNumber, setMembersByIdNumber] = useState({});

  const loadDonorsMap = useCallback(async () => {
    try {
      const p = await base44.entities.Donor.filter({}, { sort: "name", limit: 3000, fields: ["name"] });
      const m = {};
      (p.items || []).forEach((d) => { m[d.id] = d.name; });
      setDonorsMap(m);
    } catch {}
  }, []);

  const loadMembersMap = useCallback(async () => {
    try {
      const p = await base44.entities.CommunityMember.filter({}, { limit: 3000, fields: ["name", "id_number", "spouse_id"] });
      const m = {};
      (p.items || []).forEach((mem) => {
        if (mem.spouse_id && String(mem.spouse_id).trim()) m[String(mem.spouse_id).trim()] = mem.name;
      });
      (p.items || []).forEach((mem) => {
        if (mem.id_number) m[String(mem.id_number).trim()] = mem.name;
      });
      setMembersByIdNumber(m);
    } catch {}
  }, []);

  useEffect(() => { loadDonorsMap(); loadMembersMap(); }, [loadDonorsMap, loadMembersMap]);

  const { fromISO, toISO } = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    return { fromISO: r.days ? isoDaysAgo(r.days) : null, toISO: todayISO() };
  }, [range]);

  const buildQuery = useCallback(() => {
    const and = [];
    if (dateFrom || dateTo) {
      const d = {};
      if (dateFrom) d.$gte = dateFrom;
      if (dateTo) d.$lte = dateTo;
      and.push({ transaction_date: d });
    } else if (fromISO) {
      and.push({ transaction_date: { $gte: fromISO, $lte: toISO } });
    }
    if (debouncedSearch) {
      const rx = { $regex: debouncedSearch, $options: "i" };
      and.push({ $or: [{ client_name: rx }, { zeout: rx }, { last_num: rx }, { keva_id: rx }] });
    }
    if (debouncedCategory) and.push({ groupe: { $regex: debouncedCategory, $options: "i" } });
    and.push(...filtersToQuery({ type: typeFilter, assign: assignFilter, currency: currencyFilter }));
    if (and.length === 0) return {};
    return and.length === 1 ? and[0] : { $and: and };
  }, [fromISO, toISO, debouncedSearch, debouncedCategory, dateFrom, dateTo, typeFilter, assignFilter, currencyFilter]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = buildQuery();
      const page = await base44.entities.NedarimDonation.filter(query, { sort: "-transaction_id_num", limit: 100 });
      const items = page.items || [];
      setRecords(items);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
      // סטטיסטיקות מהשרת: ספירה + סכום בקריאת aggregate אחת
      try {
        const agg = await base44.entities.NedarimDonation.aggregate({ query, groupBy: "currency", sum: "amount" });
        const rows = agg?.rows || [];
        const usd = rows.find((r) => Number(r.currency) === 2);
        const count = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
        const ils = rows.filter((r) => Number(r.currency) !== 2).reduce((s, r) => s + (Number(r.sum_amount) || 0), 0);
        setStats({ count, total: ils, totalUsd: Number(usd?.sum_amount) || 0 });
      } catch {
        setStats({ count: items.length, total: items.filter((r) => r.currency !== 2).reduce((s, r) => s + (Number(r.amount) || 0), 0), totalUsd: items.filter((r) => r.currency === 2).reduce((s, r) => s + (Number(r.amount) || 0), 0) });
      }
    } catch (e) {
      setError(e.message || "שגיאה בטעינת תרומות");
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [buildQuery, toast]);

  useEffect(() => { load(); }, [range, debouncedSearch, debouncedCategory, dateFrom, dateTo, typeFilter, assignFilter, currencyFilter]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const query = buildQuery();
      const page = await base44.entities.NedarimDonation.filter(query, { sort: "-transaction_id_num", limit: 100, cursor });
      setRecords((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setLoadingMore(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("nedarimDonationsSync", {});
      const d = res.data || res || {};
      if (d.error) throw new Error(d.error);
      const creditN = d.credit?.newCount ?? 0;
      const masavN = d.masav?.upserted ?? (d.masav?.error ? 0 : 0);
      const masavErr = d.masav?.error ? ` (מס"ב: ${d.masav.error})` : "";
      toast({ title: "הסנכרון בוצע", description: `אשראי: ${creditN} · מס"ב: ${masavN}${masavErr}` });
      load();
    } catch (e) {
      toast({ title: "שגיאת סנכרון", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  // עדכון מקומי של הרשימה לאחר שיוך/ביטול — שומר על מיקום הגלילה בלי רענון מהשרת
  const filterByAssign = useCallback((list) => list.filter((r) => {
    const isAssigned = !!(r.zeout || r.donor_id);
    if (assignFilter === "unassigned") return !isAssigned;
    if (assignFilter === "assigned") return isAssigned;
    return true;
  }), [assignFilter]);

  const applyAssignment = useCallback((id, zeout, kevaId, kind, donorId) => {
    setRecords((prev) => filterByAssign(prev.map((r) => {
      const match = r.id === id || (kevaId && r.keva_id === kevaId && !r.zeout && !r.donor_id);
      if (!match) return r;
      if (kind === "donor") return { ...r, donor_id: donorId };
      return { ...r, zeout };
    })));
  }, [filterByAssign]);

  const applyUnassign = useCallback((record) => {
    setRecords((prev) => filterByAssign(prev.map((r) => {
      const sameKeva = record.keva_id && r.keva_id === record.keva_id && r.manual_assigned === true;
      const sameTarget = record.donor_id ? r.donor_id === record.donor_id : (r.zeout === record.zeout && !r.donor_id);
      const match = r.id === record.id || (sameKeva && sameTarget);
      if (!match) return r;
      return { ...r, ...(record.donor_id ? { donor_id: "" } : { zeout: "" }), manual_assigned: false };
    })));
  }, [filterByAssign]);

  const filtered = records;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <CreditCard className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">תרומות נדרים פלוס</h1>
            <p className="text-sm text-muted-foreground">היסטוריית עסקאות אשראי · סנכרון שעתי אוטומטי</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportActiveKevaButton />
          <Button variant="secondary" onClick={() => setBulkAssignOpen(true)}>
            <UserPlus className="w-4 h-4" /> שיוך תרומות
          </Button>
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} /> {syncing ? "מסנכרן..." : "סנכרן עכשיו"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => { setRange(r.key); setDateFrom(""); setDateTo(""); }}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
              !dateFrom && !dateTo && range === r.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary"
            )}
          >
            {r.label}
          </button>
        ))}
        <div className="flex-1 min-w-48">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם / ת״ז / 4 ספרות / הו״ק..." />
        </div>
      </div>

      <NedarimFilters
        type={typeFilter} assign={assignFilter} currency={currencyFilter}
        category={category} dateFrom={dateFrom} dateTo={dateTo}
        onType={setTypeFilter} onAssign={setAssignFilter} onCurrency={setCurrencyFilter}
        onCategory={setCategory} onDateFrom={setDateFrom} onDateTo={setDateTo}
      />

      <div className={cn("grid grid-cols-2 gap-3", stats.totalUsd ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <Stat label="תרומות בטווח" value={stats.count.toLocaleString("he-IL")} />
        <Stat
          label={stats.totalUsd && usdRate ? `סה"כ גובה (₪, כולל דולרים בשער ${usdRate.toFixed(3)})` : 'סה"כ גובה (₪)'}
          value={fmtAmount(stats.total + (usdRate ? stats.totalUsd * usdRate : 0), 1)}
        />
        {stats.totalUsd ? <Stat label={'מתוכו בדולרים ($)'} value={fmtAmount(stats.totalUsd, 2)} /> : null}
        <Stat label="מוצגות" value={String(filtered.length)} />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><p className="font-semibold">שגיאה</p><p className="mt-0.5">{error}</p></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : !error && filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-border">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>אין תרומות בטווח שנבחר.</p>
          <p className="text-sm mt-1">ייתכן שהסנכרון עדיין בעיצומו — נסה/י "סנכרן עכשיו" או הרחב/י את הטווח.</p>
        </div>
      ) : filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {["תאריך", "תורם", "ת\"ז", "טלפון", "כתובת", "סכום", "קטגוריה", "סוג / הערות", "הו״ק", "אישור", "כרטיס"].map((h) => (
                    <th key={h} className="text-right px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id || r.transaction_id} className={cn("border-t border-border hover:bg-muted/30", idx % 2 && "bg-muted/10")}>
                    <td className="px-3 py-2.5 whitespace-nowrap">{fmtDateTime(r.transaction_time)}</td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate">{r.client_name || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {(() => {
                        const memberName = r.zeout ? membersByIdNumber[String(r.zeout).trim()] : null;
                        if (memberName) {
                          return (
                            <span className="inline-flex items-center gap-1" title={`חבר קהילה: ${memberName}`}>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">קהילה</span>
                              <span className="text-xs">{memberName}</span>
                              <ManualAssignmentUndo record={r} onUpdated={applyUnassign} />
                            </span>
                          );
                        }
                        if (r.donor_id) {
                          return (
                            <span className="inline-flex items-center gap-1" title={donorsMap[r.donor_id] || "תורם"}>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">תורם</span>
                              <span className="text-xs">{donorsMap[r.donor_id] || "—"}</span>
                              <ManualAssignmentUndo record={r} onUpdated={applyUnassign} />
                            </span>
                          );
                        }
                        if (r.zeout) {
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="tabular-nums">{r.zeout}</span>
                              <button onClick={() => setAssignRecord(r)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" title="שייך לתורם / הוסף לרשימת התורמים">
                                <LinkIcon className="w-3 h-3" /> שייך
                              </button>
                            </span>
                          );
                        }
                        return (
                          <button onClick={() => setAssignRecord(r)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline" title="שייך לחבר קהילה / תורם">
                            <LinkIcon className="w-3 h-3" /> שייך
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{r.phone || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate" title={r.address || ""}>{r.address || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className={cn("px-3 py-2.5 font-semibold whitespace-nowrap", Number(r.amount) < 0 && "text-destructive")}>{fmtAmount(r.amount, r.currency)}</td>
                    <td className="px-3 py-2.5 max-w-[140px] truncate">{r.groupe || "—"}</td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate" title={`${r.transaction_type || ""} ${r.comments || ""}`.trim()}>
                      {r.transaction_type || ""}
                      {r.comments ? ` · ${r.comments}` : ""}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.keva_id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="tabular-nums text-primary font-medium">{r.keva_id}</span>
                          {String(r.transaction_id || "").startsWith("MASAV_") && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">בנקאי</span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">הו״ק</span>
                        </span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.confirmation || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.last_num ? `••${r.last_num}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>{filtered.length} רשומות מוצגות</span>
            {hasMore && (
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "טוען..." : "טען עוד"}
              </Button>
            )}
          </div>
        </div>
      )}

      <NedarimUnassignedAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        onAssigned={(id, zeout, name, kevaId, bulkCount, kind, donorId) => {
          applyAssignment(id, zeout, kevaId, kind, donorId);
          loadDonorsMap();
        }}
      />
      <NedarimAssignMemberDialog
        open={!!assignRecord}
        onOpenChange={(o) => !o && setAssignRecord(null)}
        record={assignRecord}
        onAssigned={(id, zeout, name, kevaId, bulkCount, kind, donorId) => {
          applyAssignment(id, zeout, kevaId, kind, donorId);
          loadDonorsMap();
          const n = Number(bulkCount) || 1;
          toast({ title: "החיוב שויך", description: kevaId ? `שויך ל${name} · ${n} חיובים עם הו״ק ${kevaId} עודכנו` : `שויך ל${name}` });
        }}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}