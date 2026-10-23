import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const EMPTY = {
  name: "", id_number: "", phone: "", mobile: "", email: "",
  address: "", city: "", company: "", notes: "",
};

export default function DonorFormDialog({ open, onOpenChange, donor, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) setForm(donor ? { ...EMPTY, ...donor } : EMPTY);
    setErr("");
  }, [open, donor?.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name?.trim()) { setErr("נא להזין שם"); return; }
    setSaving(true); setErr("");
    try {
      onSaved?.(form);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{donor ? "עריכת תורם" : "תורם חדש"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label>שם מלא *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="שם התורם" />
          </div>
          <div className="space-y-1">
            <Label>תעודת זהות</Label>
            <Input value={form.id_number} onChange={set("id_number")} />
          </div>
          <div className="space-y-1">
            <Label>חברה / גוף</Label>
            <Input value={form.company} onChange={set("company")} />
          </div>
          <div className="space-y-1">
            <Label>טלפון</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="space-y-1">
            <Label>נייד</Label>
            <Input value={form.mobile} onChange={set("mobile")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>אימייל</Label>
            <Input value={form.email} onChange={set("email")} type="email" />
          </div>
          <div className="space-y-1">
            <Label>עיר</Label>
            <Input value={form.city} onChange={set("city")} />
          </div>
          <div className="space-y-1">
            <Label>כתובת</Label>
            <Input value={form.address} onChange={set("address")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>הערות</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={3} />
          </div>
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}