import React from "react";
import { cn } from "@/lib/utils";

export const holidayLabels = {
  pesach: "פסח", shavuot: "שבועות", rosh_hashana: "ראש השנה",
  succot: "סוכות", purim: "פורים", chanukah: "חנוכה", other: "אחר",
};
export const typeLabels = { cash: "מזומן", products: "מוצרים", vouchers: "תווים", holiday_support: "תמיכת חגים", other: "אחר" };
export const statusLabels = { planning: "בתכנון", active: "פעילה", completed: "הושלמה" };
export const recurrenceLabels = { none: "חד-פעמית", weekly: "שבועית", biweekly: "דו-שבועית", monthly: "חודשית" };

const holidayStyles = {
  pesach: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  shavuot: "bg-sky-50 text-sky-700 ring-sky-600/20",
  rosh_hashana: "bg-amber-50 text-amber-700 ring-amber-600/20",
  succot: "bg-lime-50 text-lime-700 ring-lime-600/20",
  purim: "bg-violet-50 text-violet-700 ring-violet-600/20",
  chanukah: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  other: "bg-slate-50 text-slate-600 ring-slate-500/20",
};
const typeStyles = {
  cash: "bg-amber-50 text-amber-700 ring-amber-600/20",
  products: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  vouchers: "bg-sky-50 text-sky-700 ring-sky-600/20",
  holiday_support: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
  other: "bg-slate-50 text-slate-600 ring-slate-500/20",
};
const statusStyles = {
  planning: "bg-slate-50 text-slate-600 ring-slate-500/20",
  active: "bg-sky-50 text-sky-700 ring-sky-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function HolidayBadge({ holiday }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", holidayStyles[holiday] || holidayStyles.other)}>
      {holidayLabels[holiday] || holiday}
    </span>
  );
}
export function DistributionTypeBadge({ type }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", typeStyles[type] || typeStyles.other)}>
      {typeLabels[type] || type}
    </span>
  );
}
export function DistributionStatusBadge({ status }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", statusStyles[status] || statusStyles.planning)}>
      {statusLabels[status] || status}
    </span>
  );
}
const recurrenceStyles = {
  none: "bg-slate-50 text-slate-500 ring-slate-400/20",
  weekly: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  biweekly: "bg-blue-50 text-blue-700 ring-blue-600/20",
  monthly: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
};
export function RecurrenceBadge({ recurrence }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset", recurrenceStyles[recurrence] || recurrenceStyles.none)}>
      {recurrenceLabels[recurrence] || "חד-פעמית"}
    </span>
  );
}