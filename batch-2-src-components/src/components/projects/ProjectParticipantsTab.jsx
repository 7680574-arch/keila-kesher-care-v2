import React from "react";
import { Pencil, Trash2, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PARTICIPANT_STATUS } from "@/lib/projectLabels";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  invited: "bg-sky-50 text-sky-700 ring-sky-600/20",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  declined: "bg-rose-50 text-rose-700 ring-rose-600/20",
  attended: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
};

const parseArr = (s) => { if (Array.isArray(s)) return s; if (!s) return []; try { return JSON.parse(s); } catch { return []; } };

export default function ProjectParticipantsTab({ items, tasks, hideTasks, onEdit, onDelete, onToggleTask }) {
  const taskList = hideTasks ? [] : tasks;
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">אין משתתפים בפרויקט</p>;
  return (
    <div className="space-y-3">
      {taskList.length > 0 && (
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground px-2">
          <div className="flex-1">משתתף</div>
          {taskList.map((t, idx) => <div key={idx} className="w-20 text-center">{t}</div>)}
          <div className="w-16 text-center">פעולות</div>
        </div>
      )}
      {items.map((p) => {
        const done = parseArr(p.tasks_done);
        return (
          <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.title}</p>
              <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                {p.guests_count ? <span>{p.guests_count} מגיעים</span> : null}
                {p.notes && <span>{p.notes}</span>}
              </div>
            </div>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", STATUS_STYLE[p.status] || STATUS_STYLE.invited)}>
              {PARTICIPANT_STATUS[p.status] || PARTICIPANT_STATUS.invited}
            </span>
            {taskList.map((t) => (
              <div key={t} className="w-20 flex justify-center">
                <Checkbox checked={done.includes(t)} onCheckedChange={() => onToggleTask(p, t)} />
              </div>
            ))}
            <div className="flex items-center gap-1">
              <button onClick={() => onEdit(p)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => onDelete(p)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}