import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Download, Check, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import DataTable from "@/components/DataTable";
import { useMembersMap, enrichRows } from "@/hooks/useMembersMap";

const PAY = { cash: "מזומן", check: "המחאה", transfer: "העברה", card: "אשראי", other: "אחר" };
const PAY_OPTIONS = Object.entries(PAY).map(([value, label]) => ({ value, label }));
const SOURCE_LABELS = { manual: "ידני", event: "אירוע", imported: "ייבוא מאירוע" };
const SOURCE_OPTIONS = [
  { value: "event", label: "אירוע" },
  { value: "manual", label: "ידני" },
  { value: "imported", label: "ייבוא מאירוע" },
];
const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function DonationsCampaign() {
  const { toast } = useToast();
  const { members, map: memberMap } = useMembersMap();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [neighborhood, setNeighborhood] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const inputsRef = useRef({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ds] = await Promise.all([
          base44.entities.Donation.list("-date", 5000),
        ]);
        setDonations(ds);
      } catch (e) {
        toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (campaign) return;
    const d = new Date();
    const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    setCampaign(`קמפיין תרומות - ${months[d.getMonth()]} ${d.getFullYear()}`);
  }, []);

  const campaigns = useMemo(() => Array.from(new Set(donations.map((d) => d.campaign).filter(Boolean))).sort(), [donations]);
  const neighborhoods = useMemo(() => { const s = new Set(); members.forEach((m) => m.neighborhood && s.add(m.neighborhood)); return Array.from(s).sort(); }, [members]);
  const filteredMembers = useMemo(() => {
    if (neighborhood === "all") return members;
    return members.filter((m) => m.neighborhood === neighborhood);
  }, [members, neighborhood]);
  const campDons = useMemo(() => donations.filter((d) => d.campaign === campaign), [donations, campaign]);
  const campDonsDisplay = useMemo(() => enrichRows(campDons, memberMap), [campDons, memberMap]);
  const byMember = useMemo(() => { const map = {}; campDons.forEach((d) => { map[d.member_id] = (map[d.member_id] || 0) + (d.amount || 0); }); return map; }, [campDons]);
  const total = useMemo(() => campDons.reduce((s, d) => s + (d.amount || 0), 0), [campDons]);
  const count = campDons.length;

  const setDraft = (mid, patch) => setDrafts((d) => ({ ...d, [mid]: { ...d[mid], ...patch } }));
  const focusNext = (cur) => { const idx = filteredMembers.findIndex((m) => m.id === cur); const n = filteredMembers[idx + 1]; if (n) inputsRef.current[n.id]?.focus(); };

  const donate = async (m) => {
    const d = drafts[m.id] || {};
    const amount = Number(d.amount);
    if (!amount || amount <= 0) { toast({ title: "נא להזין סכום", variant: "destructive" }); inputsRef.current[m.id]?.focus(); return; }
    setSaving(m.id);
    try {
      const rec = await base44.entities.Donation.create({
        campaign, member_id: m.id, name: m.name, first_name: m.first_name, last_name: m.last_name, id_number: m.id_number,
        amount, date, payment_method: d.method || "cash", receipt_number: d.receipt || "", source: "manual", notes: "",
      });
      setDonations((c) => [rec, ...c]);
      setDrafts((dd) => ({ ...dd, [m.id]: { ...dd[m.id], amount: "", receipt: "" } }));
      toast({ title: "התרומה נרשמה", description: `${m.first_name || ""} ${m.last_name || ""} · ₪${fmt(amount)}` });
      focusNext(m.id);
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeDon = async (d) => {
    if (!confirm(`למחוק תרומה של ₪${fmt(d.amount)} מ-${d.name}?`)) return;
    try { await base44.entities.Donation.delete(d.id); setDonations((l) => l.filter((x) => x.id !== d.id)); }
    catch (e) { toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" }); }
  };

  const exportCsv = () => {
    const rows = [["שם משפחה", "שם פרטי", "ת.ז.", "סכום", "אמצעי", "קבלה", "תאריך", "מקור"], ...campDonsDisplay.map((d) => [d.last_name || "", d.first_name || "", d.id_number || "", d.amount || 0, PAY[d.payment_method] || "", d.receipt_number || "", d.date || "", SOURCE_LABELS[d.source] || d.source || ""])];
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `תרומות_${campaign}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const memberSearchFields = ["name", "first_name", "last_name", "id_number", "phone", "mobile", "street", "neighborhood"];

  const memberColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (m) => m.last_name || "" },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (m) => m.first_name || "" },
    { key: "mobile", header: "נייד", field: "mobile", filterable: true, headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell text-muted-foreground", render: (m) => m.mobile || "—" },
    { key: "address", header: "כתובת", field: "street", filterable: true, headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell text-muted-foreground", render: (m) => [m.street, m.house_number].filter(Boolean).join(" ") || "—" },
    { key: "donated", header: "תרם בקמפיין", field: (m) => byMember[m.id] || 0, render: (m) => {
      const donated = byMember[m.id] || 0;
      return donated > 0 ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> ₪{fmt(donated)}</span> : <span className="text-muted-foreground">—</span>;
    } },
    { key: "amount", header: "סכום תרומה", render: (m) => (
      <Input
        ref={(el) => (inputsRef.current[m.id] = el)}
        type="number"
        inputMode="decimal"
        value={(drafts[m.id] || {}).amount || ""}
        onChange={(e) => setDraft(m.id, { amount: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); donate(m); } }}
        placeholder="₪"
        className="w-24 h-8"
        disabled={saving === m.id}
      />
    ) },
    { key: "method", header: "אמצעי", render: (m) => (
      <Select value={(drafts[m.id] || {}).method || "cash"} onValueChange={(v) => setDraft(m.id, { method: v })}>
        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(PAY).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select>
    ), headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
    { key: "receipt", header: "קבלה", render: (m) => (
      <Input
        value={(drafts[m.id] || {}).receipt || ""}
        onChange={(e) => setDraft(m.id, { receipt: e.target.value })}
        placeholder="מס' קבלה"
        className="w-24 h-8 text-xs"
        disabled={saving === m.id}
      />
    ), headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell" },
    { key: "action", header: "", render: (m) => (
      <Button size="sm" onClick={() => donate(m)} disabled={saving === m.id || !(drafts[m.id] || {}).amount} className="h-8">
        {saving === m.id ? "..." : "תרום"}
      </Button>
    ) },
  ];

  const donColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (d) => d.last_name || "" },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (d) => d.first_name || "" },
    { key: "amount", header: "סכום", field: "amount", render: (d) => <span className="font-semibold text-emerald-600">₪{fmt(d.amount)}</span> },
    { key: "method", header: "אמצעי", field: "payment_method", filterable: true, filterOptions: PAY_OPTIONS, headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell text-muted-foreground", render: (d) => PAY[d.payment_method] || d.payment_method || "—" },
    { key: "receipt", header: "קבלה", field: "receipt_number", filterable: true, headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell text-muted-foreground", render: (d) => d.receipt_number || "—" },
    { key: "date", header: "תאריך", field: "date", headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell text-muted-foreground", render: (d) => d.date || "—" },
    { key: "source", header: "מקור", field: "source", filterable: true, filterOptions: SOURCE_OPTIONS, headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell text-muted-foreground", render: (d) => SOURCE_LABELS[d.source] || d.source || "—" },
    { key: "action", header: "", render: (d) => (
      <Button size="icon" variant="ghost" onClick={() => removeDon(d)} className="h-7 w-7 text-destructive hover:text-destructive">
        <Trash2 className="w-4 h-4" />
      </Button>
    ) },
  ];

  const neighborhoodToolbar = (
    <Select value={neighborhood} onValueChange={setNeighborhood}>
      <SelectTrigger className="w-44"><Filter className="w-4 h-4 ml-1" /><SelectValue placeholder="שכונה" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">כל השכונות</SelectItem>
        {neighborhoods.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 grid md:grid-cols-4 gap-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label>שם קמפיין</Label>
          <Input list="campaign-list" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="בחר קמפיין קיים או הקלד חדש" />
          <datalist id="campaign-list">{campaigns.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <Label>תאריך ברירת מחדל</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end gap-1">
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
            <p className="text-xs text-rose-700">סה"כ התרומות בקמפיין</p>
            <p className="text-xl font-bold text-rose-700">₪{fmt(total)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{count} תרומות · {new Set(campDons.map((d) => d.member_id)).size} תורמים</p>
        </div>
      </div>

      <DataTable
        rows={filteredMembers}
        columns={memberColumns}
        stickyColumns={2}
        loading={loading}
        emptyMessage="לא נמצאו חברים"
        searchPlaceholder="חיפוש לפי שם / ת.ז. / טלפון / כתובת..."
        searchFields={memberSearchFields}
        toolbar={
          <>
            {neighborhoodToolbar}
            <Button variant="outline" onClick={exportCsv} disabled={count === 0}><Download className="w-4 h-4" /> ייצוא ({count})</Button>
          </>
        }
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">תרומות בקמפיין: {campaign}</h2>
          <span className="text-sm text-muted-foreground">{count} רשומות · ₪{fmt(total)}</span>
        </div>
        <DataTable
          rows={campDonsDisplay}
          columns={donColumns}
          stickyColumns={2}
          emptyMessage="עדיין אין תרומות בקמפיין זה"
          searchPlaceholder="חיפוש בתרומות..."
          searchFields={["name", "first_name", "last_name", "id_number", "receipt_number"]}
          pageSize={50}
          initialSort={{ field: "date", dir: "desc" }}
        />
      </div>
    </div>
  );
}