import React, { useEffect, useMemo, useRef, useState } from "react";
import { PhoneCall, RefreshCw, AlertCircle, BarChart3, EyeOff, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/DataTable";
import { getExtension, findUnmapped } from "@/lib/telclickExtensions";
import TelclickLogsAnalysis from "@/components/TelclickLogsAnalysis";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const STATUS_ORDER = ["busy", "ringing", "available_answered", "available_missed", "available", "unavailable", "empty", "other"];
const LABELS = { busy: "בשיחה", ringing: "מצלצל אצלה", available_answered: "זמינה · נענתה", available_missed: "זמינה · לא נענתה", available: "זמין", unavailable: "לא זמין", empty: "—", other: "אחר" };

export default function TelclickMonitor() {
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(null);
  const [paused, setPaused] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [user, setUser] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [showHidden, setShowHidden] = useState(false);
  const fetching = useRef(false);
  const loggingRef = useRef(false);
  useEffect(() => { loggingRef.current = logging; }, [logging]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // טעינה ושמירה של נציגים מוסתרים — לפי משתמש, באחסון מקומי של הדפדפן
  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`telclick_hidden_${user.id}`);
      setHidden(new Set(raw ? JSON.parse(raw) : []));
    } catch { setHidden(new Set()); }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      localStorage.setItem(`telclick_hidden_${user.id}`, JSON.stringify([...hidden]));
    } catch {}
  }, [user?.id, hidden]);

  const hideRep = (name) => {
    if (!name) return;
    setHidden((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  };
  const restoreRep = (name) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };
  const restoreAll = () => setHidden(new Set());

  const canAnalyze = user?.role === "admin" || user?.role === "telclick_manager";

  const fetchNow = async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await base44.functions.invoke("telclickMonitor", { log: loggingRef.current });
      if (res.data?.error) throw new Error(res.data.error);
      setReps(res.data?.reps || []);
      setUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e.message || "שגיאה בשליפה");
    } finally {
      setLoading(false);
      fetching.current = false;
    }
  };

  useEffect(() => {
    fetchNow();
    let timer = null;
    if (!paused) timer = setInterval(fetchNow, 5000);
    return () => clearInterval(timer);
  }, [paused]);

  const visible = useMemo(() => reps.filter((r) => !hidden.has(r.name)), [reps, hidden]);
  const sorted = [...visible].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
  const stats = STATUS_ORDER.map((k) => ({ k, n: visible.filter((r) => r.status === k).length })).filter((c) => c.n > 0 && c.k !== "empty");
  const unmapped = findUnmapped(visible);

  const columns = [
    { key: "name", header: "שם הנציג", field: "name", filterable: true, cellClassName: "font-medium", render: (r) => r.name },
    { key: "status", header: "סטטוס", render: (r) => (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: r.color ? `#${r.color}` : "hsl(var(--muted))", color: r.color === "e4e4e4" || !r.color ? "hsl(var(--foreground))" : "#fff" }}>
        {r.color && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
        {r.statusLabel}
      </span>
    ) },
    { key: "ext", header: "שלוחה ישירה", render: (r) => {
      const ext = getExtension(r.name);
      return ext ? <span className="font-mono tabular-nums">{ext}</span> : <span className="text-muted-foreground">—</span>;
    } },
    { key: "duration", header: "משך", field: "duration", render: (r) => r.duration || "—" },
    { key: "direction", header: "כיוון", field: "direction", filterable: true, render: (r) => r.direction || "—" },
    { key: "phone", header: "טלפון / שלוחה", field: "phone", filterable: true, render: (r) => r.phone || "—" },
    { key: "lastCall", header: "שיחה אחרונה", field: "lastCall", filterable: true, render: (r) => r.lastCall || "—" },
    {
      key: "_hide",
      header: "",
      render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); hideRep(r.name); }}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="הסתר נציג"
        >
          <EyeOff className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-5rem)]">
      <div className="shrink-0 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <PhoneCall className="w-6 h-6 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-40">
          <h1 className="text-2xl font-bold">מרכזייה טלקליק</h1>
          <p className="text-sm text-muted-foreground">מעקב חי אחר נציגים טלפוניים · מתרענן כל 5 שניות</p>
        </div>
        <div className="flex items-center gap-2">
          {updated && <span className="text-xs text-muted-foreground hidden sm:inline">עודכן {updated.toLocaleTimeString("he-IL")}</span>}
          {canAnalyze && logging && <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 hidden sm:inline">● שומר לוגים</span>}
          {canAnalyze && <Button variant="outline" size="sm" onClick={() => setShowAnalysis(true)}><BarChart3 className="w-4 h-4" /> ניתוח</Button>}
          {canAnalyze && <Button variant={logging ? "default" : "outline"} size="sm" onClick={() => setLogging((l) => !l)}>{logging ? "עצור לוגים" : "שמור לוגים"}</Button>}
          {hidden.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHidden(true)}>
              <EyeOff className="w-4 h-4" /> מוסתרים ({hidden.size})
            </Button>
          )}
          <Button variant={paused ? "default" : "outline"} size="sm" onClick={() => setPaused((p) => !p)}>{paused ? "המשך" : "השהה"}</Button>
          <Button variant="outline" size="icon" onClick={fetchNow}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-thin">
        <div className="rounded-lg border bg-card px-2.5 py-1.5 shrink-0">
          <p className="text-[11px] text-muted-foreground leading-none">סה"כ נציגים</p>
          <p className="text-base font-bold leading-tight">{visible.length}</p>
        </div>
        {stats.map((c) => (
          <div key={c.k} className="rounded-lg border bg-card px-2.5 py-1.5 shrink-0">
            <p className="text-[11px] text-muted-foreground leading-none truncate">{LABELS[c.k]}</p>
            <p className="text-base font-bold leading-tight">{c.n}</p>
          </div>
        ))}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 shrink-0">
          <p className="text-[11px] text-amber-700 leading-none">ללא שלוחה</p>
          <p className="text-base font-bold leading-tight text-amber-700">{unmapped.length}</p>
        </div>
      </div>

      </div>
      <div className="flex-1 min-h-0">
      <DataTable
        rows={sorted}
        columns={columns}
        loading={loading}
        emptyMessage="אין נציגים להצגה"
        searchPlaceholder="חיפוש נציג..."
        searchFields={["name", "phone", "direction", "lastCall"]}
        pageSize={100}
        stickyHeader
        fillParent
      />
      </div>
      {canAnalyze && <TelclickLogsAnalysis open={showAnalysis} onClose={() => setShowAnalysis(false)} />}

      <Dialog open={showHidden} onOpenChange={setShowHidden}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>נציגים מוסתרים ({hidden.size})</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-1">
            {hidden.size === 0 ? (
              <p className="text-sm text-muted-foreground">אין נציגים מוסתרים</p>
            ) : (
              [...hidden].sort((a, b) => a.localeCompare(b, "he")).map((name) => (
                <div key={name} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm font-medium">{name}</span>
                  <Button variant="ghost" size="sm" onClick={() => restoreRep(name)}>
                    <RotateCcw className="w-4 h-4" /> שחזר
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHidden(false)}>סגור</Button>
            {hidden.size > 0 && (
              <Button variant="outline" onClick={restoreAll}>
                <RotateCcw className="w-4 h-4" /> שחזר הכל
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}