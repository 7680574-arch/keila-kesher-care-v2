import React from "react";
import { Link } from "react-router-dom";
import { Check, Trash2, Pencil, Clock, Bell, FolderKanban, User, Repeat, X } from "lucide-react";
import { PriorityBadge } from "@/components/badges";

const RECURRENCE_LABEL = { daily: "חוזרתיות: יומית", weekly: "חוזרתיות: שבועית", monthly: "חוזרתיות: חודשית" };

// item: { source: "reminder" | "case", id, title, kind, status, due_date, due_time, priority, assignee, case_id, caseLabel, recurrence, raw }
export default function TaskRow({ item, today, onToggle, onEdit, onDelete, onStopRecurrence }) {
  const done = item.status === "done";
  const overdue = !done && item.due_date && item.due_date < today;
  return (
    <div className={`flex items-start gap-3 px-5 py-3 group hover:bg-secondary/40 transition ${done ? "bg-muted/30" : ""}`}>
      <button
        onClick={() => onToggle(item)}
        title={done ? "בוצע — לחץ לביטול" : "סמן כהושלם"}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-primary"
        }`}
      >
        {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {item.source === "case" ? (
            <Link to={`/cases/${item.case_id}`} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 hover:underline">
              <FolderKanban className="w-3 h-3" /> {item.caseLabel || "תיק"}
            </Link>
          ) : (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${item.kind === "reminder" ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
              {item.kind === "reminder" ? <><Bell className="w-3 h-3" /> תזכורת</> : "משימה"}
            </span>
          )}
          <PriorityBadge priority={item.priority} />
          {item.due_date && (
            <span className={`text-xs flex items-center gap-1 ${overdue ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
              <Clock className="w-3 h-3" /> {item.due_date}{item.due_time ? ` · ${item.due_time}` : ""}{overdue && " · באיחור"}
            </span>
          )}
          {item.assignee && (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> {item.assignee}</span>
          )}
          {item.source === "case" && item.recurrence && item.recurrence !== "none" && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
              <Repeat className="w-3 h-3" /> {RECURRENCE_LABEL[item.recurrence] || item.recurrence}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.source === "case" && item.recurrence && item.recurrence !== "none" && (
          <button
            onClick={() => onStopRecurrence?.(item)}
            title="בטל חזרה — המשימה לא תיווצר שוב לאחר סיום"
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 transition"
          >
            <X className="w-3.5 h-3.5" /> בטל חזרה
          </button>
        )}
        <button onClick={() => onEdit(item)} title="עריכה" className="text-muted-foreground hover:text-primary transition">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(item)} title="מחיקה" className="text-muted-foreground hover:text-destructive transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}