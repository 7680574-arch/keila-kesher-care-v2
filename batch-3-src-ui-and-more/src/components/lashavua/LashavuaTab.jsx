import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Archive, Wallet, ShoppingCart, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import LashavuaTransactionDialog from "./LashavuaTransactionDialog";
import LashavuaTransactionRow from "./LashavuaTransactionRow";

const fmt = (n) => "₪" + (Number(n) || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 });

const TABLE_HEADERS = ["תאריך", "קופה", "סוג", "פירוט / מוטב", "קטגוריה", "סכום", "עמלה", "מקור", "פעולות"];

export default function LashavuaTab() {
  const { toast } = useToast();
  const [setting, setSetting] = useState(null);
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [balances, setBalances] = useState({ lashavua: 0, supermarket: 0 });
  const [loading, setLoading] = useState(true);
  const [bucketFilter, setBucketFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultBucket, setDefaultBucket] = useState("lashavua");
  const [syncing, setSyncing] = useState(false);

  // טבלת חיובים ישנים — נפרדת, מוצגת רק בלחיצה על "חיובים ישנים"
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyRows, setLegacyRows] = useState([]);
  const [legacyCursor, setLegacyCursor] = useState(null);
  const [legacyHasMore, setLegacyHasMore] = useState(false);
  const [legacyLoading, setLegacyLoading] = useState(false);

  const buildQuery = useCallback((legacy) => {
    const query = {};
    if (bucketFilter !== "all") query.bucket = bucketFilter;
    if (kindFilter !== "all") query.kind = kindFilter;
    if (sourceFilter !== "all") query.source = sourceFilter;
    query.legacy = legacy ? true : { $ne: true };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    const q = search.trim();
    if (q) query.$or = [{ description: { $regex: q, $options: "i" } }, { category: { $regex: q, $options: "i" } }];
    return query;
  }, [bucketFilter, kindFilter, sourceFilter, fromDate, toDate, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setPage, incAgg, trnAgg, txPage] = await Promise.all([
        base44.entities.LashavuaTovaSetting.filter({}, { sort: "-created_date", limit: 1 }).catch(() => null),
        base44.entities.LashavuaTovaTransaction.aggregate({ query: { kind: "income", legacy: { $ne: true } }, groupBy: "bucket", sum: ["amount", "commission"] }).catch(() => null),
        base44.entities.LashavuaTovaTransaction.aggregate({ query: { kind: "transfer", legacy: { $ne: true } }, groupBy: "bucket", sum: ["amount", "commission"] }).catch(() => null),
        base44.entities.LashavuaTovaTransaction.filter(buildQuery(false), { sort: "-date", limit: 100 }),
      ]);
      setSetting(setPage?.items?.[0] || null);

      const inc = { lashavua: { a: 0, c: 0 }, supermarket: { a: 0, c: 0 }, expenses: { a: 0, c: 0 } };
      const trn = { lashavua: { a: 0, c: 0 }, supermarket: { a: 0, c: 0 }, expenses: { a: 0, c: 0 } };
      (incAgg?.rows || []).forEach((r) => { const b = r.bucket || "lashavua"; if (inc[b]) { inc[b].a += Number(r.sum_amount) || 0; inc[b].c += Number(r.sum_commission) || 0; } });
      (trnAgg?.rows || []).forEach((r) => { const b = r.bucket || "lashavua"; if (trn[b]) { trn[b].a += Number(r.sum_amount) || 0; trn[b].c += Number(r.sum_commission) || 0; } });
      const expTotal = trn.expenses.a + trn.expenses.c;
      setBalances({
        lashavua: inc.lashavua.a - inc.lashavua.c - (trn.lashavua.a + trn.lashavua.c) - expTotal,
        supermarket: inc.supermarket.a - inc.supermarket.c - (trn.supermarket.a + trn.supermarket.c),
      });

      setRows(txPage.items || []);
      setCursor(txPage.has_more ? txPage.next_cursor : null);
      setHasMore(!!txPage.has_more);
    } catch (e) {
      toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [buildQuery]);

  const loadLegacy = useCallback(async () => {
    setLegacyLoading(true);
    try {
      const page = await base44.entities.LashavuaTovaTransaction.filter(buildQuery(true), { sort: "-date", limit: 100 });
      setLegacyRows(page.items || []);
      setLegacyCursor(page.has_more ? page.next_cursor : null);
      setLegacyHasMore(!!page.has_more);
    } catch (e) {
      setLegacyRows([]);
    } finally { setLegacyLoading(false); }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showLegacy) loadLegacy(); else { setLegacyRows([]); setLegacyHasMore(false); } }, [showLegacy, loadLegacy]);

  const loadMore = async () => {
    if (!cursor) return;
    const page = await base44.entities.LashavuaTovaTransaction.filter(buildQuery(false), { sort: "-date", limit: 100, cursor });
    setRows((r) => [...r, ...(page.items || [])]);
    setCursor(page.has_more ? page.next_cursor : null);
    setHasMore(!!page.has_more);
  };

  const loadMoreLegacy = async () => {
    if (!legacyCursor) return;
    const page = await base44.entities.LashavuaTovaTransaction.filter(buildQuery(true), { sort: "-date", limit: 100, cursor: legacyCursor });
    setLegacyRows((r) => [...r, ...(page.items || [])]);
    setLegacyCursor(page.has_more ? page.next_cursor : null);
    setLegacyHasMore(!!page.has_more);
  };

  const openAdd = (bucket = "lashavua") => { setEditing(null); setDefaultBucket(bucket); setDialogOpen(true); };
  const openEdit = (rec) => { setEditing(rec); setDefaultBucket(rec.bucket); setDialogOpen(true); };

  const save = async (data) => {
    try {
      if (editing) await base44.entities.LashavuaTovaTransaction.update(editing.id, data);
      else await base44.entities.LashavuaTovaTransaction.create(data);
      setDialogOpen(false); setEditing(null);
      load();
      if (showLegacy) loadLegacy();
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (rec) => {
    if (!confirm(`למחוק את התנועה של ${rec.description || rec.category || ""}?`)) return;
    try {
      await base44.entities.LashavuaTovaTransaction.delete(rec.id);
      load();
      if (showLegacy) loadLegacy();
    } catch (e) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    }
  };

  const sync = async () => {
    const mosadId = setting?.mosad_id;
    if (!mosadId) { toast({ title: "חסר קוד קופה בהגדרות", variant: "destructive" }); return; }
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("lashavuaTovaSync", { mosadId });
      const d = res?.data || {};
      if (d.error) { toast({ title: "הסנכרון נכשל", description: d.error, variant: "destructive" }); return; }
      if (setting?.id) {
        const updated = await base44.entities.LashavuaTovaSetting.update(setting.id, {
          last_synced_at: new Date().toISOString(), last_synced_count: d.newCount || 0,
        });
        setSetting(updated);
      }
      toast({ title: `הסנכרון הסתיים — ${d.newCount || 0} רשומות חדשות` });
      load();
    } catch (e) {
      toast({ title: "שגיאה בסנכרון", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  const renderTable = (list, onEdit, onDelete) => (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {TABLE_HEADERS.map((h) => (
                <th key={h} className="text-right px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((r, idx) => (
              <LashavuaTransactionRow key={r.id} r={r} idx={idx} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0"><Wallet className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">יתרת לשבוע מטובה בחשבון</p>
            <p className={cn("text-2xl font-bold tabular-nums", balances.lashavua < 0 ? "text-rose-600" : "text-foreground")}>{fmt(balances.lashavua)}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><ShoppingCart className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">יתרת סופרים (להעברה הלאה)</p>
            <p className={cn("text-2xl font-bold tabular-nums", balances.supermarket < 0 ? "text-rose-600" : "text-foreground")}>{fmt(balances.supermarket)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { k: "all", label: "הכל" },
            { k: "lashavua", label: "לשבוע מטובה" },
            { k: "supermarket", label: "סופרים" },
            { k: "expenses", label: "הוצאות" },
          ].map((b) => (
            <Button key={b.k} variant={bucketFilter === b.k ? "default" : "outline"} size="sm" onClick={() => setBucketFilter(b.k)}>{b.label}</Button>
          ))}
          <span className="mx-1 text-border">|</span>
          {[
            { k: "all", label: "הכל" },
            { k: "income", label: "הכנסות" },
            { k: "transfer", label: "העברות" },
          ].map((b) => (
            <Button key={b.k} variant={kindFilter === b.k ? "secondary" : "ghost"} size="sm" onClick={() => setKindFilter(b.k)}>{b.label}</Button>
          ))}
          <span className="mx-1 text-border">|</span>
          {[
            { k: "all", label: "כל המקורות" },
            { k: "nedarim", label: "נדרים" },
            { k: "manual", label: "ידני" },
          ].map((b) => (
            <Button key={b.k} variant={sourceFilter === b.k ? "secondary" : "ghost"} size="sm" onClick={() => setSourceFilter(b.k)}>{b.label}</Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש פירוט / קטגוריה…"
            className="h-8 rounded-md border border-input bg-transparent px-3 text-sm w-44 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground" />
          <span className="text-muted-foreground text-xs">עד</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-muted-foreground" />
          {(search || fromDate || toDate || sourceFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setSourceFilter("all"); }}>נקה</Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing} title="סנכרון עסקאות מנדרים פלוס">
            <RefreshCw className={`w-4 h-4 ml-1 ${syncing ? "animate-spin" : ""}`} />{syncing ? "מסנכרן…" : "סנכרן נדרים"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openAdd("expenses")}><Plus className="w-4 h-4 ml-1" />הוצאה חדשה</Button>
          <Button variant="outline" size="sm" onClick={() => openAdd("supermarket")}><Plus className="w-4 h-4 ml-1" />תנועת סופרים</Button>
          <Button size="sm" onClick={() => openAdd("lashavua")}><Plus className="w-4 h-4 ml-1" />תנועה חדשה</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant={showLegacy ? "secondary" : "outline"} size="sm" onClick={() => setShowLegacy((v) => !v)}>
          <Archive className="w-4 h-4 ml-1" /> חיובים ישנים
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>אין תנועות עדיין. סנכרן מנדרים פלוס או הוסף תנועה ידנית.</p>
        </div>
      ) : (
        <>
          {renderTable(rows, openEdit, remove)}
          {hasMore && (
            <div className="py-3 text-center">
              <Button variant="ghost" size="sm" onClick={loadMore}>טען עוד</Button>
            </div>
          )}
        </>
      )}

      {showLegacy && (
        <div className="space-y-3 pt-2 border-t border-dashed border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground">חיובים ישנים (מחוץ לחישוב יתרה)</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowLegacy(false)}>הסתר</Button>
          </div>
          {legacyLoading ? (
            <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : legacyRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">אין חיובים ישנים לסינון הנוכחי.</div>
          ) : (
            <>
              {renderTable(legacyRows, openEdit, remove)}
              {legacyHasMore && (
                <div className="py-3 text-center">
                  <Button variant="ghost" size="sm" onClick={loadMoreLegacy}>טען עוד</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <LashavuaTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        defaultBucket={defaultBucket}
        onSave={save}
      />
    </div>
  );
}