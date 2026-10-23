import React, { useState } from "react";
import { Calendar, Clock, User, Zap, ChevronDown, Plus } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { TASK_STATUS_LABELS } from "@/lib/projMgmtLabels";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SubtaskRow from "./SubtaskRow";

const STATUS_BADGE = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  blocked: "bg-rose-50 text-rose-700 ring-rose-600/20",
  need_help: "bg-orange-50 text-orange-700 ring-orange-600/20",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export default function ProjectTaskCard({ task, subtasks = [], onClick, onSubtasksChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const isOverdue = task.deadline && isPast(new Date(task.deadline)) && task.status !== "done";
  const isDueToday = task.deadline && isToday(new Date(task.deadline));

  const doneSubs = subtasks.filter((s) => s.status === "done").length;
  const subProgress = subtasks.length > 0 ? Math.round((doneSubs / subtasks.length) * 100) : null;

  const addSubtask = async () => {
    if (!newSubTitle.trim()) return;
    setAdding(true);
    try {
      await base44.entities.ProjectTask.create({
        title: newSubTitle.trim(),
        goal_id: task.goal_id,
        goal_title: task.goal_title,
        parent_task_id: task.id,
        status: "pending",
        created_by_ai: false,
      });
      setNewSubTitle("");
      onSubtasksChanged?.();
    } finally {
      setAdding(false);
    }
  };

  const toggleSub = async (sub) => {
    await base44.entities.ProjectTask.update(sub.id, { status: sub.status === "done" ? "pending" : "done" });
    onSubtasksChanged?.();
  };

  const deleteSub = async (subId, e) => {
    e.stopPropagation();
    await base44.entities.ProjectTask.delete(subId);
    onSubtasksChanged?.();
  };

  const saveSubSummary = async (sub, val) => {
    if ((sub.summary || "") === (val || "")) return;
    await base44.entities.ProjectTask.update(sub.id, { summary: val || undefined });
    onSubtasksChanged?.();
  };

  const saveSubCost = async (sub, val) => {
    await base44.entities.ProjectTask.update(sub.id, { cost: val });
    onSubtasksChanged?.();
  };

  return (
    <div
      className="bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", STATUS_BADGE[task.status] || STATUS_BADGE.pending)}>
          {TASK_STATUS_LABELS[task.status] || task.status}
        </span>
        {task.created_by_ai && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-violet-600 bg-violet-50 ring-1 ring-inset ring-violet-600/20 rounded-full px-2 py-0.5">
            <Zap className="w-3 h-3" />AI
          </span>
        )}
        {subProgress != null && <span className="text-xs font-semibold text-muted-foreground mr-auto">{subProgress}% · {doneSubs}/{subtasks.length}</span>}
      </div>

      <p className="text-sm font-semibold text-foreground mb-1">{task.title}</p>
      {task.description && <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>}
      {task.summary && <p className="text-xs text-muted-foreground italic mt-1">סיכום: {task.summary}</p>}

      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {task.assignee_name && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3" />{task.assignee_name}</span>
        )}
        {task.deadline && (
          <span className={cn("flex items-center gap-1 text-xs", isOverdue || isDueToday ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
            <Calendar className="w-3 h-3" />{isOverdue ? "באיחור · " : isDueToday ? "היום · " : ""}{format(new Date(task.deadline), "d בMMM")}
          </span>
        )}
        {task.estimated_hours != null && task.estimated_hours !== "" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{task.estimated_hours} שע׳</span>
        )}
        {task.cost != null && Number(task.cost) > 0 && (
          <span className="text-xs font-semibold text-rose-600">₪{Number(task.cost).toLocaleString("he-IL")}</span>
        )}
        <Button variant="outline" size="sm" className="h-7 mr-auto text-xs" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          <Plus className="w-3.5 h-3.5" />תת-משימות{subtasks.length > 0 ? ` (${subtasks.length})` : ""}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
        </Button>
      </div>

      {subtasks.length > 0 && (
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-3">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${subProgress}%` }} />
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3 pt-3 border-t border-border space-y-1">
              {subtasks.map((sub) => (
                <SubtaskRow
                  key={sub.id}
                  sub={sub}
                  onToggle={() => toggleSub(sub)}
                  onDelete={(e) => deleteSub(sub.id, e)}
                  onSaveSummary={(val) => saveSubSummary(sub, val)}
                  onSaveCost={(val) => saveSubCost(sub, val)}
                />
              ))}
              <div className="flex gap-2 mt-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="הוסף תת-משימה..."
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
                />
                <Button size="sm" className="h-8" onClick={addSubtask} disabled={adding || !newSubTitle.trim()}>
                  <Plus className="w-3.5 h-3.5" />הוסף
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}