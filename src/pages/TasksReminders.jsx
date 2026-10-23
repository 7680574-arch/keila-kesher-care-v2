import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ListChecks, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import TaskRow from "@/components/tasks/TaskRow";
import ReminderFormDialog from "@/components/tasks/ReminderFormDialog";
import CaseTaskEditDialog from "@/components/tasks/CaseTaskEditDialog";
import { nextDueDate } from "@/components/CaseTasks";

const today = () => new Date().toISOString().slice(0, 10);

const fromReminder = (r) => ({
  source: "reminder", id: r.id, title: r.title, kind: r.kind, status: r.status || "pending",
  due_date: r.due_date, due_time: r.due_time, priority: r.priority,
  assignee: r.assignee_name || r.assignee_email, assignee_email: r.assignee_email, raw: r,
});
const fromCaseTask = (t) => ({
  source: "case", id: t.id, title: t.title, kind: "task", status: t.status || "pending",
  due_date: t.due_date, due_time: t.due_time, priority: t.priority,
  assignee: t.assigned_to, case_id: t.case_id, recurrence: t.recurrence,
  caseLabel: [t.client_name, t.case_title].filter(Boolean).join(" · "), raw: t,
});

export default function TasksReminders() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [editingCaseTask, setEditingCaseTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const q = statusFilter === "all" ? {} : { status: statusFilter === "pending" ? { $ne: "done" } : "done" };
    const rq = { ...q };
    if (assigneeFilter !== "all") rq.assignee_email = assigneeFilter;
    if (typeFilter === "task" || typeFilter === "reminder") rq.kind = typeFilter;
    const wantCase = typeFilter === "all" || typeFilter === "case";
    const wantRem = typeFilter !== "case";
    const [rem, cas] = await Promise.all([
      wantRem ? base44.entities.Reminder.filter(rq, { sort: "due_date", limit: 200 }) : { items: [] },
      wantCase && assigneeFilter === "all"
        ? base44.entities.Task.filter(q, { sort: "due_date", limit: 200 })
        : { items: [] },
    ]);
    const all = [...rem.items.map(fromReminder), ...cas.items.map(fromCaseTask)];
    all.sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
    setItems(all);
    setLoading(false);
  }, [statusFilter, typeFilter, assigneeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    base44.functions.invoke("listAssignableUsers", {}).then((res) => setUsers(res?.data?.users || []));
  }, []);

  const save = async (data) => {
    setSaving(true);
    if (editingReminder) await base44.entities.Reminder.update(editingReminder.id, data);
    else await base44.entities.Reminder.create(data);
    setSaving(false);
    setOpen(false);
    toast({ title: editingReminder ? "נשמר בהצלחה" : "נוסף בהצלחה" });
    setEditingReminder(null);
    load();
  };

  const edit = (item) => {
    if (item.source === "reminder") {
      setEditingReminder(item.raw);
      setOpen(true);
    } else {
      setEditingCaseTask(item.raw);
    }
  };

  const saveCaseTask = async (data) => {
    setSaving(true);
    await base44.entities.Task.update(editingCaseTask.id, data);
    setSaving(false);
    setEditingCaseTask(null);
    toast({ title: "נשמר בהצלחה" });
    load();
  };

  const toggle = async (item) => {
    const status = item.status === "done" ? "pending" : "done";
    if (item.source === "reminder") {
      await base44.entities.Reminder.update(item.id, { status });
    } else {
      await base44.entities.Task.update(item.id, { status });
      const t = item.raw;
      if (status === "done" && t.recurrence && t.recurrence !== "none") {
        const next = nextDueDate(t.due_date, t.recurrence);
        if (next) {
          const { id, created_date, updated_date, created_by_id, ...rest } = t;
          await base44.entities.Task.create({ ...rest, status: "pending", due_date: next });
        }
      }
    }
    load();
  };

  const remove = async (item) => {
    if (!window.confirm("למחוק את הפריט?")) return;
    if (item.source === "reminder") await base44.entities.Reminder.delete(item.id);
    else await base44.entities.Task.delete(item.id);
    toast({ title: "נמחק" });
    load();
  };

  const stopRecurrence = async (item) => {
    if (!window.confirm("להפסיק את החזרה של המשימה? סימון המשימה כהושלמה לא ייצור עוד מופע חוזר.")) return;
    try {
      await base44.entities.Task.update(item.id, { recurrence: "none" });
      toast({ title: "החזרה בוטלה" });
      load();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    }
  };

  const t = today();
  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ListChecks className="w-6 h-6 text-primary" /> משימות ותזכורות</h1>
          <p className="text-sm text-muted-foreground mt-1">ריכוז משימות התיקים ותזכורות כלליות. האחראי מקבל מייל כל בוקר.</p>
        </div>
        <Button onClick={() => { setEditingReminder(null); setOpen(true); }}><Plus className="w-4 h-4 ml-1" /> חדש</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">פתוחות</SelectItem>
            <SelectItem value="done">הושלמו</SelectItem>
            <SelectItem value="all">הכל</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="case">משימות תיקים</SelectItem>
            <SelectItem value="task">משימות כלליות</SelectItem>
            <SelectItem value="reminder">תזכורות</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל האחראים</SelectItem>
            {users.map((u) => <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">אין פריטים להצגה</p>
        ) : (
          items.map((it) => (
            <TaskRow key={`${it.source}-${it.id}`} item={it} today={t} onToggle={toggle} onEdit={edit} onDelete={remove} onStopRecurrence={stopRecurrence} />
          ))
        )}
      </div>

      <ReminderFormDialog open={open} onOpenChange={setOpen} users={users} onSave={save} saving={saving} editing={editingReminder} />
      <CaseTaskEditDialog task={editingCaseTask} onClose={() => setEditingCaseTask(null)} onSave={saveCaseTask} saving={saving} />
    </div>
  );
}