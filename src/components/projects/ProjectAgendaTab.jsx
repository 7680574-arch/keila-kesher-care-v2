import React from "react";
import { Pencil, Trash2, Clock, User, ArrowUp, ArrowDown } from "lucide-react";
import { calcEndTime } from "@/lib/agendaTime";

export default function ProjectAgendaTab({ items, onEdit, onDelete, onMove }) {
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">סדר היום ריק. הוסף נושא ראשון.</p>;
  const total = items.reduce((s, i) => s + (i.duration_minutes || 0), 0);
  return (
    <div className="space-y-3">
      {items.map((a, idx) => (
        <div key={a.id} className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{a.title}</p>
            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {a.time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.time}{calcEndTime(a.time, a.duration_minutes) ? ` – ${calcEndTime(a.time, a.duration_minutes)}` : ""}
                </span>
              )}
              {a.duration_minutes ? <span className="bg-muted rounded-full px-2 py-0.5">{a.duration_minutes} דק'</span> : null}
              {a.assignee_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.assignee_name}</span>}
            </div>
            {a.notes && <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{a.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button disabled={idx === 0} onClick={() => onMove(idx, -1)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"><ArrowUp className="w-4 h-4" /></button>
            <button disabled={idx === items.length - 1} onClick={() => onMove(idx, 1)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"><ArrowDown className="w-4 h-4" /></button>
            <button onClick={() => onEdit(a)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDelete(a)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {total > 0 && <p className="text-xs text-muted-foreground pt-1">סה"כ משך מתוכנן: <span className="font-semibold text-foreground">{total} דקות</span></p>}
    </div>
  );
}