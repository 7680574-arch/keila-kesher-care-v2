import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, FolderPlus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, CaseTypeBadge, PriorityBadge } from "@/components/badges";
import CaseForm from "@/components/CaseForm";
import ExportCsvButton from "@/components/ExportCsvButton";

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    const [c, cl] = await Promise.all([
      base44.entities.Case.list("-created_date", 100),
      base44.entities.CommunityMember.list("-created_date", 2000),
    ]);
    setCases(c);
    setClients(cl);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      const q = search.trim();
      if (q) {
        const hay = `${c.title} ${c.client_name} ${c.case_number || ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, search, statusFilter, typeFilter]);

  const exportColumns = [
    { header: "מספר תיק", get: (c) => c.case_number },
    { header: "כותרת", get: (c) => c.title },
    { header: "לקוח", get: (c) => c.client_name },
    { header: "סוג", get: (c) => c.type },
    { header: "סטטוס", get: (c) => c.status },
    { header: "עדיפות", get: (c) => c.priority },
    { header: "עובד מטפל", get: (c) => c.assigned_worker },
    { header: "תאריך פתיחה", get: (c) => c.opened_date },
    { header: "תיאור", get: (c) => c.description },
  ];

  const saveCase = async (data) => {
    await base44.entities.Case.create(data);
    setFormOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">תיקים</h1>
          <p className="text-muted-foreground mt-1">{cases.length} תיקים במערכת</p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton allRows={cases} filteredRows={filtered} columns={exportColumns} fileName="תיקים.csv" />
          <Button onClick={() => setFormOpen(true)} className="bg-primary">
            <FolderPlus className="w-4 h-4 ml-2" /> תיק חדש
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1fr_160px_160px] gap-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="חיפוש תיק..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="open">פתוח</SelectItem>
            <SelectItem value="in_progress">בטיפול</SelectItem>
            <SelectItem value="urgent">דחוף</SelectItem>
            <SelectItem value="closed">סגור</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="welfare">רווחה</SelectItem>
            <SelectItem value="medical">רפואי</SelectItem>
            <SelectItem value="mental_health">בריאות נפש</SelectItem>
            <SelectItem value="financial">כלכלי</SelectItem>
            <SelectItem value="legal">משפטי</SelectItem>
            <SelectItem value="other">אחר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <p className="text-muted-foreground">לא נמצאו תיקים</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all group">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{c.title}</p>
                    <CaseTypeBadge type={c.type} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {c.client_name} {c.assigned_worker ? `· ${c.assigned_worker}` : ""}
                  </p>
                  {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                  <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CaseForm open={formOpen} onOpenChange={setFormOpen} onSubmit={saveCase} members={clients} />
    </div>
  );
}