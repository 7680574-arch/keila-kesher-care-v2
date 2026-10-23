import React, { useState, useEffect } from "react";
import { Pencil, Trash2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/projectLabels";

function PaidCell({ amount, paid, onPaid }) {
  const [val, setVal] = useState(paid != null ? paid : "");
  useEffect(() => { setVal(paid != null ? paid : ""); }, [paid]);
  const remaining = (Number(amount) || 0) - (Number(paid) || 0);
  const fullyPaid = (Number(amount) || 0) > 0 && remaining <= 0.001;

  const commit = () => {
    const n = val === "" ? 0 : Number(val);
    if (n !== (Number(paid) || 0)) onPaid(n);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="0"
        step="any"
        className="h-8 w-24 text-sm"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        placeholder="0"
      />
      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onPaid(Number(amount) || 0)}>
        <Check className="w-3.5 h-3.5 ml-1" />מלוא
      </Button>
      {fullyPaid ? (
        <span className="text-xs font-semibold text-emerald-600">שולם במלוא</span>
      ) : (
        <span className="text-xs text-rose-600">נשאר {fmtMoney(remaining)}</span>
      )}
    </div>
  );
}

export default function ProjectExpensesTab({
  taskExpenses,
  manualExpenses,
  onEditManual,
  onDeleteManual,
  onUpdateTaskPaid,
  onUpdateManualPaid,
}) {
  const all = [...taskExpenses, ...manualExpenses];
  const totalCost = all.reduce((s, e) => s + (Number(e.cost ?? e.amount) || 0), 0);
  const totalPaid = all.reduce((s, e) => s + (Number(e.paid_amount) || 0), 0);
  const remaining = totalCost - totalPaid;

  return (
    <div className="space-y-3">
      {taskExpenses.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground pt-1">הוצאות ממשימות (אוטומטי)</p>
          {taskExpenses.map((e) => (
            <div key={e.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{e.title}</p>
                {e.isSubtask && e.parentTitle && <p className="text-xs text-muted-foreground mt-0.5">תת-משימה · {e.parentTitle}</p>}
              </div>
              <span className="text-sm font-bold tabular-nums text-rose-600 min-w-[70px] text-left">{fmtMoney(e.cost)}</span>
              <PaidCell amount={e.cost} paid={e.paid_amount} onPaid={(n) => onUpdateTaskPaid(e.id, n)} />
            </div>
          ))}
        </>
      )}

      <p className="text-xs font-semibold text-muted-foreground pt-1">הוצאות ידניות</p>
      {manualExpenses.length > 0 ? (
        manualExpenses.map((e) => (
          <div key={e.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{[e.category, e.date].filter(Boolean).join(" · ")}</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-rose-600 min-w-[70px] text-left">{fmtMoney(e.amount)}</span>
            <PaidCell amount={e.amount} paid={e.paid_amount} onPaid={(n) => onUpdateManualPaid(e.id, n)} />
            <button onClick={() => onEditManual(e)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDeleteManual(e)} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">אין הוצאות ידניות</p>
      )}

      <p className="text-xs text-muted-foreground pt-1">
        סה"כ: <span className="font-semibold text-foreground">{fmtMoney(totalCost)}</span> · שולם <span className="font-semibold text-emerald-600">{fmtMoney(totalPaid)}</span> · נשאר <span className="font-semibold text-rose-600">{fmtMoney(remaining)}</span>
      </p>
    </div>
  );
}