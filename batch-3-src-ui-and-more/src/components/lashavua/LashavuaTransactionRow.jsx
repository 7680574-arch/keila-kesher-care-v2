import React from "react";
import { Pencil, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (n) => "₪" + (Number(n) || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 });

const BUCKET_LABEL = { lashavua: "לשבוע מטובה", supermarket: "סופרים", expenses: "הוצאות" };
const BUCKET_BADGE = {
  lashavua: "bg-sky-50 text-sky-700 ring-sky-600/20",
  supermarket: "bg-violet-50 text-violet-700 ring-violet-600/20",
  expenses: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export default function LashavuaTransactionRow({ r, idx, onEdit, onDelete }) {
  const net = r.kind === "income"
    ? (Number(r.amount) || 0) - (Number(r.commission) || 0)
    : -((Number(r.amount) || 0) + (Number(r.commission) || 0));
  return (
    <tr key={r.id} className={idx % 2 ? "bg-muted/10" : ""}>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset", BUCKET_BADGE[r.bucket])}>{BUCKET_LABEL[r.bucket]}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", r.kind === "income" ? "text-emerald-600" : "text-rose-600")}>
          {r.kind === "income" ? <ArrowDownCircle className="w-3.5 h-3.5" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
          {r.kind === "income" ? "הכנסה" : "העברה"}
        </span>
      </td>
      <td className="px-4 py-3">{r.description || r.category || "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.category || "—"}</td>
      <td className={cn("px-4 py-3 whitespace-nowrap font-semibold tabular-nums", net >= 0 ? "text-emerald-600" : "text-rose-600")}>{net >= 0 ? "+" : ""}{fmt(Math.abs(net))}</td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.commission ? fmt(r.commission) : "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("text-xs", r.source === "nedarim" ? "text-primary" : "text-muted-foreground")}>{r.source === "nedarim" ? "נדרים" : "ידני"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg hover:bg-secondary" title="עריכה"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => onDelete(r)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="מחיקה"><Trash2 className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}