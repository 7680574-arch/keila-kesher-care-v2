import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import FormConfigDialog from "@/components/forms/FormConfigDialog";
import { titleFor, parseTitlesJson, orderedColumns } from "@/lib/formFields";

export default function Forms() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [records, setRecords] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastId, setLastId] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState("ID");
  const [sortDir, setSortDir] = useState("desc");
  const [configOpen, setConfigOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [search, setSearch] = useState("");

  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const list = await base44.entities.FormConfig.list("-created_date", 200);
      setConfigs(list);
      if (list.length && !activeId) setActiveId(list[0].id);
    } catch (e) {
      toast({ title: "שגיאה בטעינת טפסים", description: e.message, variant: "destructive" });
    } finally {
      setLoadingConfigs(false);
    }
  };
  useEffect(() => { loadConfigs(); }, []);

  const active = useMemo(() => configs.find((c) => c.id === activeId), [configs, activeId]);
  const titles = useMemo(() => (active ? parseTitlesJson(active.titles) : {}), [active]);

  const fetchPage = useCallback(async (fromZero) => {
    if (!active) return;
    if (fromZero) { setLoading(true); setError(""); setRecords([]); setLastId(0); }
    else setLoadingMore(true);
    try {
      const res = await base44.functions.invoke("nedarimForms", {
        configId: active.id, tofesId: active.tofes_id, lastId: fromZero ? 0 : lastId, maxId: 500,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      const page = Array.isArray(data.records) ? data.records : [];
      setRecords((prev) => fromZero ? page : [...prev, ...page]);
      setLastId(data.lastId || (page.length ? Number(page[page.length - 1].ID) : lastId));
      setHasMore(!!data.hasMore);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || "שגיאה בטעינת רשומות";
      setError(msg);
      toast({ title: "שגיאה", description: msg, variant: "destructive" });
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [active, lastId, toast]);

  useEffect(() => {
    if (active) {
      setRecords([]); setHasMore(false); setLastId(0); setError(""); fetchPage(true);
      // איפוס תג השורות החדשות בפתיחת הטופס
      if ((active.new_count || 0) > 0) {
        base44.entities.FormConfig.update(active.id, { new_count: 0 });
        setConfigs((prev) => prev.map((c) => c.id === active.id ? { ...c, new_count: 0 } : c));
      }
    }
    else { setRecords([]); setHasMore(false); }
  }, [activeId]);

  const columns = useMemo(() => {
    if (!records.length) return [];
    return orderedColumns(records, titles);
  }, [records, titles]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return records;
    return records.filter((r) => columns.some((c) => String(r[c] ?? "").includes(q)));
  }, [records, columns, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortField] ?? ""; const bv = b[sortField] ?? "";
      const an = Number(av), bn = Number(bv);
      const cmp = (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") ? an - bn : String(av).localeCompare(String(bv), "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const toggleSort = (f) => {
    if (sortField === f) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  };

  const removeConfig = async (c) => {
    if (!confirm(`למחוק את הטופס "${c.name}"?`)) return;
    await base44.entities.FormConfig.delete(c.id);
    if (activeId === c.id) setActiveId("");
    loadConfigs();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <FileText className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">טפסים</h1>
            <p className="text-sm text-muted-foreground">רשומות מנדרים פלוס · מוסד 7001539</p>
          </div>
        </div>
        <Button onClick={() => { setEditingConfig(null); setConfigOpen(true); }}>
          <Plus className="w-4 h-4" /> הוסף טופס
        </Button>
      </div>

      {loadingConfigs ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : configs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-border">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>עדיין לא הוגדרו טפסים.</p>
          <p className="text-sm mt-1">לחצ/י על "הוסף טופס" כדי לחבר טופס מנדרים פלוס.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
              {configs.map((c) => {
                const isActive = c.id === activeId;
                const isNew = (c.new_count || 0) > 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-muted-foreground border-border hover:bg-secondary"
                    )}
                  >
                    {c.name}
                    {isNew && (
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold",
                        isActive ? "bg-primary-foreground text-primary" : "bg-accent text-accent-foreground"
                      )}>
                        {c.new_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {active && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingConfig(active); setConfigOpen(true); }} className="p-2 rounded-lg hover:bg-primary/10 text-primary" title="עריכת טופס"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => removeConfig(active)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחיקת טופס"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              <div className="flex-1 min-w-48">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש ברשומות..." />
              </div>
              {active && (
                <Button variant="outline" onClick={() => fetchPage(true)} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "טוען..." : "רענן"}
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div><p className="font-semibold">הטעינה נכשלה</p><p className="mt-0.5">{error}</p></div>
            </div>
          )}

          {active && !error && records.length === 0 && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>לא נטענו רשומות.</p>
            </div>
          )}

          {records.length > 0 && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="text-right px-3 py-3 font-semibold cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(c)}>
                          <span className="inline-flex items-center gap-1">
                            {c === "ID" ? "מזהה" : c === "CreatedDate" ? "תאריך" : titleFor(titles, c)}
                            {sortField === c && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, idx) => (
                      <tr key={r.ID || `row-${idx}`} className={`border-t border-border hover:bg-muted/30 ${idx % 2 ? "bg-muted/10" : ""}`}>
                        {columns.map((c) => (
                          <td key={c} className="px-3 py-2.5 max-w-[220px] truncate" title={String(r[c] ?? "")}>
                            {r[c] || <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span>{sorted.length} רשומות</span>
                {hasMore && (
                  <Button variant="ghost" size="sm" onClick={() => fetchPage(false)} disabled={loadingMore}>
                    {loadingMore ? "טוען..." : "טען עוד 500"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <FormConfigDialog open={configOpen} onOpenChange={setConfigOpen} initial={editingConfig} onSaved={loadConfigs} />
    </div>
  );
}