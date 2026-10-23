import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Pencil, Trash2, Building2, Users, Award, ListChecks, DoorOpen, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

function parseResidents(r) {
  if (!r) return [];
  try {
    const arr = typeof r === "string" ? JSON.parse(r) : r;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
import BuildingDialog from "@/components/cleaning/BuildingDialog";
import BuildingDetailDialog from "@/components/cleaning/BuildingDetailDialog";
import VolunteerDialog from "@/components/cleaning/VolunteerDialog";
import CommitteeDialog from "@/components/cleaning/CommitteeDialog";
import CleaningTaskDialog from "@/components/cleaning/CleaningTaskDialog";
import MeetingsTab from "@/components/cleaning/MeetingsTab";
import MeetingDetailDialog from "@/components/cleaning/MeetingDetailDialog";

const STATUS_LABEL = { clean: "נוקה", dirty: "לא נוקה", in_progress: "בטיפול" };
const STATUS_COLOR = {
  clean: "bg-emerald-100 text-emerald-700",
  dirty: "bg-rose-100 text-rose-700",
  in_progress: "bg-amber-100 text-amber-700",
};

export default function CleaningManagement() {
  const { toast } = useToast();
  const [tab, setTab] = useState("buildings");

  const [buildings, setBuildings] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [committee, setCommittee] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [meetingDlg, setMeetingDlg] = useState({ open: false, meeting: null });
  const [loading, setLoading] = useState(true);

  const [dlgBuilding, setDlgBuilding] = useState({ open: false, editing: null });
  const [detailDlg, setDetailDlg] = useState({ open: false, building: null });
  const [dlgVolunteer, setDlgVolunteer] = useState({ open: false, editing: null });
  const [dlgCommittee, setDlgCommittee] = useState({ open: false, editing: null });
  const [dlgTask, setDlgTask] = useState({ open: false, editing: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, v, c, t, m] = await Promise.all([
        base44.entities.CleaningBuilding.filter({}, { sort: "name", limit: 500 }),
        base44.entities.CleaningVolunteer.filter({}, { sort: "name", limit: 500 }),
        base44.entities.CleaningCommitteeMember.filter({}, { sort: "name", limit: 500 }),
        base44.entities.CleaningTask.filter({}, { sort: "-created_date", limit: 500 }),
        base44.entities.CleaningMeeting.filter({}, { sort: "-date", limit: 500 }),
      ]);
      setMeetings(m.items || []);
      setBuildings(b.items || []);
      setVolunteers(v.items || []);
      setCommittee(c.items || []);
      setTasks(t.items || []);
    } catch (e) {
      toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ---- Buildings CRUD ----
  const saveBuilding = async (data) => {
    try {
      if (dlgBuilding.editing) {
        await base44.entities.CleaningBuilding.update(dlgBuilding.editing.id, data);
      } else {
        await base44.entities.CleaningBuilding.create(data);
      }
      toast({ title: "הבניין נשמר" });
      await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const delBuilding = async (b) => {
    if (!confirm(`למחוק את הבניין "${b.name}"?`)) return;
    try { await base44.entities.CleaningBuilding.delete(b.id); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const updateBuilding = async (id, data) => {
    try {
      await base44.entities.CleaningBuilding.update(id, data);
      setDetailDlg((d) => ({ ...d, building: { ...d.building, ...data } }));
      await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  // ---- Volunteers CRUD ----
  const saveVolunteer = async (data) => {
    try {
      if (dlgVolunteer.editing) await base44.entities.CleaningVolunteer.update(dlgVolunteer.editing.id, data);
      else await base44.entities.CleaningVolunteer.create(data);
      toast({ title: "המתנדב נשמר" }); await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const delVolunteer = async (v) => {
    if (!confirm(`למחוק את "${v.name}"?`)) return;
    try { await base44.entities.CleaningVolunteer.delete(v.id); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  // ---- Committee CRUD ----
  const saveCommittee = async (data) => {
    try {
      if (dlgCommittee.editing) await base44.entities.CleaningCommitteeMember.update(dlgCommittee.editing.id, data);
      else await base44.entities.CleaningCommitteeMember.create(data);
      toast({ title: "חבר הועדה נשמר" }); await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const delCommittee = async (c) => {
    if (!confirm(`למחוק את "${c.name}"?`)) return;
    try { await base44.entities.CleaningCommitteeMember.delete(c.id); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  // ---- Tasks CRUD ----
  const saveMeeting = async (data, existing) => {
    try {
      if (existing) await base44.entities.CleaningMeeting.update(existing.id, data);
      else await base44.entities.CleaningMeeting.create(data);
      toast({ title: "הישיבה נשמרה" }); await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const delMeeting = async (m) => {
    if (!confirm(`למחוק את הישיבה "${m.title}"?`)) return;
    try { await base44.entities.CleaningMeeting.delete(m.id); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  const saveTask = async (data, editingOverride) => {
    const editingTask = editingOverride || dlgTask.editing;
    try {
      if (editingTask) await base44.entities.CleaningTask.update(editingTask.id, data);
      else await base44.entities.CleaningTask.create(data);
      toast({ title: "נשמר" }); await loadAll();
    } catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const delTask = async (t) => {
    if (!confirm(`למחוק "${t.title}"?`)) return;
    try { await base44.entities.CleaningTask.delete(t.id); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };
  const toggleTaskDone = async (t) => {
    try { await base44.entities.CleaningTask.update(t.id, { status: t.status === "done" ? "pending" : "done" }); await loadAll(); }
    catch (e) { toast({ title: "שגיאה", description: e.message, variant: "destructive" }); }
  };

  useEffect(() => {
    setMeetingDlg((d) => {
      if (!d.meeting) return d;
      const fresh = meetings.find((m) => m.id === d.meeting.id);
      return fresh && fresh !== d.meeting ? { ...d, meeting: fresh } : d;
    });
  }, [meetings]);

  const buildingsMap = useMemo(() => Object.fromEntries(buildings.map((b) => [b.id, b])), [buildings]);
  const volunteersMap = useMemo(() => Object.fromEntries(volunteers.map((v) => [v.id, v])), [volunteers]);
  const committeeMap = useMemo(() => Object.fromEntries(committee.map((c) => [c.id, c])), [committee]);

  const TABS = [
    { id: "buildings", label: "בניינים וחניות", icon: Building2 },
    { id: "volunteers", label: "מתנדבים", icon: Users },
    { id: "committee", label: "חברי ועדה", icon: Award },
    { id: "tasks", label: "משימות והערות", icon: ListChecks },
    { id: "meetings", label: "ישיבות", icon: CalendarDays },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">ניהול ניקיון הקריה</h1>
          <p className="text-muted-foreground text-sm">ניהול בניינים, חניות, מתנדבים, חברי ועדה, משימות והערות</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : tab === "buildings" ? (
        <BuildingsTab
          buildings={buildings}
          onAdd={() => setDlgBuilding({ open: true, editing: null })}
          onDelete={delBuilding}
          onOpen={(b) => setDetailDlg({ open: true, building: b })}
        />
      ) : tab === "volunteers" ? (
        <VolunteersTab
          volunteers={volunteers}
          onAdd={() => setDlgVolunteer({ open: true, editing: null })}
          onEdit={(v) => setDlgVolunteer({ open: true, editing: v })}
          onDelete={delVolunteer}
        />
      ) : tab === "committee" ? (
        <CommitteeTab
          committee={committee}
          onAdd={() => setDlgCommittee({ open: true, editing: null })}
          onEdit={(c) => setDlgCommittee({ open: true, editing: c })}
          onDelete={delCommittee}
        />
      ) : tab === "meetings" ? (
        <MeetingsTab
          meetings={meetings}
          tasks={tasks}
          onAdd={() => setMeetingDlg({ open: true, meeting: null })}
          onOpen={(m) => setMeetingDlg({ open: true, meeting: m })}
          onDelete={delMeeting}
        />
      ) : (
        <TasksTab
          tasks={tasks}
          buildingsMap={buildingsMap}
          volunteersMap={volunteersMap}
          committeeMap={committeeMap}
          onAdd={() => setDlgTask({ open: true, editing: null })}
          onEdit={(t) => setDlgTask({ open: true, editing: t })}
          onDelete={delTask}
          onToggle={toggleTaskDone}
        />
      )}

      <BuildingDialog open={dlgBuilding.open} onOpenChange={(o) => setDlgBuilding({ open: o, editing: null })} editing={dlgBuilding.editing} onSave={saveBuilding} />
      <BuildingDetailDialog
        open={detailDlg.open}
        onOpenChange={(o) => setDetailDlg({ open: o, building: null })}
        building={detailDlg.building}
        onUpdateBuilding={updateBuilding}
        tasks={tasks}
        buildings={buildings}
        volunteers={volunteers}
        committee={committee}
        onSaveTask={saveTask}
        onDeleteTask={delTask}
        onToggleTask={toggleTaskDone}
      />
      <MeetingDetailDialog
        open={meetingDlg.open}
        onOpenChange={(o) => setMeetingDlg({ open: o, meeting: o ? meetingDlg.meeting : null })}
        meeting={meetingDlg.meeting}
        onSaveMeeting={saveMeeting}
        tasks={tasks}
        buildings={buildings}
        volunteers={volunteers}
        committee={committee}
        onSaveTask={saveTask}
        onDeleteTask={delTask}
        onToggleTask={toggleTaskDone}
      />
      <VolunteerDialog open={dlgVolunteer.open} onOpenChange={(o) => setDlgVolunteer({ open: o, editing: null })} editing={dlgVolunteer.editing} onSave={saveVolunteer} />
      <CommitteeDialog open={dlgCommittee.open} onOpenChange={(o) => setDlgCommittee({ open: o, editing: null })} editing={dlgCommittee.editing} onSave={saveCommittee} />
      <CleaningTaskDialog open={dlgTask.open} onOpenChange={(o) => setDlgTask({ open: o, editing: null })} editing={dlgTask.editing} onSave={saveTask} buildings={buildings} volunteers={volunteers} committee={committee} />
    </div>
  );
}

function SectionHeader({ title, count, onAdd }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold">{title} ({count})</h2>
      <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> הוסף</Button>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">{text}</div>
  );
}

function BuildingsTab({ buildings, onAdd, onDelete, onOpen }) {
  return (
    <div>
      <SectionHeader title="בניינים" count={buildings.length} onAdd={onAdd} />
      {buildings.length === 0 ? <EmptyState text="אין בניינים עדיין. לחץ על הוסף כדי ליצור." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {buildings.map((b) => {
            const residents = parseResidents(b.residents);
            return (
              <div
                key={b.id}
                onClick={() => onOpen(b)}
                className="border border-border rounded-lg p-4 bg-card cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{b.name}</p>
                    {b.address && <p className="text-sm text-muted-foreground truncate">{b.address}</p>}
                  </div>
                  <span className={cn("text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap", STATUS_COLOR[b.status])}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div><span className="text-muted-foreground">אחראי: </span>{b.responsible_name || "—"}</div>
                  <div><span className="text-muted-foreground">טלפון: </span>{b.responsible_phone || "—"}</div>
                </div>
                {residents.length > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary">
                    <DoorOpen className="w-4 h-4" />
                    דיירים ({residents.length})
                  </div>
                )}
                {b.notes && <p className="text-sm text-muted-foreground mt-2 border-t border-border pt-2">{b.notes}</p>}
                <div className="flex justify-end gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(b)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VolunteersTab({ volunteers, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <SectionHeader title="מתנדבים" count={volunteers.length} onAdd={onAdd} />
      {volunteers.length === 0 ? <EmptyState text="אין מתנדבים עדיין." /> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-right px-3 py-2 font-semibold">שם</th>
                <th className="text-right px-3 py-2 font-semibold">טלפון</th>
                <th className="text-right px-3 py-2 font-semibold">הערות</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {volunteers.map((v, i) => (
                <tr key={v.id} className={cn("border-t border-border", i % 2 && "bg-muted/10")}>
                  <td className="px-3 py-2 font-medium">{v.name}</td>
                  <td className="px-3 py-2">{v.phone || "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate text-muted-foreground">{v.notes || "—"}</td>
                  <td className="px-3 py-2 text-left whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(v)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(v)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommitteeTab({ committee, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <SectionHeader title="חברי ועדה" count={committee.length} onAdd={onAdd} />
      {committee.length === 0 ? <EmptyState text="אין חברי ועדה עדיין." /> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-right px-3 py-2 font-semibold">שם</th>
                <th className="text-right px-3 py-2 font-semibold">תפקיד</th>
                <th className="text-right px-3 py-2 font-semibold">טלפון</th>
                <th className="text-right px-3 py-2 font-semibold">הערות</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {committee.map((c, i) => (
                <tr key={c.id} className={cn("border-t border-border", i % 2 && "bg-muted/10")}>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">{c.role || "—"}</td>
                  <td className="px-3 py-2">{c.phone || "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate text-muted-foreground">{c.notes || "—"}</td>
                  <td className="px-3 py-2 text-left whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(c)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TasksTab({ tasks, buildingsMap, volunteersMap, committeeMap, onAdd, onEdit, onDelete, onToggle }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => {
    if (filter === "pending") return tasks.filter((t) => t.type === "task" && t.status !== "done");
    if (filter === "notes") return tasks.filter((t) => t.type === "note");
    if (filter === "done") return tasks.filter((t) => t.type === "task" && t.status === "done");
    return tasks;
  }, [tasks, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2">
          {[
            { id: "all", label: "הכל" },
            { id: "pending", label: "משימות פתוחות" },
            { id: "done", label: "משימות שהושלמו" },
            { id: "notes", label: "הערות" },
          ].map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)}>{f.label}</Button>
          ))}
        </div>
        <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> הוסף משימה / הערה</Button>
      </div>
      {filtered.length === 0 ? <EmptyState text="אין פריטים בסינון הנוכחי." /> : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const bld = t.building_id ? buildingsMap[t.building_id] : null;
            const vol = t.volunteer_id ? volunteersMap[t.volunteer_id] : null;
            const mem = t.committee_member_id ? committeeMap[t.committee_member_id] : null;
            const isTask = t.type !== "note";
            return (
              <div key={t.id} className="border border-border rounded-lg p-3 bg-card flex items-start gap-3">
                {isTask && (
                  <Checkbox checked={t.status === "done"} onCheckedChange={() => onToggle(t)} className="mt-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                    <span className={cn("text-[11px] px-1.5 py-0.5 rounded", isTask ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {isTask ? "משימה" : "הערה"}
                    </span>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {t.meeting_id && <span>📋 ישיבה</span>}
                    {bld && <span>🏢 {bld.name}</span>}
                    {vol && <span>🧹 {vol.name}</span>}
                    {(mem || t.assignee_name) && <span>👤 {mem?.name || t.assignee_name}</span>}
                    {isTask && t.due_date && <span>📅 {t.due_date}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(t)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}