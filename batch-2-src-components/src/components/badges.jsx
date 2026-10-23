import React from "react";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }) {
  const map = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    inactive: "bg-slate-50 text-slate-600 ring-slate-500/20",
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    open: "bg-sky-50 text-sky-700 ring-sky-600/20",
    in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    urgent: "bg-rose-50 text-rose-700 ring-rose-600/20",
    closed: "bg-slate-50 text-slate-600 ring-slate-500/20",
  };
  const labels = {
    active: "פעיל", inactive: "לא פעיל", pending: "ממתין",
    open: "פתוח", in_progress: "בטיפול", urgent: "דחוף", closed: "סגור",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", map[status] || map.inactive)}>
      {labels[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const map = {
    low: "bg-slate-50 text-slate-600 ring-slate-500/20",
    medium: "bg-sky-50 text-sky-700 ring-sky-600/20",
    high: "bg-orange-50 text-orange-700 ring-orange-600/20",
    urgent: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  const labels = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחופה" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", map[priority] || map.medium)}>
      {labels[priority] || priority}
    </span>
  );
}

export function CaseTypeBadge({ type }) {
  const map = {
    medical: "bg-rose-50 text-rose-700 ring-rose-600/20",
    welfare: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    mental_health: "bg-violet-50 text-violet-700 ring-violet-600/20",
    financial: "bg-amber-50 text-amber-700 ring-amber-600/20",
    legal: "bg-slate-50 text-slate-700 ring-slate-500/20",
    other: "bg-slate-50 text-slate-600 ring-slate-500/20",
  };
  const labels = {
    medical: "רפואי", welfare: "רווחה", mental_health: "בריאות נפש",
    financial: "כלכלי", legal: "משפטי", other: "אחר",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", map[type] || map.other)}>
      {labels[type] || type}
    </span>
  );
}

export function GenderText({ gender }) {
  const labels = { male: "זכר", female: "נקבה", other: "אחר" };
  return <span>{labels[gender] || "—"}</span>;
}