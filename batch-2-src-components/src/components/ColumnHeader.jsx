import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable table column header with click-to-sort + multi-select AutoFilter.
 * Designed to drop into any <th>.
 */
export default function ColumnHeader({
  label,
  sublabel,
  align = "right",
  sortable = true,
  sortDir = null, // null | 'asc' | 'desc'
  onSort,
  filterable = false,
  filterOptions = [], // [{ value, label }]
  filterValue = [], // [value]
  onFilterChange,
  stickyRight = null, // number (px) — when set, makes this th sticky
  stickyShadow = false, // bool — add shadow on the last sticky column
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = Array.isArray(filterValue) ? filterValue : [];
  const active = selected.length > 0;

  const toggle = (v) => {
    if (selected.includes(v)) onFilterChange?.(selected.filter((x) => x !== v));
    else onFilterChange?.([...selected, v]);
  };

  const opts = filterOptions.filter((o) => String(o.label).includes(q.trim()));

  const stickyStyle = stickyRight != null ? { position: "sticky", right: `${stickyRight}px`, zIndex: 3, boxShadow: stickyShadow ? "-3px 0 4px rgba(0,0,0,0.07)" : undefined } : undefined;

  return (
    <th
      style={stickyStyle}
      className={cn("px-3 py-3 font-medium whitespace-nowrap select-none", align === "center" && "text-center", stickyRight != null && "bg-secondary/50")}
    >
      <div className={cn("flex items-center gap-1", align === "center" ? "justify-center" : "justify-start")}>
        {sortable ? (
          <button
            type="button"
            onClick={onSort}
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            title="מיון"
          >
            <span className="flex flex-col items-center">
              {label}
              {sublabel && <span className="text-xs font-normal text-muted-foreground block leading-tight">{sublabel}</span>}
            </span>
            {sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" />
              : sortDir === "desc" ? <ArrowDown className="w-3 h-3 text-primary" />
              : <ArrowUpDown className="w-3 h-3 opacity-40" />}
          </button>
        ) : (
          <span className="flex flex-col items-center">
            {label}
            {sublabel && <span className="text-xs font-normal text-muted-foreground block leading-tight">{sublabel}</span>}
          </span>
        )}
        {(filterable || filterOptions.length > 0) && (
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "p-0.5 rounded hover:bg-accent transition-colors",
                  active ? "text-primary" : "text-muted-foreground/60"
                )}
                title="סינון"
                onClick={(e) => e.stopPropagation()}
              >
                <Filter className={cn("w-3 h-3", active && "fill-primary/20")} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0" align="start" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/40">
                <button type="button" className="text-xs text-primary hover:underline disabled:opacity-40" disabled={selected.length === 0} onClick={() => onFilterChange?.([])}>נקה</button>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => onFilterChange?.(filterOptions.map((o) => o.value))}>בחר הכל</button>
              </div>
              <div className="p-2 border-b">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="חיפוש ברשימה…"
                  className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="max-h-56 overflow-y-auto scrollbar-thin">
                {opts.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer text-xs">
                    <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                    <span className="truncate">{opt.label}</span>
                  </label>
                ))}
                {opts.length === 0 && <p className="text-center py-4 text-xs text-muted-foreground">אין אפשרויות</p>}
              </div>
              {active && <div className="px-2 py-1.5 border-t text-xs text-muted-foreground">מציג {selected.length} מתוך {filterOptions.length}</div>}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </th>
  );
}