import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Check, Download, Filter, PiggyBank, Plus, History, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import DataTable from "@/components/DataTable";
import { useMembersMap, enrichRows } from "@/hooks/useMembersMap";
import MemberCollectionHistory from "@/components/collections/MemberCollectionHistory";
import ExportRoundDialog from "@/components/collections/ExportRoundDialog";
import PrintStickers from "@/components/collections/PrintStickers";

const BOX_STATUS = {
  has: "יש",
  wants: "רוצה",
  no: "לא רוצה",
};

const BOX_OPTIONS = Object.entries(BOX_STATUS).map(([value, label]) => ({ value, label }));

const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function Collections() {
  const { toast } = useToast();
  const { members, map: memberMap } = useMembersMap();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fund, setFund] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [neighborhood, setNeighborhood] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(null);
  const [historyMember, setHistoryMember] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [newRoundName, setNewRoundName] = useState("");
  const inputsRef = useRef({});
  const scanRef = useRef(null);
  const scanTargetRef = useRef(null);
  const [scanValue, setScanValue] = useState("");
  const [adhoc, setAdhoc] = useState({ name: "", amount: "", refund: false });
  const adhocNameRef = useRef(null);
  const adhocAmountRef = useRef(null);

  useEffect(() => { scanRef.current?.focus(); }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cols = await base44.entities.Collection.list("-date", 3000);
        setCollections(cols);
      } catch (e) {
        toast({ title: "שגיאה בטעינת נתונים", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // רשימת סבבי האיסוף (לפי fund) ממוינת לפי תאריך איסוף אחרון
  const rounds = useMemo(() => {
    const map = {};
    collections.forEach((c) => {
      const f = c.fund || "—";
      if (!map[f]) map[f] = { fund: f, latest: c.date || "", total: 0, count: 0 };
      map[f].total += c.amount || 0;
      map[f].count += 1;
      if (c.date && c.date > map[f].latest) map[f].latest = c.date;
    });
    return Object.values(map).sort((a, b) => (b.latest || "").localeCompare(a.latest || ""));
  }, [collections]);

  // סבב ברירת מחדל: האחרון, או חדש לחודש הנוכחי
  useEffect(() => {
    if (fund) return;
    if (rounds.length > 0) {
      setFund(rounds[0].fund);
    } else {
      const d = new Date();
      const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
      setFund(`איסוף קופה - ${months[d.getMonth()]} ${d.getFullYear()}`);
    }
  }, [rounds, fund]);

  const neighborhoods = useMemo(() => {
    const s = new Set();
    members.forEach((m) => m.neighborhood && s.add(m.neighborhood));
    return Array.from(s).sort();
  }, [members]);

  const byIdNumber = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      const id = (m.id_number || "").trim();
      if (!id) return;
      (map[id] = map[id] || []).push(m);
    });
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (neighborhood === "all") return members;
    return members.filter((m) => m.neighborhood === neighborhood);
  }, [members, neighborhood]);

  const fundCols = useMemo(() => collections.filter((c) => c.fund === fund), [collections, fund]);
  const fundColsDisplay = useMemo(() => enrichRows(fundCols, memberMap), [fundCols, memberMap]);
  const byMember = useMemo(() => {
    const map = {};
    fundCols.forEach((c) => { map[c.member_id] = (map[c.member_id] || 0) + (c.amount || 0); });
    return map;
  }, [fundCols]);
  const totalCollected = useMemo(() => fundCols.reduce((s, c) => s + (c.amount || 0), 0), [fundCols]);
  const contributorsCount = useMemo(() => new Set(fundCols.map((c) => c.member_id)).size, [fundCols]);

  const setDraft = (mid, patch) => setDrafts((d) => ({ ...d, [mid]: { ...d[mid], ...patch } }));

  const handleScan = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = (scanValue || "").trim();
    if (!val) return;
    const norm = (s) => String(s || "").replace(/\D/g, "");
    let matches = byIdNumber[val];
    if (!matches || !matches.length) {
      const nd = norm(val);
      matches = nd
        ? Object.keys(byIdNumber).filter((k) => norm(k) === nd).flatMap((k) => byIdNumber[k])
        : [];
    }
    if (!matches || !matches.length) {
      // הקלדת ספרות שלא תאמהו לאף חבר — ככל הנראה סריקה שנכשלה
      if (/^\d+$/.test(val)) {
        toast({ title: "לא נמצא חבר עם ת.ז. זו", variant: "destructive" });
        setScanValue("");
        scanRef.current?.focus();
      }
      // טקסט חופשי (שם וכו') — נשאר כחיפוש חי בטבלה, לא מנקים ולא מקפיצים שגיאה
      return;
    }
    if (matches.length > 1) {
      toast({ title: "ת.ז. כפולה — בחר ידנית", description: matches.map((m) => m.name).join(" · "), variant: "destructive" });
      return;
    }
    const m = matches[0];
    setScanValue("");
    if (!filteredMembers.find((x) => x.id === m.id)) setNeighborhood("all");
    scanTargetRef.current = m.id;
    setTimeout(() => {
      const el = inputsRef.current[m.id];
      if (el) {
        el.focus();
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        scanRef.current?.focus();
      }
    }, 80);
  };

  const updateBoxStatus = async (m, value) => {
    try {
      await base44.entities.CommunityMember.update(m.id, { box_status: value });
    } catch (e) {
      toast({ title: "שגיאה בעדכון סטטוס קופה", description: e.message, variant: "destructive" });
    }
  };

  const collect = async (m) => {
    const d = drafts[m.id] || {};
    const raw = Number(d.amount);
    if (!raw || raw === 0) {
      toast({ title: "נא להזין סכום", variant: "destructive" });
      inputsRef.current[m.id]?.focus();
      return;
    }
    const isRefund = !!d.refund;
    const amount = isRefund ? -Math.abs(raw) : Math.abs(raw);
    setSaving(m.id);
    try {
      const rec = await base44.entities.Collection.create({
        member_id: m.id,
        name: m.name,
        first_name: m.first_name,
        last_name: m.last_name,
        id_number: m.id_number,
        fund,
        amount,
        date,
        payment_method: "cash",
        receipt_number: "",
        status: "collected",
        notes: isRefund ? "החזר/זיכוי" : "",
      });
      setCollections((c) => [rec, ...c]);
      setDrafts((dd) => ({ ...dd, [m.id]: { ...dd[m.id], amount: "", refund: false } }));
      toast({ title: isRefund ? "ההחזר נרשם" : "האיסוף נרשם", description: `${m.first_name || ""} ${m.last_name || ""} · ₪${fmt(amount)}` });
      scanTargetRef.current = null;
      setScanValue("");
      setTimeout(() => scanRef.current?.focus(), 0);
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const collectAdhoc = async () => {
    const name = (adhoc.name || "").trim();
    const raw = Number(adhoc.amount);
    if (!name) {
      toast({ title: "נא להזין שם", variant: "destructive" });
      adhocNameRef.current?.focus();
      return;
    }
    if (!raw || raw === 0) {
      toast({ title: "נא להזין סכום", variant: "destructive" });
      adhocAmountRef.current?.focus();
      return;
    }
    const isRefund = !!adhoc.refund;
    const amount = isRefund ? -Math.abs(raw) : Math.abs(raw);
    const parts = name.split(/\s+/);
    const first_name = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
    const last_name = parts.length > 1 ? parts[parts.length - 1] : name;
    setSaving("adhoc");
    try {
      const rec = await base44.entities.Collection.create({
        member_id: "",
        name,
        first_name,
        last_name,
        id_number: "",
        fund,
        amount,
        date,
        payment_method: "cash",
        receipt_number: "",
        status: "collected",
        notes: isRefund ? "החזר/זיכוי · ללא שם" : "איסוף ללא שם",
      });
      setCollections((c) => [rec, ...c]);
      setAdhoc({ name: "", amount: "", refund: false });
      toast({ title: isRefund ? "ההחזר נרשם" : "האיסוף נרשם", description: `${name} · ₪${fmt(amount)}` });
      setTimeout(() => adhocNameRef.current?.focus(), 0);
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeCollection = async (c) => {
    if (!confirm(`למחוק איסוף של ₪${fmt(c.amount)} מ-${c.name}?`)) return;
    try {
      await base44.entities.Collection.delete(c.id);
      setCollections((list) => list.filter((x) => x.id !== c.id));
      toast({ title: "האיסוף נמחק" });
    } catch (e) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    }
  };

  const createNewRound = () => {
    const name = newRoundName.trim();
    if (!name) {
      toast({ title: "נא להזין שם לאיסוף", variant: "destructive" });
      return;
    }
    setFund(name);
    setNewRoundName("");
    setNewRoundOpen(false);
    toast({ title: "סבב איסוף חדש", description: name });
  };

  const buildCsv = (rows) => {
    const header = ["שם מלא", "שם משפחה", "שם פרטי", "ת.ז.", "סכום", "תאריך", "סבב / קמפיין", "הערות"];
    const body = rows.map((c) => [
      c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "",
      c.last_name || "", c.first_name || "", c.id_number || "", c.amount || 0,
      c.date || "", c.fund || "", c.notes || "",
    ]);
    const all = [header, ...body];
    return "\uFEFF" + all.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const downloadCsv = (rows, filename) => {
    const csv = buildCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportChoice = (mode) => {
    setExportOpen(false);
    if (mode === "current") {
      if (fundCols.length === 0) {
        toast({ title: "אין נתונים לייצוא בסבב זה", variant: "destructive" });
        return;
      }
      downloadCsv(fundCols, `איסוף_${fund}.csv`);
    } else {
      if (collections.length === 0) {
        toast({ title: "אין נתונים לייצוא", variant: "destructive" });
        return;
      }
      downloadCsv(collections, "איסופים_כל_הסבבים.csv");
    }
  };

  const openHistory = (m) => {
    setHistoryMember(m);
    setHistoryOpen(true);
  };

  const memberSearchFields = ["name", "first_name", "last_name", "id_number", "phone", "mobile", "street", "neighborhood"];

  const NameButton = ({ m, label, className = "" }) => (
    <button
      onClick={() => openHistory(m)}
      className={`text-right hover:text-amber-600 hover:underline underline-offset-2 ${className}`}
      title="היסטוריית איסופים"
    >
      {label || "—"}
    </button>
  );

  const memberColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (m) => <NameButton m={m} label={m.last_name || ""} /> },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (m) => <NameButton m={m} label={m.first_name || ""} /> },
    { key: "mobile", header: "נייד", field: "mobile", filterable: true, headerClassName: "hidden md:table-cell", cellClassName: "hidden md:table-cell text-muted-foreground", render: (m) => m.mobile || "—" },
    { key: "address", header: "כתובת", field: "street", filterable: true, headerClassName: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell text-muted-foreground", render: (m) => [m.street, m.house_number].filter(Boolean).join(" ") || "—" },
    { key: "box", header: "קופה", render: (m) => (
      <Select value={m.box_status || ""} onValueChange={(v) => updateBoxStatus(m, v)}>
        <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>{BOX_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    ) },
    { key: "collected", header: "נאסף בסבב זה", field: (m) => byMember[m.id] || 0, render: (m) => {
      const collected = byMember[m.id] || 0;
      if (collected === 0) return <span className="text-muted-foreground">—</span>;
      if (collected < 0) return <span className="inline-flex items-center gap-1 text-red-600 font-medium">−₪{fmt(Math.abs(collected))}</span>;
      return <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><Check className="w-3.5 h-3.5" /> ₪{fmt(collected)}</span>;
    } },
    { key: "amount", header: "סכום איסוף", render: (m) => (
      <Input
        ref={(el) => (inputsRef.current[m.id] = el)}
        type="number"
        inputMode="decimal"
        value={(drafts[m.id] || {}).amount || ""}
        onChange={(e) => setDraft(m.id, { amount: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); collect(m); } }}
        onFocus={() => { if (scanTargetRef.current && scanTargetRef.current !== m.id) scanTargetRef.current = null; }}
        placeholder="₪"
        className="w-24 h-8"
        disabled={saving === m.id}
      />
    ) },
    { key: "refund", header: "החזר", headerClassName: "text-center", render: (m) => (
      <input
        type="checkbox"
        checked={!!(drafts[m.id] || {}).refund}
        onChange={(e) => setDraft(m.id, { refund: e.target.checked })}
        disabled={saving === m.id}
        className="w-4 h-4 accent-red-600"
        title="סמן לרישום החזר/זיכוי (סכום שלילי שיורד מהסכום שנאסף)"
      />
    ) },
    { key: "action", header: "", render: (m) => {
      const isRefund = !!(drafts[m.id] || {}).refund;
      return (
        <Button size="sm" variant={isRefund ? "destructive" : "default"} onClick={() => collect(m)} disabled={saving === m.id || !(drafts[m.id] || {}).amount} className="h-8">
          {saving === m.id ? "..." : isRefund ? "החזר" : "איסוף"}
        </Button>
      );
    } },
  ];

  const colColumns = [
    { key: "last_name", header: "שם משפחה", field: "last_name", filterable: true, cellClassName: "font-medium", render: (c) => {
      const m = memberMap[c.member_id];
      return m ? <NameButton m={m} label={c.last_name || ""} /> : (c.last_name || "");
    } },
    { key: "first_name", header: "שם פרטי", field: "first_name", filterable: true, render: (c) => {
      const m = memberMap[c.member_id];
      return m ? <NameButton m={m} label={c.first_name || ""} /> : (c.first_name || "");
    } },
    { key: "amount", header: "סכום", field: "amount", render: (c) => c.amount < 0
      ? <span className="font-semibold text-red-600">−₪{fmt(Math.abs(c.amount))}</span>
      : <span className="font-semibold text-emerald-600">₪{fmt(c.amount)}</span> },
    { key: "date", header: "תאריך", field: "date", headerClassName: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell text-muted-foreground", render: (c) => c.date || "—" },
    { key: "action", header: "", render: (c) => (
      <Button size="icon" variant="ghost" onClick={() => removeCollection(c)} className="h-7 w-7 text-destructive hover:text-destructive">
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <PiggyBank className="w-6 h-6 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">איסוף קופות</h1>
            <p className="text-sm text-muted-foreground">סבבי איסוף לכל חבר — היסטוריה מלאה וייצוא לפי סבב</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PrintStickers members={members} disabled={loading || members.length === 0} />
          <Button variant="outline" onClick={() => setExportOpen(true)} disabled={collections.length === 0}>
            <Download className="w-4 h-4" /> ייצוא CSV
          </Button>
        </div>
      </div>

      {/* Round bar */}
      <div className="rounded-2xl border bg-card p-4 grid md:grid-cols-12 gap-3">
        <div className="space-y-1.5 md:col-span-5">
          <Label>סבב איסוף נוכחי</Label>
          <Select value={fund} onValueChange={setFund}>
            <SelectTrigger className="w-full"><SelectValue placeholder="בחר סבב" /></SelectTrigger>
            <SelectContent>
              {rounds.map((r) => (
                <SelectItem key={r.fund} value={r.fund}>
                  {r.fund} · ₪{fmt(r.total)} ({r.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label>תאריך ברירת מחדל</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end gap-1 md:col-span-2">
          <Button variant="outline" onClick={() => setNewRoundOpen(true)} className="justify-start">
            <Plus className="w-4 h-4" /> איסוף חדש
          </Button>
        </div>
        <div className="flex flex-col justify-end gap-1 md:col-span-2">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">נאסף בסבב זה</p>
            <p className="text-xl font-bold text-amber-700">₪{fmt(totalCollected)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{contributorsCount} תורמים · {fundCols.length} איסופים</p>
        </div>
      </div>

      {/* Scan bar */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-amber-700 font-medium">
          <ScanLine className="w-5 h-5" />
          סריקת מדבקה
        </div>
        <Input
          ref={scanRef}
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={handleScan}
          placeholder="סריקת מדבקה (ת.ז. + Enter) או חיפוש לפי שם / כתובת…"
          className="flex-1 min-w-[240px] max-w-xl"
        />
        <span className="text-xs text-amber-700/80">ת.ז. + Enter פותח את הסכום; הקלדת שם מסננת את הטבלה. אחרי שמירה (Enter) המיקוד חוזר לכאן</span>
      </div>

      {/* Ad-hoc collection row (no name) */}
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-amber-700 whitespace-nowrap">איסוף ללא שם</span>
          <Input
            ref={adhocNameRef}
            value={adhoc.name}
            onChange={(e) => setAdhoc((a) => ({ ...a, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adhocAmountRef.current?.focus(); } }}
            placeholder="שם מלא (לא מתוך רשימת הקהילה)"
            className="flex-1 min-w-[180px] max-w-xs"
          />
          <Input
            ref={adhocAmountRef}
            type="number"
            inputMode="decimal"
            value={adhoc.amount}
            onChange={(e) => setAdhoc((a) => ({ ...a, amount: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); collectAdhoc(); } }}
            placeholder="₪ סכום"
            className="w-28"
          />
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={adhoc.refund}
              onChange={(e) => setAdhoc((a) => ({ ...a, refund: e.target.checked }))}
              className="w-4 h-4 accent-red-600"
              title="סמן לרישום החזר/זיכוי"
            />
            החזר
          </label>
          <Button size="sm" variant={adhoc.refund ? "destructive" : "default"} onClick={collectAdhoc} disabled={saving === "adhoc"} className="h-9">
            {saving === "adhoc" ? "..." : adhoc.refund ? "רשום החזר" : "רשום איסוף"}
          </Button>
        </div>
      </div>

      {/* Members table */}
      <DataTable
        rows={filteredMembers}
        columns={memberColumns}
        stickyColumns={2}
        loading={loading}
        emptyMessage="לא נמצאו חברים"
        searchFields={memberSearchFields}
        toolbar={neighborhoodToolbar}
        externalSearch={scanValue}
        onExternalSearchChange={setScanValue}
      />

      {/* Collections list for the round */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            איסופים בסבב: {fund}
          </h2>
          <span className="text-sm text-muted-foreground">{fundCols.length} רשומות · ₪{fmt(totalCollected)}</span>
        </div>
        <DataTable
          rows={fundColsDisplay}
          columns={colColumns}
          stickyColumns={2}
          emptyMessage="עדיין אין איסופים בסבב זה"
          searchPlaceholder="חיפוש באיסופים..."
          searchFields={["name", "first_name", "last_name", "id_number"]}
          pageSize={50}
          initialSort={{ field: "amount", dir: "desc" }}
        />
      </div>

      <MemberCollectionHistory
        member={historyMember}
        collections={collections}
        currentFund={fund}
        onDelete={removeCollection}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <ExportRoundDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        currentFund={fund}
        currentCount={fundCols.length}
        totalCount={collections.length}
        onChoose={handleExportChoice}
      />

      {/* New round dialog */}
      <Dialog open={newRoundOpen} onOpenChange={setNewRoundOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>סבב איסוף חדש</DialogTitle>
            <DialogDescription>הנתונים שנאספו עד כה יישמרו — רק יוסתרו מהתצוגה עד שתחזרו לסבב הקודם.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>שם הסבב</Label>
            <Input
              value={newRoundName}
              onChange={(e) => setNewRoundName(e.target.value)}
              placeholder='לדוגמה: חודש חשוון'
              onKeyDown={(e) => { if (e.key === "Enter") createNewRound(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewRoundOpen(false)}>ביטול</Button>
            <Button onClick={createNewRound}>צור סבב</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}