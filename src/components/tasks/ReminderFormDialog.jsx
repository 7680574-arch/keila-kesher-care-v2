import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({
  kind: "task", title: "", due_date: today(), due_time: "", priority: "medium",
  assignee_email: "", notes: "",
});

// editing: an existing Reminder record (or null for a new one)
export default function ReminderFormDialog({ open, onOpenChange, users, onSave, saving, editing }) {
  const [form, setForm] = useState(empty());
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      kind: editing.kind || "task", title: editing.title || "", due_date: editing.due_date || "",
      due_time: editing.due_time || "", priority: editing.priority || "medium",
      assignee_email: editing.assignee_email || "", notes: editing.notes || "",
    } : empty());
  }, [open, editing]);

  const submit = () => {
    if (!form.title.trim()) return;
    const u = users.find((x) => x.email === form.assignee_email);
    onSave({ ...form, title: form.title.trim(), assignee_name: u?.name || "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{editing ? "עריכת משימה / תזכורת" : "משימה / תזכורת חדשה"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סוג</Label>
              <Select value={form.kind} onValueChange={(v) => update("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">משימה</SelectItem>
                  <SelectItem value="reminder">תזכורת</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>עדיפות</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">נמוכה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="urgent">דחופה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>כותרת *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך</Label>
              <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>שעה</Label>
              <Input type="time" value={form.due_time} onChange={(e) => update("due_time", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>אחראי מטפל (יקבל מייל תזכורת בבוקר)</Label>
            <Select value={form.assignee_email} onValueChange={(v) => update("assignee_email", v)}>
              <SelectTrigger><SelectValue placeholder="בחר משתמש" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.email} value={u.email}>{u.name}</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={saving || !form.title.trim()}>
            {saving ? "שומר..." : editing ? "שמירה" : "הוספה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}