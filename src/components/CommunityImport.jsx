import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, UploadCloud, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { decodeFile, parseCSV, autoDetect, norm } from "@/lib/csvUtils";

const fields = [
  { key: "first_name", label: "שם פרטי (בעל)", opts: ["שם פרטי", "שם ", "שם", "first_name"] },
  { key: "last_name", label: "שם משפחה", opts: ["שם משפחה", "משפחה", "last_name"] },
  { key: "id_number", label: "תעודת זהות", opts: ["ת.ז", "תז", "תעודת זהות", "id_number"] },
  { key: "mobile", label: "נייד", opts: ["נייד", "mobile", "סלולרי"] },
  { key: "phone", label: "טלפון (קווי)", opts: ["טלפון", "phone", "קווי"] },
  { key: "email", label: "אימייל", opts: ["מייל", "email", "אימייל"] },
  { key: "birth_date", label: "תאריך לידה", opts: ["ת.לידה", "לידה", "birth_date"] },
  { key: "occupation", label: "עיסוק", opts: ["עיסוק", "occupation"] },
  { key: "city", label: "עיר", opts: ["עיר", "city", "ישוב"] },
  { key: "street", label: "רחוב / כתובת", opts: ["רחוב", "כתובת", "כתובת מלאה", "street"] },
  { key: "house_number", label: "מספר בית", opts: ["מספר בית", "מס בית", "מס' בית", "מספר הבית", "house_number", "housenumber", "בית מספר", "בית מס'"] },
  { key: "apartment", label: "דירה", opts: ["דירה", "apartment"] },
  { key: "spouse_name", label: "שם בן/בת זוג", opts: ["פרטי האשה - שם פרטי", "בת זוג", "אשה", "spouse"] },
  { key: "spouse_id", label: "ת.ז. בן/בת זוג", opts: ["פרטי האשה - ת.ז", "ת.ז. בת זוג"] },
  { key: "spouse_phone", label: "טלפון בן/בת זוג", opts: ["פרטי האשה - נייד", "טלפון אשה"] },
  { key: "spouse_occupation", label: "עיסוק בן/בת זוג", opts: ["פרטי האשה - עיסוק", "עיסוק אשה"] },
  { key: "children_count", label: "מספר ילדים", opts: ["ילדים", "children"] },
];

export default function CommunityImport({ open, onOpenChange, onImported }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [cols, setCols] = useState({});
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null);
  const [mode, setMode] = useState("update_all");

  const reset = () => { setHeaders([]); setRows([]); setCols({}); setError(""); setFileName(""); setDone(null); };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setDone(null);
    setError("");
    try {
      const text = await decodeFile(f);
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) { setError("הקובץ ריק או לא תקין."); setHeaders([]); setRows([]); return; }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setCols(autoDetect(parsed.headers, fields));
    } catch {
      setError("שגיאה בקריאת הקובץ. ודא שמדובר בקובץ CSV תקין (UTF-8 או Windows-1255).");
    }
  };

  const setCol = (key, val) => setCols((p) => ({ ...p, [key]: val === "none" ? -1 : Number(val) }));
  const cell = (r, key) => { const idx = cols[key]; if (idx == null || idx < 0) return ""; return (r[idx] || "").trim(); };

  const preview = rows.map((r) => {
    const first = cell(r, "first_name");
    const last = cell(r, "last_name");
    const name = [first, last].filter(Boolean).join(" ").trim();
    const city = cell(r, "city");
    const street = cell(r, "street");
    const num = cell(r, "house_number");
    const apt = cell(r, "apartment");
    const children_count = Number(cell(r, "children_count") || 0) || 0;
    const hasSpouse = !!cell(r, "spouse_name");
    return {
      name, first_name: first, last_name: last,
      id_number: cell(r, "id_number"), mobile: cell(r, "mobile"), phone: cell(r, "phone"),
      email: cell(r, "email"), birth_date: cell(r, "birth_date"), occupation: cell(r, "occupation"),
      city, street, house_number: num, apartment: apt,
      address: [street, num && "מס' " + num, apt && "דירה " + apt].filter(Boolean).join(" "),
      neighborhood: city, family_size: children_count + (hasSpouse ? 2 : 1),
      spouse_name: cell(r, "spouse_name"), spouse_id: cell(r, "spouse_id"), spouse_phone: cell(r, "spouse_phone"),
      spouse_occupation: cell(r, "spouse_occupation"), children_count,
    };
  }).filter((r) => r.name !== "");

  const hasName = cols.first_name >= 0 || cols.last_name >= 0;

  const doImport = async () => {
    if (preview.length === 0) return;
    if (mode === "replace" && !confirm("מחיקת כל חברי הקהילה הקיימים והחלפתם בקובץ זה. להמשיך?")) return;
    setImporting(true);
    setError("");
    try {
      const existing = await base44.entities.CommunityMember.list();
      const byId = new Map();
      existing.forEach((m) => { const d = (m.id_number || "").replace(/\D/g, ""); if (d) byId.set(d, m.id); });
      let updated = 0, created = 0, deleted = 0, skipped = 0;
      if (mode === "replace") {
        if (existing.length) { await base44.entities.CommunityMember.deleteMany({}); deleted = existing.length; }
        const c = await base44.entities.CommunityMember.bulkCreate(preview);
        created = Array.isArray(c) ? c.length : 0;
      } else if (mode === "new_only") {
        const toCreate = [];
        preview.forEach((r) => {
          const d = (r.id_number || "").replace(/\D/g, "");
          if (d && byId.has(d)) skipped++; else toCreate.push(r);
        });
        if (toCreate.length) { const c = await base44.entities.CommunityMember.bulkCreate(toCreate); created = Array.isArray(c) ? c.length : 0; }
      } else {
        const toUpdate = [];
        const toCreate = [];
        preview.forEach((r) => {
          const d = (r.id_number || "").replace(/\D/g, "");
          if (d && byId.has(d)) toUpdate.push({ id: byId.get(d), ...r });
          else toCreate.push(r);
        });
        if (toUpdate.length) { await base44.entities.CommunityMember.bulkUpdate(toUpdate); updated = toUpdate.length; }
        if (toCreate.length) { const c = await base44.entities.CommunityMember.bulkCreate(toCreate); created = Array.isArray(c) ? c.length : 0; }
      }
      setDone({ updated, created, skipped, deleted, total: preview.length });
      if (onImported) onImported();
    } catch (e) {
      setError("שגיאה בשמירה: " + (e.message || ""));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary" /> העלאת / עדכון רשימת הקהילה</SheetTitle>
          <SheetDescription>העלו קובץ CSV. רשומות שמזוהות לפי ת.ז. יעודכנו; חדשות יתווספו. קידוד מזוהה אוטומטית (UTF-8 / Windows-1255).</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin space-y-4">
          <div className="space-y-1.5">
            <Label>מצב ייבוא</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="update_all">עדכון קיימים + הוספת חדשים</SelectItem>
                <SelectItem value="new_only">חדשים בלבד (ללא דריסת קיימים)</SelectItem>
                <SelectItem value="replace">מחיקת כל הרשימה וייבוא הקובץ בלבד</SelectItem>
              </SelectContent>
            </Select>
            {mode === "replace" && <p className="text-xs text-destructive">כל חברי הקהילה הקיימים יימחקו לצמיתות לפני הייבוא.</p>}
            {mode === "new_only" && <p className="text-xs text-muted-foreground">רשומות שמזוהות לפי ת.ז. ידולגו; רק חדשות יתווספו.</p>}
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

          {done && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {mode === "replace"
                ? `נמחקו ${done.deleted} רשומות ישנות ויובאו ${done.created} חדשות.`
                : mode === "new_only"
                  ? `נוספו ${done.created} רשומות חדשות${done.skipped ? ` · ${done.skipped} קיימות דולגו` : ""}.`
                  : `עודכנו ${done.updated} ונוספו ${done.created} מתוך ${done.total} רשומות.`}
            </div>
          )}

          {headers.length > 0 && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">מיפוי עמודות ({headers.length} עמודות זוהו)</p>
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                  {fields.map((f) => (
                    <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Select value={cols[f.key] == null || cols[f.key] < 0 ? "none" : String(cols[f.key])} onValueChange={(v) => setCol(f.key, v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="— ללא —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— ללא —</SelectItem>
                          {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `עמודה ${i + 1}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                {!hasName && <p className="text-xs amber-700 mt-2 text-amber-700">יש לבחור לפחות עמודת שם.</p>}
              </div>
              <p className="text-xs text-muted-foreground">תצוגה מקדימה: {preview.length} רשומות תקפות</p>
            </>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button type="button" disabled={preview.length === 0 || importing || !hasName} onClick={doImport}>
            {importing ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מייבא…</>) : `ייבא / עדכן ${preview.length || ""}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}