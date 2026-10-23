import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Receipt, Upload, Trash2, Save, Plus, FileText, Loader2, Download, Layers, Search, CheckCircle2, XCircle, Wrench } from "lucide-react";
import { rowsToCsv, downloadCsv } from "@/lib/exportCsv";
import { exportPivotExcel } from "@/lib/exportPivotExcel";
import SalesPivotTable from "@/components/SalesPivotTable";
import SalesUploadsList from "@/components/SalesUploadsList";
import AsteriskSkuPicker, { isAsteriskSku } from "@/components/AsteriskSkuPicker";
import HashSkuMatch from "@/components/HashSkuMatch";
import MaintenanceRequestsDialog from "@/components/maintenance/MaintenanceRequestsDialog";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
const emptyRow = () => ({
  order_number: "", transaction_date: "", transaction_time: "",
  customer_name: "", department: "", product_name: "", sku: "",
  quantity: 1, unit_price: 0, line_total: 0,
});

const COLS = [
  { key: "order_number", label: "הזמנה", width: "w-24" },
  { key: "transaction_date", label: "תאריך", width: "w-36", type: "date" },
  { key: "transaction_time", label: "שעה", width: "w-20" },
  { key: "customer_name", label: "לקוח", width: "w-40" },
  { key: "department", label: "מחלקה", width: "w-32" },
  { key: "product_name", label: "שם מוצר", width: "w-48" },
  { key: "sku", label: "קוד מוצר", width: "w-28" },
  { key: "quantity", label: "כמות", width: "w-24", type: "number" },
  { key: "unit_price", label: "מחיר יחידה", width: "w-28", type: "number" },
  { key: "line_total", label: "סכום שורה", width: "w-28", type: "number" },
];

export default function Invoices() {
  const { toast } = useToast();
  const [files, setFiles] = useState([]); // [{ file, garden }]
  const [progress, setProgress] = useState({}); // { index: { status, rows, err } }
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const [view, setView] = useState("uploads"); // "uploads" | "pivot" | "rows"
  const [uploadTitle, setUploadTitle] = useState("");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [uploadFilter, setUploadFilter] = useState("");
  const [sort, setSort] = useState({ key: "transaction_date", dir: "desc" });
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const filteredSaved = useMemo(() => {
    const q = query.trim().toLowerCase();
    return saved.filter((t) =>
      (!q || (t.product_name || "").toLowerCase().includes(q) || (t.sku || "").toLowerCase().includes(q)) &&
      (!deptFilter || (t.department || "") === deptFilter) &&
      (!uploadFilter || (t.upload_id || "") === uploadFilter)
    );
  }, [saved, query, deptFilter, uploadFilter]);

  const uploads = useMemo(() => {
    const map = new Map();
    for (const t of saved) {
      const id = t.upload_id || "";
      if (!id) continue;
      if (!map.has(id)) map.set(id, t.upload_title || id);
    }
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [saved]);

  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  const sortedRows = useMemo(() => {
    const arr = [...filteredSaved];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let av = a[key], bv = b[key];
      if (av == null) av = ""; if (bv == null) bv = "";
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv), "he") : String(bv).localeCompare(String(av), "he");
    });
    return arr;
  }, [filteredSaved, sort]);

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const all = [];
      let cursor;
      do {
        const page = await base44.entities.SalesTransaction.filter({}, { sort: "-created_date", limit: 500, cursor });
        all.push(...page.items);
        cursor = page.has_more ? page.next_cursor : undefined;
      } while (cursor);
      setSaved(all);
    } catch (e) {
      toast({ title: "שגיאה בטעינת תנועות", description: e.message, variant: "destructive" });
    } finally { setLoadingSaved(false); }
  };
  useEffect(() => { loadSaved(); }, []);

  const knownGardens = useMemo(() => {
    const set = new Set();
    for (const t of saved) { const g = (t.department || "").trim(); if (g) set.add(g); }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [saved]);

  const knownProducts = useMemo(() => {
    const map = new Map();
    for (const t of saved) {
      const sku = (t.sku || "").trim();
      if (!sku || isAsteriskSku(sku)) continue;
      if (!map.has(sku)) map.set(sku, { sku, name: t.product_name || sku });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [saved]);

  const knownSkus = useMemo(() => knownProducts.map((p) => p.sku), [knownProducts]);

  const gardenFromName = (name) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

  const onFile = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    setPreview([]);
    setProgress({});
    setFiles((prev) => [...prev, ...picked.map((f) => ({ file: f, garden: gardenFromName(f.name) }))]);
  };

  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const updateFileGarden = (i, val) => setFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, garden: val } : f));
  const clearFiles = () => { setFiles([]); if (fileRef.current) fileRef.current.value = ""; };

  const extract = async () => {
    const validIdx = files.map((f, i) => f.garden.trim() ? i : null).filter((i) => i !== null);
    if (!validIdx.length) return;
    setBusy(true);
    setProgress(Object.fromEntries(validIdx.map((i) => [i, { status: "pending" }])));
    const allRows = [];
    const errors = [];
    for (const i of validIdx) {
      const { file: f, garden: g } = files[i];
      setProgress((p) => ({ ...p, [i]: { status: "working" } }));
      let pageCount = 0;
      try {
        // Split into single-page PDFs so each extraction call stays well under the server's time limit,
        // which is what caused large multi-page files to time out and fail.
        const srcBytes = await f.arrayBuffer();
        const srcDoc = await PDFDocument.load(srcBytes);
        pageCount = srcDoc.getPageCount();
        let fileRows = 0;
        for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
          setProgress((p) => ({ ...p, [i]: { status: "working", page: pageIdx + 1, pages: pageCount } }));
          const pageDoc = await PDFDocument.create();
          const [copiedPage] = await pageDoc.copyPages(srcDoc, [pageIdx]);
          pageDoc.addPage(copiedPage);
          const pageBytes = await pageDoc.save();
          const pageFile = new File([pageBytes], `${f.name.replace(/\.pdf$/i, "")}_p${pageIdx + 1}.pdf`, { type: "application/pdf" });

          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: pageFile });
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
          const res = await base44.functions.invoke("extractSalesTransactions", { file_url: signed_url });
          const data = res?.data || res || {};
          if (data.error) throw new Error(`עמוד ${pageIdx + 1}: ${data.error}`);
          const rows = Array.isArray(data.transactions) ? data.transactions : [];
          fileRows += rows.length;
          for (const r of rows) {
            allRows.push({
              order_number: r.order_number || "",
              transaction_date: r.transaction_date || "",
              transaction_time: r.transaction_time || "",
              customer_name: r.customer_name || "",
              department: g.trim(),
              product_name: r.product_name || "",
              sku: r.sku || "",
              quantity: Number(r.quantity) || 0,
              unit_price: Number(r.unit_price) || 0,
              line_total: Number(r.line_total) || 0,
            });
          }
        }
        if (!fileRows) {
          errors.push(`${f.name}: לא זוהו שורות`);
        }
        setProgress((p) => ({ ...p, [i]: { status: "done", rows: fileRows } }));
      } catch (e) {
        errors.push(`${f.name}: ${e.message}`);
        setProgress((p) => ({ ...p, [i]: { status: "error", err: e.message } }));
      }
    }
    setPreview(allRows);
    if (allRows.length) {
      toast({ title: "חולצו תנועות", description: `${allRows.length} שורות מ-${validIdx.length} קבצים${errors.length ? ` · ${errors.length} שגיאות` : ""}` });
    } else {
      toast({ title: "לא זוהו תנועות", description: errors.join(" · ") || "לא הצלחנו לחלץ שורות", variant: "destructive" });
    }
    if (errors.length) toast({ title: "שגיאות בחילוץ", description: errors.join(" · "), variant: "destructive" });
    setBusy(false);
  };

  const updateRow = (i, field, val) => {
    setPreview((prev) => prev.map((r, idx) => idx === i
      ? { ...r, [field]: val === "" ? "" : (COLS.find((c) => c.key === field)?.type === "number" ? Number(val) : val) }
      : r));
  };
  const setRowProduct = (i, sku, name) => {
    setPreview((prev) => prev.map((r, idx) => idx === i ? { ...r, sku, product_name: name } : r));
  };
  const removeRow = (i) => setPreview((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setPreview((prev) => [...prev, emptyRow()]);

  const defaultTitle = () => {
    const today = new Date().toLocaleDateString("he-IL");
    const gardens = files.map((f) => f.garden.trim()).filter(Boolean);
    return gardens.length ? `${gardens.join(", ")} - ${today}` : `העלאה ${today}`;
  };

  const save = async () => {
    const valid = preview.filter((r) => r.product_name.trim());
    if (!valid.length) { toast({ title: "אין שורות לשמירה", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const uploadId = (crypto?.randomUUID?.() || String(Date.now()));
      const title = (uploadTitle.trim() || defaultTitle());
      await base44.entities.SalesTransaction.bulkCreate(valid.map((r) => ({
        order_number: r.order_number.trim(),
        transaction_date: r.transaction_date || undefined,
        transaction_time: r.transaction_time,
        customer_name: r.customer_name,
        department: r.department,
        product_name: r.product_name.trim(),
        sku: r.sku,
        quantity: Number(r.quantity) || 0,
        unit_price: Number(r.unit_price) || 0,
        line_total: Number(r.line_total) || 0,
        upload_id: uploadId,
        upload_title: title,
      })));
      toast({ title: "נשמרו תנועות", description: `${valid.length} שורות נשמרו תחת "${title}"` });
      setPreview([]); clearFiles(); setUploadTitle("");
      loadSaved();
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const updateBatchTitle = async (uploadId, title) => {
    if (!uploadId) return;
    await base44.entities.SalesTransaction.updateMany({ upload_id: uploadId }, { $set: { upload_title: title } });
    setSaved((prev) => prev.map((r) => (r.upload_id === uploadId ? { ...r, upload_title: title } : r)));
  };

  const editRowTitle = async (t, title) => {
    if (!t.upload_id) return;
    try {
      await updateBatchTitle(t.upload_id, title);
      toast({ title: "כותרת עודכנה", description: "הכותרת עודכנה לכל שורות ההעלאה" });
    } catch (e) {
      toast({ title: "שגיאה בעדכון כותרת", description: e.message, variant: "destructive" });
    }
  };

  const assignSkuToGroup = async (group, newSku, newName) => {
    const query = { sku: group.sku || "", product_name: group.name || "", unit_price: group.unit_price ?? 0 };
    try {
      await base44.entities.SalesTransaction.updateMany(query, { $set: { sku: newSku, product_name: newName } });
      toast({ title: "עודכן קוד מוצר", description: `כל השורות של "${group.name}" עודכנו לקוד ${newSku}` });
      loadSaved();
    } catch (e) {
      toast({ title: "שגיאה בעדכון קוד מוצר", description: e.message, variant: "destructive" });
    }
  };

  const assignSkuToRow = async (t, newSku, newName) => {
    try {
      await base44.entities.SalesTransaction.update(t.id, { sku: newSku, product_name: newName });
      toast({ title: "עודכן קוד מוצר", description: `השורה עודכנה לקוד ${newSku}` });
      loadSaved();
    } catch (e) {
      toast({ title: "שגיאה בעדכון קוד מוצר", description: e.message, variant: "destructive" });
    }
  };

  const applyHashMatch = async (group, sku, name) => {
    try {
      for (let i = 0; i < group.ids.length; i += 500) {
        await base44.entities.SalesTransaction.bulkUpdate(
          group.ids.slice(i, i + 500).map((id) => ({ id, sku, product_name: name }))
        );
      }
      const idSet = new Set(group.ids);
      setSaved((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, sku, product_name: name } : r)));
      toast({ title: "עודכן קוד מוצר", description: `${group.ids.length} שורות של "${group.name}" צורפו ל"${name}" (${sku})` });
    } catch (e) {
      toast({ title: "שגיאה בעדכון קוד מוצר", description: e.message, variant: "destructive" });
    }
  };

  // אישור מצובר של כל ההתאמות בעדכון אחד (מונע הגבלת קצב מריבוי קריאות)
  const applyHashBatch = async (records) => {
    if (!records.length) return;
    try {
      for (let i = 0; i < records.length; i += 500) {
        await base44.entities.SalesTransaction.bulkUpdate(records.slice(i, i + 500));
      }
      const map = new Map(records.map((r) => [r.id, r]));
      setSaved((prev) => prev.map((r) => (map.has(r.id) ? { ...r, sku: map.get(r.id).sku, product_name: map.get(r.id).product_name } : r)));
      toast({ title: "אושרו התאמות", description: `${records.length} שורות עודכנו במצטבר` });
    } catch (e) {
      toast({ title: "שגיאה בעדכון מצובר", description: e.message, variant: "destructive" });
    }
  };

  const exportSaved = () => {
    const cols = [
      { header: "תאריך", get: (r) => r.transaction_date },
      { header: "שעה", get: (r) => r.transaction_time },
      { header: "הזמנה", get: (r) => r.order_number },
      { header: "לקוח", get: (r) => r.customer_name },
      { header: "מחלקה", get: (r) => r.department },
      { header: "כותרת העלאה", get: (r) => r.upload_title },
      { header: "שם מוצר", get: (r) => r.product_name },
      { header: "קוד מוצר", get: (r) => r.sku },
      { header: "כמות", get: (r) => r.quantity },
      { header: "מחיר יחידה", get: (r) => r.unit_price },
      { header: "סכום שורה", get: (r) => r.line_total },
    ];
    downloadCsv("תנועות_מכירה.csv", rowsToCsv(saved, cols));
  };

  // ייצוא מצטבר לפי גן לקובץ אקסל — משחזר את התצוגה באתר כולל שורת הכותרת הכפולה והתאים הממוזגים
  const exportPivot = () => exportPivotExcel(saved);

  const removeSaved = async (t) => {
    if (!confirm(`למחוק את התנועה "${t.product_name}"?`)) return;
    try { await base44.entities.SalesTransaction.delete(t.id); loadSaved(); }
    catch (e) { toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" }); }
  };

  const deleteUpload = async (g) => {
    if (!g || !g.count) return;
    if (!confirm(`למחוק את כל ההעלאה "${g.title}" (${g.count} שורות)?`)) return;
    try {
      if (g.upload_id) {
        await base44.entities.SalesTransaction.deleteMany({ upload_id: g.upload_id });
      } else {
        const ids = (g.items || []).map((t) => t.id).filter(Boolean);
        for (let i = 0; i < ids.length; i += 500) {
          await base44.entities.SalesTransaction.deleteMany({ id: { $in: ids.slice(i, i + 500) } });
        }
      }
      toast({ title: "ההעלאה נמחקה", description: `${g.count} שורות הוסרו` });
      loadSaved();
    } catch (e) {
      toast({ title: "שגיאה במחיקת העלאה", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Receipt className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">חשבוניות / תנועות מכירה</h1>
            <p className="text-sm text-muted-foreground">העלאת קובץ PDF שמיוצא מאקסל, חילוץ שורות ושמירה בטבלת תנועות מכירה</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setMaintenanceOpen(true)}>
          <Wrench className="w-4 h-4" />
          אחזקת בית ספר
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold">העלאת קבצים (PDF) — ניתן לבחור מספר קבצים ביחד</p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={onFile}
              className="text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:font-medium"
            />
            {files.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFiles} disabled={busy}>נקה רשימה</Button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">כותרת העלאה (משותפת לכל הקבצים)</label>
          <input
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder={defaultTitle()}
            className="h-9 min-w-56 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
        {files.length > 0 && (
          <div className="rounded-xl border border-border divide-y divide-border">
            {files.map((f, i) => {
              const st = progress[i];
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <span className="shrink-0 w-5 flex justify-center">
                    {st?.status === "working" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {st?.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {st?.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                    {(!st || st.status === "pending") && <FileText className="w-4 h-4 text-muted-foreground" />}
                  </span>
                  <span className="text-sm truncate flex-1" title={f.file.name}>{f.file.name}</span>
                  {st?.status === "working" && st.pages > 1 && <span className="text-xs text-muted-foreground">עמוד {st.page}/{st.pages}</span>}
                  {st?.status === "done" && <span className="text-xs text-muted-foreground">{st.rows || 0} שורות</span>}
                  {st?.status === "error" && <span className="text-xs text-destructive truncate max-w-40" title={st.err}>שגיאה</span>}
                  <input
                    list="known-gardens"
                    value={f.garden}
                    onChange={(e) => updateFileGarden(i, e.target.value)}
                    placeholder="שם גן / מחלקה"
                    className="h-8 min-w-40 rounded-md border border-input bg-transparent px-2 text-sm"
                  />
                  <datalist id="known-gardens">
                    {knownGardens.map((g) => <option key={g} value={g} />)}
                  </datalist>
                  <button onClick={() => removeFile(i)} disabled={busy} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="הסר קובץ">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {(() => {
          const validIdx = files.map((f, i) => f.garden.trim() ? i : null).filter((i) => i !== null);
          const total = validIdx.length;
          const done = validIdx.filter((i) => progress[i]?.status === "done" || progress[i]?.status === "error").length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return busy && total > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{done} מתוך {total} קבצים הסתיימו</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : (
            busy && <p className="text-xs text-muted-foreground">חילוץ רץ על כל הקבצים בזה אחר זה — עשוי להימשך עד כחצי דקה לכל קובץ...</p>
          );
        })()}
        <div className="flex items-center gap-3">
          <Button onClick={extract} disabled={busy || files.length === 0 || files.every((f) => !f.garden.trim())}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {busy ? "מעלה וחולץ..." : `חלץ תנועות (${files.length})`}
          </Button>
          {files.some((f) => !f.garden.trim()) && <p className="text-xs text-amber-600">יש להזין שם גן לכל קובץ לפני החילוץ.</p>}
        </div>
        {busy && <p className="text-xs text-muted-foreground">חילוץ רץ על כל הקבצים בזה אחר זה — עשוי להימשך עד כחצי דקה לכל קובץ...</p>}
      </div>

      {preview.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
            <div>
              <p className="text-sm font-semibold">תוצאות החילוץ — בדיקה ועריכה</p>
              <p className="text-xs text-muted-foreground">{preview.length} שורות · ניתן לערוך, למחוק או להוסיף לפני השמירה</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4" /> שורה</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "שומר..." : "שמור הכל"}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto scrollbar-thin max-h-[55vh]">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  {COLS.map((c) => <th key={c.key} className={`text-right px-3 py-2.5 font-semibold ${c.width}`}>{c.label}</th>)}
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {COLS.map((c) => (
                      <td key={c.key} className="px-3 py-1.5">
                        {c.key === "sku" && isAsteriskSku(r.sku) ? (
                          <AsteriskSkuPicker
                            products={knownProducts}
                            existingSkus={knownSkus}
                            onChange={(sku, name) => setRowProduct(i, sku, name)}
                          />
                        ) : (
                          <Input
                            type={c.type || "text"}
                            value={r[c.key] ?? ""}
                            onChange={(e) => updateRow(i, c.key, e.target.value)}
                            className="h-8 min-w-20"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={() => removeRow(i)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="הסר שורה">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">טבלת תנועות מכירה</p>
            <span className="text-xs font-normal text-muted-foreground">({filteredSaved.length}{query && saved.length !== filteredSaved.length ? ` מתוך ${saved.length}` : ""})</span>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setView("uploads")} className={`px-3 py-1 text-xs font-medium ${view === "uploads" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>העלאות</button>
              <button onClick={() => setView("pivot")} className={`px-3 py-1 text-xs font-medium ${view === "pivot" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>מצטבר לפי גן</button>
              <button onClick={() => setView("rows")} className={`px-3 py-1 text-xs font-medium ${view === "rows" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>תצוגת שורות</button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לפי קוד מוצר או שם מוצר"
                className="h-9 min-w-64 pr-8 pl-3 rounded-md border border-input bg-transparent text-sm"
              />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">כל הגנים</option>
              {knownGardens.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={uploadFilter} onChange={(e) => setUploadFilter(e.target.value)} className="h-9 max-w-52 rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="">כל ההעלאות</option>
              {uploads.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
            {(deptFilter || uploadFilter || query) && (
              <Button variant="ghost" size="sm" onClick={() => { setDeptFilter(""); setUploadFilter(""); setQuery(""); }}>נקה סינון</Button>
            )}
            <HashSkuMatch rows={saved} products={knownProducts} existingSkus={knownSkus} onApply={applyHashMatch} onApplyBatch={applyHashBatch} />
            <Button variant="outline" size="sm" onClick={exportSaved} disabled={!saved.length}><Download className="w-4 h-4" /> ייצוא CSV</Button>
            <Button variant="outline" size="sm" onClick={exportPivot} disabled={!saved.length}><Download className="w-4 h-4" /> ייצוא Excel מצטבר</Button>
            <Button variant="ghost" size="sm" onClick={loadSaved} disabled={loadingSaved}>רענן</Button>
          </div>
        </div>
        {loadingSaved ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : saved.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>אין עדיין תנועות שמורות.</p>
            <p className="text-sm mt-1">העל/י קובץ PDF כדי להתחיל.</p>
          </div>
        ) : view === "uploads" ? (
          <SalesUploadsList rows={filteredSaved} onRowDelete={removeSaved} onTitleChange={updateBatchTitle} onDeleteUpload={deleteUpload} />
        ) : view === "pivot" ? (
          <SalesPivotTable
            rows={filteredSaved}
            knownProducts={knownProducts}
            existingSkus={knownSkus}
            onAssignSku={assignSkuToGroup}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {[
                    { key: "transaction_date", label: "תאריך" },
                    { key: "order_number", label: "הזמנה" },
                    { key: "customer_name", label: "לקוח" },
                    { key: "department", label: "מחלקה" },
                    { key: "upload_title", label: "כותרת העלאה" },
                    { key: "product_name", label: "שם מוצר" },
                    { key: "sku", label: "קוד" },
                    { key: "quantity", label: "כמות" },
                    { key: "unit_price", label: "מחיר" },
                    { key: "line_total", label: 'סה"כ' },
                  ].map((c) => (
                    <th key={c.key} onClick={() => toggleSort(c.key)} className="text-right px-3 py-2.5 font-semibold cursor-pointer select-none hover:text-foreground whitespace-nowrap">
                      {c.label} <span className="text-xs opacity-70">{sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRows.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-muted-foreground">{t.transaction_date || "—"}</td>
                    <td className="px-3 py-2.5">{t.order_number || "—"}</td>
                    <td className="px-3 py-2.5">{t.customer_name || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{t.department || "—"}</td>
                    <td className="px-3 py-2.5">
                      <input
                        defaultValue={t.upload_title || ""}
                        placeholder="ללא כותרת"
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== (t.upload_title || "")) editRowTitle(t, v); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                        className="h-8 min-w-36 rounded-md border border-transparent hover:border-input focus:border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{t.product_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {isAsteriskSku(t.sku) ? (
                        <AsteriskSkuPicker products={knownProducts} existingSkus={knownSkus} onChange={(sku, name) => assignSkuToRow(t, sku, name)} />
                      ) : (t.sku || "—")}
                    </td>
                    <td className="px-3 py-2.5">{t.quantity ?? 0}</td>
                    <td className="px-3 py-2.5">{fmt(t.unit_price)}</td>
                    <td className="px-3 py-2.5 font-medium">{fmt(t.line_total)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => removeSaved(t)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחיקה">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MaintenanceRequestsDialog open={maintenanceOpen} onClose={() => setMaintenanceOpen(false)} />
    </div>
  );
}