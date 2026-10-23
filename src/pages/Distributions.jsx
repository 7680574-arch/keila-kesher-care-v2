import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Gift, Plus, Upload, Users, Calendar, ArrowLeft, Wallet, Search, Trash2, Lock, FolderPlus, ArrowRight } from "lucide-react";
import GroupCard from "@/components/distributions/GroupCard";
import GroupFormDialog from "@/components/distributions/GroupFormDialog";
import CommunityImport from "@/components/CommunityImport";
import LockAllDistributedButton from "@/components/LockAllDistributedButton";
import DistributionFormDialog from "@/components/DistributionFormDialog";
import { HolidayBadge, DistributionTypeBadge, DistributionStatusBadge, RecurrenceBadge, holidayLabels, typeLabels } from "@/components/distributionBadges";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL")}`;

export default function Distributions() {
  const [distributions, setDistributions] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fHoliday, setFHoliday] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [groups, setGroups] = useState([]);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [groupDialog, setGroupDialog] = useState({ open: false, group: null });

  const load = async () => {
    setLoading(true);
    const [d, r, m, g] = await Promise.all([
      base44.entities.Distribution.list("-created_date", 100),
      base44.entities.DistributionRecipient.list("-created_date", 10000),
      base44.entities.CommunityMember.list(),
      base44.entities.DistributionGroup.list("-created_date", 200),
    ]);
    setDistributions(d);
    setRecipients(r);
    setMembersCount(m.length);
    setGroups(g);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const byDist = {};
    for (const r of recipients) {
      byDist[r.distribution_id] = byDist[r.distribution_id] || { count: 0, total: 0, delivered: 0 };
      byDist[r.distribution_id].count++;
      byDist[r.distribution_id].total += Number(r.amount || 0);
      if (r.status === "delivered") byDist[r.distribution_id].delivered++;
    }
    return byDist;
  }, [recipients]);

  const openGroup = groups.find((g) => g.id === openGroupId) || null;
  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const groupCounts = useMemo(() => {
    const c = {};
    distributions.forEach((d) => { if (d.group_id) c[d.group_id] = (c[d.group_id] || 0) + 1; });
    return c;
  }, [distributions]);

  const filteredD = useMemo(() => {
    const q = search.trim();
    return distributions.filter((d) => {
      // Inside a folder: only its distributions. At the top level: only ungrouped ones.
      const inGroup = d.group_id && groupIds.has(d.group_id);
      if (openGroupId ? d.group_id !== openGroupId : inGroup) return false;
      if (fHoliday !== "all" && d.holiday !== fHoliday) return false;
      if (fStatus !== "all" && d.status !== fStatus) return false;
      if (q && !`${d.title} ${d.notes || ""}`.includes(q)) return false;
      return true;
    });
  }, [distributions, search, fHoliday, fStatus, openGroupId, groupIds]);

  const deleteGroup = async (g) => {
    const cnt = groupCounts[g.id] || 0;
    if (!confirm(`למחוק את הקבוצה "${g.name}"?${cnt > 0 ? `\n${cnt} החלוקות שבה לא יימחקו, הן יחזרו לרשימה הכללית.` : ""}`)) return;
    const inside = distributions.filter((d) => d.group_id === g.id);
    await Promise.all(inside.map((d) => base44.entities.Distribution.update(d.id, { group_id: "" })));
    await base44.entities.DistributionGroup.delete(g.id);
    if (openGroupId === g.id) setOpenGroupId(null);
    load();
  };

  const deleteDist = async (d) => {
    const cnt = counts[d.id]?.count || 0;
    if (!confirm(`למחוק את החלוקה "${d.title}"?${cnt > 0 ? `\n${cnt} מקבלים יימחקו יחד איתה.` : ""}`)) return;
    try {
      await base44.entities.DistributionRecipient.deleteMany({ distribution_id: d.id });
    } catch (e) { /* אין מקבלים — התעלם */ }
    await base44.entities.Distribution.delete(d.id);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="w-7 h-7 text-primary" /> חלוקות חגים
          </h1>
          <p className="text-muted-foreground mt-1">ניהול חלוקות לחגים עבור כלל הקהילה — מזומן, מוצרים, תווים ועוד</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setGroupDialog({ open: true, group: null })}>
            <FolderPlus className="w-4 h-4 ml-1" /> קבוצת חלוקות חדשה
          </Button>
          <LockAllDistributedButton distributions={distributions} recipients={recipients} onDone={load} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 ml-1" /> העלאת רשימת קהילה
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 ml-1" /> הוסף חלוקה
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/community" className="bg-card rounded-2xl border border-border p-5 hover:border-primary hover:shadow-md transition group block">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users className="w-6 h-6" /></div>
          <p className="text-2xl font-bold mt-3 group-hover:text-primary transition">{membersCount}</p>
          <p className="text-sm text-muted-foreground">חברים ברשימת הקהילה ←</p>
        </Link>
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Gift className="w-6 h-6" /></div>
          <p className="text-2xl font-bold mt-3">{distributions.length}</p>
          <p className="text-sm text-muted-foreground">חלוקות</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><ArrowLeft className="w-6 h-6" /></div>
          <p className="text-2xl font-bold mt-3">{recipients.length}</p>
          <p className="text-sm text-muted-foreground">שיבוצים למקבלים</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש חלוקה…" className="pr-9" />
        </div>
        <div className="w-40">
          <Select value={fHoliday} onValueChange={setFHoliday}>
            <SelectTrigger><SelectValue placeholder="חג" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החגים</SelectItem>
              {Object.entries(holidayLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="סטטוס" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="planning">בתכנון</SelectItem>
              <SelectItem value="active">פעילה</SelectItem>
              <SelectItem value="completed">הושלמה</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {openGroup && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setOpenGroupId(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowRight className="w-4 h-4" /> חזרה לכל החלוקות
          </button>
          <h2 className="text-xl font-bold">📁 {openGroup.name}</h2>
          <Button variant="outline" size="sm" onClick={() => setGroupDialog({ open: true, group: openGroup })}>ניהול החלוקות בקבוצה</Button>
        </div>
      )}

      {!openGroup && !loading && groups.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              count={groupCounts[g.id] || 0}
              onOpen={() => setOpenGroupId(g.id)}
              onEdit={() => setGroupDialog({ open: true, group: g })}
              onDelete={() => deleteGroup(g)}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filteredD.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Gift className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">אין חלוקות עדיין — התחילו בהעלאת רשימת הקהילה ואז בהוספת חלוקה.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredD.map((d) => {
            const c = counts[d.id] || { count: 0, total: 0, delivered: 0 };
            return (
              <Link key={d.id} to={`/distributions/${d.id}`} className="bg-card rounded-2xl border border-border p-5 hover:border-primary hover:shadow-md transition group">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <HolidayBadge holiday={d.holiday} />
                    <DistributionTypeBadge type={d.type} />
                  </div>
                  <div className="flex items-center gap-2">
                    {d.data_locked && <span title="נתוני המקבלים קבועים" className="text-amber-700"><Lock className="w-4 h-4" /></span>}
                    <DistributionStatusBadge status={d.status} />
                    {d.recurrence && d.recurrence !== "none" && <RecurrenceBadge recurrence={d.recurrence} />}
                  </div>
                </div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition">{d.title}</h3>
                {d.date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Calendar className="w-3.5 h-3.5" /> {d.date}</p>
                )}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-4 h-4" /> {c.count} מקבלים</span>
                  <span className="flex items-center gap-1 font-semibold"><Wallet className="w-4 h-4 text-primary" /> {fmt(c.total)}</span>
                </div>
                {c.count > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.delivered / c.count) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">נמסרו {c.delivered} מתוך {c.count}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border">
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteDist(d); }} className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 transition">
                    <Trash2 className="w-3.5 h-3.5" /> מחיקת חלוקה
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CommunityImport open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <DistributionFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={load}
        groups={groups}
        defaultGroupId={openGroupId}
      />

      <GroupFormDialog
        open={groupDialog.open}
        onOpenChange={(o) => setGroupDialog((s) => ({ ...s, open: o }))}
        onSaved={load}
        group={groupDialog.group}
        distributions={distributions}
      />
    </div>
  );
}