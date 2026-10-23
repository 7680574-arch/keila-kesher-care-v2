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
import { KIND_LABELS, STATUS_LABELS } from "@/lib/projectLabels";
import AssigneePicker from "@/components/projects/AssigneePicker";

const empty = {
  title: "", kind: "event", description: "", start_date: "", end_date: "", location: "",
  status: "planning", manager_email: "", manager_name: "", income_goal: "", budget: "", notes: "",
};

export default function ProjectFormDialog({ open, onOpenChange, project, users, onSave, saving }) {
  const [form, setForm] = useState(empty);
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm(project ? { ...empty, ...Object.fromEntries(Object.entries(project).filter(([, v]) => v != null)) } : empty);
  }, [open, project]);

  const submit = () => {
    onSave({
      title: form.title.trim(), kind: form.kind, description: form.description,
      start_date: form.start_date || undefined, end_date: form.end_date || undefined,
      location: form.location, status: form.status,
      manager_email: form.manager_email, manager_name: form.manager_name || "",
      income_goal: form.income_goal === "" ? undefined : Number(form.income_goal),
      budget: form.budget === "" ? undefined : Number(form.budget),
      notes: form.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{project ? "עריכת פרויקט" : "פרויקט חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם הפרויקט *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="לדוגמה: טיול תורמים" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סוג</Label>
              <Select value={form.kind} onValueChange={(v) => update("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך התחלה</Label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך סיום</Label>
              <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>מיקום</Label>
            <Input value={form.location} onChange={(e) => update("location", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>יעד הכנסות (₪)</Label>
              <Input type="number" value={form.income_goal} onChange={(e) => update("income_goal", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תקציב הוצאות (₪)</Label>
              <Input type="number" value={form.budget} onChange={(e) => update("budget", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>אחראי ראשי</Label>
            <AssigneePicker
              users={users}
              value={{ email: form.manager_email, name: form.manager_name }}
              onChange={(a) => setForm((p) => ({ ...p, manager_email: a.email, manager_name: a.name }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={saving || !form.title.trim()}>{saving ? "שומר..." : "שמירה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}