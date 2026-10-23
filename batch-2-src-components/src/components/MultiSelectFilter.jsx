import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MultiSelectFilter({ options, value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const label =
    selected.length === 0
      ? "הכל"
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label || selected[0]
        : `${selected.length} נבחרו`;

  const toggle = (v) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-between gap-1 h-7 w-full min-w-[110px] px-2 text-xs font-normal rounded-md border border-input bg-transparent hover:bg-accent/50 transition-colors",
            selected.length > 0 && "border-primary/50 text-primary"
          )}
        >
          <span className="truncate text-right flex-1">{label}</span>
          <ChevronsUpDown className="w-3 h-3 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/40">
          <button type="button" className="text-xs text-primary hover:underline disabled:opacity-40" disabled={selected.length === 0} onClick={() => onChange([])}>
            נקה
          </button>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
            בחר הכל
          </button>
        </div>
        <div className="max-h-60 overflow-y-auto scrollbar-thin">
          {options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer text-xs">
              <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
          {options.length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">אין אפשרויות</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}