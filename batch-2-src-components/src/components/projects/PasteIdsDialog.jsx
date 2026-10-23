import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle } from "lucide-react";

const parseIds = (text) => {
  const ids = new Set();
  text.split(/[\s,;\t\n]+/).forEach((s) => {
    const d = s.replace(/\D/g, "");
    if (d.length >= 5) ids.add(d);
  });
  return [...ids];
};

// existingMemberIds: Set; onAdd(members[]) מוסיף את חברי הקהילה שנמצאו
export default function PasteIdsDialog({ open, onOpenChange, existingMemberIds, onAdd }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setText(""); setResult(null); setError(""); } }, [open]);

  const submit = async () => {
    const ids = parseIds(text);
    if (ids.length === 0) { setError("לא זוהו מספרי זהות בטקסט."); return; }
    setError("");
    setBusy(true);
    const found = [];
    for (let i = 0; i < ids.length; i += 100) {
      const page = await base44.entities.CommunityMember.filter(
        { id_number: { $in: ids.slice(i, i + 100) } }, { limit: 200 }
      );
      found.push(...page.items);
    }
    const foundIds = new Set(found.map((m) => (m.id_number || "").replace(/\D/g, "")));
    const missing = ids.filter((d) => !foundIds.has(d));
    const toAdd = found.filter((m) => !existingMemberIds.has(m.id));
    if (toAdd.length) await onAdd(toAdd);
    setBusy(false);
    setResult({ added: toAdd.length, already: found.length - toAdd.length, missing });
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת מוזמנים ממספרי זהות</DialogTitle>
          <DialogDescription>הדביקו מספרי ת"ז (שורה, פסיק או רווח בין מספר למספר). המערכת תתאים מול רשימת הקהילה.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>מספרי זהות</Label>
          <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"123456789\n987654321"} className="font-mono text-sm" dir="ltr" autoFocus />
        </div>
        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        {result && (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> נוספו {result.added} מוזמנים.
            </div>
            {result.already > 0 && <p className="text-xs text-muted-foreground">{result.already} כבר היו ברשימה.</p>}
            {result.missing.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p>{result.missing.length} מספרי זהות לא נמצאו ברשימת הקהילה.</p>
                  <p className="text-xs mt-1 opacity-80">{result.missing.slice(0, 8).join(", ")}</p>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button disabled={busy || !text.trim()} onClick={submit}>{busy ? "מוסיף..." : "הוסף מוזמנים"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}