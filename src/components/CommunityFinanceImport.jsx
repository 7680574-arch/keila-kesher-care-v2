import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, UploadCloud, FileSpreadsheet, Calendar } from "lucide-react";
import { decodeFile, parseCSV, autoDetect, num } from "@/lib/csvUtils";

const fields = [
  { key: "first_name", label: "שם פרטי", opts: ["שם פרטי", "שם ", "שם", "first"] },
  { key: "last_name", label: "שם משפחה", opts: ["שם משפחה", "משפחה", "last"] },
  { key: "id_number", label: "תעודת זהות", opts: ["ת.ז", "תז", "תעודת זהות", "id"] },
  { key: "phone", label: "נייד", opts: ["נייד", "mobile", "סלולרי"] },
  { key: "city", label: "עיר", opts: ["עיר", "city", "ישוב"] },
  { key: "address", label: "רחוב", opts: ["רחוב", "כתובת", "street"] },
  { key: "occupation", label: "עיסוק", opts: ["פרטים אישיים - עיסוק", "עיסוק", "occupation"] },
  { key: "fixed_income", label: "הכנסה קבועה", opts: ["הכנסה קבועה", "קבועה"] },
  { key: "installments_income", label: "הכנסה ממקצבאות", opts: ["הכנסה מקצבאות", "מקצבאות"] },
  { key: "total_income", label: 'סה"כ הכנסות', opts: ["סהכ הכנסות", "סה״כ הכנסות", "סך הכנסות", "סך הכנסה"] },
  { key: "tuition_expense", label: 'הוצאות מטפלות שכ"ל', opts: ["הוצאות מטפלות שכ", "מטפלות"] },
  { key: "special_children_expense", label: "הוצאות חריגות ילדים", opts: ["הוצאות חריגות ילדים", "חריגות"] },
  { key: "rent_expense", label: "הוצאות דיור", opts: ["הוצאות דיור", "דיור"] },
  { key: "total_expenses", label: 'סה"כ הוצאות', opts: ["סהכ הוצאות", "סה״כ הוצאות", "סך הוצאות"] },
  { key: "total_debt", label: "סך חובות כללי", opts: ["סך חובות כללי", "חובות כללי", "חובות"] },
  { key: "debt_reason", label: "ממה נוצרו החובות", opts: ["ממה נוצרו החובות", "נוצרו"] },
  { key: "monthly_repayment", label: "סכום החזר חודשי", opts: ["סכום החזר חודשי", "החזר חודשי", "החזר"] },
  { key: "children_count", label: "מספר ילדים", opts: ["ילדים", "מספר ילדים"] },
];

const thisYear = () => String(new Date().getFullYear());

export default function CommunityFinanceImport({ open, onOpenChange, onImported }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState({});
  const [year, setYear] = useState(thisYear());
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  const reset = () => { setHeaders([]); setRows([]); setCols({}); setError(""); setFileName(""); setProgress(""); };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setError("");
    try {
      const lower = f.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
        setError("קובץ אקסל (.xlsx) אינו נתמך בייבוא. יש לפתוח את הקובץ באקסל ולשמור אותו כ-CSV (UTF-8) ואז להעלות שוב.");
        setHeaders([]); setRows([]); return;
      }
      const text = await decodeFile(f);
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) { setError("הקובץ ריק או לא תקין."); setHeaders([]); setRows([]); return; }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setCols(autoDetect(parsed.headers, fields));
    } catch {
      setError("שגיאה בקריאת הקובץ. ודא שמדובר בקובץ CSV תקין.");
    }
  };

  const setCol = (key, val) => setCols((p) => ({ ...p, [key]: val === "none" ? -1 : Number(val) }));
  const cell = (r, key) => {
    const idx = cols[key];
    if (idx == null || idx < 0) return "";
    return (r[idx] || "").trim();
  };

  const records = () =>
    rows.map((r) => {
      const first = cell(r, "first_name");
      const last = cell(r, "last_name");
      const name = [first, last].filter(Boolean).join(" ").trim();
      if (!name) return null;
      const totalExpenses =
        num(cell(r, "total_expenses")) ||
        num(cell(r, "tuition_expense")) + num(cell(r, "special_children_expense")) + num(cell(r, "rent_expense"));
      return {
        year: year,
        name,
        first_name: first,
        last_name: last,
        id_number: cell(r, "id_number"),
        phone: cell(r, "phone"),
        city: cell(r, "city"),
        address: cell(r, "address"),
        occupation: cell(r, "occupation"),
        fixed_income: num(cell(r, "fixed_income")),
        installments_income: num(cell(r, "installments_income")),
        total_income: num(cell(r, "total_income")) || num(cell(r, "fixed_income")) + num(cell(r, "installments_income")),
        tuition_expense: num(cell(r, "tuition_expense")),
        special_children_expense: num(cell(r, "special_children_expense")),
        rent_expense: num(cell(r, "rent_expense")),
        total_expenses: totalExpenses,
        total_debt: num(cell(r, "total_debt")),
        debt_reason: cell(r, "debt_reason"),
        monthly_repayment: num(cell(r, "monthly_repayment")),
        children_count: num(cell(r, "children_count")),
        raw_data: JSON.stringify(Object.fromEntries(headers.map((h, i) => [h, r[i] || ""]))),
        improving: "new",
      };
    }).filter(Boolean);

  const preview = records();

  const doImport = async () => {
    if (preview.length === 0 || !year) return;
    setImporting(true);
    setError("");
    setProgress("מייבא רשומות…");
    try {
      const created = await base44.entities.CommunityFinance.bulkCreate(preview);
      const arr = Array.isArray(created) ? created : created?.results || [];
      setProgress("מחשב שיפור כלכלי מול השנה הקודמת…");
      const all = await base44.entities.CommunityFinance.list();
      const keyOf = (r) => (r.id_number ? `id:${r.id_number}` : `n:${r.name}`);
      const byKey = {};
      all.forEach((r) => { const k = keyOf(r); (byKey[k] = byKey[k] || []).push(r); });
      const updates = arr.map((r) => {
        const k = keyOf(r);
        const prev = (byKey[k] || [])
          .filter((x) => x.id !== r.id && x.year < r.year)
          .sort((a, b) => (b.year < a.year ? -1 : b.year > a.year ? 1 : 0))[0];
        let improving = "new";
        if (prev) {
          const bal = (x) => (x.total_income || 0) - (x.total_expenses || 0) - (x.monthly_repayment || 0);
          const dBal = bal(r) - bal(prev);
          const dDebt = (r.total_debt || 0) - (prev.total_debt || 0);
          const score = Math.sign(dBal) + (dDebt !== 0 ? -Math.sign(dDebt) : 0);
          improving = score > 0 ? "improving" : score < 0 ? "declining" : "stable";
        }
        return { id: r.id, improving };
      }).filter((u) => u.improving !== "new");
      if (updates.length > 0) await base44.entities.CommunityFinance.bulkUpdate(updates);
      setHeaders([]); setRows([]); setFileName("");
      setProgress("");
      if (onImported) onImported();
    } catch (e) {
      setError("שגיאה בשמירה: " + (e.message || ""));
    } finally {
      setImporting(false);
      setProgress("");
    }
  };

  const hasName = cols.first_name >= 0 || cols.last_name >= 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary" /> העלאת נתונים כלכליים שנתיים</SheetTitle>
          <SheetDescription>העלו את קובץ הקהילה לשנה הנבחרת. המערכת תחשב אוטומטית את השיפור הכלכלי מול השנה הקודמת שהועלתה.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin space-y-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> שנת הנתונים</Label>
            <Input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>

          <label className="block">
            <div className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-2xl p-5 cursor-pointer hover:border-primary hover:bg-primary/5 transition">
              <UploadCloud className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium">בחר קובץ CSV</span>
              <span className="text-xs text-muted-foreground">{fileName || "לחצו לבחירת קובץ"}</span>
            </div>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
          </label>

          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          {progress && <div className="p-3 rounded-lg bg-sky-50 text-sky-700 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {progress}</div>}

          {headers.length > 0 && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">מיפוי עמודות ({headers.length} עמודות)</p>
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                  {fields.map((f) => (
                    <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Select value={cols[f.key] == null || cols[f.key] < 0 ? "none" : String(cols[f.key])} onValueChange={(v) => setCol(f.key, v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="— ללא —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— ללא —</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>{h || `עמודה ${i + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!hasName && <p className="text-xs text-amber-700 mt-2">יש לבחור לפחות עמודת שם.</p>}
              </div>
              <p className="text-xs text-muted-foreground">זוהו {preview.length} רשומות תקפות לשנה {year}.</p>
            </>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button type="button" disabled={preview.length === 0 || importing || !hasName || !year} onClick={doImport}>
            {importing ? "מעבד…" : `ייבא ${preview.length || ""} רשומות לשנה ${year}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}