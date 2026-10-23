import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Calendar, CheckCircle2, Target, Trash2, Plus, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { useNavigate, useParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import ProjectTaskCard from "@/components/projmgmt/ProjectTaskCard";
import StatusUpdateForm from "@/components/projmgmt/StatusUpdateForm";
import ProjectTaskFormModal from "@/components/projmgmt/ProjectTaskFormModal";
import ProjectAgendaTab from "@/components/projects/ProjectAgendaTab";
import ProjectParticipantsTab from "@/components/projects/ProjectParticipantsTab";
import ProjectExpensesTab from "@/components/projects/ProjectExpensesTab";
import CommunityInviteesDialog from "@/components/projects/CommunityInviteesDialog";
import PasteIdsDialog from "@/components/projects/PasteIdsDialog";
import ProjectTasksBar from "@/components/projects/ProjectTasksBar";
import ProjectParticipantsFilter from "@/components/projects/ProjectParticipantsFilter";
import ItemFormDialog from "@/components/projects/ItemFormDialog";
import ExportCsvButton from "@/components/ExportCsvButton";
import { useMembersMap, withMember } from "@/hooks/useMembersMap";
import { PARTICIPANT_STATUS } from "@/lib/projectLabels";
import { calcEndTime } from "@/lib/agendaTime";
import { printAgenda } from "@/lib/printAgenda";
import { GOAL_STATUS_LABELS } from "@/lib/projMgmtLabels";

const GOAL_STATUS_BADGE = {
  draft: "bg-slate-50 text-slate-600 ring-slate-500/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const [agendaItems, setAgendaItems] = useState([]);
  const [agendaDialog, setAgendaDialog] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantDialog, setParticipantDialog] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [communityDialog, setCommunityDialog] = useState(false);
  const [pasteIdsDialog, setPasteIdsDialog] = useState(false);
  const [hideInviteeTasks, setHideInviteeTasks] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskStateFilter, setTaskStateFilter] = useState("all");
  const [expenses, setExpenses] = useState([]);
  const { map: membersMap } = useMembersMap();
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const load = useCallback(async () => {
    try {
      const tPage = await base44.entities.ProjectTask.filter({ goal_id: id }, { sort: "order", limit: 500 });
      setTasks(tPage.items || []);
      try { setGoal(await base44.entities.Goal.get(id)); }
      catch { setGoal(null); }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAgenda = useCallback(async () => {
    try {
      const page = await base44.entities.ProjectItem.filter({ goal_id: id, type: "agenda" }, { sort: "order", limit: 500 });
      setAgendaItems(page.items || []);
    } catch (err) { console.error(err); }
  }, [id]);

  const loadParticipants = useCallback(async () => {
    try {
      const page = await base44.entities.ProjectItem.filter({ goal_id: id, type: "participant" }, { sort: "order", limit: 500 });
      setParticipants(page.items || []);
    } catch (err) { console.error(err); }
  }, [id]);

  const loadExpenses = useCallback(async () => {
    try {
      const page = await base44.entities.ProjectItem.filter({ goal_id: id, type: "expense" }, { sort: "-created_date", limit: 500 });
      setExpenses(page.items || []);
    } catch (err) { console.error(err); }
  }, [id]);

  const loadUser = useCallback(async () => { try { setUser(await base44.auth.me()); } catch {} }, []);

  useEffect(() => { load(); loadUser(); loadAgenda(); loadParticipants(); loadExpenses(); }, [load, loadUser, loadAgenda, loadParticipants, loadExpenses]);
  useEffect(() => {
    base44.functions.invoke("listAssignableUsers", {}).then((res) => setUsers(res?.data?.users || []));
  }, []);
  useEffect(() => { if (selectedTask) setSummaryDraft(selectedTask.summary || ""); }, [selectedTask]);

  const topTasks = useMemo(
    () => tasks.filter((t) => !t.parent_task_id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [tasks]
  );
  const subtasksByParent = useMemo(() => {
    const m = {};
    tasks.filter((t) => t.parent_task_id).forEach((t) => { (m[t.parent_task_id] ||= []).push(t); });
    return m;
  }, [tasks]);

  const taskExpenses = useMemo(() => {
    const parentTitle = (pid) => tasks.find((t) => t.id === pid)?.title;
    return tasks
      .filter((t) => t.cost != null && Number(t.cost) > 0)
      .map((t) => ({
        id: t.id, title: t.title, cost: Number(t.cost), paid_amount: Number(t.paid_amount) || 0,
        isSubtask: !!t.parent_task_id, parentTitle: t.parent_task_id ? parentTitle(t.parent_task_id) : null,
      }));
  }, [tasks]);

  const taskProgress = useCallback((t) => {
    const subs = subtasksByParent[t.id] || [];
    if (subs.length > 0) return subs.filter((s) => s.status === "done").length / subs.length;
    return t.status === "done" ? 1 : 0;
  }, [subtasksByParent]);

  const lastAgenda = agendaItems[agendaItems.length - 1];
  const defaultAgendaTime = lastAgenda && lastAgenda.time ? calcEndTime(lastAgenda.time, lastAgenda.duration_minutes) : "";

  const saveAgenda = async (data) => {
    if (editingAgenda) await base44.entities.ProjectItem.update(editingAgenda.id, data);
    else await base44.entities.ProjectItem.create({ ...data, goal_id: id, order: agendaItems.length });
    setAgendaDialog(false); setEditingAgenda(null); loadAgenda();
  };
  const deleteAgenda = async (item) => { await base44.entities.ProjectItem.delete(item.id); loadAgenda(); };
  const moveAgenda = async (idx, dir) => {
    const sorted = [...agendaItems];
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    [sorted[idx], sorted[j]] = [sorted[j], sorted[idx]];
    await base44.entities.ProjectItem.bulkUpdate(sorted.map((it, i) => ({ id: it.id, order: i })));
    loadAgenda();
  };

  const saveParticipant = async (data) => {
    if (editingParticipant) await base44.entities.ProjectItem.update(editingParticipant.id, data);
    else await base44.entities.ProjectItem.create({ ...data, goal_id: id, type: "participant", order: participants.length });
    setParticipantDialog(false); setEditingParticipant(null); loadParticipants();
  };
  const deleteParticipant = async (p) => { await base44.entities.ProjectItem.delete(p.id); loadParticipants(); };
  const inviteeTasks = useMemo(() => {
    if (!goal?.tasks) return [];
    try { return JSON.parse(goal.tasks); } catch { return []; }
  }, [goal]);
  const addInviteeTask = (label) => {
    if (!label || inviteeTasks.includes(label)) return false;
    base44.entities.Goal.update(id, { tasks: JSON.stringify([...inviteeTasks, label]) }).then((g) => setGoal(g));
    return true;
  };
  const removeInviteeTask = (idx) => {
    const next = inviteeTasks.filter((_, i) => i !== idx);
    base44.entities.Goal.update(id, { tasks: JSON.stringify(next) }).then((g) => setGoal(g));
  };
  const toggleInviteeTask = async (p, taskLabel) => {
    const done = (() => { try { return JSON.parse(p.tasks_done || "[]"); } catch { return []; } })();
    const next = done.includes(taskLabel) ? done.filter((t) => t !== taskLabel) : [...done, taskLabel];
    const updated = await base44.entities.ProjectItem.update(p.id, { tasks_done: JSON.stringify(next) });
    setParticipants((list) => list.map((x) => (x.id === p.id ? updated : x)));
  };
  const filteredParticipants = useMemo(() => {
    if (!taskFilter || taskFilter === "all") return participants;
    return participants.filter((p) => {
      const done = (() => { try { return JSON.parse(p.tasks_done || "[]"); } catch { return []; } })();
      const isDone = done.includes(taskFilter);
      if (taskStateFilter === "done") return isDone;
      if (taskStateFilter === "not_done") return !isDone;
      return true;
    });
  }, [participants, taskFilter, taskStateFilter]);

  const participantExportColumns = useMemo(() => {
    const cols = [
      { key: "title", label: "שם" },
      { key: "phone", label: "טלפון" },
      { key: "statusLabel", label: "סטטוס" },
      { key: "guests_count", label: "מספר מגיעים" },
      { key: "address", label: "כתובת מעודכנת" },
    ];
    inviteeTasks.forEach((t) => cols.push({ key: `task_${t}`, label: t }));
    cols.push({ key: "notes", label: "הערות" });
    return cols;
  }, [inviteeTasks]);

  const buildParticipantRows = (list) => list.map((p) => {
    const enriched = withMember(p, membersMap);
    const done = (() => { try { return JSON.parse(p.tasks_done || "[]"); } catch { return []; } })();
    const row = {
      title: enriched.title || p.title,
      phone: enriched.phone || p.phone || "",
      statusLabel: PARTICIPANT_STATUS[p.status] || PARTICIPANT_STATUS.invited,
      guests_count: p.guests_count || "",
      address: enriched.address || [enriched.city, enriched.street, enriched.house_number].filter(Boolean).join(" "),
      notes: p.notes || "",
    };
    inviteeTasks.forEach((t) => { row[`task_${t}`] = done.includes(t) ? "✓" : ""; });
    return row;
  });

  const addCommunityInvitees = async (members) => {
    const existing = new Set(participants.map((p) => p.member_id).filter(Boolean));
    const toCreate = members.filter((m) => !existing.has(m.id));
    if (toCreate.length === 0) { setCommunityDialog(false); return; }
    await base44.entities.ProjectItem.bulkCreate(
      toCreate.map((m) => ({ goal_id: id, type: "participant", title: m.name, member_id: m.id, phone: m.mobile || m.phone || "", email: m.email || "", status: "invited", order: participants.length }))
    );
    setCommunityDialog(false); loadParticipants();
  };

  const saveExpense = async (data) => {
    if (editingExpense) await base44.entities.ProjectItem.update(editingExpense.id, data);
    else await base44.entities.ProjectItem.create({ ...data, goal_id: id, type: "expense", order: expenses.length });
    setExpenseDialog(false); setEditingExpense(null); loadExpenses();
  };
  const deleteExpense = async (e) => { await base44.entities.ProjectItem.delete(e.id); loadExpenses(); };
  const updateTaskPaid = async (taskId, paid) => { await base44.entities.ProjectTask.update(taskId, { paid_amount: paid }); load(); };
  const updateExpensePaid = async (itemId, paid) => { await base44.entities.ProjectItem.update(itemId, { paid_amount: paid }); loadExpenses(); };

  if (loading) return <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!goal) return <p className="py-20 text-center text-muted-foreground">הפרויקט לא נמצא</p>;

  const doneTasks = topTasks.filter((t) => taskProgress(t) === 1).length;
  const blockedTasks = topTasks.filter((t) => t.status === "blocked").length;
  const progress = topTasks.length > 0 ? Math.round(topTasks.reduce((s, t) => s + taskProgress(t), 0) / topTasks.length * 100) : 0;

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.ProjectTask.deleteMany({ goal_id: id });
    await base44.entities.ProjectItem.deleteMany({ goal_id: id });
    await base44.entities.Goal.delete(id);
    navigate("/projects");
  };
  const handleMarkComplete = async () => { await base44.entities.Goal.update(id, { status: "completed" }); load(); };
  const handleDeleteTask = async (taskId) => {
    await base44.entities.ProjectTask.deleteMany({ parent_task_id: taskId });
    await base44.entities.ProjectTask.delete(taskId);
    setConfirmDeleteTask(null); load();
  };
  const saveSummary = async () => {
    if (!selectedTask) return;
    setSavingSummary(true);
    try {
      await base44.entities.ProjectTask.update(selectedTask.id, { summary: summaryDraft || undefined });
      setSelectedTask({ ...selectedTask, summary: summaryDraft });
      load();
    } finally { setSavingSummary(false); }
  };

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowRight className="w-4 h-4" />חזרה לפרויקטים
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", GOAL_STATUS_BADGE[goal.status] || GOAL_STATUS_BADGE.draft)}>
              {GOAL_STATUS_LABELS[goal.status] || goal.status}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{goal.title}</h1>
          {goal.description && <p className="text-muted-foreground mt-1 max-w-xl">{goal.description}</p>}
          {goal.target_date && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />תאריך יעד: {format(new Date(goal.target_date), "d בMMM yyyy")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {goal.status === "active" && progress === 100 && (
            <Button variant="outline" onClick={handleMarkComplete}>
              <CheckCircle2 className="w-4 h-4 ml-2" />סמן כהושלם
            </Button>
          )}
          {!confirmDelete ? (
            <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 ml-2" />מחק
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">למחוק פרויקט וכל המשימות?</span>
              <Button onClick={handleDelete} disabled={deleting} className="bg-rose-600 hover:bg-rose-700">{deleting ? "מוחק…" : "כן, מחק"}</Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>ביטול</Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 sm:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">התקדמות</p>
            <span className="text-sm text-muted-foreground">{doneTasks}/{topTasks.length} משימות הושלמו</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-2xl font-bold mt-3">{progress}%</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex flex-col items-center justify-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground">חסומות</p>
          <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
            <span className={cn("text-2xl font-bold", blockedTasks > 0 ? "text-rose-600" : "text-foreground")}>{blockedTasks}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">משימות</TabsTrigger>
          <TabsTrigger value="agenda">סדר יום</TabsTrigger>
          <TabsTrigger value="invitees">מוזמנים</TabsTrigger>
          <TabsTrigger value="expenses">הוצאות</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">משימות</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{topTasks.length} סה"כ</span>
              <Button size="sm" onClick={() => setShowAddTask(true)}>
                <Plus className="w-4 h-4 ml-1" />הוסף משימה
              </Button>
            </div>
          </div>

          {topTasks.length > 0 ? (
            <div className="space-y-3">
              {topTasks.map((task) => (
                <div key={task.id} className="relative">
                  <ProjectTaskCard task={task} subtasks={subtasksByParent[task.id] || []} onClick={setSelectedTask} onSubtasksChanged={load} />
                  <div className="absolute top-3 left-3 flex items-center gap-1 z-10">
                    {confirmDeleteTask === task.id ? (
                      <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-muted-foreground">למחוק?</span>
                        <button onClick={() => handleDeleteTask(task.id)} className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-xs font-semibold">כן</button>
                        <button onClick={() => setConfirmDeleteTask(null)} className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-xs">לא</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteTask(task.id); }} className="p-1.5 rounded-lg bg-card border border-border text-muted-foreground hover:text-rose-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-16 text-center">
              <Target className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">אין משימות עדיין</p>
              <p className="text-sm text-muted-foreground mb-4">הוסף/י אחת ידנית או תני/ה ל-AI ליצור משימות.</p>
              <Button size="sm" onClick={() => setShowAddTask(true)}>
                <Plus className="w-4 h-4 ml-1" />הוסף משימה
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">סדר יום</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => printAgenda(goal, agendaItems)}>
                <Printer className="w-4 h-4 ml-1" />הדפס סדר יום
              </Button>
              <Button size="sm" onClick={() => { setEditingAgenda(null); setAgendaDialog(true); }}>
                <Plus className="w-4 h-4 ml-1" />הוסף נושא
              </Button>
            </div>
          </div>
          <ProjectAgendaTab items={agendaItems} onEdit={(a) => { setEditingAgenda(a); setAgendaDialog(true); }} onDelete={deleteAgenda} onMove={moveAgenda} />
        </TabsContent>

        <TabsContent value="invitees" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">מוזמנים</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{participants.length} מוזמנים</span>
              <Button variant="outline" size="sm" onClick={() => setPasteIdsDialog(true)}>
                <Plus className="w-4 h-4 ml-1" />הדבק ת"ז
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCommunityDialog(true)}>
                <Plus className="w-4 h-4 ml-1" />מהקהילה
              </Button>
              <Button size="sm" onClick={() => { setEditingParticipant(null); setParticipantDialog(true); }}>
                <Plus className="w-4 h-4 ml-1" />הוסף ידני
              </Button>
            </div>
          </div>
          <ProjectTasksBar
            tasks={inviteeTasks}
            hideTasks={hideInviteeTasks}
            onHideToggle={() => setHideInviteeTasks((v) => !v)}
            onAdd={addInviteeTask}
            onRemove={removeInviteeTask}
          />
          <ProjectParticipantsFilter
            tasks={inviteeTasks}
            taskFilter={taskFilter}
            stateFilter={taskStateFilter}
            onTaskChange={(v) => { setTaskFilter(v); if (v === "all") setTaskStateFilter("all"); }}
            onStateChange={setTaskStateFilter}
            resultCount={filteredParticipants.length}
            totalCount={participants.length}
          />
          <div className="flex justify-end">
            <ExportCsvButton
              allRows={buildParticipantRows(participants)}
              filteredRows={buildParticipantRows(filteredParticipants)}
              columns={participantExportColumns}
              fileName={`מוזמנים ${goal.title || ""}.csv`}
            />
          </div>
          <ProjectParticipantsTab
            items={filteredParticipants}
            tasks={inviteeTasks}
            hideTasks={hideInviteeTasks}
            onEdit={(p) => { setEditingParticipant(p); setParticipantDialog(true); }}
            onDelete={deleteParticipant}
            onToggleTask={toggleInviteeTask}
          />
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">הוצאות</p>
            <Button size="sm" onClick={() => { setEditingExpense(null); setExpenseDialog(true); }}>
              <Plus className="w-4 h-4 ml-1" />הוסף הוצאה
            </Button>
          </div>
          <ProjectExpensesTab
            taskExpenses={taskExpenses}
            manualExpenses={expenses}
            onEditManual={(e) => { setEditingExpense(e); setExpenseDialog(true); }}
            onDeleteManual={deleteExpense}
            onUpdateTaskPaid={updateTaskPaid}
            onUpdateManualPaid={updateExpensePaid}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask?.description && <p className="text-sm text-muted-foreground mb-3">{selectedTask.description}</p>}

          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">סיכום</p>
            <Textarea
              rows={3}
              placeholder="הוסף סיכום למשימה..."
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={saveSummary} disabled={savingSummary}>
                {savingSummary ? "שומר…" : "שמור סיכום"}
              </Button>
            </div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground mb-3">עדכן סטטוס:</p>
          <StatusUpdateForm task={selectedTask} user={user} onSubmit={() => { setSelectedTask(null); load(); }} />
        </DialogContent>
      </Dialog>

      {showAddTask && <ProjectTaskFormModal goalId={id} users={users} onClose={() => setShowAddTask(false)} onSave={() => { setShowAddTask(false); load(); }} />}
      {editingTask && <ProjectTaskFormModal task={editingTask} goalId={id} users={users} onClose={() => setEditingTask(null)} onSave={() => { setEditingTask(null); load(); }} />}

      <ItemFormDialog open={agendaDialog} onOpenChange={setAgendaDialog} type="agenda" item={editingAgenda} defaultTime={defaultAgendaTime} users={users} onSave={saveAgenda} />
      <ItemFormDialog open={participantDialog} onOpenChange={setParticipantDialog} type="participant" item={editingParticipant} users={users} onSave={saveParticipant} />
      <ItemFormDialog open={expenseDialog} onOpenChange={setExpenseDialog} type="expense" item={editingExpense} users={users} onSave={saveExpense} />

      <CommunityInviteesDialog
        open={communityDialog}
        onOpenChange={setCommunityDialog}
        existingMemberIds={new Set(participants.map((p) => p.member_id).filter(Boolean))}
        onAdd={addCommunityInvitees}
      />
      <PasteIdsDialog
        open={pasteIdsDialog}
        onOpenChange={setPasteIdsDialog}
        existingMemberIds={new Set(participants.map((p) => p.member_id).filter(Boolean))}
        onAdd={addCommunityInvitees}
      />
    </div>
  );
}