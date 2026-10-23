import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, CheckCheck, Loader2 } from "lucide-react";
import HashSkuMatchRow from "@/components/HashSkuMatchRow";
import { buildCandidates, buildHashGroups, suggest } from "@/lib/skuMatching";

const HIGH = 0.85;

const HEADERS = ["שם מוצר", "קוד נוכחי", "מחיר", "שורות", "הצעה למוצר קיים", "", "בחירה ידנית"];

export default function HashSkuMatch({ rows, products, existingSkus, onApply, onApplyBatch }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => buildHashGroups(rows), [rows]);

  const items = useMemo(() => {
    if (!open) return [];
    const candidates = buildCandidates(rows);
    return groups.map((group) => ({ group, suggestions: suggest(group, candidates) }));
  }, [open, groups, rows]);

  const highCount = items.filter((it) => it.suggestions[0]?.score >= HIGH).length;

  const approveAll = async () => {
    setBusy(true);
    const records = [];
    for (const it of items) {
      const pick = it.suggestions[0];
      if (pick && pick.score >= HIGH) {
        for (const id of it.group.ids) records.push({ id, sku: pick.sku, product_name: pick.name });
      }
    }
    if (records.length) await onApplyBatch(records);
    setBusy(false);
  };

  return (
    <>
      {groups.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Sparkles className="w-4 h-4" /> התאמת קודי ####
          <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 text-xs">{groups.length}</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-6xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>התאמת מוצרים עם קוד ####</DialogTitle>
            <DialogDescription>
              לכל מוצר מוצעת התאמה למוצר קיים לפי דמיון בשם ובמחיר. אשר/י את ההתאמות הנכונות, או בחר/י מוצר אחרת ידנית.
            </DialogDescription>
          </DialogHeader>
          {items.length > 0 && highCount > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={approveAll} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                אשר את כל {highCount} ההתאמות ברמה גבוהה
              </Button>
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">כל הקודים הותאמו.</p>
          ) : (
            <div className="overflow-auto scrollbar-thin rounded-xl border border-border">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10">
                  <tr>{HEADERS.map((h, i) => <th key={i} className="text-right px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(({ group, suggestions }) => (
                    <HashSkuMatchRow
                      key={group.key}
                      group={group}
                      suggestions={suggestions}
                      products={products}
                      existingSkus={existingSkus}
                      onApply={onApply}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}