import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
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
import { holidayLabels, typeLabels, statusLabels, recurrenceLabels } from "@/components/distributionBadges";

const today = () => new Date().toISOString().slice(0, 10);
const empty = { title: "", holiday: "other", type: "products", date: today(), total_budget: "", planned_recipients: "", status: "planning", recurrence: "none", notes: "" };

export default function DistributionFormDialog({ open, onOpenChange, onSaved, initial, groups = [], defaultGroupId = null }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editing = !!initial?.id;

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title || "",
        holiday: initial.holiday || "other",
        type: initial.type || "products",
        date: initial.date || "",
        total_budget: initial.total_budget ?? "",
        planned_recipients: initial.planned_recipients ?? "",
        status: initial.status || "planning",
        recurrence: initial.recurrence || "none",
        notes: initial.notes || "",
        group_id: initial.group_id || "",
      });
    } else {
      setForm({ ...empty, group_id: defaultGroupId || "" });
    }
  }, [open, initial, defaultGroupId]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        holiday: form.holiday,
        type: form.type,
        date: form.date || "",
        total_budget: form.total_budget ? Number(form.total_budget) : 0,
        planned_recipients: form.planned_recipients ? Number(form.planned_recipients) : 0,
        status: form.status,
        recurrence: form.recurrence,
        notes: form.notes,
        group_id: form.group_id || "",
      };
      if (editing) {
        await base44.entities.Distribution.update(initial.id, payload);
      } else {
        await base44.entities.Distribution.create(payload);
      }
      onOpenChange(false);
      onSaved?.();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "עריכת חלוקה" : "הוספת חלוקה חדשה"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם החלוקה *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="לדוגמה: חלוקת מטרנה אלול" autoFocus={!editing} />
          </div>
          {groups.length > 0 && (
            <div className="space-y-1.5">
              <Label>לאיזו קבוצה לשייך את החלוקה?</Label>
              <Select value={form.group_id || "none"} onValueChange={(v) => update("group_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קבוצה</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>חג</Label>
              <Select value={form.holiday} onValueChange={(v) => update("holiday", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(holidayLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סוג חלוקה</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך חלוקה</Label>
              <Input type="date" value={form.date || ""} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>תקציב כולל (₪)</Label>
              <Input type="number" min="0" value={form.total_budget} onChange={(e) => update("total_budget", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>מספר מקבלים מתוכנן</Label>
            <Input type="number" min="0" value={form.planned_recipients} onChange={(e) => update("planned_recipients", e.target.value)} placeholder="לדף רישום ריק" />
            <p className="text-xs text-muted-foreground">להדפסת דף רישום ריק עם שורות ממוספרות לפי מספר זה.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>מחזוריות</Label>
              <Select value={form.recurrence} onValueChange={(v) => update("recurrence", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(recurrenceLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label>סטטוס</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          <Button type="button" disabled={saving || !form.title.trim()} onClick={submit}>{saving ? "שומר…" : editing ? "שמור שינויים" : "צור חלוקה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}