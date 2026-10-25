import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const EMPTY = {
  title: "", type: "task", description: "", building_id: "", volunteer_id: "",
  committee_member_id: "", assignee_name: "", status: "pending", due_date: "", notes: "",
};

export default function CleaningTaskDialog({ open, onOpenChange, editing, onSave, buildings, volunteers, committee }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(editing ? { ...EMPTY, ...editing } : EMPTY); }, [editing, open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try { await onSave({ ...form }); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>{editing ? "עריכת משימה / הערה" : "הוספת משימה / הערה"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>כותרת *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>סוג</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">משימה</SelectItem>
                  <SelectItem value="note">הערה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>תיאור</Label>
            <Textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>בניין משויך</Label>
              <Select value={form.building_id || "none"} onValueChange={(v) => set("building_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="כללי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">כללי (ללא בניין)</SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>מתנדב משויך</Label>
              <Select value={form.volunteer_id || "none"} onValueChange={(v) => set("volunteer_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="כללי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">כללי (ללא מתנדב)</SelectItem>
                  {volunteers.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>נציג / חבר ועדה</Label>
              <Select value={form.committee_member_id || "none"} onValueChange={(v) => set("committee_member_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="כללי" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">כללי (ללא נציג)</SelectItem>
                  {committee.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>נציג (טקסט חופשי)</Label>
              <Input value={form.assignee_name || ""} onChange={(e) => set("assignee_name", e.target.value)} />
            </div>
          </div>
          {form.type === "task" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>סטטוס</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="done">הושלם</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>תאריך יעד</Label>
                <Input type="date" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>הערות</Label>
            <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={saving || !form.title?.trim()}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}