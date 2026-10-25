import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Trash2, Pencil, Calendar, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GOAL_STATUS_LABELS, GOAL_STATUS_OPTIONS } from "@/lib/projMgmtLabels";

const STATUS_BADGE = {
  draft: "bg-slate-50 text-slate-600 ring-slate-500/20",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

function GoalStatusBadge({ status }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", STATUS_BADGE[status] || STATUS_BADGE.draft)}>
      {GOAL_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function GoalCard({ goal, tasks, onDelete, onEdit }) {
  const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
  const doneTasks = goalTasks.filter((t) => t.status === "done").length;
  const blockedCount = goalTasks.filter((t) => t.status === "blocked").length;
  const progress = goalTasks.length > 0 ? Math.round((doneTasks / goalTasks.length) * 100) : 0;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({ title: goal.title, description: goal.description || "", status: goal.status, target_date: goal.target_date || "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditData({ title: goal.title, description: goal.description || "", status: goal.status, target_date: goal.target_date || "" });
  }, [goal]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Goal.update(goal.id, {
      title: editData.title,
      description: editData.description,
      status: editData.status,
      target_date: editData.target_date || null,
    });
    setSaving(false);
    setShowEdit(false);
    onEdit && onEdit();
  };

  return (
    <>
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת פרויקט</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>כותרת</Label>
              <Input value={editData.title} onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>תיאור</Label>
              <Textarea rows={3} value={editData.description} onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>סטטוס</Label>
                <Select value={editData.status} onValueChange={(v) => setEditData((d) => ({ ...d, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{GOAL_STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>תאריך יעד</Label>
                <Input type="date" value={editData.target_date} onChange={(e) => setEditData((d) => ({ ...d, target_date: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>ביטול</Button>
              <Button type="submit" disabled={saving}>{saving ? "שומר…" : "שמור"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Link to={`/projects/${goal.id}`} className="block bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all group">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-sm">{goal.title}</p>
              <GoalStatusBadge status={goal.status} />
              {blockedCount > 0 && <span className="text-xs font-semibold text-rose-600">{blockedCount} חסומות</span>}
            </div>
            {goal.description && <p className="text-xs text-muted-foreground line-clamp-2">{goal.description}</p>}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{progress}%</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{doneTasks}/{goalTasks.length} משימות</span>
              {goal.target_date && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(goal.target_date), "d בMMM")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEdit(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(goal.id); }} className="px-2 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold">מחק</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }} className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs">ביטול</button>
              </div>
            ) : (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-secondary transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Link>
    </>
  );
}