import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function LashavuaTransactionDialog({ open, onOpenChange, record = null, defaultBucket = "lashavua", onSave }) {
  const isEdit = !!record;
  const [form, setForm] = useState({
    bucket: "lashavua",
    kind: "income",
    date: "",
    description: "",
    amount: "",
    commission: "",
    category: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      bucket: record?.bucket || defaultBucket,
      kind: record?.kind || "income",
      date: record?.date || new Date().toISOString().slice(0, 10),
      description: record?.description || "",
      amount: record?.amount ?? "",
      commission: record?.commission ?? "",
      category: record?.category || "",
      notes: record?.notes || "",
    });
  }, [open, record, defaultBucket]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // חישוב עמלה אוטומטי (מכאן ולהבא) — רק רשומות חדשות בקופות לשבוע מטובה / סופרים:
  // הכנסה אשראי 3%, העברה שבוצעה 15 ₪ קבוע. הערות ועריכת רשומות קיימות אינן מושפעות.
  const autoCommission = form.bucket === "lashavua" || form.bucket === "supermarket";
  useEffect(() => {
    if (isEdit || !autoCommission) return;
    const amt = Number(form.amount) || 0;
    const calc = form.kind === "income"
      ? Math.round(amt * 0.03 * 100) / 100
      : form.kind === "transfer" ? 15 : "";
    setForm((f) => ({ ...f, commission: calc }));
  }, [form.amount, form.kind, form.bucket, isEdit, autoCommission]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.date || form.amount === "" ) return;
    setSaving(true);
    try {
      await onSave({
        bucket: form.bucket,
        kind: form.kind,
        date: form.date,
        description: form.description || undefined,
        amount: Number(form.amount) || 0,
        commission: form.commission === "" ? undefined : Number(form.commission),
        category: form.category || undefined,
        notes: form.notes || undefined,
        source: record?.source === "nedarim" ? "nedarim" : "manual",
      });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת תנועה" : "תנועה חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>קופה</Label>
              <Select value={form.bucket} onValueChange={(v) => set("bucket", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lashavua">לשבוע מטובה</SelectItem>
                  <SelectItem value="supermarket">סופרים</SelectItem>
                  <SelectItem value="expenses">הוצאות</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>סוג תנועה</Label>
              <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">הכנסה</SelectItem>
                  <SelectItem value="transfer">העברה שבוצעה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>קטגוריה</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="אופציונלי" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{form.kind === "transfer" ? "מוטב ההעברה" : "פירוט"}</Label>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={form.kind === "transfer" ? "שם המוטב" : "מקור ההכנסה"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>סכום *</Label>
              <Input type="number" min="0" step="any" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>עמלה</Label>
              <Input type="number" min="0" step="any" value={form.commission} onChange={(e) => set("commission", e.target.value)} placeholder="0" />
              {autoCommission && !isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  {form.kind === "income" ? "מחושב אוטומטית 3% מהסכום" : form.kind === "transfer" ? "מחושב אוטומטית 15 ₪ קבוע" : null}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button type="submit" disabled={saving}>{saving ? "שומר…" : "שמור"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}