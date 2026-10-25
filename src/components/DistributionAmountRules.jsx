import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal, Loader2, Users, Wallet } from "lucide-react";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL")}`;

export default function DistributionAmountRules({ open, onOpenChange, recipients, distributionType, onApplied }) {
  const [mode, setMode] = useState("uniform");
  const [amount, setAmount] = useState("");
  const [base, setBase] = useState("");
  const [perNef, setPerNef] = useState("");
  const [applying, setApplying] = useState(false);

  const compute = (r) => {
    if (mode === "uniform") return Number(amount) || 0;
    if (mode === "by_family") return (Number(base) || 0) + (Number(perNef) || 0) * (r.family_size || 0);
    return 0;
  };

  const preview = recipients.slice(0, 4).map((r) => ({
    name: r.name,
    family_size: r.family_size || 0,
    amount: compute(r),
  }));
  const total = recipients.reduce((s, r) => s + compute(r), 0);

  const apply = async () => {
    if (recipients.length === 0) { onOpenChange(false); return; }
    setApplying(true);
    try {
      const updates = recipients.map((r) => ({ id: r.id, amount: compute(r) }));
      await base44.entities.DistributionRecipient.bulkUpdate(updates);
      if (onApplied) onApplied();
      onOpenChange(false);
    } finally { setApplying(false); }
  };

  const unit = distributionType === "cash" ? "₪" : "יח׳";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-primary" /> קביעת סכומים למקבלים</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>אופן חישוב הסכום</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">סכום זהה לכולם</SelectItem>
                <SelectItem value="by_family">סכומים משתנים לפי גודל משפחה</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "uniform" && (
            <div className="space-y-1.5">
              <Label>סכום זהה {distributionType === "cash" ? "(₪)" : ""} *</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="לדוגמה 500" autoFocus />
              <p className="text-xs text-muted-foreground">יוחל על כל {recipients.length} המקבלים.</p>
            </div>
          )}

          {mode === "by_family" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>סכום בסיס {distributionType === "cash" ? "(₪)" : ""}</Label>
                  <Input type="number" min="0" value={base} onChange={(e) => setBase(e.target.value)} placeholder="300" />
                </div>
                <div className="space-y-1.5">
                  <Label>תוספת לכל נפש {distributionType === "cash" ? "(₪)" : ""}</Label>
                  <Input type="number" min="0" value={perNef} onChange={(e) => setPerNef(e.target.value)} placeholder="100" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">סכום = בסיס + (מס׳ נפשות × תוספת). מתאים לסכומים משתנים לפי גודל המשפחה.</p>
            </div>
          )}

          {recipients.length > 0 && (
            <div className="rounded-xl bg-secondary/50 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3.5 h-3.5" /> סה״כ מקבלים</span>
                <span className="font-semibold">{recipients.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Wallet className="w-3.5 h-3.5" /> סה״כ {distributionType === "cash" ? "תקציב" : "כמות"}</span>
                <span className="font-semibold text-primary">{distributionType === "cash" ? fmt(total) : `${total} ${unit}`}</span>
              </div>
              {preview.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">תצוגה מקדימה</p>
                  <div className="space-y-1">
                    {preview.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{p.name} ({p.family_size} נפשות)</span>
                        <span className="font-medium">{distributionType === "cash" ? fmt(p.amount) : `${p.amount} ${unit}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          <Button type="button" disabled={applying || recipients.length === 0} onClick={apply}>
            {applying ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מחיל…</>) : "החל על המקבלים"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}