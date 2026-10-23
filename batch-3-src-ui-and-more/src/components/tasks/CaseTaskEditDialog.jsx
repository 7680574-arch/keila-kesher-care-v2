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

const priorityLabels = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחופה" };

// task: an existing Task (case task) record
export default function CaseTaskEditDialog({ task, onClose, onSave, saving }) {
  const [form, setForm] = useState({});
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title || "", due_date: task.due_date || "", due_time: task.due_time || "",
      priority: task.priority || "medium", assigned_to: task.assigned_to || "", notes: task.notes || "",
    });
  }, [task]);

  return (
    <Dialog open={!!task} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>עריכת משימת תיק</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>כותרת *</Label>
            <Input value={form.title || ""} onChange={(e) => update("title", e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך יעד</Label>
              <Input type="date" value={form.due_date || ""} onChange={(e) => update("due_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>שעה</Label>
              <Input type="time" value={form.due_time || ""} onChange={(e) => update("due_time", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>עדיפות</Label>
              <Select value={form.priority || "medium"} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>אחראי (מטפל)</Label>
              <Input value={form.assigned_to || ""} onChange={(e) => update("assigned_to", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={() => onSave({ ...form, title: (form.title || "").trim() })} disabled={saving || !(form.title || "").trim()}>
            {saving ? "שומר..." : "שמירה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}