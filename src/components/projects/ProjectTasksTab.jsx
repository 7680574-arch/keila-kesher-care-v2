import React from "react";
import { Check, Pencil, Trash2, Clock, User } from "lucide-react";

export default function ProjectTasksTab({ items, onToggle, onEdit, onDelete }) {
  const today = new Date().toISOString().slice(0, 10);
  if (items.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">אין משימות בפרויקט</p>;
  return (
    <div className="px-4 pb-4 space-y-3">
      {items.map((t) => {
        const done = t.status === "done";
        const overdue = !done && t.date && t.date < today;
        return (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 ${done ? "proj-row-done rounded-[14px]" : "proj-row"}`}>
            <button
              onClick={() => onToggle(t)}
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${done ? "bg-[#2ECC8A] border-[#2ECC8A] text-white" : "border-[#C9B3F5] hover:border-[#2ECC8A]"}`}
            >
              {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
              <div className="flex gap-2 mt-1.5 text-xs flex-wrap">
                {t.date && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? "bg-[#FF8077]/25 text-[#b3342b] font-medium" : "bg-[#B8EFF5]/60 text-[#13717f]"}`}><Clock className="w-3 h-3" />{t.date}{overdue && " · באיחור"}</span>}
                {(t.assignee_name || t.assignee_email) && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C9B3F5]/40 text-[#5b3fa0]"><User className="w-3 h-3" />{t.assignee_name || t.assignee_email}</span>}
              </div>
            </div>
            <button onClick={() => onEdit(t)} title="עריכה" className="text-muted-foreground hover:text-[#A98BEA]"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDelete(t)} title="מחיקה" className="text-muted-foreground hover:text-[#FF8077]"><Trash2 className="w-4 h-4" /></button>
          </div>
        );
      })}
    </div>
  );
}