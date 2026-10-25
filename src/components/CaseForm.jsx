import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import MemberPicker from "@/components/MemberPicker";

export default function CaseForm({ open, onOpenChange, onSubmit, initial = null, members = [], defaultClientId = "" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: initial?.title || "",
    client_id: initial?.client_id || defaultClientId,
    type: initial?.type || "welfare",
    status: initial?.status || "open",
    priority: initial?.priority || "medium",
    description: initial?.description || "",
    assigned_worker: initial?.assigned_worker || "",
    opened_date: initial?.opened_date || today,
    summary: initial?.summary || "",
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const submit = (e) => {
    if (e) e.preventDefault();
    const member = members.find((m) => m.id === form.client_id);
    onSubmit({ ...form, client_name: member?.name || "" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "עריכת תיק" : "תיק חדש"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="px-4 space-y-4">
          <div className="space-y-1.5">
            <Label>כותרת התיק *</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>חבר קהילה *</Label>
            <MemberPicker value={form.client_id} onChange={(v) => update("client_id", v)} members={members} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סוג תיק</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="welfare">רווחה</SelectItem>
                  <SelectItem value="medical">רפואי</SelectItem>
                  <SelectItem value="mental_health">בריאות נפש</SelectItem>
                  <SelectItem value="financial">כלכלי</SelectItem>
                  <SelectItem value="legal">משפטי</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">פתוח</SelectItem>
                  <SelectItem value="in_progress">בטיפול</SelectItem>
                  <SelectItem value="urgent">דחוף</SelectItem>
                  <SelectItem value="closed">סגור</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>תאריך פתיחה</Label>
              <Input type="date" value={form.opened_date} onChange={(e) => update("opened_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>עובד מטפל</Label>
            <Input value={form.assigned_worker} onChange={(e) => update("assigned_worker", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>תיאור</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>סיכום</Label>
            <Textarea rows={2} value={form.summary} onChange={(e) => update("summary", e.target.value)} />
          </div>
        </form>
        <SheetFooter className="px-4">
          <SheetClose asChild>
            <Button variant="outline" type="button">ביטול</Button>
          </SheetClose>
          <Button type="submit" onClick={submit}>שמירה</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}