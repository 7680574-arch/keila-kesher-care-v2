import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Download, Trash2, Check, Import, Printer } from "lucide-react";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
import DataTable from "@/components/DataTable";
import CopyPhonesButton from "@/components/CopyPhonesButton";
import { useMembersMap } from "@/hooks/useMembersMap";

const PAY = { cash: "מזומן", check: "המחאה", transfer: "העברה", card: "אשראי", other: "אחר" };
const PAY_OPTIONS = Object.entries(PAY).map(([value, label]) => ({ value, label }));
const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function CommunityEventDonations({ event }) {
  const { toast } = useToast();
  const { members } = useMembersMap();
  const [invitees, setInvitees] = useState([]);
  const [donations, setDonations] = useState([]);
  const [linkedDonations, setLinkedDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [processedMembers, setProcessedMembers] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputsRef = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const linkedId = event.linked_event_id;
      const [inv, don, ld] = await Promise.all([
        linkedId ? base44.entities.FundraisingInvitee.filter({ event_id: linkedId }, "-created_date", 5000) : Promise.resolve([]),
        base44.entities.Donation.filter({ event_id: event.id }, "-date", 5000),
        linkedId ? base44.entities.Donation.filter({ event_id: linkedId }, "-date", 5000) : Promise.resolve([]),
      ]);
      setInvitees(inv); setDonations(don); setLinkedDonations(ld);
    } catch (e) {
      toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [event.id]);

  const invitedIds = useMemo(() => new Set(invitees.map((i) => i.member_id).filter(Boolean)), [invitees]);
  const donByMember = useMemo(() => { const m = {}; donations.forEach((d) => { if (d.member_id && !m[d.member_id]) m[d.member_id] = d; }); return m; }, [donations]);
  const total = useMemo(() => donations.reduce((s, d) => s + (d.amount || 0), 0), [donations]);
  const importCandidates = useMemo(() => {
    const existing = new Set(donations.map((d) => d.member_id).filter(Boolean));
    return linkedDonations.filter((d) => d.member_id && !existing.has(d.member_id));
  }, [linkedDonations, donations]);
  const importTotal = useMemo(() => importCandidates.reduce((s, d) => s + (d.paid_amount || 0), 0), [importCandidates]);
  const importedDonations = useMemo(() => donations.filter((d) => d.source === "imported" && d.event_id === event.id), [donations, event.id]);

  const undoImport = async () => {
    if (!confirm(`למחוק את כל ${importedDonations.length} התרומות שיובאו מהאירוע?`)) return;
    try {
      await base44.entities.Donation.deleteMany({ source: "imported", event_id: event.id });
      setDonations((list) => list.filter((d) => !(d.source === "imported" && d.event_id === event.id)));
      toast({ title: `נמחקו ${importedDonations.length} תרומות מיובאות` });
    } catch (e) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    }
  };

  const doImport = async () => {
    if (importCandidates.length === 0) { setImportOpen(false); return; }
    setImporting(true);
    try {
      const recs = importCandidates.map((d) => {
        const paid = d.paid_amount || 0;
        const pledge = d.amount || 0;
        const partial = paid > 0 && paid < pledge;
        return {
          campaign: event.title, member_id: d.member_id, name: d.name, first_name: d.first_name, last_name: d.last_name, id_number: d.id_number,
          amount: paid, paid_amount: paid, payment_status: paid > 0 ? "paid" : "unpaid",
          date: d.date || event.date || new Date().toISOString().slice(0, 10),
          payment_method: d.payment_method || "cash", receipt_number: d.receipt_number || "",
          source: "imported", event_id: event.id, notes: partial ? "חלקי" : "",
        };
      });
      const created = await base44.entities.Donation.bulkCreate(recs);
      const createdCount = Array.isArray(created) ? created.length : 0;
      setDonations((c) => [...(Array.isArray(created) ? created : []), ...c]);
      toast({ title: `יובאו ${createdCount} תרומות לפי סכום בפועל` });
      setImportOpen(false);
    } catch (e) {
      toast({ title: "שגיאה בייבוא", description: e.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const setDraft = (mid, patch) => setDrafts((d) => ({ ...d, [mid]: { ...d[mid], ...patch } }));

  const donate = async (m) => {
    const d = drafts[m.id] || {};
    const amount = Number(d.amount);
    if (!amount || amount <= 0) { toast({ title: "נא להזין סכום", variant: "destructive" }); inputsRef.current[m.id]?.focus(); return; }
    setSaving(m.id);
    try {
      const existing = donByMember[m.id];
      const notes = d.notes != null ? d.notes : (existing?.notes || "");
      const method = d.method || existing?.payment_method || "card";
      let rec;
      if (existing) {
        rec = await base44.entities.Donation.update(existing.id, { amount, payment_method: method, notes });
      } else {
        rec = await base44.entities.Donation.create({
          campaign: event.title, member_id: m.id, name: m.name, first_name: m.first_name, last_name: m.last_name, id_number: m.id_number,
          amount, date: event.date || new Date().toISOString().slice(0, 10), payment_method: method, receipt_number: "",
          source: "event", event_id: event.id, paid_amount: 0, payment_status: "unpaid", notes,
        });
      }
      setDonations((c) => [rec, ...c.filter((x) => x.id !== rec.id)]);
      setDrafts((dd) => ({ ...dd, [m.id]: { ...dd[m.id], amount: "" } }));
      toast({ title: "התרומה נשמרה", description: `${m.first_name || ""} ${m.last_name || ""} · ₪${fmt(amount)}` });
    } catch (e) { toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" }); }
    finally { setSaving(null); }
  };

  const removeDon = async (d) => {
    if (!confirm(`למחוק תרומה של ₪${fmt(d.amount)} מ-${d.name}?`)) return;
    try { await base44.entities.Donation.delete(d.id); setDonations((l) => l.filter((x) => x.id !== d.id)); }
    catch (e) { toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" }); }
  };

  const exportCsv = () => {
    const rows = [["שם משפחה", "שם פרטי", "ת.ז.", "נייד", "מוזמן", "סכום", "אמצעי", "הערות", "תאריך"],
      ...members.map((m) => {
        const don = donByMember[m.id];
        return [m.last_name || "", m.first_name || "", m.id_number || "", m.mobile || "", invitedIds.has(m.id) ? "כן" : "", don?.amount || 0, PAY[don?.payment_method] || "", don?.notes || "", don?.date || ""];
      })];
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `${(event.title || "קמפיין").replace(/[\\/]/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const printList = () => {
    const sorted = [...members].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "", "he") || (a.first_name || "").localeCompare(b.first_name || "", "he"));
    const body = sorted.map((m) => {
      const don = donByMember[m.id];
      const invited = invitedIds.has(m.id);
      const amountCell = invited ? '<span class="inv">תרם באירוע</span>' : (don?.amount ? `₪${fmt(don.amount)}` : "");
      return `<tr>
        <td>${esc(m.last_name)}</td>
        <td>${esc(m.first_name)}</td>
        <td>${esc(m.mobile || "")}</td>
        <td class="amt">${amountCell}</td>
        <td></td>
        <td></td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${esc(event.title)} - רשימת תרומות</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Heebo', Arial, sans-serif; color: #1e293b; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { font-size: 12px; color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  thead { display: table-header-group; }
  th { background: #1e3a5f; color: #fff; padding: 4px 8px; text-align: right; border: 1px solid #1e3a5f; font-weight: 600; }
  td { padding: 2px 8px; border: 1px solid #cbd5e1; height: 20px; line-height: 20px; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #eef2f7; }
  tbody tr:nth-child(odd) { background: #ffffff; }
  .amt { text-align: center; font-weight: 700; }
  .inv { color: #b45309; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(event.title)} — רשימת תרומות</h1>
<div class="sub">${esc(event.date || "")} · ${members.length} חברים</div>
<table>
  <thead><tr><th>שם משפחה</th><th>שם פרטי</th><th>נייד</th><th>סכום תרומה</th><th>אמצעי</th><th>הערות</th></tr></thead>
  <tbody>${body}</tbody>
</table>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "נא לאפשר חלונות קופצים להדפסה", variant: "destructive" }); return; }
    w.document.write(html); w.document.close();
  };

  const memberColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (m) => m.last_name || "" },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (m) => m.first_name || "" },
    { key: "mobile", header: "נייד", field: "mobile", filterable: true, headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell text-muted-foreground", render: (m) => m.mobile || "—" },
    { key: "address", header: "כתובת", field: "street", filterable: true, headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell text-muted-foreground", render: (m) => [m.street, m.house_number].filter(Boolean).join(" ") || "—" },
    { key: "donated", header: "תרם באירוע", field: (m) => (donByMember[m.id]?.amount ? "yes" : "no"), filterable: true, filterOptions: [{ value: "yes", label: "תרם" }, { value: "no", label: "לא תרם" }], render: (m) => {
      const don = donByMember[m.id];
      return don?.amount ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> ₪{fmt(don.amount)}</span> : <span className="text-muted-foreground">—</span>;
    } },
    { key: "amount", header: "סכום תרומה", render: (m) => (
      <Input ref={(el) => (inputsRef.current[m.id] = el)} type="number" inputMode="decimal" value={(drafts[m.id] || {}).amount || ""} onChange={(e) => setDraft(m.id, { amount: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); donate(m); } }} placeholder="₪" className="w-24 h-8" disabled={saving === m.id} />
    ) },
    { key: "method", header: "אמצעי", field: (m) => donByMember[m.id]?.payment_method || "", filterable: true, filterOptions: PAY_OPTIONS, render: (m) => (
      <Select value={(drafts[m.id] || {}).method || donByMember[m.id]?.payment_method || "card"} onValueChange={(v) => setDraft(m.id, { method: v })}>
        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(PAY).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select>
    ), headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
    { key: "notes", header: "הערות", field: (m) => ((drafts[m.id] || {}).notes != null ? (drafts[m.id] || {}).notes : (donByMember[m.id]?.notes || "")) || "", filterable: true, render: (m) => (
      <Input value={(drafts[m.id] || {}).notes != null ? (drafts[m.id] || {}).notes : (donByMember[m.id]?.notes || "")} onChange={(e) => setDraft(m.id, { notes: e.target.value })} placeholder="הערות" className="w-32 h-8 text-xs" disabled={saving === m.id} />
    ) },
    { key: "action", header: "", render: (m) => (
      <Button size="sm" onClick={() => donate(m)} disabled={saving === m.id || !(drafts[m.id] || {}).amount} className="h-8">{saving === m.id ? "..." : "תרום"}</Button>
    ) },
  ];

  const donColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (d) => d.last_name || "" },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (d) => d.first_name || "" },
    { key: "amount", header: "סכום", field: "amount", filterable: true, render: (d) => <span className="font-semibold text-emerald-600">₪{fmt(d.amount)}</span> },
    { key: "method", header: "אמצעי", field: "payment_method", filterable: true, filterOptions: PAY_OPTIONS, render: (d) => PAY[d.payment_method] || "—" },
    { key: "notes", header: "הערות", field: "notes", filterable: true, render: (d) => d.notes || "—" },
    { key: "date", header: "תאריך", field: "date", filterable: true, render: (d) => d.date || "—" },
    { key: "action", header: "", render: (d) => (
      <Button size="icon" variant="ghost" onClick={() => removeDon(d)} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
    ) },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2"><p className="text-xs text-rose-700">סה"כ תרומות</p><p className="text-xl font-bold text-rose-700">₪{fmt(total)}</p></div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2"><p className="text-xs text-blue-700">מוזמנים</p><p className="text-xl font-bold text-blue-700">{invitedIds.size}</p></div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2"><p className="text-xs text-emerald-700">תורמים</p><p className="text-xl font-bold text-emerald-700">{donations.length}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {event.linked_event_id && (
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={importCandidates.length === 0}>
              <Import className="w-4 h-4" /> ייבוא תרומות מהאירוע ({importCandidates.length})
            </Button>
          )}
          {event.linked_event_id && importedDonations.length > 0 && (
            <Button variant="outline" onClick={undoImport} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" /> ביטול ייבוא ({importedDonations.length})
            </Button>
          )}
          <Button variant="outline" onClick={printList} disabled={members.length === 0}><Printer className="w-4 h-4" /> הדפסת רשימה</Button>
          <Button variant="outline" onClick={exportCsv} disabled={members.length === 0}><Download className="w-4 h-4" /> ייצוא</Button>
        </div>
      </div>

      <DataTable
        rows={members}
        columns={memberColumns}
        loading={loading}
        emptyMessage="לא נמצאו חברים"
        searchPlaceholder="חיפוש חבר קהילה..."
        searchFields={["name", "first_name", "last_name", "id_number", "phone", "mobile", "street", "neighborhood"]}
        pageSize={100000}
        onProcessedRows={setProcessedMembers}
        toolbar={<CopyPhonesButton phones={processedMembers.map((m) => m.mobile)} />}
        rowClassName={(m) => (invitedIds.has(m.id) ? "bg-blue-100" : undefined)}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ייבוא תרומות מהאירוע המקושר</DialogTitle></DialogHeader>
          {importCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">כל התורמים מהאירוע כבר נמצאים בקמפיין.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                יובאו <span className="font-semibold text-foreground">{importCandidates.length}</span> תרומות לפי הסכום ששולם בפועל, בסכום כולל של <span className="font-semibold text-foreground">₪{fmt(importTotal)}</span>. תרומה חלקית תסומן בהערה "חלקי".
              </p>
              <div className="max-h-64 overflow-y-auto scrollbar-thin border rounded-lg divide-y">
                {importCandidates.map((d) => {
                  const paid = d.paid_amount || 0;
                  const partial = paid > 0 && paid < (d.amount || 0);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">{d.last_name || ""} {d.first_name || ""}</span>
                      <span className="text-muted-foreground">₪{fmt(paid)}{partial ? " · חלקי" : (paid === 0 ? " · לא שולם" : "")}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>ביטול</Button>
            <Button onClick={doImport} disabled={importing || importCandidates.length === 0}>
              {importing ? "מייבא..." : `ייבוא ${importCandidates.length} תרומות`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}