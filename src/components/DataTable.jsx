import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import StickyScrollBar from "@/components/StickyScrollBar";
import ColumnOrderButton from "@/components/ColumnOrderButton";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { cn } from "@/lib/utils";

const getVal = (row, field) => (typeof field === "function" ? field(row) : row?.[field]);

export default function DataTable({
  rows = [],
  columns,
  searchable = true,
  searchPlaceholder = "חיפוש כללי בכל השדות",
  searchFields,
  externalSearch,
  onExternalSearchChange,
  getRowId = (r, i) => r?.id ?? i,
  loading = false,
  emptyMessage = "לא נמצאו נתונים",
  pageSize,
  toolbar,
  onRowClick,
  rowClassName,
  className,
  initialSort,
  onProcessedRows,
  stickyColumns = 0,
  stickyHeader = false,
  fillParent = false,
}) {
  const [sort, setSort] = useState(initialSort || { field: null, dir: "asc" });
  const [filters, setFilters] = useState({});
  const [internalSearch, setInternalSearch] = useState("");
  const globalSearch = externalSearch !== undefined ? externalSearch : internalSearch;
  const handleSearchChange = (v) => {
    if (externalSearch !== undefined) onExternalSearchChange?.(v);
    else setInternalSearch(v);
    setPage(0);
  };
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);
  const tableRef = useRef(null);
  const [stickyOffsets, setStickyOffsets] = useState([]);

  const storageKey = useMemo(() => "dt_cols_" + columns.map((c) => c.key).sort().join("_"), [columns.map((c) => c.key).join("|")]);
  const stickyCols = columns.slice(0, stickyColumns);
  const freeCols = columns.slice(stickyColumns);
  const freeKeys = useMemo(() => freeCols.map((c) => c.key), [storageKey]);
  const [savedFreeOrder, setSavedFreeOrder] = useColumnOrder(storageKey, freeKeys);
  const mergedFreeKeys = useMemo(() => {
    const existing = savedFreeOrder.filter((k) => freeKeys.includes(k));
    const missing = freeKeys.filter((k) => !existing.includes(k));
    return [...existing, ...missing];
  }, [savedFreeOrder, freeKeys]);
  const orderedColumns = useMemo(
    () => [...stickyCols, ...mergedFreeKeys.map((k) => freeCols.find((c) => c.key === k)).filter(Boolean)],
    [columns, mergedFreeKeys]
  );
  const canReorder = freeCols.length > 1;

  useEffect(() => {
    if (!stickyColumns) { setStickyOffsets([]); return; }
    const measure = () => {
      const ths = tableRef.current?.querySelectorAll("thead tr:first-child > th") || [];
      const offsets = [];
      let cum = 0;
      for (let i = 0; i < stickyColumns && i < ths.length; i++) {
        offsets.push(cum);
        cum += ths[i].offsetWidth;
      }
      setStickyOffsets(offsets);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [stickyColumns, columns.length, rows.length]);

  const globalFields = useMemo(
    () => searchFields || columns.filter((c) => c.field).map((c) => c.field),
    [columns, searchFields]
  );

  const derivedOptions = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      if (col.filterOptions || !col.filterable || !col.field) return;
      const seen = new Map();
      (rows || []).forEach((row) => {
        const v = getVal(row, col.field);
        if (v == null || v === "") return;
        const key = String(v);
        if (!seen.has(key)) seen.set(key, key);
      });
      map[col.key] = Array.from(seen.keys())
        .sort((a, b) => a.localeCompare(b, "he", { numeric: true }))
        .map((v) => ({ value: v, label: v }));
    });
    return map;
  }, [columns, rows]);

  const processed = useMemo(() => {
    let r = rows || [];
    const q = globalSearch.trim().toLowerCase();
    if (q) {
      r = r.filter((row) => globalFields.some((f) => String(getVal(row, f) ?? "").toLowerCase().includes(q)));
    }
    Object.entries(filters).forEach(([key, val]) => {
      const col = columns.find((c) => c.key === key);
      if (!col || !col.field) return;
      if (Array.isArray(val)) {
        if (val.length === 0) return;
        r = r.filter((row) => val.includes(String(getVal(row, col.field) ?? "")));
      } else {
        const v = (val || "").trim().toLowerCase();
        if (!v) return;
        r = r.filter((row) => String(getVal(row, col.field) ?? "").toLowerCase().includes(v));
      }
    });
    if (sort.field) {
      const dir = sort.dir === "desc" ? -1 : 1;
      r = [...r].sort((a, b) => {
        let av = getVal(a, sort.field) ?? "";
        let bv = getVal(b, sort.field) ?? "";
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv), "he", { numeric: true }) * dir;
      });
    }
    return r;
  }, [rows, globalSearch, filters, sort, columns, globalFields]);

  useEffect(() => { onProcessedRows?.(processed); }, [processed, onProcessedRows]);

  const total = processed.length;
  const ps = pageSize && pageSize > 0 ? pageSize : 0;
  const pages = ps ? Math.max(1, Math.ceil(total / ps)) : 1;
  const safePage = Math.min(page, pages - 1);
  const shown = ps ? processed.slice(safePage * ps, safePage * ps + ps) : processed;

  const onSort = (col) => {
    if (!col.field) return;
    setSort((p) => (p.field === col.field ? { field: col.field, dir: p.dir === "asc" ? "desc" : "asc" } : { field: col.field, dir: "asc" }));
  };
  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(0); };

  return (
    <div className={cn(fillParent && "h-full flex flex-col")}>
    <div className={cn("rounded-2xl border bg-card overflow-hidden", fillParent && "flex-1 min-h-0 flex flex-col", className)}>
      {(searchable || toolbar) && (
        <div className={cn("flex items-center gap-2 p-3 border-b flex-wrap bg-muted/30", fillParent && "shrink-0")}>
          {searchable && externalSearch === undefined && (
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={globalSearch} onChange={(e) => handleSearchChange(e.target.value)} placeholder={searchPlaceholder} className="pr-9 h-9" />
            </div>
          )}
          {toolbar}
          {canReorder && (
            <ColumnOrderButton
              columns={freeCols.map((c) => ({ key: c.key, label: typeof c.header === "string" ? c.header : c.key }))}
              order={mergedFreeKeys}
              onOrderChange={setSavedFreeOrder}
              defaultOrder={freeKeys}
            />
          )}
          <span className="text-sm text-muted-foreground whitespace-nowrap">{total} רשומות</span>
        </div>
      )}
      <div ref={scrollRef} className={cn("scrollbar-thin", fillParent ? "flex-1 min-h-0 overflow-auto" : "overflow-x-auto")}>
        <table ref={tableRef} className="w-full text-sm">
          <thead className={cn("text-muted-foreground", stickyHeader ? "bg-muted" : "bg-muted/50")}>
            <tr>
              {orderedColumns.map((col, i) => {
                const active = sort.field === col.field;
                const canSort = !!col.field && col.sortable !== false;
                const f = filters[col.key];
                const isSticky = i < stickyColumns;
                const stickyStyle = isSticky
                  ? { position: "sticky", right: `${stickyOffsets[i] || 0}px`, zIndex: 3, boxShadow: i === stickyColumns - 1 ? "-3px 0 4px rgba(0,0,0,0.07)" : undefined, ...(stickyHeader ? { top: 0, zIndex: 6 } : {}) }
                  : stickyHeader ? { position: "sticky", top: 0, zIndex: 5 } : undefined;
                return (
                  <th key={col.key} style={stickyStyle} className={cn("px-3 py-2.5 font-medium align-top text-right", isSticky && "bg-muted", col.headerClassName, col.hideOnMobile && "hidden md:table-cell", col.hideOnDesktop && "md:hidden")}>
                    <div className="flex flex-col gap-1">
                      <button type="button" disabled={!canSort} onClick={() => onSort(col)} className={cn("inline-flex items-center gap-1 text-right", canSort && "hover:text-foreground", active && "text-primary", !canSort && "cursor-default")}>
                        {col.header}
                        {canSort && (active ? (sort.dir === "desc" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />)}
                      </button>
                      {col.filterable && (col.filterOptions || derivedOptions[col.key]) ? (
                        <MultiSelectFilter options={col.filterOptions || derivedOptions[col.key]} value={f || []} onChange={(vals) => setFilter(col.key, vals)} />
                      ) : col.filterable ? (
                        <Input value={f || ""} onChange={(e) => setFilter(col.key, e.target.value)} placeholder="סינון…" className="h-7 text-xs font-normal w-full min-w-[110px]" />
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={orderedColumns.length} className="text-center py-10 text-muted-foreground">טוען...</td></tr>}
            {!loading && shown.length === 0 && <tr><td colSpan={orderedColumns.length} className="text-center py-10 text-muted-foreground">{emptyMessage}</td></tr>}
            {!loading && shown.map((row, idx) => (
              <tr key={getRowId(row, idx)} className={cn("border-t hover:bg-muted/30 group", onRowClick && "cursor-pointer", rowClassName?.(row))} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {orderedColumns.map((col, i) => {
                  const isSticky = i < stickyColumns;
                  const stickyStyle = isSticky ? { position: "sticky", right: `${stickyOffsets[i] || 0}px`, zIndex: 2, boxShadow: i === stickyColumns - 1 ? "-3px 0 4px rgba(0,0,0,0.07)" : undefined } : undefined;
                  return (
                    <td key={col.key} style={stickyStyle} className={cn("px-3 py-2 align-middle", isSticky && "bg-card group-hover:bg-muted/30", col.cellClassName, col.hideOnMobile && "hidden md:table-cell", col.hideOnDesktop && "md:hidden")}>
                      {col.render ? col.render(row, idx) : (String(getVal(row, col.field) ?? "") || "—")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ps > 0 && pages > 1 && (
        <div className={cn("flex items-center justify-between p-3 border-t text-sm", fillParent && "shrink-0")}>
          <span className="text-muted-foreground">עמוד {safePage + 1} מתוך {pages}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} title="הקודם"><ChevronRight className="w-4 h-4" /></Button>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} title="הבא"><ChevronLeft className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
    <StickyScrollBar targetRef={scrollRef} className={cn("rounded-b-2xl border border-t-0", fillParent && "shrink-0")} />
    </div>
  );
}