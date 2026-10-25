import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { LineChart, Upload, TrendingUp, TrendingDown, Minus, Sparkles, Search, Save } from "lucide-react";
import CommunityFinanceImport from "@/components/CommunityFinanceImport";
import ExportCsvButton from "@/components/ExportCsvButton";
import ColumnOrderButton from "@/components/ColumnOrderButton";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortHeader, applyTable, useSort } from "@/components/dataTableUtils";

const DEFAULT_FREE_ORDER = ["year", "total_income", "total_expenses", "total_debt", "monthly_repayment", "children_count", "program_participation", "trend"];

const trendSpan = (value, trend) => {
  const m = trendMeta[trend] || trendMeta.new;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 ring-inset ${m.cell}`}>
      <span>{fmt(value)}</span>
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
};

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

const splitName = (name) => {
  const parts = (name || "").trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.length > 1 ? parts.slice(1).join(" ") : "" };
};

const impMeta = {
  improving: { label: "משתפר", icon: TrendingUp, cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  declining: { label: "מחמיר", icon: TrendingDown, cls: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  stable: { label: "יציב", icon: Minus, cls: "bg-slate-50 text-slate-600 ring-slate-500/20" },
  new: { label: "חדש / אין נתון קודם", icon: Sparkles, cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
};

const trendMeta = {
  improving: { label: "משתפר", icon: TrendingUp, cell: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  declining: { label: "מחמיר", icon: TrendingDown, cell: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  stable: { label: "יציב", icon: Minus, cell: "bg-slate-50 text-slate-600 ring-slate-500/20" },
  new: { label: "חדש / אין נתון קודם", icon: Sparkles, cell: "bg-sky-50 text-sky-700 ring-sky-600/20" },
};

const numFields = ["fixed_income", "installments_income", "total_income", "tuition_expense", "special_children_expense", "rent_expense", "total_expenses", "total_debt", "monthly_repayment", "children_count"];

const emptyForm = {
  name: "", id_number: "", phone: "", city: "", address: "", occupation: "",
  fixed_income: "", installments_income: "", total_income: "",
  tuition_expense: "", special_children_expense: "", rent_expense: "", total_expenses: "",
  total_debt: "", monthly_repayment: "", children_count: "", debt_reason: "", improving: "new",
};

export default function Finance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [trendFilter, setTrendFilter] = useState("all");
  const [colOrder, setColOrder] = useColumnOrder("finance_cols", DEFAULT_FREE_ORDER);
  const [stickyOffsets, setStickyOffsets] = useState([]);
  const tableRef = useRef(null);
  useEffect(() => {
    const measure = () => {
      const ths = tableRef.current?.querySelectorAll("thead tr:first-child > th") || [];
      const offsets = [];
      let cum = 0;
      for (let i = 0; i < 2 && i < ths.length; i++) { offsets.push(cum); cum += ths[i].offsetWidth; }
      setStickyOffsets(offsets);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [records.length, colOrder.join(",")]);

  const load = async () => {
    setLoading(true);
    const r = await base44.entities.CommunityFinance.list("-year", 2000);
    setRecords(r);
    if (r.length > 0 && year === "all") {
      const latest = r.map((x) => x.year).filter(Boolean).sort().reverse()[0];
      setYear(latest || "all");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const years = useMemo(() => {
    const s = new Set(records.map((r) => r.year).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [records]);

  const trendMap = useMemo(() => {
    const byId = {};
    records.forEach((r) => { const d = (r.id_number || "").replace(/\D/g, ""); if (!d) return; (byId[d] ||= {})[r.year] = r; });
    const map = {};
    records.forEach((r) => {
      const d = (r.id_number || "").replace(/\D/g, "");
      if (!d) { map[r.id] = { income: "new", expense: "new", debt: "new", overall: "new" }; return; }
      const ys = Object.keys(byId[d]).sort();
      const prev = ys.indexOf(r.year) > 0 ? byId[d][ys[ys.indexOf(r.year) - 1]] : null;
      if (!prev) { map[r.id] = { income: "new", expense: "new", debt: "new", overall: "new" }; return; }
      const dir = (cur, p, goodWhenUp) => {
        if ((cur || 0) === (p || 0)) return "stable";
        return ((cur || 0) > (p || 0)) === goodWhenUp ? "improving" : "declining";
      };
      const income = dir(r.total_income, prev.total_income, true);
      const expense = dir(r.total_expenses, prev.total_expenses, false);
      const debt = dir(r.total_debt, prev.total_debt, false);
      const arr = [income, expense, debt].filter((x) => x !== "stable");
      const imp = arr.filter((x) => x === "improving").length;
      const dec = arr.filter((x) => x === "declining").length;
      const overall = arr.length === 0 ? "stable" : imp > dec ? "improving" : dec > imp ? "declining" : "stable";
      map[r.id] = { income, expense, debt, overall };
    });
    return map;
  }, [records]);

  const [sort, onSort] = useSort();
  const [filters, setFilters] = useState({});
  const setFilter = (f, v) => setFilters((p) => ({ ...p, [f]: v }));
  const financeField = (m, f) =>
    f === "first_name" ? (m.first_name || splitName(m.name).first)
    : f === "last_name" ? (m.last_name || splitName(m.name).last)
    : m[f];

  const view = useMemo(() => {
    let list = year === "all" ? records : records.filter((r) => r.year === year);
    const q = search.trim();
    if (q) list = list.filter((r) => (r.name || "").includes(q) || (r.id_number || "").includes(q) || (r.phone || "").includes(q));
    if (trendFilter !== "all") list = list.filter((r) => (trendMap[r.id]?.overall || "new") === trendFilter);
    return applyTable(list, sort, filters, financeField);
  }, [records, year, search, trendFilter, trendMap, sort, filters]);

  const stats = useMemo(() => {
    const c = { improving: 0, declining: 0, stable: 0, new: 0 };
    view.forEach((r) => { const o = trendMap[r.id]?.overall || "new"; c[o]++; });
    return c;
  }, [view, trendMap]);

  const totals = useMemo(() => {
    const inc = view.reduce((s, r) => s + (r.total_income || 0), 0);
    const exp = view.reduce((s, r) => s + (r.total_expenses || 0), 0);
    const debt = view.reduce((s, r) => s + (r.total_debt || 0), 0);
    return { inc, exp, debt };
  }, [view]);

  const openEdit = (r) => {
    setDetail(r);
    setForm({
      name: r.name || "", id_number: r.id_number || "", phone: r.phone || "",
      city: r.city || "", address: r.address || "", occupation: r.occupation || "",
      fixed_income: r.fixed_income ?? "", installments_income: r.installments_income ?? "",
      total_income: r.total_income ?? "", tuition_expense: r.tuition_expense ?? "",
      special_children_expense: r.special_children_expense ?? "", rent_expense: r.rent_expense ?? "",
      total_expenses: r.total_expenses ?? "", total_debt: r.total_debt ?? "",
      monthly_repayment: r.monthly_repayment ?? "", children_count: r.children_count ?? "",
      debt_reason: r.debt_reason || "", improving: r.improving || "new",
    });
  };

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    const payload = { ...form };
    numFields.forEach((k) => { payload[k] = Number(payload[k] || 0); });
    try {
      await base44.entities.CommunityFinance.update(detail.id, payload);
      setDetail(null);
      load();
    } finally { setSaving(false); }
  };

  const rawRows = useMemo(() => {
    if (!detail?.raw_data) return [];
    try { return Object.entries(JSON.parse(detail.raw_data)).filter(([, v]) => v !== ""); }
    catch { return []; }
  }, [detail]);

  const exportColumns = [
    { header: "שם משפחה", get: (r) => r.last_name || splitName(r.name).last },
    { header: "שם פרטי", get: (r) => r.first_name || splitName(r.name).first },
    { header: "שנה", get: (r) => r.year },
    { header: "תעודת זהות", get: (r) => r.id_number },
    { header: "טלפון", get: (r) => r.phone },
    { header: "הכנסה קבועה", get: (r) => r.fixed_income },
    { header: "הכנסה ממקצבאות", get: (r) => r.installments_income },
    { header: "סה״כ הכנסות", get: (r) => r.total_income },
    { header: "שכ״ל", get: (r) => r.tuition_expense },
    { header: "חריגות ילדים", get: (r) => r.special_children_expense },
    { header: "דיור", get: (r) => r.rent_expense },
    { header: "סה״כ הוצאות", get: (r) => r.total_expenses },
    { header: "סך חובות", get: (r) => r.total_debt },
    { header: "החזר חודשי", get: (r) => r.monthly_repayment },
    { header: "מספר ילדים", get: (r) => r.children_count },
    { header: "השתתף בתוכנית", get: (r) => (r.program_participation ? "כן" : "לא") },
    { header: "מגמה", get: (r) => trendMap[r.id]?.overall },
  ];

  const nameCols = [
    { key: "last_name", label: "שם משפחה", th: <SortHeader label="שם משפחה" field="last_name" sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable rows={records} getField={financeField} style={{ position: "sticky", right: `${stickyOffsets[0] ?? 0}px`, zIndex: 3 }} className="bg-muted" />, td: (r) => <span className="font-medium">{r.last_name || splitName(r.name).last || "—"}</span> },
    { key: "first_name", label: "שם", th: <SortHeader label="שם" field="first_name" sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable rows={records} getField={financeField} style={{ position: "sticky", right: `${stickyOffsets[1] ?? 0}px`, zIndex: 3 }} className="bg-muted" />, td: (r) => <span className="font-medium">{r.first_name || splitName(r.name).first}</span> },
  ];
  const freeCols = [
    ...(year === "all" ? [{ key: "year", label: "שנה", th: <SortHeader label="שנה" field="year" sort={sort} onSort={onSort} />, td: (r) => <span className="text-muted-foreground">{r.year}</span> }] : []),
    { key: "total_income", label: "הכנסות", th: <SortHeader label="הכנסות" field="total_income" sort={sort} onSort={onSort} />, td: (r) => trendSpan(r.total_income, (trendMap[r.id] || {}).income) },
    { key: "total_expenses", label: "הוצאות", th: <SortHeader label="הוצאות" field="total_expenses" sort={sort} onSort={onSort} />, td: (r) => trendSpan(r.total_expenses, (trendMap[r.id] || {}).expense) },
    { key: "total_debt", label: "חוב", th: <SortHeader label="חוב" field="total_debt" sort={sort} onSort={onSort} />, td: (r) => trendSpan(r.total_debt, (trendMap[r.id] || {}).debt) },
    { key: "monthly_repayment", label: "החזר חודשי", th: <SortHeader label="החזר חודשי" field="monthly_repayment" sort={sort} onSort={onSort} />, td: (r) => <span className="text-muted-foreground">{fmt(r.monthly_repayment)}</span> },
    { key: "children_count", label: "ילדים", th: <SortHeader label="ילדים" field="children_count" sort={sort} onSort={onSort} />, td: (r) => r.children_count || "—" },
    { key: "program_participation", label: "השתתף בתוכנית", th: <SortHeader label="השתתף בתוכנית" field="program_participation" sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable filterOptions={[{ value: "true", label: "כן" }, { value: "false", label: "לא" }]} />, td: (r) => r.program_participation ? <span className="text-emerald-600 font-medium">כן</span> : "—" },
    { key: "trend", label: "מגמה (אוט׳)", th: <th className="px-4 py-3 text-right text-xs text-muted-foreground font-medium">מגמה (אוט׳)</th>, td: (r) => { const ovr = trendMeta[(trendMap[r.id] || {}).overall || "new"]; const OIcon = ovr.icon; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 ring-inset ${ovr.cell}`}><OIcon className="w-3.5 h-3.5" /> {ovr.label}</span>; } },
  ];
  const orderedFree = [...colOrder.map((k) => freeCols.find((c) => c.key === k)).filter(Boolean), ...freeCols.filter((c) => !colOrder.includes(c.key))];
  const orderedCols = [...nameCols, ...orderedFree];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <LineChart className="w-7 h-7 text-primary" /> ניהול כלכלי של הקהילה
          </h1>
          <p className="text-muted-foreground mt-1">טבלה שנתית · העלאת נתונים, מעקב שיפור כלכלי ועריכה מלאה של כל משפחה</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportCsvButton allRows={records} filteredRows={view} columns={exportColumns} fileName="ניהול_כלכלי.csv" />
          <ColumnOrderButton columns={freeCols.map((c) => ({ key: c.key, label: c.label }))} order={colOrder} onOrderChange={setColOrder} defaultOrder={DEFAULT_FREE_ORDER} />
          <Button onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 ml-1" /> העלאת נתוני שנה</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-44">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="בחר שנה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל השנים</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-56">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם / תז / טלפון" className="pr-9" />
        </div>
        <div className="w-44">
          <Select value={trendFilter} onValueChange={setTrendFilter}>
            <SelectTrigger><SelectValue placeholder="מגמה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המגמות</SelectItem>
              <SelectItem value="improving">משתפר</SelectItem>
              <SelectItem value="declining">מחמיר</SelectItem>
              <SelectItem value="stable">יציב</SelectItem>
              <SelectItem value="new">חדש / אין נתון</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(impMeta).map(([key, m]) => {
          const Icon = m.icon;
          const active = trendFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTrendFilter((p) => (p === key ? "all" : key))}
              className={`text-right bg-card rounded-2xl border p-4 transition hover:shadow-md ${active ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-inset ${m.cls}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold mt-2">{stats[key] || 0}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">סה״כ הכנסות</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{fmt(totals.inc)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">סה״כ הוצאות</p>
          <p className="text-xl font-bold text-rose-700 mt-1">{fmt(totals.exp)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">סה״כ חובות</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{fmt(totals.debt)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : view.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
          אין נתונים עדיין. לחצו על "העלאת נתוני שנה" כדי להתחיל.
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted">
                <tr className="text-right text-xs text-muted-foreground">
                  {orderedCols.map((c) => <React.Fragment key={c.key}>{c.th}</React.Fragment>)}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.map((r) => (
                    <tr key={r.id} className="group hover:bg-secondary/40 transition cursor-pointer" onClick={() => openEdit(r)}>
                      {orderedCols.map((c) => {
                        const isName = c.key === "last_name" || c.key === "first_name";
                        const idx = c.key === "last_name" ? 0 : c.key === "first_name" ? 1 : -1;
                        return (
                          <td key={c.key} className={`px-4 py-3 ${isName ? "bg-card group-hover:bg-secondary/40" : ""}`} style={isName ? { position: "sticky", right: `${stickyOffsets[idx] ?? 0}px`, zIndex: 2, boxShadow: idx === 1 ? "-3px 0 4px rgba(0,0,0,0.07)" : undefined } : undefined} onClick={c.key === "trend" ? (e) => e.stopPropagation() : undefined}>
                            {c.td(r)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(r)} className="text-primary text-xs hover:underline">עריכה</button>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CommunityFinanceImport open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              עריכת נתוני משפחה
              <span className="text-sm font-normal text-muted-foreground">{detail?.name} · {detail?.year}</span>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-2">
              <Section title="פרטים אישיים">
                <EF label="שם מלא" k="name" v={form.name} setF={setF} />
                <EF label="תעודת זהות" k="id_number" v={form.id_number} setF={setF} />
                <EF label="טלפון" k="phone" v={form.phone} setF={setF} />
                <EF label="עיר" k="city" v={form.city} setF={setF} />
                <EF label="כתובת" k="address" v={form.address} setF={setF} />
                <EF label="עיסוק" k="occupation" v={form.occupation} setF={setF} />
                <EF label="מס׳ ילדים" k="children_count" v={form.children_count} setF={setF} numeric />
                <div className="space-y-1.5">
                  <Label>סטטוס שיפור כלכלי</Label>
                  <Select value={form.improving} onValueChange={(v) => setF("improving", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="improving">משתפר</SelectItem>
                      <SelectItem value="stable">יציב</SelectItem>
                      <SelectItem value="declining">מחמיר</SelectItem>
                      <SelectItem value="new">חדש / אין נתון קודם</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Section>

              <Section title="הכנסות (₪)">
                <EF label="הכנסה קבועה" k="fixed_income" v={form.fixed_income} setF={setF} numeric />
                <EF label="הכנסה ממקצבאות" k="installments_income" v={form.installments_income} setF={setF} numeric />
                <EF label='סה"כ הכנסות' k="total_income" v={form.total_income} setF={setF} numeric />
              </Section>

              <Section title="הוצאות (₪)">
                <EF label='שכ"ל' k="tuition_expense" v={form.tuition_expense} setF={setF} numeric />
                <EF label="חריגות ילדים" k="special_children_expense" v={form.special_children_expense} setF={setF} numeric />
                <EF label="דיור" k="rent_expense" v={form.rent_expense} setF={setF} numeric />
                <EF label='סה"כ הוצאות' k="total_expenses" v={form.total_expenses} setF={setF} numeric />
              </Section>

              <Section title="חובות (₪)">
                <EF label="סך חובות כללי" k="total_debt" v={form.total_debt} setF={setF} numeric />
                <EF label="סכום החזר חודשי" k="monthly_repayment" v={form.monthly_repayment} setF={setF} numeric />
              </Section>

              <div className="space-y-1.5">
                <Label>ממה נוצרו החובות</Label>
                <Textarea rows={2} value={form.debt_reason} onChange={(e) => setF("debt_reason", e.target.value)} />
              </div>

              {rawRows.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">נתוני השורה מהקובץ (קריאה בלבד)</p>
                  <div className="border border-border rounded-xl max-h-44 overflow-y-auto scrollbar-thin divide-y divide-border">
                    {rawRows.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="col-span-2 break-words">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
                <Button type="button" disabled={saving} onClick={save}><Save className="w-4 h-4 ml-1" /> {saving ? "שומר…" : "שמור שינויים"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function EF({ label, k, v, setF, numeric }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={numeric ? "number" : "text"}
        value={v ?? ""}
        onChange={(e) => setF(k, e.target.value)}
      />
    </div>
  );
}