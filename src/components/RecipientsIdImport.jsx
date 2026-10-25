import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { memberAddress } from "@/lib/communityFields";

export default function RecipientsIdImport({ open, onOpenChange, distributionId, distributionType, members, existingMemberIds, onImported, defaultAmount, defaultMemberPart, defaultFundPart }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [amt, setAmt] = useState("");
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setText(""); setFileName(""); setResult(null); setError(""); };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const t = await f.text();
    setText(t);
  };

  const parseIds = () => {
    const ids = new Set();
    text.split(/[\s,;\t\n]+/).forEach((s) => {
      const d = s.replace(/\D/g, "");
      if (d.length >= 5) ids.add(d);
    });
    return ids;
  };

  const doImport = async () => {
    const ids = parseIds();
    if (ids.size === 0) { setError("לא זוהו מספרי זהות בטקסט."); return; }
    setError("");
    setImporting(true);
    try {
      const byId = {};
      members.forEach((m) => {
        const d = (m.id_number || "").replace(/\D/g, "");
        if (d) byId[d] = m;
      });
      const toAdd = [];
      const missing = [];
      const already = [];
      ids.forEach((idn) => {
        const m = byId[idn];
        if (!m) { missing.push(idn); return; }
        if (existingMemberIds.has(m.id)) { already.push(m.name); return; }
        toAdd.push({
          distribution_id: distributionId,
          member_id: m.id,
          name: m.name,
          family_size: m.family_size || 0,
          neighborhood: m.neighborhood || "",
          phone: m.mobile || "",
          address: memberAddress(m) || m.address || "",
          amount: amt ? Number(amt) : (Number(defaultAmount) || 0),
          member_participation: Number(defaultMemberPart) || 0,
          fund_participation: Number(defaultFundPart) || 0,
          status: "pending",
        });
      });
      if (toAdd.length > 0) await base44.entities.DistributionRecipient.bulkCreate(toAdd);
      setResult({ added: toAdd.length, missing: missing.length, already: already.length, total: ids.size, missingExamples: missing.slice(0, 8) });
      setText(""); setFileName("");
      if (onImported) onImported();
    } catch (e) {
      setError("שגיאה: " + (e.message || ""));
    } finally { setImporting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> הוספת מקבלים ממספרי זהות</SheetTitle>
          <SheetDescription>העלו קובץ או הדביקו מספרי זהות. המערכת תתאים אוטומטית מול רשימת הקהילה ותשלוף את כל הפרטים (שם, שכונה, נפשות, טלפון).</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin space-y-4">
          <label className="block">
            <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-5 cursor-pointer hover:border-primary hover:bg-primary/5 transition">
              <UploadCloud className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium">בחר קובץ טקסט / CSV</span>
              <span className="text-xs text-muted-foreground">{fileName || "מספרי זהות מופרדים בשורה/פסיק/רווח"}</span>
            </div>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
          </label>

          <div className="space-y-1.5">
            <Label>מספרי זהות (ניתן להדביק)</Label>
            <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"123456789\n987654321\n..."} className="font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label>{distributionType === "cash" ? "סכום ברירת מחדל (₪)" : "כמות ברירת מחדל"}</Label>
            <Input type="number" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={defaultAmount ? `ברירת מחדל: ${defaultAmount}` : "לדוגמה 500 (ניתן לערוך אחר כך)"} />
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          {result && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> נוספו {result.added} מקבלים בהצלחה מתוך {result.total} מספרי זהות.
              </div>
              {result.already > 0 && <p className="text-xs text-muted-foreground">{result.already} כבר היו ברשימת המקבלים.</p>}
              {result.missing > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{result.missing} מספרי זהות לא נמצאו ברשימת הקהילה.</p>
                    {result.missingExamples.length > 0 && <p className="text-xs mt-1 opacity-80">דוגמאות: {result.missingExamples.join(", ")}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button type="button" disabled={importing || !text.trim()} onClick={doImport}>
            {importing ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מייבא…</>) : "הוסף מקבלים שזוהו"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}