import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, ADDRESS_OPTIONS } from "@/lib/serviceLabels";

export default function ServiceRequestFormDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ title: "", category: "maintenance", priority: "medium", phone: "", address: "", description: "" });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const res = await base44.functions.invoke("submitServiceRequest", form);
      onCreated?.(res.data?.request);
      setForm({ title: "", category: "maintenance", priority: "medium", phone: "", address: "", description: "" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>פתיחת קריאת שירות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>כותרת הקריאה *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="לדוגמה: נזילה בכיור במטבח" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>קטגוריה</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>דחיפות</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="050-0000000" />
            </div>
            <div className="space-y-1.5">
              <Label>כתובת</Label>
              <Select value={form.address} onValueChange={(v) => set("address", v)}>
                <SelectTrigger><SelectValue placeholder="בחר מיקום" /></SelectTrigger>
                <SelectContent>
                  {ADDRESS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>תיאור הבעיה</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="פרט את הבעיה, מתי התחילה, וכל מידע רלוונטי" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.title.trim()}>{loading ? "פותח..." : "פתיחת קריאה"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}