import React, { useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import { cn } from "@/lib/utils";

function deriveOptions(rows, getField, field) {
  const seen = new Map();
  rows.forEach((row) => {
    const v = getField(row, field);
    if (v == null || v === "") return;
    const key = String(v);
    if (!seen.has(key)) seen.set(key, key);
  });
  return Array.from(seen.keys())
    .sort((a, b) => a.localeCompare(b, "he", { numeric: true }))
    .map((v) => ({ value: v, label: v }));
}

export function SortHeader({ label, field, sort, onSort, filter, onFilter, filterable, filterOptions, rows, getField, className, style, action }) {
  const active = sort?.field === field;
  const options = useMemo(
    () => filterOptions || (filterable && rows && getField ? deriveOptions(rows, getField, field) : null),
    [filterOptions, filterable, rows, getField, field]
  );
  return (
    <th style={style} className={cn("px-4 py-3 font-semibold align-top", className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn("inline-flex items-center gap-1 hover:text-foreground transition", active && "text-primary")}
      >
        {label}
        {active ? (
          sort.dir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
      {filterable && options ? (
        <div className="mt-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
          <MultiSelectFilter options={options} value={filter?.[field] || []} onChange={(vals) => onFilter(field, vals)} />
        </div>
      ) : filterable ? (
        <Input
          value={filter?.[field] || ""}
          onChange={(e) => onFilter(field, e.target.value)}
          placeholder="סינון…"
          className="h-7 mt-1.5 text-xs font-normal w-28 min-w-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : null}
      {action}
    </th>
  );
}

export function applyTable(rows, sort, filters, getField) {
  let r = rows;
  if (filters) {
    Object.entries(filters).forEach(([f, val]) => {
      if (Array.isArray(val)) {
        if (val.length === 0) return;
        r = r.filter((row) => val.includes(String(getField(row, f) ?? "")));
      } else {
        const q = (val || "").trim();
        if (q) r = r.filter((row) => String(getField(row, f) ?? "").includes(q));
      }
    });
  }
  if (sort?.field) {
    const dir = sort.dir === "desc" ? -1 : 1;
    r = [...r].sort((a, b) => {
      let av = getField(a, sort.field) ?? "";
      let bv = getField(b, sort.field) ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "he") * dir;
    });
  }
  return r;
}

export function useSort(initialField = null, initialDir = "asc") {
  const [sort, setSort] = React.useState({ field: initialField, dir: initialDir });
  const onSort = (field) =>
    setSort((p) =>
      p.field === field
        ? { field, dir: p.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  return [sort, onSort];
}
