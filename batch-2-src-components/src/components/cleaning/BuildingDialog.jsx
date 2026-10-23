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
import MemberPicker from "@/components/MemberPicker";

const EMPTY = {
  name: "", address: "", parking_lots_count: "", responsible_name: "",
  responsible_phone: "", status: "dirty", last_cleaned_date: "", notes: "",
};

function parseResidents(r) {
  if (!r) return [];
  try {
    const arr = typeof r === "string" ? JSON.parse(r) : r;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export default function BuildingDialog({ open, onOpenChange, editing, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editing ? { ...EMPTY, ...editing } : EMPTY);
  }, [editing, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        parking_lots_count: form.parking_lots_count === "" ? null : Number(form.parking_lots_count),
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const residents = parseResidents(form.residents);
  const residentOptions = residents.map((r, i) => ({ ...r, id: String(i), id_number: r.apartment ? `דירה ${r.apartment}` : "" }));
  const pickResponsible = (id) => {
    const r = residents[Number(id)];
    if (r) setForm((f) => ({ ...f, responsible_name: r.name || "", responsible_phone: r.phone || r.mobile || f.responsible_phone }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת בניין" : "הוספת בניין"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>שם / מספר בניין *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>כתובת</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>מספר חניות</Label>
              <Input type="number" value={form.parking_lots_count} onChange={(e) => set("parking_lots_count", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>סטטוס ניקיון</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dirty">לא נוקה</SelectItem>
                  <SelectItem value="in_progress">בטיפול</SelectItem>
                  <SelectItem value="clean">נוקה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>אחראי</Label>
              {residentOptions.length > 0 && (
                <MemberPicker value="" onChange={pickResponsible} members={residentOptions} placeholder="בחר מתוך הדיירים" />
              )}
              <Input value={form.responsible_name} onChange={(e) => set("responsible_name", e.target.value)} placeholder="או הקלד שם" />
            </div>
            <div className="grid gap-1.5">
              <Label>טלפון אחראי</Label>
              <Input value={form.responsible_phone} onChange={(e) => set("responsible_phone", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>תאריך ניקוי אחרון</Label>
            <Input type="date" value={form.last_cleaned_date || ""} onChange={(e) => set("last_cleaned_date", e.target.value)} />
          </div>
          {residents.length > 0 && (
            <div className="grid gap-1.5">
              <Label>רשימת דיירים ({residents.length})</Label>
              <div className="border border-border rounded-md max-h-40 overflow-y-auto scrollbar-thin divide-y divide-border">
                {residents.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                    <span className="font-medium truncate">{r.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap text-xs">
                      {r.apartment ? `דירה ${r.apartment}` : ""}
                      {r.apartment && (r.phone || r.mobile) ? " · " : ""}
                      {r.phone || r.mobile || ""}
                    </span>
                  </div>
                ))}
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
          <Button onClick={submit} disabled={saving || !form.name?.trim()}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}