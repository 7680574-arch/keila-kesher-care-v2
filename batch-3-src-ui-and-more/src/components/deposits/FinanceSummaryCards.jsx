import React from "react";
import { Coins, Wallet, ShoppingCart, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n) => "₪" + (Number(n) || 0).toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function FinanceSummaryCards({ depositsTotal, lashavuaBalance, supermarketBalance }) {
  const grandTotal = (Number(depositsTotal) || 0) + (Number(lashavuaBalance) || 0) + (Number(supermarketBalance) || 0);

  const cards = [
    { label: "פקדונות", value: depositsTotal, icon: Coins, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-600/20" },
    { label: "לשבוע מטובה", value: lashavuaBalance, icon: Wallet, color: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-600/20" },
    { label: "סופרים", value: supermarketBalance, icon: ShoppingCart, color: "text-violet-600", bg: "bg-violet-50", ring: "ring-violet-600/20" },
    { label: "סה״כ", value: grandTotal, icon: PiggyBank, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-600/20" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", c.bg, c.color)}>
            <c.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground truncate">{c.label}</p>
            <p className={cn("text-xl font-bold tabular-nums", c.label === "סה״כ" ? "text-emerald-600" : "text-foreground")}>{fmt(c.value)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}