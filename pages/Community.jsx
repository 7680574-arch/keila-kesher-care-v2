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
import { Contact, Plus, Search, Pencil, Trash2, Upload, Save, FilterX, FileText, Coins } from "lucide-react";
import CommunityImport from "@/components/CommunityImport";
import ExportCsvButton from "@/components/ExportCsvButton";
import CopyPhonesButton from "@/components/CopyPhonesButton";
import CopyIdsButton from "@/components/CopyIdsButton";
import ColumnOrderButton from "@/components/ColumnOrderButton";
import DownloadComparisonButton from "@/components/DownloadComparisonButton";
import SyncFormsToCommunityButton from "@/components/SyncFormsToCommunityButton";
import StickyScrollBar from "@/components/StickyScrollBar";
import ChildrenDetailsCell from "@/components/ChildrenDetailsCell";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import MemberFormsDialog from "@/components/forms/MemberFormsDialog";
import MemberDonationsDialog from "@/components/MemberDonationsDialog";
import { SortHeader, applyTable, useSort } from "@/components/dataTableUtils";
import { FORM_COLUMNS, FIN_KEYS, DEFAULT_FREE_ORDER, CHILD_KEY_RE } from "@/lib/communityFormColumns";
import { parseMemberChildren } from "@/lib/formFieldMap";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

const splitName = (name) => {
  const parts = (name || "").trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.length > 1 ? parts.slice(1).join(" ") : "" };
};

const emptyForm = {
  name: "", first_name: "", last_name: "", id_number: "", phone: "", mobile: "", email: "", birth_date: "", occupation: "",
  city: "", street: "", house_number: "", apartment: "", neighborhood: "", family_size: "", gender: "", box_status: "",
  spouse_name: "", spouse_id: "", spouse_phone: "", spouse_birth_date: "", spouse_occupation: "",
  father_last_name: "", father_first_name: "", father_mother_first_name: "", father_phone: "", father_city: "",
  mother_last_name: "", mother_first_name: "", mother_mother_first_name: "", mother_phone: "", mother_city: "",
  bank_name: "", bank_number: "", branch_number: "", account_number: "",
  children_count: "", children_json: "", notes: "",
};

export default function Community() {
  const [members, setMembers] = useState([]);
  const [fin, setFin] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fYear, setFYear] = useState("all");
  const [sort, onSort] = useSort("last_name", "asc");
  const [filters, setFilters] = useState({});
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formsConfig, setFormsConfig] = useState([]);
  const [memberForms, setMemberForms] = useState(null);
  const [memberDonations, setMemberDonations] = useState(null);
  const [colOrder, setColOrder, colHidden, setColHidden] = useColumnOrder("community_cols_v2", DEFAULT_FREE_ORDER);
  const [stickyOffsets, setStickyOffsets] = useState([]);
  const tableRef = useRef(null);
  const tableScrollRef = useRef(null);
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
  }, [members.length, colOrder.join(",")]);

  const [loadError, setLoadError] = useState(null);
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, f] = await Promise.all([
        base44.entities.CommunityMember.list("-created_date", 2000),
        base44.entities.CommunityFinance.list("-year", 3000).catch(() => []),
      ]);
      setMembers(m);
      setFin(f);
      if (fYear === "all" && f.length) {
        const latest = Array.from(new Set(f.map((x) => x.year).filter(Boolean))).sort().reverse()[0];
        setFYear(latest || "all");
      }
    } catch (e) {
      setLoadError(e?.message || "שגיאה בטעינת הנתונים");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    base44.entities.FormConfig.filter({}, { sort: "-created_date", limit: 200, fields: ["name", "tofes_id", "id_field", "titles"] }).then((r) => setFormsConfig(r.items || [])).catch(() => {});
  }, []);

  const years = useMemo(() => Array.from(new Set(fin.map((x) => x.year).filter(Boolean))).sort().reverse(), [fin]);
  const finMap = useMemo(() => {
    const map = {};
    for (const fr of fin) {
      const d = (fr.id_number || "").replace(/\D/g, "");
      if (d) map[`${d}|${fr.year}`] = fr;
    }
    return map;
  }, [fin]);

  const kidsFor = (m) => {
    const id = (m.id_number || "").replace(/\D/g, "");
    if (id) {
      if (fYear !== "all") {
        const fr = finMap[`${id}|${fYear}`];
        if (fr && fr.children_count != null) return fr.children_count;
      }
      const recs = fin.filter((f) => (f.id_number || "").replace(/\D/g, "") === id);
      if (recs.length) {
        recs.sort((a, b) => String(b.year || "").localeCompare(String(a.year || "")));
        if (recs[0].children_count != null) return recs[0].children_count;
      }
    }
    return m.children_count ?? "—";
  };

  const finFor = (m) => {
    const id = (m.id_number || "").replace(/\D/g, "");
    if (!id) return null;
    if (fYear !== "all") return finMap[`${id}|${fYear}`] || null;
    const recs = fin.filter((f) => (f.id_number || "").replace(/\D/g, "") === id);
    if (!recs.length) return null;
    recs.sort((a, b) => String(b.year || "").localeCompare(String(a.year || "")));
    return recs[0];
  };
  const finVal = (m, field) => {
    const fr = finFor(m);
    const v = fr ? fr[field] : null;
    return v == null || v === "" ? null : v;
  };

  const kidsById = useMemo(() => {
    const o = {};
    for (const m of members) o[m.id] = parseMemberChildren(m.children_json);
    return o;
  }, [members]);
  const childVal = (m, f) => {
    const [, i, k] = f.match(CHILD_KEY_RE);
    return kidsById[m.id]?.[Number(i) - 1]?.[k] || "";
  };

  const memberField = (m, f) =>
    f === "first_name" ? (m.first_name || splitName(m.name).first)
    : f === "last_name" ? (m.last_name || splitName(m.name).last)
    : f === "children_count" ? kidsFor(m)
    : FIN_KEYS.has(f) ? finVal(m, f)
    : CHILD_KEY_RE.test(f) ? childVal(m, f)
    : m[f];

  const searched = useMemo(() => {
    const q = search.trim();
    if (!q) return members;
    return members.filter((m) =>
      `${m.name || ""} ${m.id_number || ""} ${m.phone || ""} ${m.mobile || ""} ${m.city || ""} ${m.neighborhood || ""} ${m.occupation || ""}`.includes(q)
    );
  }, [members, search]);
  const view = useMemo(() => applyTable(searched, sort, filters, memberField), [searched, sort, filters, finMap, fin, fYear, kidsById]);

  const setFilter = (f, v) => setFilters((p) => ({ ...p, [f]: v }));
  const hasFilters = Object.values(filters).some((v) => Array.isArray(v) ? v.length > 0 : (v || "").trim());

  const openEdit = (m) => {
    setEditing(m || null);
    setForm(m ? { ...emptyForm, ...m, family_size: m.family_size ?? "", children_count: m.children_count ?? "" } : emptyForm);
    setDialogOpen(true);
  };
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const name = `${form.first_name || ""} ${form.last_name || ""}`.trim();
    if (!name) return;
    const payload = { ...form, name, family_size: form.family_size ? Number(form.family_size) : 0, children_count: form.children_count ? Number(form.children_count) : 0 };
    if (editing) await base44.entities.CommunityMember.update(editing.id, payload);
    else await base44.entities.CommunityMember.create(payload);
    setDialogOpen(false); setEditing(null); load();
  };
  const remove = async (m) => {
    if (!confirm(`מחיקת ${m.name} מרשימת הקהילה?`)) return;
    await base44.entities.CommunityMember.delete(m.id);
    load();
  };

  const dFin = editing ? finMap[`${(editing.id_number || "").replace(/\D/g, "")}|${fYear}`] : null;
  const children = useMemo(() => {
    try { return form.children_json ? JSON.parse(form.children_json) : []; }
    catch { return []; }
  }, [form.children_json]);

  const exportColumns = [
    { header: "שם משפחה", get: (m) => m.last_name || splitName(m.name).last },
    { header: "שם פרטי", get: (m) => m.first_name || splitName(m.name).first },
    { header: "תעודת זהות", get: (m) => m.id_number },
    { header: "נייד", get: (m) => m.mobile },
    { header: "אימייל", get: (m) => m.email },
    { header: "כתובת", get: (m) => [m.street, m.house_number].filter(Boolean).join(" ") },
    { header: "שכונה", get: (m) => m.neighborhood },
    { header: "מספר ילדים", get: (m) => kidsFor(m) },
    { header: "עיסוק", get: (m) => m.occupation },
    { header: "טלפון בן/בת זוג", get: (m) => m.spouse_phone },
    { header: "טלפון הורי הבעל", get: (m) => m.father_phone },
    { header: "טלפון הורי האשה", get: (m) => m.mother_phone },
  ];

  const nameCols = [
    { key: "last_name", label: "שם משפחה", th: <SortHeader label="שם משפחה" field="last_name" sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable rows={members} getField={memberField} style={{ position: "sticky", right: `${stickyOffsets[0] ?? 0}px`, zIndex: 3 }} className="bg-muted" />, td: (m) => <span className="font-medium">{m.last_name || splitName(m.name).last || "—"}</span> },
    { key: "first_name", label: "שם פרטי", th: <SortHeader label="שם" field="first_name" sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable rows={members} getField={memberField} style={{ position: "sticky", right: `${stickyOffsets[1] ?? 0}px`, zIndex: 3 }} className="bg-muted" />, td: (m) => <span className="font-medium">{m.first_name || splitName(m.name).first}</span> },
  ];
  const headerAction = (key) =>
    key === "id_number" ? <CopyIdsButton ids={view.map((m) => m.id_number)} />
    : key === "mobile" ? <CopyPhonesButton phones={view.map((m) => m.mobile)} />
    : undefined;
  const cellFor = (d, m) => {
    if (d.popup) return <ChildrenDetailsCell member={m} />;
    const v = memberField(m, d.key);
    if (v == null || v === "") return "—";
    return <span className={d.cls}>{d.money ? fmt(v) : v}</span>;
  };
  const freeCols = FORM_COLUMNS.map((d) => ({
    key: d.key,
    label: d.label,
    th: d.popup
      ? <th className="px-4 py-3 font-semibold align-top">{d.label}</th>
      : <SortHeader label={d.label} field={d.key} sort={sort} onSort={onSort} filter={filters} onFilter={setFilter} filterable={!d.noFilter} rows={members} getField={memberField} action={headerAction(d.key)} />,
    td: (m) => cellFor(d, m),
  }));
  const orderedFree = [...colOrder.map((k) => freeCols.find((c) => c.key === k)).filter(Boolean), ...freeCols.filter((c) => !colOrder.includes(c.key))].filter((c) => !colHidden.includes(c.key));
  const orderedCols = [...nameCols, ...orderedFree];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Contact className="w-7 h-7 text-primary" /> רשימת הקהילה
          </h1>
          <p className="text-muted-foreground mt-1">{members.length} חברים · המקור המרכזי לתיקים, חלוקות וניהול כלכלי</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportCsvButton allRows={members} filteredRows={view} columns={exportColumns} fileName="רשימת_הקהילה.csv" />
          <ColumnOrderButton columns={freeCols.map((c) => ({ key: c.key, label: c.label }))} order={colOrder} onOrderChange={setColOrder} defaultOrder={DEFAULT_FREE_ORDER} hidden={colHidden} onHiddenChange={setColHidden} />
          <DownloadComparisonButton />
          <SyncFormsToCommunityButton />
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="w-4 h-4 ml-1" /> העלאת קובץ</Button>
          <Button onClick={() => openEdit(null)}><Plus className="w-4 h-4 ml-1" /> הוסף חבר</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש כללי בכל השדות" className="pr-9" />
        </div>
        <div className="w-40">
          <Select value={fYear} onValueChange={setFYear}>
            <SelectTrigger><SelectValue placeholder="שנת נתונים" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ללא נתוני שנה</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>נתוני {y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}><FilterX className="w-4 h-4 ml-1" /> נקה סינון</Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : loadError ? (
        <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center">
          <p className="text-destructive font-medium">שגיאה בטעינת רשימת הקהילה</p>
          <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
          <Button variant="outline" className="mt-4" onClick={load}>נסה שוב</Button>
        </div>
      ) : view.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
          אין תוצאות. שנו את הסינון או העלו קובץ.
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border">
          <div ref={tableScrollRef} className="overflow-x-auto scrollbar-thin">
            <table ref={tableRef} className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted">
                <tr className="text-right text-xs text-muted-foreground">
                  {orderedCols.map((c) => <React.Fragment key={c.key}>{c.th}</React.Fragment>)}
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.map((m) => (
                  <tr key={m.id} className="group hover:bg-secondary/40 transition cursor-pointer" onClick={() => openEdit(m)}>
                    {orderedCols.map((c) => {
                      const isName = c.key === "last_name" || c.key === "first_name";
                      const idx = c.key === "last_name" ? 0 : c.key === "first_name" ? 1 : -1;
                      return (
                        <td key={c.key} className={`px-4 py-3 ${isName ? "bg-card group-hover:bg-secondary/40" : ""}`} style={isName ? { position: "sticky", right: `${stickyOffsets[idx] ?? 0}px`, zIndex: 2, boxShadow: idx === 1 ? "-3px 0 4px rgba(0,0,0,0.07)" : undefined } : undefined}>
                          {c.td(m)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setMemberForms(m)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary" title="טפסים"><FileText className="w-4 h-4" /></button>
                        <button onClick={() => setMemberDonations(m)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary" title="תרומות נדרים פלוס"><Coins className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary" title="עריכה"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove(m)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחיקה"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-t border-border">מציג {view.length} מתוך {members.length}</div>
          <StickyScrollBar targetRef={tableScrollRef} className="rounded-b-2xl border-t-0" />
        </div>
      )}

      <CommunityImport open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? "עריכת חבר קהילה" : "הוספת חבר קהילה"}
              {editing?.name && <span className="text-sm font-normal text-muted-foreground">· {editing.name}</span>}
              {editing?.id_number && <span className="text-sm font-normal text-muted-foreground">· {editing.id_number}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <Section title="פרטים אישיים">
              <EF label="שם משפחה *" k="last_name" v={form.last_name} setF={setF} />
              <EF label="שם פרטי" k="first_name" v={form.first_name} setF={setF} />
              <EF label="תעודת זהות" k="id_number" v={form.id_number} setF={setF} />
              <EF label="נייד" k="mobile" v={form.mobile} setF={setF} />
              <EF label="טלפון קווי" k="phone" v={form.phone} setF={setF} />
              <EF label="אימייל" k="email" v={form.email} setF={setF} />
              <EF label="תאריך לידה" k="birth_date" v={form.birth_date} setF={setF} type="date" />
              <EF label="עיסוק" k="occupation" v={form.occupation} setF={setF} />
              <div className="space-y-1.5">
                <Label className="text-xs">מגדר</Label>
                <Select value={form.gender || ""} onValueChange={(v) => setF("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">זכר</SelectItem>
                    <SelectItem value="female">נקבה</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">סטטוס קופה</Label>
                <Select value={form.box_status || ""} onValueChange={(v) => setF("box_status", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has">יש קופה</SelectItem>
                    <SelectItem value="wants">רוצה קופה</SelectItem>
                    <SelectItem value="no">אין קופה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Section>
            <Section title="כתובת">
              <EF label="עיר" k="city" v={form.city} setF={setF} />
              <EF label="שכונה" k="neighborhood" v={form.neighborhood} setF={setF} />
              <EF label="רחוב" k="street" v={form.street} setF={setF} />
              <EF label="מספר בית" k="house_number" v={form.house_number} setF={setF} />
              <EF label="דירה" k="apartment" v={form.apartment} setF={setF} />
            </Section>
            <Section title="בן / בת זוג">
              <EF label="שם" k="spouse_name" v={form.spouse_name} setF={setF} />
              <EF label="ת.ז." k="spouse_id" v={form.spouse_id} setF={setF} />
              <EF label="טלפון" k="spouse_phone" v={form.spouse_phone} setF={setF} />
              <EF label="תאריך לידה" k="spouse_birth_date" v={form.spouse_birth_date} setF={setF} type="date" />
              <EF label="עיסוק" k="spouse_occupation" v={form.spouse_occupation} setF={setF} />
            </Section>
            <Section title="הורים">
              <EF label="הורי הבעל - שם משפחה" k="father_last_name" v={form.father_last_name} setF={setF} />
              <EF label="הורי הבעל - שם פרטי אב" k="father_first_name" v={form.father_first_name} setF={setF} />
              <EF label="הורי הבעל - שם פרטי אם" k="father_mother_first_name" v={form.father_mother_first_name} setF={setF} />
              <EF label="הורי הבעל - טלפון" k="father_phone" v={form.father_phone} setF={setF} />
              <EF label="הורי הבעל - עיר" k="father_city" v={form.father_city} setF={setF} />
              <EF label="הורי האשה - שם משפחה" k="mother_last_name" v={form.mother_last_name} setF={setF} />
              <EF label="הורי האשה - שם פרטי אב" k="mother_first_name" v={form.mother_first_name} setF={setF} />
              <EF label="הורי האשה - שם פרטי אם" k="mother_mother_first_name" v={form.mother_mother_first_name} setF={setF} />
              <EF label="הורי האשה - טלפון" k="mother_phone" v={form.mother_phone} setF={setF} />
              <EF label="הורי האשה - עיר" k="mother_city" v={form.mother_city} setF={setF} />
            </Section>
            <Section title="פרטי בנק">
              <EF label="שם בנק" k="bank_name" v={form.bank_name} setF={setF} />
              <EF label="מספר בנק" k="bank_number" v={form.bank_number} setF={setF} />
              <EF label="מספר סניף" k="branch_number" v={form.branch_number} setF={setF} />
              <EF label="מספר חשבון" k="account_number" v={form.account_number} setF={setF} />
            </Section>
            <Section title="משפחה">
              <EF label="מספר נפשות" k="family_size" v={form.family_size} setF={setF} numeric />
              <EF label="מספר ילדים" k="children_count" v={form.children_count} setF={setF} numeric />
            </Section>
            {children.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">פרטי ילדים ({children.length})</p>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr className="text-right"><th className="px-3 py-2 font-semibold">שם</th><th className="px-3 py-2 font-semibold">ת.ז.</th><th className="px-3 py-2 font-semibold">ת. לידה</th><th className="px-3 py-2 font-semibold">מגדר</th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {children.map((c, i) => (
                        <tr key={i}><td className="px-3 py-1.5">{c.name}</td><td className="px-3 py-1.5 text-muted-foreground">{c.id_number || "—"}</td><td className="px-3 py-1.5 text-muted-foreground">{c.birth_date || "—"}</td><td className="px-3 py-1.5">{c.gender || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {dFin && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">נתונים כספיים · {dFin.year} (נערך בעמוד הניהול הכלכלי)</p>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">הכנסות</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <FinBox label="מלגה / הכנסה אישית" value={dFin.personal_scholarship} />
                    <FinBox label="מלגה / הכנסה בת זוג" value={dFin.spouse_scholarship} />
                    <FinBox label="הכנסה קבועה" value={dFin.fixed_income} />
                    <FinBox label="הכנסה ממקצבאות" value={dFin.installments_income} />
                    <FinBox label='סה"כ הכנסות' value={dFin.total_income} cls="text-emerald-700" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">הוצאות</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <FinBox label='הוצאות מטפלות שכ"ל' value={dFin.tuition_expense} />
                    <FinBox label="הוצאות חריגות ילדים" value={dFin.special_children_expense} />
                    <FinBox label="הוצאות דיור" value={dFin.rent_expense} />
                    <FinBox label='סה"כ הוצאות' value={dFin.total_expenses} cls="text-rose-700" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">חובות וסיכום</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <FinBox label="סך חובות כללי" value={dFin.total_debt} cls="text-amber-700" />
                    <FinBox label="סכום החזר חודשי" value={dFin.monthly_repayment} />
                    <div className="bg-secondary/50 rounded-lg p-2">
                      <p className="text-muted-foreground">ממה נוצרו החובות?</p>
                      <p className="font-semibold mt-0.5 text-xs whitespace-normal">{dFin.debt_reason || "—"}</p>
                    </div>
                    <FinBox label="שיפור כלכלי" value={dFin.improving ? ({ improving: "משתפר", stable: "יציב", declining: "מידרדר", new: "חדש" }[dFin.improving] || dFin.improving) : null} />
                    <FinBox label="משתתף בתכנית" value={dFin.program_participation ? "כן" : "לא"} />
                  </div>
                </div>
                {(() => {
                  const inc = Number(dFin.total_income) || 0;
                  const exp = Number(dFin.total_expenses) || 0;
                  const kids = Number(dFin.children_count ?? editing?.children_count ?? 0) || 0;
                  const persons = kids + 2;
                  const free = persons > 0 ? (inc - exp) / persons : 0;
                  return (
                    <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
                      <p className="text-xs text-primary font-semibold">סה"כ הכנסה פנויה לנפש</p>
                      <p className="text-lg font-bold text-primary mt-0.5">{fmt(free)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">(הכנסות − הוצאות) ÷ {persons} נפשות (ילדים + 2 הורים)</p>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setF("notes", e.target.value)} />
            </div>
            {editing?.form_update_date && (
              <p className="text-xs text-muted-foreground">תאריך עדכון בטופס: {editing.form_update_date}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button" onClick={() => setEditing(null)}>ביטול</Button></DialogClose>
            <Button type="button" disabled={!(form.first_name?.trim() || form.last_name?.trim())} onClick={save}><Save className="w-4 h-4 ml-1" /> שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberFormsDialog open={!!memberForms} onOpenChange={(o) => !o && setMemberForms(null)} member={memberForms} forms={formsConfig} />
      <MemberDonationsDialog open={!!memberDonations} onOpenChange={(o) => !o && setMemberDonations(null)} member={memberDonations} />
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

function EF({ label, k, v, setF, numeric, type, className }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label className="text-xs">{label}</Label>
      <Input type={type || (numeric ? "number" : "text")} value={v ?? ""} onChange={(e) => setF(k, e.target.value)} />
    </div>
  );
}

function FinBox({ label, value, cls }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold mt-0.5 ${cls || ""}`}>{fmt(value)}</p>
    </div>
  );
}