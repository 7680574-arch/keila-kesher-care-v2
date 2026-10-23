import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, Plus, Trash2, Check, Search, Users, Wallet, PackageCheck, X, UserPlus, FileText, SlidersHorizontal, Pencil, CopyPlus, ListChecks, Wand2, Printer, ClipboardList, Phone, Lock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { HolidayBadge, DistributionTypeBadge, DistributionStatusBadge, RecurrenceBadge, typeLabels } from "@/components/distributionBadges";
import DistributionFormDialog from "@/components/DistributionFormDialog";
import RegistrationSheetDialog from "@/components/RegistrationSheetDialog";
import HolidaySupportTable from "@/components/HolidaySupportTable";
import RecipientsIdImport from "@/components/RecipientsIdImport";
import BulkActionsPanel from "@/components/BulkActionsPanel";
import DistributionAmountRules from "@/components/DistributionAmountRules";
import ExportCsvButton from "@/components/ExportCsvButton";
import CopyPhonesButton from "@/components/CopyPhonesButton";
import { memberAddress } from "@/lib/communityFields";
import LockDataButton from "@/components/LockDataButton";
import { membersForDist, hydrateSnapshot } from "@/lib/distributionLock";
import { useMembersMap, enrichRows } from "@/hooks/useMembersMap";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL")}`;
const splitName = (name) => { const p = (name || "").trim().split(/\s+/); return { first: p[0] || "", last: p.length > 1 ? p.slice(1).join(" ") : "" }; };
const parseTasks = (d) => { try { return JSON.parse(d?.tasks || "[]"); } catch { return []; } };
const parseDone = (r) => { try { return JSON.parse(r?.tasks_done || "[]"); } catch { return []; } };

export default function DistributionDetail() {
  const { id } = useParams();
  const [dist, setDist] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const { members, map: memberMap } = useMembersMap();
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [idImportOpen, setIdImportOpen] = useState(false);
  const [amountsOpen, setAmountsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [neighborhood, setNeighborhood] = useState("all");
  const [minFamily, setMinFamily] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [defaultAmount, setDefaultAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkMemberPart, setBulkMemberPart] = useState("");
  const [bulkFundPart, setBulkFundPart] = useState("");
  const [applying, setApplying] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [regSheetOpen, setRegSheetOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savingId, setSavingId] = useState(null);
  const [savingTaskKey, setSavingTaskKey] = useState(null);
  const [groups, setGroups] = useState([]);
  useEffect(() => { base44.entities.DistributionGroup.list("-created_date", 200).then(setGroups).catch(() => {}); }, []);
  const [recSearch, setRecSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskColFilters, setTaskColFilters] = useState({});

  const load = async () => {
    setLoading(true);
    const [d, r] = await Promise.all([
      base44.entities.Distribution.get(id),
      base44.entities.DistributionRecipient.filter({ distribution_id: id }, "-created_date"),
    ]);
    setDist(await hydrateSnapshot(d));
    setRecipients(r);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const unsubscribe = base44.entities.DistributionRecipient.subscribe((event) => {
      setRecipients((prev) => {
        if (event.type === "create") {
          if (event.data?.distribution_id !== id) return prev;
          if (prev.some((r) => r.id === event.id)) return prev;
          return [...prev, event.data];
        }
        if (event.type === "update") {
          const idx = prev.findIndex((r) => r.id === event.id);
          if (idx === -1) {
            if (event.data?.distribution_id === id) return [...prev, event.data];
            return prev;
          }
          const merged = { ...prev[idx], ...event.data };
          if (merged.distribution_id !== id) return prev.filter((r) => r.id !== event.id);
          const next = [...prev];
          next[idx] = merged;
          return next;
        }
        if (event.type === "delete") {
          return prev.filter((r) => r.id !== event.id);
        }
        return prev;
      });
    });
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [id]);

  useEffect(() => {
    if (pickerOpen && !defaultAmount && dist?.default_amount) setDefaultAmount(String(dist.default_amount));
  }, [pickerOpen, dist?.default_amount]);

  const neighborhoods = useMemo(() => {
    const s = new Set();
    members.forEach((m) => { if (m.neighborhood) s.add(m.neighborhood); });
    return Array.from(s).sort();
  }, [members]);

  const existingIds = useMemo(() => new Set(recipients.map((r) => r.member_id).filter(Boolean)), [recipients]);
  const locked = !!dist?.data_locked;
  const memberById = useMemo(() => {
    const map = {};
    if (!locked) members.forEach((m) => { map[m.id] = m; });
    return map;
  }, [members, locked]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (existingIds.has(m.id)) return false;
      if (search && !m.name?.includes(search) && !m.phone?.includes(search)) return false;
      if (neighborhood !== "all" && m.neighborhood !== neighborhood) return false;
      if (minFamily && (m.family_size || 0) < minFamily) return false;
      return true;
    });
  }, [members, existingIds, search, neighborhood, minFamily]);

  const toggleSel = (mid) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(mid)) n.delete(mid); else n.add(mid);
      return n;
    });
  };
  const selectAllFiltered = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      filteredMembers.forEach((m) => n.add(m.id));
      return n;
    });
  };
  const clearSel = () => setSelected(new Set());

  const addSelected = async () => {
    const amtNum = defaultAmount ? Number(defaultAmount) : (Number(dist.default_amount) || 0);
    const memberPart = Number(dist.default_member_part) || 0;
    const fundPart = Number(dist.default_fund_part) || 0;
    const chosen = members.filter((m) => selected.has(m.id));
    if (chosen.length === 0) return;
    setAdding(true);
    try {
      const payload = chosen.map((m) => ({
        distribution_id: id,
        member_id: m.id,
        name: m.name,
        id_number: m.id_number || "",
        family_size: m.family_size || 0,
        neighborhood: m.neighborhood || "",
        phone: m.mobile || "",
        address: memberAddress(m) || m.address || "",
        amount: amtNum,
        member_participation: memberPart,
        fund_participation: fundPart,
        status: "pending",
      }));
      await base44.entities.DistributionRecipient.bulkCreate(payload);
      setSelected(new Set());
      setDefaultAmount("");
      setPickerOpen(false);
      load();
    } finally { setAdding(false); }
  };

  const toggleDelivered = async (r) => {
    const next = r.status === "delivered" ? "pending" : "delivered";
    setSavingId(r.id);
    try {
      await base44.entities.DistributionRecipient.update(r.id, { status: next });
      setRecipients((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    } catch (e) {
      toast({ title: "שגיאה בשמירת וידוא ההגעה", description: "השמירה נכשלה, נא לנסות שוב.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };
  const removeRecipient = async (r) => {
    if (!confirm("הסרת מקבל מהחלוקה?")) return;
    await base44.entities.DistributionRecipient.delete(r.id);
    load();
  };

  const applyToAll = async () => {
    if (recipients.length === 0) return;
    setApplying(true);
    try {
      const amount = bulkAmount ? Number(bulkAmount) : 0;
      const memberPart = bulkMemberPart ? Number(bulkMemberPart) : 0;
      const fundPart = bulkFundPart ? Number(bulkFundPart) : 0;
      await base44.entities.DistributionRecipient.bulkUpdate(
        recipients.map((r) => ({ id: r.id, amount, member_participation: memberPart, fund_participation: fundPart }))
      );
      await base44.entities.Distribution.update(dist.id, { default_amount: amount, default_member_part: memberPart, default_fund_part: fundPart });
      setDist((d) => ({ ...d, default_amount: amount, default_member_part: memberPart, default_fund_part: fundPart }));
      setBulkAmount("");
      setBulkMemberPart("");
      setBulkFundPart("");
      load();
    } finally {
      setApplying(false);
    }
  };

  const duplicate = async () => {
    if (!confirm(`שכפול החלוקה "${dist.title}" עם כל מקבליה (${recipients.length})?`)) return;
    setDuplicating(true);
    try {
      const created = await base44.entities.Distribution.create({
        title: `${dist.title} (העתק)`,
        holiday: dist.holiday,
        type: dist.type,
        date: dist.date || "",
        total_budget: dist.total_budget || 0,
        planned_recipients: dist.planned_recipients || 0,
        status: "planning",
        recurrence: dist.recurrence || "none",
        notes: dist.notes || "",
        tasks: dist.tasks || "",
        group_id: dist.group_id || "",
      });
      if (recipients.length) {
        await base44.entities.DistributionRecipient.bulkCreate(
          recipients.map((r) => ({
            distribution_id: created.id,
            member_id: r.member_id || "",
            name: r.name,
            id_number: r.id_number || (r.member_id ? memberById[r.member_id]?.id_number : "") || "",
            family_size: r.family_size || 0,
            neighborhood: r.neighborhood || "",
            phone: r.phone || "",
            address: r.address || "",
            amount: Number(r.amount) || 0,
            member_participation: Number(r.member_participation) || 0,
            fund_participation: Number(r.fund_participation) || 0,
            status: "pending",
            notes: r.notes || "",
          }))
        );
      }
      navigate(`/distributions/${created.id}`);
    } finally { setDuplicating(false); }
  };

  const tasks = parseTasks(dist);

  const addTask = async () => {
    const t = taskTitle.trim();
    if (!t || !dist) return;
    setSavingTask(true);
    try {
      const arr = parseTasks(dist);
      if (!arr.includes(t)) arr.push(t);
      await base44.entities.Distribution.update(dist.id, { tasks: JSON.stringify(arr) });
      setTaskTitle("");
      setTaskOpen(false);
      load();
    } finally { setSavingTask(false); }
  };

  const removeTask = async (title) => {
    if (!dist) return;
    if (!confirm(`הסרת המשימה "${title}" מכל המקבלים?`)) return;
    const arr = parseTasks(dist).filter((x) => x !== title);
    await base44.entities.Distribution.update(dist.id, { tasks: JSON.stringify(arr) });
    const updates = recipients
      .filter((r) => parseDone(r).includes(title))
      .map((r) => ({ id: r.id, tasks_done: JSON.stringify(parseDone(r).filter((x) => x !== title)) }));
    if (updates.length) await base44.entities.DistributionRecipient.bulkUpdate(updates);
    load();
  };

  const toggleTaskDone = async (r, title) => {
    const done = parseDone(r);
    const next = done.includes(title) ? done.filter((x) => x !== title) : [...done, title];
    const key = `${r.id}:${title}`;
    setSavingTaskKey(key);
    try {
      await base44.entities.DistributionRecipient.update(r.id, { tasks_done: JSON.stringify(next) });
      setRecipients((prev) => prev.map((x) => (x.id === r.id ? { ...x, tasks_done: JSON.stringify(next) } : x)));
    } catch (e) {
      toast({ title: "שגיאה בשמירת המשימה", description: "השמירה נכשלה, נא לנסות שוב.", variant: "destructive" });
    } finally {
      setSavingTaskKey(null);
    }
  };

  const enrichedRecipients = useMemo(() => (locked ? recipients : enrichRows(recipients, memberMap)), [recipients, memberMap, locked]);
  const recipientPhones = useMemo(() => enrichedRecipients.map((r) => (r.member_id ? (memberById[r.member_id]?.mobile || "") : "") || r.phone || "").filter(Boolean), [enrichedRecipients, memberById]);
  const totalAmount = recipients.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalMemberPart = recipients.reduce((s, r) => s + Number(r.member_participation || 0), 0);
  const totalFundPart = recipients.reduce((s, r) => s + Number(r.fund_participation || 0), 0);
  const deliveredCount = recipients.filter((r) => r.status === "delivered").length;
  const filteredRecipients = useMemo(() => {
    const tList = parseTasks(dist);
    let list = enrichedRecipients;
    const q = recSearch.trim();
    if (q) list = list.filter((r) => `${r.name || ""} ${r.neighborhood || ""} ${r.address || ""} ${r.phone || ""} ${r.id_number || ""}`.includes(q));
    if (taskFilter === "doneAll") list = list.filter((r) => tList.length > 0 && parseDone(r).length === tList.length);
    else if (taskFilter === "doneNone") list = list.filter((r) => parseDone(r).length === 0);
    Object.entries(taskColFilters).forEach(([t, val]) => {
      if (val === "done") list = list.filter((r) => parseDone(r).includes(t));
      else if (val === "notDone") list = list.filter((r) => !parseDone(r).includes(t));
    });
    const sorted = [...list];
    const lastNameOf = (r) => (r.member_id && memberById[r.member_id]?.last_name) || splitName(r.name).last || "";
    const firstNameOf = (r) => (r.member_id && memberById[r.member_id]?.first_name) || splitName(r.name).first || "";
    if (sortBy === "name") sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
    else if (sortBy === "lastName") sorted.sort((a, b) => (lastNameOf(a).localeCompare(lastNameOf(b), "he") || firstNameOf(a).localeCompare(firstNameOf(b), "he")));
    else if (sortBy === "status") sorted.sort((a, b) => (a.status === "delivered" ? 0 : 1) - (b.status === "delivered" ? 0 : 1));
    else if (sortBy === "tasks") sorted.sort((a, b) => parseDone(b).length - parseDone(a).length);
    return sorted;
  }, [enrichedRecipients, recSearch, taskFilter, taskColFilters, sortBy, dist]);

  const exportColumns = [
    { header: "שם משפחה", get: (r) => (r.member_id && memberById[r.member_id]?.last_name) || splitName(r.name).last },
    { header: "שם פרטי", get: (r) => (r.member_id && memberById[r.member_id]?.first_name) || splitName(r.name).first },
    { header: "תעודת זהות", get: (r) => r.id_number || (r.member_id ? memberById[r.member_id]?.id_number : "") || "" },
    { header: "רחוב", get: (r) => (r.member_id ? memberById[r.member_id]?.street : "") || "" },
    { header: "מספר", get: (r) => (r.member_id ? memberById[r.member_id]?.house_number : "") || "" },
    { header: "דירה", get: (r) => (r.member_id ? memberById[r.member_id]?.apartment : "") || "" },
    { header: "שכונה", get: (r) => r.neighborhood || "" },
    { header: "נייד", get: (r) => (r.member_id ? (memberById[r.member_id]?.mobile || "") : "") || r.phone || "" },
    { header: "מספר נפשות", get: (r) => r.family_size ?? "" },
    { header: "שווי חלוקה", get: (r) => r.amount ?? "" },
    { header: "השתתפות אברך", get: (r) => r.member_participation ?? "" },
    { header: "השתתפות קופה", get: (r) => r.fund_participation ?? "" },
    { header: "סטטוס", get: (r) => (r.status === "delivered" ? "נמסר" : "ממתין") },
    ...tasks.map((t) => ({ header: t, get: (r) => (parseDone(r).includes(t) ? "בוצע" : "לא בוצע") })),
  ];

  const printDistribution = () => {
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const sorted = [...filteredRecipients].sort((a, b) => {
      const la = (a.member_id && memberById[a.member_id]?.last_name) || splitName(a.name).last || "";
      const lb = (b.member_id && memberById[b.member_id]?.last_name) || splitName(b.name).last || "";
      const fa = (a.member_id && memberById[a.member_id]?.first_name) || splitName(a.name).first || "";
      const fb = (b.member_id && memberById[b.member_id]?.first_name) || splitName(b.name).first || "";
      return la.localeCompare(lb, "he") || fa.localeCompare(fb, "he");
    });
    const body = sorted.map((r) => {
      const mem = r.member_id ? memberById[r.member_id] : null;
      const last = (mem?.last_name) || splitName(r.name).last;
      const first = (mem?.first_name) || splitName(r.name).first;
      const ph = (mem ? (mem.mobile || "") : "") || r.phone || "";
      const done = parseDone(r);
      const taskCells = tasks.map((t) => `<td class="chk">${done.includes(t) ? "✓" : ""}</td>`).join("");
      return `<tr><td>${esc(last)}</td><td>${esc(first)}</td><td>${esc(ph)}</td>${taskCells}</tr>`;
    }).join("");
    const taskHeaders = tasks.map((t) => `<th>${esc(t)}</th>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${esc(dist.title)} - רשימת חלוקה</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Heebo', Arial, sans-serif; color: #1e293b; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
  thead { display: table-header-group; }
  th { background: #1e3a5f; color: #fff; padding: 3px 5px; text-align: right; border: 1px solid #1e3a5f; font-weight: 600; }
  td { padding: 2px 5px; border: 1px solid #cbd5e1; height: 18px; line-height: 18px; vertical-align: middle; overflow: hidden; }
  tbody tr:nth-child(even) { background: #eef2f7; }
  tbody tr:nth-child(odd) { background: #ffffff; }
  .chk { text-align: center; font-weight: 700; }
  tr { page-break-inside: avoid; }
</style></head><body>
<h1>${esc(dist.title)} — רשימת חלוקה</h1>
<div class="sub">${esc(dist.date || "")} · ${sorted.length} מקבלים</div>
<table>
  <thead><tr><th>שם משפחה</th><th>שם פרטי</th><th>נייד</th>${taskHeaders}</tr></thead>
  <tbody>${body}</tbody>
</table>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "נא לאפשר חלונות קופצים להדפסה", variant: "destructive" }); return; }
    w.document.write(html); w.document.close();
  };

  const printRegistrationSheet = (n) => {
    if (!n || n <= 0) return;
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const rowsPerTable = 25;
    const tablesPerPage = 2;
    const rowsPerPage = rowsPerTable * tablesPerPage;
    const totalPages = Math.ceil(n / rowsPerPage);
    let pagesHtml = "";
    for (let p = 0; p < totalPages; p++) {
      const start = p * rowsPerPage;
      let tablesHtml = "";
      for (let t = 0; t < tablesPerPage; t++) {
        const tStart = start + t * rowsPerTable;
        let rowsHtml = "";
        for (let i = 0; i < rowsPerTable; i++) {
          const num = tStart + i + 1;
          rowsHtml += `<tr><td class="num">${num <= n ? num : ""}</td><td class="name"></td></tr>`;
        }
        tablesHtml += `<table><thead><tr><th class="num">מס'</th><th class="name">שם</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }
      pagesHtml += `<div class="page"><div class="tables">${tablesHtml}</div></div>`;
    }
    const regHtml = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${esc(dist.title)} - דף רישום</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Heebo', Arial, sans-serif; color: #1e293b; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 8px; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .tables { display: flex; gap: 6mm; align-items: flex-start; }
  .tables table { flex: 1; border-collapse: collapse; table-layout: fixed; font-size: 14px; }
  thead { display: table-header-group; }
  th { background: #1e3a5f; color: #fff; padding: 5px 6px; text-align: right; border: 1px solid #1e3a5f; font-weight: 600; }
  td { padding: 4px 6px; border: 1px solid #cbd5e1; height: 22px; vertical-align: middle; }
  .num { width: 8%; text-align: center; font-weight: 600; }
  .name { width: 92%; }
  tbody tr:nth-child(even) { background: #eef2f7; }
</style></head><body>
<h1>${esc(dist.title)} — דף רישום</h1>
<div class="sub">${esc(dist.date || "")} · ${n} מקבלים מתוכננים</div>
${pagesHtml}
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "נא לאפשר חלונות קופצים להדפסה", variant: "destructive" }); return; }
    w.document.write(regHtml); w.document.close();
  };

  const openRegSheet = () => {
    const n = Number(dist.planned_recipients) || 0;
    if (n > 0) printRegistrationSheet(n);
    else setRegSheetOpen(true);
  };
  const onRegSheetConfirm = async (n) => {
    setRegSheetOpen(false);
    printRegistrationSheet(n);
    if (Number(dist.planned_recipients) !== n) {
      try { await base44.entities.Distribution.update(dist.id, { planned_recipients: n }); setDist((d) => ({ ...d, planned_recipients: n })); } catch {}
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }
  if (!dist) return <p className="text-muted-foreground">חלוקה לא נמצאה</p>;

  return (
    <div className="space-y-6">
      <Link to="/distributions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowRight className="w-4 h-4" /> חזרה לחלוקות
      </Link>

      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <HolidayBadge holiday={dist.holiday} />
              <DistributionTypeBadge type={dist.type} />
              <DistributionStatusBadge status={dist.status} />
              {dist.recurrence && dist.recurrence !== "none" && <RecurrenceBadge recurrence={dist.recurrence} />}
              {locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-medium"><Lock className="w-3 h-3" /> נתונים קבועים{dist.locked_at ? ` · ${new Date(dist.locked_at).toLocaleDateString("he-IL")}` : ""}</span>}
            </div>
            <h1 className="text-xl md:text-2xl font-bold">{dist.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">סוג: {typeLabels[dist.type]} · {dist.date || "ללא תאריך"}{dist.planned_recipients ? ` · מתוכנן: ${dist.planned_recipients} מקבלים` : ""}</p>
            {dist.notes && <p className="text-sm mt-3 whitespace-pre-wrap rounded-xl bg-secondary/50 p-3">{dist.notes}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <LockDataButton dist={dist} recipients={recipients} members={members} onChanged={() => load()} />
            <Button variant="outline" size="sm" onClick={openRegSheet} title="הדפסת דף רישום ריק"><ClipboardList className="w-4 h-4 ml-1" /> דף רישום</Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="w-4 h-4 ml-1" /> עריכה</Button>
            <Button variant="outline" size="sm" onClick={duplicate} disabled={duplicating}><CopyPlus className="w-4 h-4 ml-1" /> {duplicating ? "משכפל…" : "שכפול"}</Button>
          </div>
        </div>
      </div>

      {dist.type === "holiday_support" ? (
        <HolidaySupportTable dist={dist} members={membersForDist(dist, members)} onChange={load} />
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{recipients.length}</p>
          <p className="text-xs text-muted-foreground">מקבלים</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Check className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{deliveredCount}</p>
          <p className="text-xs text-muted-foreground">נמסרו</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center"><PackageCheck className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{recipients.length - deliveredCount}</p>
          <p className="text-xs text-muted-foreground">ממתינים</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{fmt(totalAmount)}</p>
          <p className="text-xs text-muted-foreground">סה״כ מוקצה</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> רשימת מקבלים ({recipients.length})</h2>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><Wand2 className="w-4 h-4 ml-1" /> פעולות מרובות</Button>
            <CopyPhonesButton phones={recipientPhones} />
            <ExportCsvButton allRows={enrichedRecipients} filteredRows={enrichedRecipients} columns={exportColumns} fileName={`${(dist.title || "חלוקה").replace(/[\\/]/g, "-")}_מקבלים.csv`} />
            <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}><ListChecks className="w-4 h-4 ml-1" /> הוסף משימה</Button>
            <Button size="sm" variant="outline" onClick={() => setAmountsOpen(true)}><SlidersHorizontal className="w-4 h-4 ml-1" /> קביעת סכומים</Button>
            <Button size="sm" variant="outline" onClick={() => setIdImportOpen(true)}><FileText className="w-4 h-4 ml-1" /> הוספה מתז</Button>
            <Button size="sm" variant="outline" onClick={printDistribution}><Printer className="w-4 h-4 ml-1" /> הדפסת טבלה</Button>
            <Button size="sm" onClick={() => setPickerOpen(true)}><UserPlus className="w-4 h-4 ml-1" /> הוסף מקבלים</Button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={recSearch} onChange={(e) => setRecSearch(e.target.value)} placeholder="חיפוש מקבלים..." className="pr-9" />
          </div>
          <div className="w-40">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger><SelectValue placeholder="מיון" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">מיון: ברירת מחדל</SelectItem>
                <SelectItem value="name">שם פרטי (א׳→ב׳)</SelectItem>
                <SelectItem value="lastName">שם משפחה (א׳→ב׳)</SelectItem>
                <SelectItem value="status">סטטוס מסירה</SelectItem>
                <SelectItem value="tasks">משימות שבוצעו</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tasks.length > 0 && (
            <div className="w-56">
              <Select value={taskFilter} onValueChange={setTaskFilter}>
                <SelectTrigger><SelectValue placeholder="סינון לפי משימה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המקבלים</SelectItem>
                  <SelectItem value="doneAll">כל המשימות בוצעו</SelectItem>
                  <SelectItem value="doneNone">אף משימה לא בוצעה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-b border-border space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs text-amber-700">סה"כ שווי למקבלים</p>
              <p className="text-lg font-bold text-amber-700 mt-1">{fmt(totalAmount)}</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3">
              <p className="text-xs text-sky-700">סה"כ השתתפות האברך</p>
              <p className="text-lg font-bold text-sky-700 mt-1">{fmt(totalMemberPart)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">סה"כ השתתפות הקופה</p>
              <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(totalFundPart)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">שווי למקבל</Label>
              <Input type="number" min="0" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} className="w-32 h-9" placeholder="₪" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">השתתפות האברך</Label>
              <Input type="number" min="0" value={bulkMemberPart} onChange={(e) => setBulkMemberPart(e.target.value)} className="w-32 h-9" placeholder="₪" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">השתתפות הקופה</Label>
              <Input type="number" min="0" value={bulkFundPart} onChange={(e) => setBulkFundPart(e.target.value)} className="w-32 h-9" placeholder="₪" />
            </div>
            <Button size="sm" disabled={recipients.length === 0 || applying} onClick={applyToAll} className="h-9">
              {applying ? "מעדכן…" : "החל על כולם"}
            </Button>
          </div>
        </div>

        {tasks.length > 0 && (
          <div className="px-5 py-3 border-b border-border bg-secondary/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">משימות החלוקה ({tasks.length})</p>
            <div className="flex flex-wrap gap-2">
              {tasks.map((t) => {
                const doneCount = recipients.filter((r) => parseDone(r).includes(t)).length;
                const cf = taskColFilters[t];
                return (
                  <span key={t} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${cf ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    <ListChecks className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{t}</span>
                    <span className="text-muted-foreground">{doneCount}/{recipients.length}</span>
                    <Select value={cf || "all"} onValueChange={(v) => setTaskColFilters((p) => { const n = { ...p }; if (v === "all") delete n[t]; else n[t] = v; return n; })}>
                      <SelectTrigger className="h-6 w-20 text-xs border-0 px-1 shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">הכל</SelectItem>
                        <SelectItem value="done">בוצע</SelectItem>
                        <SelectItem value="notDone">לא בוצע</SelectItem>
                      </SelectContent>
                    </Select>
                    <button onClick={() => removeTask(t)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {filteredRecipients.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">{recipients.length === 0 ? "אין מקבלים בחלוקה זו — הוסיפו מרשימת הקהילה" : "לא נמצאו מקבלים לחיפוש/סינון"}</p>
          )}
          {filteredRecipients.map((r) => {
            const done = parseDone(r);
            return (
              <div key={r.id} className="px-5 py-3 group hover:bg-secondary/40 transition">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDelivered(r)}
                    disabled={savingId === r.id}
                    title={r.status === "delivered" ? "נמסר — לחץ לביטול" : "סמן כנמסר"}
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border-2 transition disabled:opacity-50 disabled:cursor-wait ${r.status === "delivered" ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-primary"}`}
                  >
                    {savingId === r.id ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (r.status === "delivered" && <Check className="w-4 h-4" strokeWidth={3} />)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${r.status === "delivered" ? "line-through text-muted-foreground" : ""}`}>{r.name}</p>
                    {(() => {
                      const mem = r.member_id ? memberById[r.member_id] : null;
                      const addr = (mem ? memberAddress(mem) : "") || r.address || "—";
                      const idn = r.id_number || (mem ? mem.id_number : "") || "";
                      return (
                        <p className="text-xs text-muted-foreground truncate">
                          {[r.neighborhood, addr].filter((x) => x && x !== "—").join(" · ")}{idn ? ` · תז ${idn}` : ""}
                        </p>
                      );
                    })()}
                  </div>
                  {(() => {
                    const mem = r.member_id ? memberById[r.member_id] : null;
                    const mobile = (mem?.mobile || "") || r.phone || "";
                    return mobile ? (
                      <a href={`tel:${mobile}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary shrink-0 whitespace-nowrap" dir="ltr">
                        <Phone className="w-3.5 h-3.5" /> {mobile}
                      </a>
                    ) : <span className="text-xs text-muted-foreground shrink-0">—</span>;
                  })()}
                  <button onClick={() => removeRecipient(r)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {tasks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 mr-9">
                    {tasks.map((t) => {
                      const isDone = done.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleTaskDone(r, t)}
                          disabled={savingTaskKey === `${r.id}:${t}`}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition disabled:opacity-50 disabled:cursor-wait ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-muted-foreground hover:border-primary hover:text-primary"}`}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${isDone ? "border-white/40" : "border-slate-300"}`}>
                            {savingTaskKey === `${r.id}:${t}` ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : (isDone && <Check className="w-3 h-3" strokeWidth={3} />)}
                          </span>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* Picker sheet */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> הוספת מקבלים מרשימת הקהילה</SheetTitle>
            <SheetDescription>סננו ובחרו את מקבלי החלוקה. ניתן לבחור מספר אנשים ולקבוע סכום/כמות ברירת מחדל.</SheetDescription>
          </SheetHeader>

          <div className="px-4 py-3 border-b border-border space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם או טלפון" className="pr-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={neighborhood} onValueChange={setNeighborhood}>
                <SelectTrigger><SelectValue placeholder="כל השכונות" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל השכונות</SelectItem>
                  {neighborhoods.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min="0" value={minFamily || ""} onChange={(e) => setMinFamily(Number(e.target.value) || 0)} placeholder="מינ׳ נפשות בבית" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{filteredMembers.length} זמינים · {selected.size} נבחרו</span>
              <div className="flex gap-2">
                <button onClick={selectAllFiltered} className="text-primary hover:underline">בחר הכל</button>
                {selected.size > 0 && <button onClick={clearSel} className="text-muted-foreground hover:underline inline-flex items-center gap-1"><X className="w-3 h-3" /> נקה</button>}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
            {members.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">אין חברי קהילה ברשימה. העלו רשימת קהילה תחילה.</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">אין תוצאות לסינון (או שכולם כבר משובצים).</p>
            ) : (
              <div className="space-y-2">
                {filteredMembers.slice(0, 300).map((m) => {
                  const checked = selected.has(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-secondary/40 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggleSel(m.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{[m.neighborhood, memberAddress(m) || null].filter(Boolean).join(" · ")}{m.id_number ? ` · תז ${m.id_number}` : ""}{m.mobile ? ` · ${m.mobile}` : ""}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-border pt-3">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1">
                <Label className="text-xs">{dist.type === "cash" ? "סכום ברירת מחדל (₪)" : "כמות ברירת מחדל"}</Label>
                <Input type="number" min="0" value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)} placeholder="לדוגמה 500" className="h-9" />
              </div>
              <Button type="button" disabled={selected.size === 0 || adding} onClick={addSelected} className="mt-5">
                {adding ? "מוסיף…" : `הוסף ${selected.size || ""} מקבלים`}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <RecipientsIdImport
        open={idImportOpen}
        onOpenChange={setIdImportOpen}
        distributionId={id}
        distributionType={dist.type}
        members={members}
        existingMemberIds={existingIds}
        onImported={load}
        defaultAmount={dist.default_amount}
        defaultMemberPart={dist.default_member_part}
        defaultFundPart={dist.default_fund_part}
      />
      <DistributionAmountRules
        open={amountsOpen}
        onOpenChange={setAmountsOpen}
        recipients={recipients}
        distributionType={dist.type}
        onApplied={load}
      />

      <DistributionFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={load}
        initial={dist}
        groups={groups}
      />

      <RegistrationSheetDialog
        open={regSheetOpen}
        onOpenChange={setRegSheetOpen}
        onConfirm={onRegSheetConfirm}
        initial={dist.planned_recipients}
      />

      <BulkActionsPanel
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        recipients={recipients}
        tasks={tasks}
        onApplied={load}
      />

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> הוספת משימה</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">המשימה תתווסף לכל מקבלי החלוקה. ניתן יהיה לסמן אותה כבוצעה בנפרד עבור כל מקבל.</p>
          <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="לדוגמה: נמסרה החבילה" onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} />
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" disabled={!taskTitle.trim() || savingTask} onClick={addTask}>{savingTask ? "שומר…" : "הוסף משימה"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}