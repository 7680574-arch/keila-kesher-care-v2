import React, { useMemo, useState } from "react";
import { Layers, Package } from "lucide-react";
import AsteriskSkuPicker, { isAsteriskSku } from "@/components/AsteriskSkuPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

// רוחבי העמודות הדביקות — שם מוצר + קוד מוצר מוצמדים יחד כדי שבורר קוד הכוכביות לא יתכוסה בגלילה.
const NAME_W = 200;
const SKU_W = 180;

const nameStyle = { position: "sticky", right: 0, width: NAME_W, minWidth: NAME_W, maxWidth: NAME_W };
const skuStyle = { position: "sticky", right: NAME_W, width: SKU_W, minWidth: SKU_W, maxWidth: SKU_W };

// מצטבר תנועות מכירה לפי מוצר (שורות) × גן/מחלקה (עמודות: כמות + סכום שורה)
// כל גן חדש שמופיע בנתונים מוסיף אוטומטית זוג עמודות חדש.
export default function SalesPivotTable({ rows, loading, knownProducts, existingSkus, onAssignSku }) {
  const { gardens, products, totalsByGarden } = useMemo(() => {
    const gardenSet = new Set();
    const productMap = new Map();

    for (const r of rows) {
      const garden = (r.department || "").trim() || "ללא גן";
      gardenSet.add(garden);
      const key = `${r.sku || ""}|${r.product_name || ""}|${r.unit_price ?? 0}`;
      if (!productMap.has(key)) {
        productMap.set(key, { name: r.product_name, sku: r.sku, unit_price: r.unit_price, gardens: {} });
      }
      const p = productMap.get(key);
      if (!p.gardens[garden]) p.gardens[garden] = { qty: 0, total: 0 };
      p.gardens[garden].qty += Number(r.quantity) || 0;
      p.gardens[garden].total += Number(r.line_total) || 0;
    }

    const gardens = Array.from(gardenSet).sort((a, b) => a.localeCompare(b, "he"));
    const products = Array.from(productMap.values());

    const totalsByGarden = {};
    for (const g of gardens) totalsByGarden[g] = { qty: 0, total: 0 };
    for (const p of products) {
      for (const g of gardens) {
        const cell = p.gardens[g];
        if (cell) {
          totalsByGarden[g].qty += cell.qty;
          totalsByGarden[g].total += cell.total;
        }
      }
    }
    return { gardens, products, totalsByGarden };
  }, [rows]);

  const [selected, setSelected] = useState(null);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>אין נתונים למצטבר.</p>
        <p className="text-sm mt-1">לאחר שמירת תנועות, הטבלה תקבץ אותן לפי מוצר וגן.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto scrollbar-thin max-h-[65vh]">
      <table className="w-full text-sm whitespace-nowrap border-separate" style={{ borderSpacing: 0 }}>
        <thead className="text-muted-foreground">
          <tr>
            <th style={nameStyle} className="text-right px-3 py-2.5 font-semibold sticky top-0 bg-muted/80 backdrop-blur z-30">שם מוצר</th>
            <th style={skuStyle} className="text-right px-3 py-2.5 font-semibold sticky top-0 bg-muted/80 backdrop-blur z-30">קוד מוצר</th>
            <th className="text-right px-3 py-2.5 font-semibold sticky top-0 bg-muted/80 backdrop-blur z-20">מחיר יחידה</th>
            {gardens.map((g) => (
              <th colSpan={2} key={g} className="text-center px-2 py-1.5 font-semibold border-x border-border bg-primary/5 sticky top-0 z-20">
                <span className="text-primary block">{g}</span>
                <span className="text-xs font-medium text-foreground block mt-0.5">{fmt(totalsByGarden[g].total)}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th style={nameStyle} className="text-right px-3 py-1.5 text-xs font-normal sticky bg-muted/80 z-20"></th>
            <th style={skuStyle} className="text-right px-3 py-1.5 text-xs font-normal sticky bg-muted/80 z-20"></th>
            <th className="text-right px-3 py-1.5 text-xs font-normal"></th>
            {gardens.map((g) => (
              <React.Fragment key={g}>
                <th className="text-right px-2 py-1.5 text-xs font-semibold border-x border-border">כמות</th>
                <th className="text-right px-2 py-1.5 text-xs font-semibold border-x border-border">סכום</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((p, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td
                style={nameStyle}
                className="px-3 py-2.5 font-medium bg-card z-20 cursor-pointer hover:text-primary"
                onClick={() => setSelected(p)}
                title="לחץ לפילוח לפי גן"
              >
                <span className="block truncate underline-offset-2 hover:underline" title={p.name}>{p.name || "—"}</span>
              </td>
              <td style={skuStyle} className="px-3 py-2.5 bg-card z-20">
                {isAsteriskSku(p.sku) && onAssignSku ? (
                  <AsteriskSkuPicker
                    products={knownProducts || []}
                    existingSkus={existingSkus || []}
                    onChange={(sku, name) => onAssignSku(p, sku, name)}
                  />
                ) : (
                  <span className="block truncate text-muted-foreground" title={p.sku}>{p.sku || "—"}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{fmt(p.unit_price)}</td>
              {gardens.map((g) => {
                const cell = p.gardens[g];
                return (
                  <React.Fragment key={g}>
                    <td className="px-2 py-2.5 text-center border-x border-border">{cell ? cell.qty : ""}</td>
                    <td className="px-2 py-2.5 text-center border-x border-border">{cell ? fmt(cell.total) : ""}</td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 font-semibold sticky bottom-0 z-10">
            <td style={nameStyle} className="px-3 py-2.5 sticky bg-muted/80 z-20">סה"כ</td>
            <td style={skuStyle} className="px-3 py-2.5 bg-muted/40 z-20"></td>
            <td className="px-3 py-2.5 bg-muted/40"></td>
            {gardens.map((g) => (
              <React.Fragment key={g}>
                <td className="px-2 py-2.5 text-center border-x border-border bg-muted/40">{totalsByGarden[g].qty}</td>
                <td className="px-2 py-2.5 text-center border-x border-border bg-muted/40">{fmt(totalsByGarden[g].total)}</td>
              </React.Fragment>
            ))}
          </tr>
        </tfoot>
      </table>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {selected?.name || "מוצר"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>קוד מוצר: {selected.sku || "—"}</span>
                <span>מחיר יחידה: {fmt(selected.unit_price)}</span>
              </div>
              {(() => {
                const entries = gardens
                  .map((g) => ({ garden: g, cell: selected.gardens[g] }))
                  .filter((e) => e.cell);
                if (!entries.length) {
                  return <p className="text-center py-6 text-sm text-muted-foreground">אין גנים שהזמינו מוצר זה</p>;
                }
                const totalQty = entries.reduce((s, e) => s + e.cell.qty, 0);
                const totalSum = entries.reduce((s, e) => s + e.cell.total, 0);
                return (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-right px-3 py-2 font-semibold">גן / מחלקה</th>
                          <th className="text-center px-3 py-2 font-semibold">כמות</th>
                          <th className="text-center px-3 py-2 font-semibold">עלות</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {entries.map((e) => (
                          <tr key={e.garden} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">{e.garden}</td>
                            <td className="px-3 py-2 text-center">{e.cell.qty}</td>
                            <td className="px-3 py-2 text-center font-semibold">{fmt(e.cell.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 font-semibold">
                        <tr>
                          <td className="px-3 py-2">סה"כ</td>
                          <td className="px-3 py-2 text-center">{totalQty}</td>
                          <td className="px-3 py-2 text-center">{fmt(totalSum)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}