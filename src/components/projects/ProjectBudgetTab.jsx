import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fmtMoney } from "@/lib/projectLabels";

function Column({ title, color, amountColor, items, onEdit, onDelete }) {
  return (
    <div className="flex-1 min-w-0 px-4 pb-4">
      <h3 className={`text-sm font-semibold px-4 py-2 rounded-xl mb-3 ${color}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">אין שורות</p>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.id} className="proj-row flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm">{i.title}</p>
                <p className="text-xs text-muted-foreground">{[i.category, i.date].filter(Boolean).join(" · ")}</p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${amountColor}`}>{fmtMoney(i.amount)}</span>
              <button onClick={() => onEdit(i)} className="text-muted-foreground hover:text-[#A98BEA]"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => onDelete(i)} className="text-muted-foreground hover:text-[#FF8077]"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectBudgetTab({ incomes, expenses, onEdit, onDelete }) {
  return (
    <div className="flex flex-col md:flex-row">
      <Column title="הכנסות" color="bg-[#2ECC8A]/20 text-[#0f7a50]" amountColor="text-[#0f7a50]" items={incomes} onEdit={onEdit} onDelete={onDelete} />
      <Column title="הוצאות" color="bg-[#FF8077]/20 text-[#b3342b]" amountColor="text-[#b3342b]" items={expenses} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}