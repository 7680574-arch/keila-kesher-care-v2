import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import MemberPicker from "@/components/MemberPicker";
import { parseHkInstructions } from "@/lib/depositBalance";
import { Plus, Trash2 } from "lucide-react";

function emptyInstr(type = "deduction") {
  return { number: "", amount: "", type };
}

export default function DepositFormDialog({ open, onOpenChange, members, editDep, onSaved }) {
  const { toast } = useToast();
  const [memberId, setMemberId] = useState("");
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [instr, setInstr] = useState([emptyInstr()]);
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editDep) {
      setMemberId(editDep.member_id || "");
      setName(editDep.name || "");
      setIdNumber(editDep.id_number || "");
      setPhone(editDep.phone || "");
      setAmount(editDep.initial_amount != null ? String(editDep.initial_amount) : "");
      const list = parseHkInstructions(editDep);
      setInstr(list.length ? list.map((x) => ({ number: x.number, amount: x.amount == null ? "" : String(x.amount), type: x.type })) : [emptyInstr()]);
      setStatus(editDep.status || "active");
      setNotes(editDep.notes || "");
    } else {
      setMemberId(""); setName(""); setIdNumber(""); setPhone("");
      setAmount(""); setInstr([emptyInstr()]); setStatus("active"); setNotes("");
    }
  }, [open, editDep]);

  const onPickMember = (id) => {
    setMemberId(id);
    if (id) {
      const m = members.find((mm) => mm.id === id);
      if (m) {
        setName(m.name || "");
        setIdNumber(m.id_number || "");
        setPhone(m.phone || m.mobile || "");
      }
    }
  };

  const updateInstr = (idx, field, value) => {
    setInstr((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const addInstr = () => setInstr((prev) => [...prev, emptyInstr()]);
  const removeInstr = (idx) => setInstr((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim() || !amount) {
      toast({ title: "יש למלא שם וסכום", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cleanInstr = instr
        .map((it) => ({ number: String(it.number || "").trim(), amount: it.amount === "" ? null : Number(it.amount), type: it.type === "deposit" ? "deposit" : "deduction" }))
        .filter((it) => it.number || it.amount != null);
      const primary = cleanInstr[0] || {};
      const data = {
        member_id: memberId || "",
        name: name.trim(),
        id_number: idNumber.trim(),
        phone: phone.trim(),
        initial_amount: Number(amount) || 0,
        hk_instruction_number: primary.number || "",
        hk_amount: primary.amount != null ? primary.amount : null,
        hk_type: primary.type || "deduction",
        hk_instructions: JSON.stringify(cleanInstr),
        status,
        notes: notes.trim(),
      };
      if (editDep) {
        await base44.entities.Deposit.update(editDep.id, data);
        toast({ title: "הפיקדון עודכן" });
      } else {
        await base44.entities.Deposit.create(data);
        toast({ title: "הפיקדון נוצר" });
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editDep ? "עריכת פיקדון" : "פיקדון חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>בחירה מרשימת הקהילה (אופציונלי)</Label>
            <MemberPicker value={memberId} onChange={onPickMember} members={members} placeholder="בחר חבר קהילה, או הזן שם ידני" />
          </div>
          <div className="space-y-1.5">
            <Label>שם מלא *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם בעל הפיקדון" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תעודת זהות</Label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>טלפון</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>סכום פיקדון התחלתי *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₪" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>הוראות קבע (הו״ק) מנדרים פלוס</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInstr}>
                <Plus className="w-3.5 h-3.5" /> הוסף הו״ק
              </Button>
            </div>
            <div className="space-y-2">
              {instr.map((it, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">הו״ק #{idx + 1}</span>
                    {instr.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeInstr(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={it.number} onChange={(e) => updateInstr(idx, "number", e.target.value)} placeholder="מזהה קבע מנדרים" />
                    <Select value={it.type} onValueChange={(v) => updateInstr(idx, "type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deduction">הפחתה מהפיקדון</SelectItem>
                        <SelectItem value="deposit">הפקדה לפיקדון (הוספה)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input type="number" value={it.amount} onChange={(e) => updateInstr(idx, "amount", e.target.value)} placeholder="סכום קבוע (ריק = סכום העסקה)" />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">ניתן להוסיף מספר הוראות קבע — הפחתות והפקדות כאחד. הסנכרון יתרשם אוטומטית לפי מזהה הקבע.</p>
          </div>

          <div className="space-y-1.5">
            <Label>סטטוס</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="redeemed">נפרע</SelectItem>
                <SelectItem value="closed">סגור</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={save} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}