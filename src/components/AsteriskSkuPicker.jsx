import React, { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, Plus, ChevronDown, Asterisk } from "lucide-react";

export const isAsteriskSku = (sku) => {
  const s = (sku || "").trim();
  return !s || /^[*#\s]+$/.test(s);
};

export default function AsteriskSkuPicker({ products, existingSkus, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(s) ||
      (p.sku || "").toLowerCase().includes(s)
    );
  }, [products, q]);

  const randomSku = () => {
    let s;
    let tries = 0;
    do {
      s = String(90000 + Math.floor(Math.random() * 10000));
      tries++;
    } while (existingSkus.includes(s) && tries < 100);
    return s;
  };

  const choose = (p) => {
    onChange(p.sku, p.name);
    setOpen(false);
    setQ("");
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    onChange(randomSku(), name);
    setNewName("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-between min-w-40 gap-2 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100">
          <span className="flex items-center gap-1.5 truncate">
            <Asterisk className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">בחר/י מוצר</span>
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start" dir="rtl">
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש מוצר קיים..."
              className="h-9 w-full rounded-md border border-input bg-transparent pr-8 pl-3 text-sm"
            />
          </div>
          <div className="max-h-56 overflow-y-auto scrollbar-thin rounded-md border border-border divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">אין מוצרים תואמים</p>
            ) : (
              filtered.slice(0, 100).map((p, i) => (
                <button
                  key={(p.sku || "") + i}
                  onClick={() => choose(p)}
                  className="w-full text-right px-3 py-2 hover:bg-accent/50 flex items-center justify-between gap-2"
                >
                  <span className="text-sm truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{p.sku}</span>
                </button>
              ))
            )}
          </div>
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">מוצר חדש (קוד אקראי מ-90000)</p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNew(); }}
                placeholder="שם המוצר החדש"
                className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
              />
              <Button size="sm" onClick={addNew} disabled={!newName.trim()}>
                <Plus className="w-4 h-4" /> הוסף
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}