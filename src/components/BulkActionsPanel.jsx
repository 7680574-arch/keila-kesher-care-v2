import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { Wand2, Sparkles, Loader2, AlertTriangle, CheckCircle2, ListFilter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const parseDone = (r) => { try { return JSON.parse(r?.tasks_done || "[]"); } catch { return []; } };

const COND_TYPES = [
  { value: "all", label: "כל המקבלים" },
  { value: "task_done", label: "מי שביצעו משימה/ות" },
  { value: "task_not_done", label: "מי שטרם ביצעו משימה/ות" },
  { value: "status_delivered", label: "מי שכבר נמסרו" },
  { value: "status_pending", label: "מי שממתינים" },
];

const CHANGE_TYPES = [
  { value: "mark_delivered", label: "סמן כנמסר" },
  { value: "mark_pending", label: "בטל סימון נמסר" },
  { value: "set_amount", label: "קבע סכום/כמות" },
  { value: "complete_task", label: "סמן משימה כבוצעה" },
  { value: "uncomplete_task", label: "בטל סימון משימה" },
];

const COND_NEEDS_TASK = ["task_done", "task_not_done"];
const CHANGE_NEEDS_TASK = ["complete_task", "uncomplete_task"];

function buildCond(type, taskList) {
  if (type === "all") return { type: "all" };
  if (type === "status_delivered") return { type: "status_delivered" };
  if (type === "status_pending") return { type: "status_pending" };
  if (COND_NEEDS_TASK.includes(type)) return { type, tasks: taskList || [] };
  return null;
}
function buildChange(type, task, amount) {
  if (type === "mark_delivered") return { type: "mark_delivered" };
  if (type === "mark_pending") return { type: "mark_pending" };
  if (type === "set_amount") return { type: "set_amount", amount: Number(amount) || 0 };
  if (CHANGE_NEEDS_TASK.includes(type)) return { type, task };
  return null;
}

function condLabel(cond) {
  if (!cond) return "";
  if (cond.type === "all") return "כל המקבלים";
  if (cond.type === "status_delivered") return "מי שכבר נמסרו";
  if (cond.type === "status_pending") return "מי שממתינים";
  const list = Array.isArray(cond.tasks) && cond.tasks.length ? cond.tasks : (cond.task ? [cond.task] : []);
  const names = list.join(", ");
  if (cond.type === "task_done") return `מי שביצעו: ${names}`;
  if (cond.type === "task_not_done") return `מי שטרם ביצעו: ${names}`;
  return "";
}
function changeLabel(change) {
  if (!change) return "";
  if (change.type === "mark_delivered") return "סמן כנמסר";
  if (change.type === "mark_pending") return "בטל סימון נמסר";
  if (change.type === "set_amount") return `קבע סכום/כמות: ₪${Number(change.amount || 0).toLocaleString("he-IL")}`;
  if (change.type === "complete_task") return `סמן משימה כבוצעה: ${change.task}`;
  if (change.type === "uncomplete_task") return `בטל סימון משימה: ${change.task}`;
  return "";
}

function matchCondition(r, cond) {
  if (!cond) return false;
  if (cond.type === "all") return true;
  const done = parseDone(r);
  if (cond.type === "task_done" || cond.type === "task_not_done") {
    const list = Array.isArray(cond.tasks) && cond.tasks.length ? cond.tasks : (cond.task ? [cond.task] : []);
    if (list.length === 0) return false;
    return cond.type === "task_done" ? list.every((t) => done.includes(t)) : list.every((t) => !done.includes(t));
  }
  if (cond.type === "status_delivered") return r.status === "delivered";
  if (cond.type === "status_pending") return r.status !== "delivered";
  return false;
}
function applyChange(r, change) {
  const patch = {};
  if (change.type === "mark_delivered") patch.status = "delivered";
  else if (change.type === "mark_pending") patch.status = "pending";
  else if (change.type === "set_amount") patch.amount = Number(change.amount) || 0;
  else if (change.type === "complete_task") {
    const done = parseDone(r);
    if (!done.includes(change.task)) done.push(change.task);
    patch.tasks_done = JSON.stringify(done);
  } else if (change.type === "uncomplete_task") {
    const done = parseDone(r).filter((x) => x !== change.task);
    patch.tasks_done = JSON.stringify(done);
  }
  return patch;
}

function validCond(cond, tasks) {
  if (!cond || !cond.type) return false;
  if (COND_NEEDS_TASK.includes(cond.type)) {
    const list = Array.isArray(cond.tasks) && cond.tasks.length ? cond.tasks : (cond.task ? [cond.task] : []);
    return list.length > 0 && list.every((t) => tasks.includes(t));
  }
  return true;
}
function validChange(change, tasks) {
  if (!change || !change.type) return false;
  if (CHANGE_NEEDS_TASK.includes(change.type)) return !!change.task && tasks.includes(change.task);
  if (change.type === "set_amount") return Number.isFinite(Number(change.amount));
  return true;
}

export default function BulkActionsPanel({ open, onOpenChange, recipients, tasks, onApplied }) {
  const { toast } = useToast();
  const [mode, setMode] = useState("quick");
  const [condType, setCondType] = useState("all");
  const [condTasks, setCondTasks] = useState([]);
  const [changeType, setChangeType] = useState("mark_delivered");
  const [changeTask, setChangeTask] = useState("");
  const [changeAmount, setChangeAmount] = useState("");
  const [instruction, setInstruction] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [cond, setCond] = useState(null);
  const [change, setChange] = useState(null);
  const [actionSource, setActionSource] = useState("");
  const [applying, setApplying] = useState(false);
  const [appliedResult, setAppliedResult] = useState(null);

  const reset = () => {
    setCond(null);
    setChange(null);
    setActionSource("");
    setParseError("");
    setInstruction("");
    setAppliedResult(null);
  };

  const switchMode = (m) => {
    setMode(m);
    reset();
  };

  // Quick mode builds cond/change reactively from dropdowns
  const quickCond = useMemo(() => {
    if (mode !== "quick") return null;
    if (COND_NEEDS_TASK.includes(condType) && condTasks.length === 0) return null;
    return buildCond(condType, condTasks);
  }, [mode, condType, condTasks]);
  const quickChange = useMemo(() => {
    if (mode !== "quick") return null;
    if (CHANGE_NEEDS_TASK.includes(changeType) && !changeTask) return null;
    return buildChange(changeType, changeTask, changeAmount);
  }, [mode, changeType, changeTask, changeAmount]);

  const activeCond = mode === "quick" ? quickCond : cond;
  const activeChange = mode === "quick" ? quickChange : change;

  const affected = useMemo(() => {
    if (!activeCond) return [];
    return recipients.filter((r) => matchCondition(r, activeCond));
  }, [recipients, activeCond]);

  const canApply = mode === "quick"
    ? !!activeCond && !!activeChange && affected.length > 0 && validCond(activeCond, tasks) && validChange(activeChange, tasks)
    : !!activeCond && !!activeChange && affected.length > 0;

  const parseInstruction = async () => {
    const txt = instruction.trim();
    if (!txt) return;
    setParsing(true);
    setParseError("");
    setCond(null);
    setChange(null);
    setAppliedResult(null);
    try {
      const res = await base44.functions.invoke("parseBulkInstruction", { instruction: txt, tasks });
      const data = res?.data || res;
      if (data?.error) {
        setParseError(data.error);
        return;
      }
      if (!validCond(data?.condition, tasks) || !validChange(data?.change, tasks)) {
        setParseError("הפענוח החזיר פעולה לא תקינה — ודאו שהמשימות קיימות בחלוקה ונסו שוב.");
        return;
      }
      setCond(data.condition);
      setChange(data.change);
      setActionSource("free");
    } catch (e) {
      setParseError(e?.message || "שגיאה בפענוח ההוראה");
    } finally {
      setParsing(false);
    }
  };

  const doApply = async () => {
    if (!canApply) return;
    if (!confirm(`לאשר ביצוע?\n${changeLabel(activeChange)} על ${affected.length} מקבלים (${condLabel(activeCond)}).`)) return;
    setApplying(true);
    try {
      const updates = affected.map((r) => ({ id: r.id, ...applyChange(r, activeChange) }));
      await base44.entities.DistributionRecipient.bulkUpdate(updates);
      setAppliedResult({ count: updates.length });
      toast({ title: "הפעולה בוצעה", description: `${updates.length} מקבלים עודכנו.` });
      if (typeof onApplied === "function") onApplied();
    } catch (e) {
      toast({ title: "שגיאה בביצוע", description: e?.message || "העדכון נכשל", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-primary" /> פעולות מרובות-מקבלים</SheetTitle>
          <SheetDescription>הגדר תנאי ופעולה (או כתוב הוראה בשפה חופשית) — לפני הביצוע תוצג תצוגה מקדימה מלאה לאישור.</SheetDescription>
        </SheetHeader>

        <div className="px-4 py-3 border-b border-border">
          <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
            <button onClick={() => switchMode("quick")} className={`px-3 py-1.5 flex items-center gap-1.5 ${mode === "quick" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
              <ListFilter className="w-3.5 h-3.5" /> פעולה מהירה
            </button>
            <button onClick={() => switchMode("free")} className={`px-3 py-1.5 flex items-center gap-1.5 ${mode === "free" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}>
              <Sparkles className="w-3.5 h-3.5" /> הוראה חופשית (AI)
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin space-y-4">
          {mode === "quick" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">תנאי — על מי להחיל</Label>
                <Select value={condType} onValueChange={setCondType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COND_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {COND_NEEDS_TASK.includes(condType) && (
                  <div className="rounded-lg border border-border p-2 space-y-0.5 max-h-44 overflow-y-auto scrollbar-thin">
                    {tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-1">אין משימות מוגדרות בחלוקה</p>
                    ) : tasks.map((t) => {
                      const checked = condTasks.includes(t);
                      return (
                        <label key={t} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-secondary/40 rounded">
                          <Checkbox checked={checked} onCheckedChange={() => setCondTasks((prev) => checked ? prev.filter((x) => x !== t) : [...prev, t])} />
                          <span className="text-sm">{t}</span>
                        </label>
                      );
                    })}
                    <p className="text-xs text-muted-foreground px-1 pt-1">ניתן לבחור מספר משימות (ישולבו כולן — AND).</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">פעולה — מה לעשות</Label>
                <Select value={changeType} onValueChange={setChangeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANGE_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {CHANGE_NEEDS_TASK.includes(changeType) && (
                  <Select value={changeTask} onValueChange={setChangeTask}>
                    <SelectTrigger><SelectValue placeholder="בחר משימה" /></SelectTrigger>
                    <SelectContent>
                      {tasks.length === 0 ? <SelectItem value="__none__" disabled>אין משימות מוגדרות</SelectItem>
                        : tasks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {changeType === "set_amount" && (
                  <Input type="number" min="0" step="0.01" value={changeAmount} onChange={(e) => setChangeAmount(e.target.value)} placeholder="סכום/כמות" />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs">כתוב הוראה בעברית</Label>
              <Textarea
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='לדוגמה: "סמן כנמסר את כל מי שביצע את המשימה נמסרה החבילה"'
              />
              <Button type="button" size="sm" onClick={parseInstruction} disabled={parsing || !instruction.trim()}>
                {parsing ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מפענח…</> : <><Sparkles className="w-4 h-4 ml-1" /> פענח הוראה</>}
              </Button>
              {parseError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
              {actionSource === "free" && cond && change && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                  <p className="font-medium">הפענוח הצליח — בדוק את התצוגה המקדימה למטה ואשר.</p>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {activeCond && activeChange && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">תנאי: </span><span className="font-medium">{condLabel(activeCond)}</span></div>
                <div><span className="text-muted-foreground">פעולה: </span><span className="font-medium">{changeLabel(activeChange)}</span></div>
                <div><span className="text-muted-foreground">מספר מקבלים שיושפעו: </span><span className="font-bold text-primary">{affected.length}</span></div>
              </div>

              {affected.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4" /> אין מקבלים העונים לתנאי — לא ניתן לבצע.
                </div>
              ) : (
                <div className="rounded-xl border border-border max-h-64 overflow-y-auto scrollbar-thin">
                  <div className="px-3 py-2 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground sticky top-0">תצוגה מקדימה — {affected.length} מקבלים</div>
                  <ul className="divide-y divide-border">
                    {affected.map((r) => (
                      <li key={r.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{r.status === "delivered" ? "נמסר" : "ממתין"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {appliedResult && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4" /> בוצע בהצלחה — {appliedResult.count} מקבלים עודכנו.
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2 w-full">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>סגור</Button>
            <Button type="button" onClick={doApply} disabled={!canApply || applying || !!appliedResult}>
              {applying ? <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מבצע…</> : `אשר ובצע${affected.length ? ` (${affected.length})` : ""}`}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}