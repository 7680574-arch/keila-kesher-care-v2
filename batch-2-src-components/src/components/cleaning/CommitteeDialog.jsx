import React, { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MemberPicker from "@/components/MemberPicker";
import { base44 } from "@/api/base44Client";

const EMPTY = { name: "", role: "", phone: "", notes: "" };

export default function CommitteeDialog({ open, onOpenChange, editing, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberId, setMemberId] = useState("");

  useEffect(() => { setForm(editing ? { ...EMPTY, ...editing } : EMPTY); setMemberId(""); }, [editing, open]);
  useEffect(() => {
    if (!open || editing || members.length) return;
    base44.entities.CommunityMember
      .filter({}, { sort: "name", limit: 3000, fields: ["name", "id_number", "phone", "mobile"] })
      .then((p) => setMembers(p.items || []));
  }, [open, editing, members.length]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickMember = (id) => {
    setMemberId(id);
    const m = members.find((x) => x.id === id);
    if (m) setForm((f) => ({ ...f, name: m.name || "", phone: m.mobile || m.phone || f.phone }));
  };

  const submit = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try { await onSave({ ...form }); onOpenChange(false); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "עריכת חבר ועדה" : "הוספת חבר ועדה"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {!editing && (
            <div className="grid gap-1.5">
              <Label>בחירה מרשימת הקהילה</Label>
              <MemberPicker value={memberId} onChange={pickMember} members={members} placeholder="בחר אברך מהרשימה" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>שם מלא *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>תפקיד בועדה</Label>
            <Input value={form.role || ""} onChange={(e) => set("role", e.target.value)} placeholder="לדוגמה: יוֹר, גזבר, מזכיר" />
          </div>
          <div className="grid gap-1.5">
            <Label>טלפון</Label>
            <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
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