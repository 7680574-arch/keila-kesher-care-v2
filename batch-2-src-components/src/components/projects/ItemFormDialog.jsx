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
import { PARTICIPANT_STATUS } from "@/lib/projectLabels";
import AssigneePicker from "@/components/projects/AssigneePicker";

const TITLES = {
  task: ["משימה חדשה", "עריכת משימה", "כותרת המשימה *"],
  income: ["הכנסה חדשה", "עריכת הכנסה", "מקור ההכנסה *"],
  expense: ["הוצאה חדשה", "עריכת הוצאה", "תיאור ההוצאה *"],
  participant: ["מוזמן חדש", "עריכת מוזמן", "שם המוזמן *"],
  agenda: ["נושא חדש בסדר היום", "עריכת נושא", "נושא *"],
};

// type: task | income | expense | participant; item: existing record or null
export default function ItemFormDialog({ open, onOpenChange, type, item, defaultTime, users, onSave, saving }) {
  const [f, setF] = useState({});
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const base = { title: "", amount: "", paid_amount: "", date: "", assignee_email: "", assignee_name: "", phone: "", email: "", guests_count: "", category: "", notes: "", time: defaultTime || "", duration_minutes: "",
      status: type === "participant" ? "invited" : "pending" };
    setF(item ? { ...base, ...Object.fromEntries(Object.entries(item).filter(([, v]) => v != null)) } : base);
  }, [open, item, type, defaultTime]);

  const [newT, editT, labelT] = TITLES[type] || TITLES.task;
  const money = type === "income" || type === "expense";

  const submit = () => {
    const data = { type, title: f.title.trim(), notes: f.notes, category: f.category };
    if (f.date) data.date = f.date;
    if (money) data.amount = Number(f.amount) || 0;
    if (type === "expense") data.paid_amount = f.paid_amount === "" ? 0 : Number(f.paid_amount);
    if (type === "task") {
      data.status = f.status || "pending";
      data.assignee_email = f.assignee_email || "";
      data.assignee_name = f.assignee_name || "";
    }
    if (type === "agenda") {
      data.time = f.time || "";
      data.duration_minutes = f.duration_minutes === "" ? undefined : Number(f.duration_minutes);
      data.assignee_email = f.assignee_email || "";
      data.assignee_name = f.assignee_name || "";
    }
    if (type === "participant") {
      data.status = f.status || "invited";
      data.phone = f.phone; data.email = f.email;
      data.guests_count = f.guests_count === "" ? undefined : Number(f.guests_count);
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{item ? editT : newT}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{labelT}</Label>
            <Input value={f.title || ""} onChange={(e) => up("title", e.target.value)} autoFocus />
          </div>
          {money && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>סכום (₪)</Label>
                  <Input type="number" value={f.amount ?? ""} onChange={(e) => up("amount", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>קטגוריה</Label>
                  <Input value={f.category || ""} onChange={(e) => up("category", e.target.value)} />
                </div>
              </div>
              {type === "expense" && (
                <div className="space-y-1.5">
                  <Label>שולם (₪) — ניתן לתשלום חלקי</Label>
                  <Input type="number" value={f.paid_amount ?? ""} onChange={(e) => up("paid_amount", e.target.value)} placeholder="0" />
                </div>
              )}
            </>
          )}
          {(type === "task" || money) && (
            <div className="space-y-1.5">
              <Label>{type === "task" ? "תאריך יעד" : "תאריך"}</Label>
              <Input type="date" value={f.date || ""} onChange={(e) => up("date", e.target.value)} />
            </div>
          )}
          {type === "agenda" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>שעה</Label>
                <Input type="time" value={f.time || ""} onChange={(e) => up("time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>משך (דקות)</Label>
                <Input type="number" value={f.duration_minutes ?? ""} onChange={(e) => up("duration_minutes", e.target.value)} />
              </div>
            </div>
          )}
          {(type === "task" || type === "agenda") && (
            <div className="space-y-1.5">
              <Label>{type === "agenda" ? "אחראי על הנושא" : "אחראי"}</Label>
              <AssigneePicker
                users={users}
                value={{ email: f.assignee_email, name: f.assignee_name }}
                onChange={(a) => setF((p) => ({ ...p, assignee_email: a.email, assignee_name: a.name }))}
              />
            </div>
          )}
          {type === "participant" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>טלפון</Label>
                  <Input value={f.phone || ""} onChange={(e) => up("phone", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>מספר מגיעים</Label>
                  <Input type="number" value={f.guests_count ?? ""} onChange={(e) => up("guests_count", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>אימייל</Label>
                <Input value={f.email || ""} onChange={(e) => up("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>סטטוס</Label>
                <Select value={f.status || "invited"} onValueChange={(v) => up("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARTICIPANT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={2} value={f.notes || ""} onChange={(e) => up("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={saving || !(f.title || "").trim()}>{saving ? "שומר..." : "שמירה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}