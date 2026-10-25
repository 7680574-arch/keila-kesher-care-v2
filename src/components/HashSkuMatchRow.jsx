import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import AsteriskSkuPicker from "@/components/AsteriskSkuPicker";
import { confidence } from "@/lib/skuMatching";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export default function HashSkuMatchRow({ group, suggestions, products, existingSkus, onApply }) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const pick = suggestions[idx];
  const conf = pick ? confidence(pick.score) : null;

  const apply = async (sku, name) => {
    setBusy(true);
    await onApply(group, sku, name);
    setBusy(false);
  };

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{group.name || "—"}</td>
      <td className="px-3 py-2 text-muted-foreground">{group.sku}</td>
      <td className="px-3 py-2">{fmt(group.price)}</td>
      <td className="px-3 py-2 text-center">{group.ids.length}</td>
      <td className="px-3 py-2">
        {pick ? (
          <div className="flex items-center gap-2">
            <select
              value={idx}
              onChange={(e) => setIdx(Number(e.target.value))}
              className="h-8 max-w-64 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {suggestions.map((s, i) => (
                <option key={s.sku} value={i}>{s.name} · {s.sku} · {fmt(s.price)}</option>
              ))}
            </select>
            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${conf.cls}`}>{conf.label}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">אין הצעה אוטומטית</span>
        )}
      </td>
      <td className="px-3 py-2">
        {pick && (
          <Button size="sm" disabled={busy} onClick={() => apply(pick.sku, pick.name)}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} אשר
          </Button>
        )}
      </td>
      <td className="px-3 py-2">
        <AsteriskSkuPicker products={products} existingSkus={existingSkus} onChange={apply} />
      </td>
    </tr>
  );
}