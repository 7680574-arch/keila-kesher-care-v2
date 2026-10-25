import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Plus, Check, Trash2, Clock, Calendar, Repeat, UserPlus } from "lucide-react";
import { PriorityBadge } from "@/components/badges";

const priorityLabels = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחופה" };
const recurrenceLabels = { none: "ללא", daily: "יומית", weekly: "שבועית", monthly: "חודשית" };
export function nextDueDate(dateStr, recurrence) {
  if (!dateStr || recurrence === "none") return null;
  const d = new Date(dateStr + "T00:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
const recurrenceStyles = {
  none: "bg-muted text-muted-foreground",
  daily: "bg-emerald-100 text-emerald-700",
  weekly: "bg-indigo-100 text-indigo-700",
  monthly: "bg-amber-100 text-amber-700",
};

export default function CaseTasks({ caseItem, tasks, onAdd, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: "", role: "", phone: "" });
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "", due_date: today, due_time: "09:00", priority: "medium", assigned_to: "", recurrence: "none", notes: "",
  });
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const loadWorkers = async () => {
    try {
      const w = await base44.entities.Worker.list();
      setWorkers(w);
    } catch {
      setWorkers([]);
    }
  };
  useEffect(() => { loadWorkers(); }, []);

  const submit = () => {
    if (!form.title.trim()) return;
    onAdd(form);
    setForm({ title: "", due_date: today, due_time: "09:00", priority: "medium", assigned_to: "", recurrence: "none", notes: "" });
    setOpen(false);
  };

  const createWorker = async () => {
    if (!newWorker.name.trim()) return;
    setSavingWorker(true);
    try {
      const w = await base44.entities.Worker.create({
        name: newWorker.name.trim(),
        role: newWorker.role,
        phone: newWorker.phone,
      });
      setWorkers((prev) => [...prev, w]);
      setForm((p) => ({ ...p, assigned_to: w.name }));
      setNewWorker({ name: "", role: "", phone: "" });
      setAddWorkerOpen(false);
    } finally {
      setSavingWorker(false);
    }
  };

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> משימות ({tasks.length})
        </h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 ml-1" /> משימה חדשה
        </Button>
      </div>

      <div className="divide-y divide-border">
        {tasks.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">אין משימות בתיק זה</p>
        )}

        {pending.map((t) => {
          const overdue = t.due_date && t.due_date < today;
          return (
            <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 group hover:bg-secondary/40 transition">
              <button
                onClick={() => onToggle(t)}
                title="סמן כהושלם"
                aria-label="סמן כהושלם"
                className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 hover:border-primary hover:bg-primary/5 flex items-center justify-center transition shrink-0"
              >
                <Check className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-40 transition" strokeWidth={3} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t.title}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {t.recurrence && t.recurrence !== "none" && (
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${recurrenceStyles[t.recurrence]}`}>
                      <Repeat className="w-3 h-3" /> {recurrenceLabels[t.recurrence]}
                    </span>
                  )}
                  <PriorityBadge priority={t.priority} />
                  <span className={`text-xs flex items-center gap-1 ${overdue ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
                    <Clock className="w-3 h-3" /> {t.due_date} {t.due_time ? `· ${t.due_time}` : ""}
                    {overdue && " · אחר"}
                  </span>
                  {t.assigned_to && <span className="text-xs text-muted-foreground">· {t.assigned_to}</span>}
                </div>
              </div>
              <button onClick={() => onDelete(t)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {done.length > 0 && (
          <div className="px-5 py-2 bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground py-1.5">הושלמו ({done.length})</p>
          </div>
        )}
        {done.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-5 py-2.5 group bg-muted/30">
            <button
              onClick={() => onToggle(t)}
              title="בוצע — לחץ לביטול"
              className="mt-0.5 w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center shrink-0"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
            <p className="text-sm text-muted-foreground line-through flex-1">{t.title}</p>
            <button onClick={() => onDelete(t)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>משימה חדשה לתיק</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>כותרת משימה *</Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך יעד</Label>
                <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>שעה</Label>
                <Input type="time" value={form.due_time} onChange={(e) => update("due_time", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>עדיפות</Label>
                <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>אחראי (מטפל)</Label>
                <div className="flex gap-2">
                  <Select value={form.assigned_to} onValueChange={(v) => update("assigned_to", v)}>
                    <SelectTrigger><SelectValue placeholder="בחר מטפל" /></SelectTrigger>
                    <SelectContent>
                      {workers.length === 0 && (
                        <SelectItem value="__none__" disabled>אין מטפלים עדיין</SelectItem>
                      )}
                      {workers.map((w) => (
                        <SelectItem key={w.id} value={w.name}>{w.name}{w.role ? ` · ${w.role}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddWorkerOpen(true)}
                    title="הוסף מטפל חדש לרשימה"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>חזרתיות</Label>
              <Select value={form.recurrence} onValueChange={(v) => update("recurrence", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(recurrenceLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" onClick={submit}>הוספה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add worker dialog — ישות משותפת, מופיע אוטומטית בכל התיקים לאחר ההוספה */}
      <Dialog open={addWorkerOpen} onOpenChange={setAddWorkerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספת מטפל לרשימה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>שם המטפל *</Label>
              <Input value={newWorker.name} onChange={(e) => setNewWorker((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>תפקיד</Label>
              <Input value={newWorker.role} onChange={(e) => setNewWorker((p) => ({ ...p, role: e.target.value }))} placeholder="לדוגמה: עובד סוציאלי" />
            </div>
            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input value={newWorker.phone} onChange={(e) => setNewWorker((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" disabled={savingWorker || !newWorker.name.trim()} onClick={createWorker}>
              {savingWorker ? "שומר..." : "הוספה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}