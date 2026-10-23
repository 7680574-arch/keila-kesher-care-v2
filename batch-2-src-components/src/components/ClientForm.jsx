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

export default function ClientForm({ open, onOpenChange, onSubmit, initial = null }) {
  const [form, setForm] = useState({
    full_name: initial?.full_name || "",
    id_number: initial?.id_number || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    address: initial?.address || "",
    date_of_birth: initial?.date_of_birth || "",
    gender: initial?.gender || "male",
    status: initial?.status || "active",
    tags: initial?.tags || "",
    emergency_contact: initial?.emergency_contact || "",
    notes: initial?.notes || "",
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "עריכת לקוח" : "לקוח חדש"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="px-4 space-y-4">
          <div className="space-y-1.5">
            <Label>שם מלא *</Label>
            <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תעודת זהות</Label>
              <Input value={form.id_number} onChange={(e) => update("id_number", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>אימייל</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>כתובת</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך לידה</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>מגדר</Label>
              <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">זכר</SelectItem>
                  <SelectItem value="female">נקבה</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>סטטוס</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>איש קשר לחירום</Label>
            <Input value={form.emergency_contact} onChange={(e) => update("emergency_contact", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>תגיות</Label>
            <Input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="לדוגמה: קשיש, משפחה" />
          </div>
          <div className="space-y-1.5">
            <Label>הערות כלליות</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
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