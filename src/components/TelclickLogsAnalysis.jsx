import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2, Send } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUS_KEYS = ["busy", "ringing", "available_answered", "available_missed", "available", "unavailable", "empty", "other"];
const LABELS = { busy: "בשיחה", ringing: "מצלצל אצלה", available_answered: "זמינה · נענתה", available_missed: "זמינה · לא נענתה", available: "זמין", unavailable: "לא זמין", empty: "—", other: "אחר" };
const COLORS = { busy: "#16a34a", ringing: "#ea580c", available_answered: "#2563eb", available_missed: "#dc2626", available: "#6a7389", unavailable: "#52525b", empty: "#d4d4d8", other: "#a855f7" };

const fmtDuration = (s) => {
  s = Math.round(s || 0);
  if (s < 60) return `${s} שנ'`;
  const m = Math.floor(s / 60); const r = s % 60;
  if (m < 60) return r ? `${m} דק' ${r} שנ'` : `${m} דק'`;
  const h = Math.floor(m / 60); const rm = m % 60;
  return rm ? `${h} שע' ${rm} דק'` : `${h} שע'`;
};

export default function TelclickLogsAnalysis({ open, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedRep, setSelectedRep] = useState(null);
  const [sending, setSending] = useState(false);

  const sendExample = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendTelclickDailyDigest", {});
      const d = res?.data || res || {};
      if (d.error) throw new Error(d.error);
      alert(d.sent ? `נשלח סיכום דוגמה ל-${(d.recipients || []).join(", ")}` : "לא נשלח מייל");
    } catch (e) {
      alert("שגיאה בשליחה: " + e.message);
    } finally { setSending(false); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const query = {};
      if (from) query.fetched_at = { ...query.fetched_at, $gte: new Date(from).toISOString() };
      if (to) query.fetched_at = { ...query.fetched_at, $lte: new Date(to + "T23:59:59").toISOString() };
      const rows = await base44.entities.TelclickLog.filter(query, "-fetched_at", 5000);
      setLogs(rows);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const parsed = useMemo(() => logs.map((l) => {
    let reps = []; try { reps = JSON.parse(l.reps); } catch { }
    return { ...l, reps };
  }), [logs]);

  const span = parsed.length;
  const first = span ? new Date(parsed[span - 1].fetched_at) : null;
  const last = span ? new Date(parsed[0].fetched_at) : null;
  const totalSec = first && last ? (last - first) / 1000 : 0;
  const avgInterval = span > 1 ? totalSec / (span - 1) : 0;

  const chrono = useMemo(() => [...parsed].sort((a, b) => new Date(a.fetched_at) - new Date(b.fetched_at)), [parsed]);
  const timeline = chrono.map((l) => {
    const counts = { time: new Date(l.fetched_at).toLocaleTimeString("he-IL") };
    STATUS_KEYS.forEach((k) => { counts[k] = l.reps.filter((r) => r.status === k).length; });
    return counts;
  });

  const repMap = useMemo(() => {
    const m = new Map();
    chrono.forEach((l) => {
      l.reps.forEach((r) => {
        if (!m.has(r.name)) m.set(r.name, { name: r.name, total: 0, statuses: {} });
        const e = m.get(r.name);
        e.total++;
        e.statuses[r.status] = (e.statuses[r.status] || 0) + 1;
      });
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [chrono]);

  const repRecords = useMemo(() => {
    if (!selectedRep) return [];
    const recs = [];
    chrono.forEach((l) => {
      const r = l.reps.find((x) => x.name === selectedRep);
      if (r) recs.push({ time: l.fetched_at, status: r.status, rep: r });
    });
    return recs;
  }, [chrono, selectedRep]);

  const repStatusCounts = useMemo(() => {
    if (!selectedRep) return [];
    const m = new Map();
    repRecords.forEach((rec) => { m.set(rec.status, (m.get(rec.status) || 0) + 1); });
    return STATUS_KEYS.map((k) => ({ key: k, label: LABELS[k], color: COLORS[k], count: m.get(k) || 0 })).filter((x) => x.count > 0);
  }, [repRecords]);

  const clearAll = async () => {
    if (!confirm("למחוק את כל הלוגים השמורים?")) return;
    setLoading(true);
    try {
      await base44.entities.TelclickLog.deleteMany({});
      setLogs([]);
    } catch { } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ניתוח לוגים</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">מתאריך</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">עד תאריך</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "טען"}</Button>
          <Button size="sm" onClick={sendExample} disabled={sending}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} שלח דוגמה למייל</Button>
          <Button size="sm" variant="outline" onClick={clearAll} disabled={loading || !logs.length}><Trash2 className="w-4 h-4" /> נקה לוגים</Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">אין לוגים. הפעל "שמור לוגים" במסך המעקב, המתן מעט, ואז טען מחדש.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">סה"כ ריענונים</p><p className="text-xl font-bold">{logs.length}</p></div>
              <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">טווח זמן</p><p className="text-xl font-bold">{fmtDuration(totalSec)}</p></div>
              <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">ממוצע בין ריענונים</p><p className="text-xl font-bold">{fmtDuration(avgInterval)}</p></div>
              <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">מ-עד</p><p className="text-sm font-bold mt-1">{first?.toLocaleString("he-IL")} – {last?.toLocaleString("he-IL")}</p></div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">התפלגות סטטוסים לאורך זמן</p>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <AreaChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {STATUS_KEYS.map((k) => (
                      <Area key={k} type="monotone" dataKey={k} name={LABELS[k]} stackId="1" stroke={COLORS[k]} fill={COLORS[k]} fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">פילוח לפי נציג ({repMap.length})</p>
              <div className="overflow-x-auto rounded-lg border max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-right px-3 py-2 font-medium">נציג</th>
                      <th className="text-right px-3 py-2 font-medium">ריענונים</th>
                      <th className="text-right px-3 py-2 font-medium">זמן מוערך</th>
                      {STATUS_KEYS.map((k) => (<th key={k} className="text-right px-3 py-2 font-medium whitespace-nowrap" style={{ color: COLORS[k] }}>{LABELS[k]}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {repMap.map((r) => (
                      <tr key={r.name} className={`border-t cursor-pointer hover:bg-accent/40 ${selectedRep === r.name ? "bg-accent/60" : ""}`} onClick={() => setSelectedRep(r.name)}>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2">{r.total}</td>
                        <td className="px-3 py-2">{fmtDuration(r.total * avgInterval)}</td>
                        {STATUS_KEYS.map((k) => {
                          const c = r.statuses[k] || 0;
                          return <td key={k} className="px-3 py-2">{c || ""}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRep && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">תיעוד לוגים · {selectedRep}</p>
                    <p className="text-xs text-muted-foreground">{repRecords.length} רשומות · {repStatusCounts.map((s) => `${s.label}: ${s.count}`).join(" · ")}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedRep(null)}>סגור</Button>
                </div>
                <div className="overflow-x-auto rounded-lg border max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-right px-3 py-2 font-medium">#</th>
                        <th className="text-right px-3 py-2 font-medium">תאריך ושעה</th>
                        <th className="text-right px-3 py-2 font-medium">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repRecords.map((rec, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-muted-foreground">{repRecords.length - i}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{new Date(rec.time).toLocaleString("he-IL")}</td>
                          <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1.5 font-medium" style={{ color: COLORS[rec.status] || COLORS.other }}>● {LABELS[rec.status] || rec.status || "—"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}