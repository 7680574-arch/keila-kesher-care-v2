import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight, Plus, Search, Check, Trash2, Download, Pencil, Users, Coins, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import FundraisingEventFormDialog from "@/components/FundraisingEventFormDialog";
import CommunityEventDonations from "@/components/CommunityEventDonations";
import { cn } from "@/lib/utils";
import DataTable from "@/components/DataTable";
import { useMembersMap, enrichRows } from "@/hooks/useMembersMap";

const PAY = { cash: "מזומן", check: "המחאה", transfer: "העברה", card: "אשראי", other: "אחר" };
const PAY_STATUS = { unpaid: "לא שולם", partial: "שולם חלקית", paid: "שולם" };
const PAY_STATUS_COLOR = { unpaid: "bg-red-100 text-red-700", partial: "bg-amber-100 text-amber-700", paid: "bg-emerald-100 text-emerald-700" };
const ISTATUS = { invited: "מוזמן", confirmed: "אישר", donated: "תרם", no_show: "לא הגיע" };
const ISTATUS_COLOR = {
  invited: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-100 text-blue-700",
  donated: "bg-emerald-100 text-emerald-700",
  no_show: "bg-rose-100 text-rose-700",
};
const ESTATUS = { planning: "תכנון", active: "פעיל", completed: "הושלם" };
const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");
const parseArr = (s) => { if (Array.isArray(s)) return s; if (!s) return []; try { return JSON.parse(s); } catch { return []; } };

export default function FundraisingEventDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [event, setEvent] = useState(null);
  const [invitees, setInvitees] = useState([]);
  const [donations, setDonations] = useState([]);
  const { members, map: memberMap } = useMembersMap();
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [newTask, setNewTask] = useState("");
  const [hideTasks, setHideTasks] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ev, inv, don] = await Promise.all([
        base44.entities.FundraisingEvent.get(id),
        base44.entities.FundraisingInvitee.filter({ event_id: id }, "-last_name", 5000),
        base44.entities.Donation.filter({ event_id: id }, "-date", 5000),
      ]);
      setEvent(ev); setInvitees(inv); setDonations(don);
    } catch (e) {
      toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);

  const tasks = useMemo(() => parseArr(event?.tasks), [event]);
  const enrichedInvitees = useMemo(() => enrichRows(invitees, memberMap), [invitees, memberMap]);
  const filteredInvitees = useMemo(() => {
    let list = enrichedInvitees;
    if (taskFilter === "doneAll") list = list.filter((i) => tasks.length > 0 && parseArr(i.tasks_done).length === tasks.length);
    else if (taskFilter === "doneNone") list = list.filter((i) => parseArr(i.tasks_done).length === 0);
    return list;
  }, [invitees, taskFilter, tasks]);
  const donationByMember = useMemo(() => { const m = {}; donations.forEach((d) => { if (d.member_id && !m[d.member_id]) m[d.member_id] = d; }); return m; }, [donations]);
  const totalPledged = useMemo(() => donations.reduce((s, d) => s + (d.amount || 0), 0), [donations]);
  const totalPaid = useMemo(() => donations.reduce((s, d) => s + (d.paid_amount || 0), 0), [donations]);
  const existingMemberIds = useMemo(() => new Set(invitees.map((i) => i.member_id).filter(Boolean)), [invitees]);
  const filteredMembers = useMemo(() => {
    const q = addSearch.trim();
    return members.filter((m) => !existingMemberIds.has(m.id) && (!q || [m.first_name, m.last_name, m.name, m.id_number, m.phone, m.mobile].some((v) => (v || "").includes(q))));
  }, [members, addSearch, existingMemberIds]);

  const addInvitees = async () => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return;
    try {
      const recs = ids.map((mid) => {
        const m = members.find((x) => x.id === mid);
        return { event_id: id, member_id: mid, name: m?.name || "", first_name: m?.first_name || "", last_name: m?.last_name || "", id_number: m?.id_number || "", phone: m?.mobile || m?.phone || "", address: [m?.street, m?.house_number].filter(Boolean).join(" "), status: "invited", tasks_done: "[]", notes: "" };
      });
      const created = await base44.entities.FundraisingInvitee.bulkCreate(recs);
      setInvitees((list) => [...list, ...(Array.isArray(created) ? created : [])]);
      setSelected({}); setAddOpen(false); setAddSearch("");
      toast({ title: `נוספו ${recs.length} מוזמנים` });
    } catch (e) {
      toast({ title: "שגיאה בהוספה", description: e.message, variant: "destructive" });
    }
  };

  const addTask = async () => {
    const t = newTask.trim();
    if (!t || !event) return;
    try {
      const updated = await base44.entities.FundraisingEvent.update(event.id, { tasks: JSON.stringify([...tasks, t]) });
      setEvent(updated); setNewTask("");
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const removeTask = async (idx) => {
    try {
      const updated = await base44.entities.FundraisingEvent.update(event.id, { tasks: JSON.stringify(tasks.filter((_, i) => i !== idx)) });
      setEvent(updated);
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const toggleTask = async (inv, taskLabel) => {
    const done = parseArr(inv.tasks_done);
    const next = done.includes(taskLabel) ? done.filter((t) => t !== taskLabel) : [...done, taskLabel];
    try {
      const updated = await base44.entities.FundraisingInvitee.update(inv.id, { tasks_done: JSON.stringify(next) });
      setInvitees((list) => list.map((x) => (x.id === inv.id ? updated : x)));
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const setStatus = async (inv, status) => {
    try {
      const updated = await base44.entities.FundraisingInvitee.update(inv.id, { status });
      setInvitees((list) => list.map((x) => (x.id === inv.id ? updated : x)));
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  const savePledge = async (inv) => {
    const d = drafts[inv.id] || {};
    const amount = Number(d.pledge);
    if (!amount || amount <= 0) { toast({ title: "נא להזין סכום התחייבות", variant: "destructive" }); return; }
    setSaving(inv.id);
    try {
      const existing = donationByMember[inv.member_id];
      let rec;
      if (existing) {
        rec = await base44.entities.Donation.update(existing.id, { amount, payment_method: d.method || existing.payment_method || "cash" });
      } else {
        rec = await base44.entities.Donation.create({
          campaign: event.title, member_id: inv.member_id, name: inv.name, first_name: inv.first_name, last_name: inv.last_name, id_number: inv.id_number,
          amount, date: new Date().toISOString().slice(0, 10), payment_method: d.method || "cash", receipt_number: "", source: "event", event_id: event.id, paid_amount: 0, payment_status: "unpaid", notes: "",
        });
      }
      setDonations((c) => [rec, ...c.filter((x) => x.id !== rec.id)]);
      if (inv.status === "invited") {
        const upd = await base44.entities.FundraisingInvitee.update(inv.id, { status: "confirmed" });
        setInvitees((list) => list.map((x) => (x.id === inv.id ? upd : x)));
      }
      setDrafts((dd) => ({ ...dd, [inv.id]: { ...dd[inv.id], pledge: String(amount) } }));
      toast({ title: "ההתחייבות נשמרה", description: `${inv.first_name || ""} ${inv.last_name || ""} · ₪${fmt(amount)}` });
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const savePayment = async (inv, paidAmount, payStatus) => {
    const existing = donationByMember[inv.member_id];
    if (!existing) { toast({ title: "נא להזין התחייבות תחילה", variant: "destructive" }); return; }
    setSaving(inv.id);
    try {
      const rec = await base44.entities.Donation.update(existing.id, { paid_amount: Number(paidAmount) || 0, payment_status: payStatus });
      setDonations((c) => [rec, ...c.filter((x) => x.id !== rec.id)]);
      let newStatus = inv.status;
      if (payStatus === "paid") newStatus = "donated";
      else if (inv.status === "invited") newStatus = "confirmed";
      if (newStatus !== inv.status) {
        const upd = await base44.entities.FundraisingInvitee.update(inv.id, { status: newStatus });
        setInvitees((list) => list.map((x) => (x.id === inv.id ? upd : x)));
      }
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const onPayStatus = (inv, status) => {
    const don = donationByMember[inv.member_id];
    const pledge = don?.amount || 0;
    let paid = don?.paid_amount || 0;
    if (status === "paid") paid = pledge;
    else if (status === "unpaid") paid = 0;
    savePayment(inv, paid, status);
  };

  const onPaidEnter = (inv) => {
    const don = donationByMember[inv.member_id];
    const pledge = don?.amount || 0;
    const paid = Number(drafts[inv.id]?.paid);
    let status = "unpaid";
    if (pledge > 0 && paid >= pledge) status = "paid";
    else if (paid > 0) status = "partial";
    savePayment(inv, paid, status);
  };

  const removeInvitee = async (inv) => {
    if (!confirm(`להסיר את ${inv.name} מהאירוע?`)) return;
    try { await base44.entities.FundraisingInvitee.delete(inv.id); setInvitees((list) => list.filter((x) => x.id !== inv.id)); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  const exportCsv = () => {
    const rows = [["שם משפחה", "שם פרטי", "ת.ז.", "טלפון", "כתובת", "סטטוס", ...tasks, "התחייבות", "שולם", "סטטוס תשלום"]];
    enrichedInvitees.forEach((inv) => {
      const don = donationByMember[inv.member_id];
      rows.push([inv.last_name || "", inv.first_name || "", inv.id_number || "", inv.phone || "", inv.address || "", ISTATUS[inv.status] || inv.status, ...tasks.map((t) => (parseArr(inv.tasks_done).includes(t) ? "✔" : "")), don?.amount || 0, don?.paid_amount || 0, PAY_STATUS[don?.payment_status] || "לא שולם"]);
    });
    const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `${event?.title || "אירוע"}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground">טוען...</p>;
  if (!event) return <p className="text-muted-foreground">אירוע לא נמצא</p>;
  const goal = event.goal_amount || 0;
  const pct = goal > 0 ? Math.min(100, Math.round((totalPledged / goal) * 100)) : 0;

  const inviteeColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (inv) => inv.last_name || "" },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (inv) => inv.first_name || "" },
    { key: "phone", header: "טלפון", field: "phone", filterable: true, headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell text-muted-foreground", render: (inv) => inv.phone || "—" },
    { key: "address", header: "כתובת", field: "address", filterable: true, headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell text-muted-foreground", render: (inv) => inv.address || "—" },
    { key: "status", header: "סטטוס", field: "status", filterable: true, filterOptions: Object.entries(ISTATUS).map(([value, label]) => ({ value, label })), render: (inv) => (
      <Select value={inv.status || "invited"} onValueChange={(v) => setStatus(inv, v)}>
        <SelectTrigger className={cn("h-8 w-24 text-xs border-0", ISTATUS_COLOR[inv.status] || ISTATUS_COLOR.invited)}><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(ISTATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
      </Select>
    ) },
    ...(!hideTasks ? tasks.map((t) => ({ key: `task_${t}`, header: t, field: (inv) => (parseArr(inv.tasks_done).includes(t) ? "done" : "notDone"), filterable: true, filterOptions: [{ value: "done", label: "בוצע" }, { value: "notDone", label: "לא בוצע" }], headerClassName: "text-center", cellClassName: "text-center", render: (inv) => <Checkbox checked={parseArr(inv.tasks_done).includes(t)} onCheckedChange={() => toggleTask(inv, t)} /> })) : []),
    { key: "pledge", header: "התחייבות ₪", field: (inv) => donationByMember[inv.member_id]?.amount, render: (inv) => {
      const don = donationByMember[inv.member_id];
      const pledgeVal = drafts[inv.id]?.pledge != null ? drafts[inv.id].pledge : (don?.amount || "");
      return <Input type="number" inputMode="decimal" value={pledgeVal} onChange={(e) => setDrafts((dd) => ({ ...dd, [inv.id]: { ...dd[inv.id], pledge: e.target.value } }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); savePledge(inv); } }} placeholder="₪" className="w-24 h-8" disabled={saving === inv.id} />;
    } },
    { key: "paid", header: "שולם ₪", render: (inv) => {
      const don = donationByMember[inv.member_id];
      const paidVal = drafts[inv.id]?.paid != null ? drafts[inv.id].paid : (don?.paid_amount || "");
      return <Input type="number" inputMode="decimal" value={paidVal} onChange={(e) => setDrafts((dd) => ({ ...dd, [inv.id]: { ...dd[inv.id], paid: e.target.value } }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onPaidEnter(inv); } }} placeholder="₪" className="w-24 h-8" disabled={saving === inv.id} />;
    } },
    { key: "payStatus", header: "סטטוס תשלום", field: (inv) => donationByMember[inv.member_id]?.payment_status, filterable: true, filterOptions: Object.entries(PAY_STATUS).map(([value, label]) => ({ value, label })), render: (inv) => {
      const payStatus = donationByMember[inv.member_id]?.payment_status || "unpaid";
      return (
        <Select value={payStatus} onValueChange={(v) => onPayStatus(inv, v)}>
          <SelectTrigger className={cn("h-8 w-28 text-xs border-0", PAY_STATUS_COLOR[payStatus] || PAY_STATUS_COLOR.unpaid)}><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PAY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      );
    } },
    { key: "method", header: "אמצעי", headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell", render: (inv) => {
      const don = donationByMember[inv.member_id];
      const d = drafts[inv.id] || {};
      return (
        <Select value={d.method || don?.payment_method || "cash"} onValueChange={(v) => setDrafts((dd) => ({ ...dd, [inv.id]: { ...dd[inv.id], method: v } }))}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PAY).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      );
    } },
    { key: "action", header: "", render: (inv) => (
      <Button size="icon" variant="ghost" onClick={() => removeInvitee(inv)} className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
    ) },
  ];

  return (
    <div className="space-y-5">
      <Link to="/donations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="w-4 h-4" /> חזרה לתרומות חגים</Link>

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {event.date && `${new Date(event.date).toLocaleDateString("he-IL")} · `}
              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {invitees.length} מוזמנים</span>
              {" · "}<span className={cn("text-xs px-2 py-0.5 rounded-full", ISTATUS_COLOR[event.status] || ISTATUS_COLOR.planning)}>{ESTATUS[event.status] || event.status}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4" /> עריכה</Button>
            {event.event_type !== "community" && <Button variant="outline" onClick={exportCsv} disabled={invitees.length === 0}><Download className="w-4 h-4" /> ייצוא</Button>}
            {event.event_type !== "community" && <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" /> הוספת מוזמנים</Button>}
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3"><p className="text-xs text-rose-700">סה"כ התחייבויות</p><p className="text-2xl font-bold text-rose-700">₪{fmt(totalPledged)}</p></div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"><p className="text-xs text-emerald-700">סה"כ שולם</p><p className="text-2xl font-bold text-emerald-700">₪{fmt(totalPaid)}</p></div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3"><p className="text-xs text-amber-700">יעד</p><p className="text-2xl font-bold text-amber-700">₪{fmt(goal)}</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><p className="text-xs text-slate-700">תורמים</p><p className="text-2xl font-bold text-slate-700">{new Set(donations.map((d) => d.member_id)).size}</p></div>
        </div>
        {goal > 0 && <div className="mt-3 h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-l from-rose-500 to-rose-600" style={{ width: `${pct}%` }} /></div>}
        {event.notes && <p className="mt-3 text-sm text-muted-foreground">{event.notes}</p>}
      </div>

      {event.event_type === "community" ? (
        <CommunityEventDonations event={event} />
      ) : (
      <>
      {/* Tasks bar */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="font-semibold">משימות האירוע:</Label>
          <Button size="sm" variant="outline" onClick={() => setHideTasks((v) => !v)} className="h-8">
            {hideTasks ? (<><Eye className="w-4 h-4" /> הצג משימות</>) : (<><EyeOff className="w-4 h-4" /> הסתר משימות</>)}
          </Button>
          {!hideTasks && (
            <>
              {tasks.length === 0 && <span className="text-sm text-muted-foreground">אין משימות עדיין</span>}
              {tasks.map((t, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 text-sm bg-secondary px-2 py-1 rounded-full">
                  {t}
                  <button onClick={() => removeTask(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} placeholder="משימה חדשה" className="w-40 h-8" />
                <Button size="sm" onClick={addTask} disabled={!newTask.trim()} className="h-8"><Plus className="w-4 h-4" /></Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Invitees table */}
      <DataTable
        rows={filteredInvitees}
        columns={inviteeColumns}
        stickyColumns={2}
        loading={loading}
        emptyMessage={invitees.length > 0 && filteredInvitees.length === 0 ? "אין מוזמנים התואמים לסינון" : `עדיין אין מוזמנים — לחץ על "הוספת מוזמנים"`}
        searchPlaceholder="חיפוש מוזמנים..."
        searchFields={["name", "first_name", "last_name", "id_number", "phone", "address"]}
        getRowId={(inv) => inv.id}
        pageSize={50}
        toolbar={tasks.length > 0 ? (
          <div className="w-56">
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger><SelectValue placeholder="סינון לפי משימה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל המוזמנים</SelectItem>
                <SelectItem value="doneAll">כל המשימות בוצעו</SelectItem>
                <SelectItem value="doneNone">אף משימה לא בוצעה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      />

      {/* Add invitees dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>הוספת מוזמנים מרשימת הקהילה</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="חיפוש חבר קהילה..." className="pr-9" autoFocus />
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-thin border rounded-lg divide-y">
              {filteredMembers.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">אין תוצאות / כל החברים כבר מוזמנים</p>}
              {filteredMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={!!selected[m.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [m.id]: !!v }))} />
                  <span className="flex-1 text-sm">{m.last_name || ""} {m.first_name || ""}</span>
                  <span className="text-xs text-muted-foreground">{m.id_number || ""}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setSelected({}); }}>ביטול</Button>
            <Button onClick={addInvitees} disabled={Object.values(selected).filter(Boolean).length === 0}>
              הוסף {Object.values(selected).filter(Boolean).length} מוזמנים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}

      <FundraisingEventFormDialog open={editOpen} onOpenChange={setEditOpen} initial={event} onSaved={(ev) => setEvent(ev)} />
    </div>
  );
}