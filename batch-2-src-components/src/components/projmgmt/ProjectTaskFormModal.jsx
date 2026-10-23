import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TASK_STATUS_OPTIONS, TASK_STATUS_LABELS } from "@/lib/projMgmtLabels";
import AssigneePicker from "@/components/projects/AssigneePicker";

export default function ProjectTaskFormModal({ task = null, goalId, goals = [], users = [], onClose, onSave }) {
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "pending",
    deadline: task?.deadline || "",
    estimated_hours: task?.estimated_hours || "",
    assignee_name: task?.assignee_name || "",
    assignee_id: task?.assignee_id || "",
    assignee_email: task?.assignee_email || "",
    summary: task?.summary || "",
    cost: task?.cost ?? "",
    paid_amount: task?.paid_amount ?? "",
    goal_id: task?.goal_id || goalId || (goals[0]?.id || ""),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goalId && !form.goal_id) setForm((f) => ({ ...f, goal_id: goalId }));
  }, [goalId]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        status: form.status,
        deadline: form.deadline || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
        assignee_name: form.assignee_name || undefined,
        assignee_id: form.assignee_id || undefined,
        assignee_email: form.assignee_email || undefined,
        summary: form.summary || undefined,
        cost: form.cost === "" ? undefined : Number(form.cost),
        paid_amount: form.paid_amount === "" ? undefined : Number(form.paid_amount),
        goal_id: form.goal_id,
        created_by_ai: false,
      };
      if (goals.length > 0) {
        const g = goals.find((g) => g.id === form.goal_id);
        if (g) payload.goal_title = g.title;
      }
      if (isEdit) {
        await base44.entities.ProjectTask.update(task.id, payload);
      } else {
        await base44.entities.ProjectTask.create(payload);
      }
      onSave && onSave();
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת משימה" : "משימה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>כותרת *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder="כותרת המשימה" />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="תיאור אופציונלי" />
          </div>
          <div className="space-y-1.5">
            <Label>סיכום</Label>
            <Textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="סיכום אופציונלי" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>תאריך יעד</Label>
              <Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>אחראי</Label>
              <AssigneePicker
                users={users}
                value={{ email: form.assignee_email, name: form.assignee_name }}
                onChange={(a) => setForm((f) => ({ ...f, assignee_email: a.email, assignee_name: a.name, assignee_id: users.find((u) => u.email === a.email)?.id || "" }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>שעות מוערכות</Label>
              <Input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => set("estimated_hours", e.target.value)} placeholder="לדוגמה 3" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>עלות (₪)</Label>
              <Input type="number" min="0" step="any" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="עלות המשימה" />
            </div>
            <div className="space-y-1.5">
              <Label>שולם (₪)</Label>
              <Input type="number" min="0" step="any" value={form.paid_amount} onChange={(e) => set("paid_amount", e.target.value)} placeholder="סכום ששולם" />
            </div>
          </div>
          {goals.length > 0 && (
            <div className="space-y-1.5">
              <Label>פרויקט</Label>
              <Select value={form.goal_id} onValueChange={(v) => set("goal_id", v)}>
                <SelectTrigger><SelectValue placeholder="— בחר פרויקט —" /></SelectTrigger>
                <SelectContent>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={saving}>{saving ? "שומר…" : isEdit ? "שמור שינויים" : "הוסף משימה"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}