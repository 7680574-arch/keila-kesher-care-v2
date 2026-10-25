import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

export const TYPE_OPTIONS = [
  { value: "all", label: "כל הסוגים" },
  { value: "regular", label: "רגיל" },
  { value: "keva", label: 'הו"ק (אשראי)' },
  { value: "bank", label: 'הו"ק בנקאי' },
  { value: "installments", label: "תשלומים" },
];
export const ASSIGN_OPTIONS = [
  { value: "all", label: "כל השיוכים" },
  { value: "assigned", label: "משויכות" },
  { value: "unassigned", label: "לא משויכות" },
];
export const CURRENCY_OPTIONS = [
  { value: "all", label: "כל המטבעות" },
  { value: "ils", label: "שקלים ₪" },
  { value: "usd", label: "דולרים $" },
];

// מחזיר תנאי שאילתה לפי הסינונים שנבחרו
export function filtersToQuery({ type, assign, currency }) {
  const and = [];
  if (type === "regular") and.push({ transaction_type: "רגיל" });
  if (type === "keva") and.push({ transaction_type: 'הו"ק' });
  if (type === "bank") and.push({ transaction_type: 'הו"ק בנקאי' });
  if (type === "installments") and.push({ transaction_type: "תשלומים" });
  if (assign === "assigned") and.push({ $or: [{ zeout: { $nin: ["", null] } }, { donor_id: { $nin: ["", null] } }] });
  if (assign === "unassigned") and.push({ zeout: { $in: ["", null] } }, { donor_id: { $in: ["", null] } });
  if (currency === "usd") and.push({ currency: 2 });
  if (currency === "ils") and.push({ currency: { $ne: 2 } });
  return and;
}

function Pick({ value, onChange, options, width }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function NedarimFilters({ type, assign, currency, category, dateFrom, dateTo, onType, onAssign, onCurrency, onCategory, onDateFrom, onDateTo }) {
  const active = type !== "all" || assign !== "all" || currency !== "all" || !!category || !!dateFrom || !!dateTo;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick value={type} onChange={onType} options={TYPE_OPTIONS} width="w-40" />
      <Pick value={assign} onChange={onAssign} options={ASSIGN_OPTIONS} width="w-36" />
      <Pick value={currency} onChange={onCurrency} options={CURRENCY_OPTIONS} width="w-36" />
      <Input value={category || ""} onChange={(e) => onCategory(e.target.value)} placeholder="קטגוריה..." className="w-36 h-9" />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">מ-</span>
        <Input type="date" value={dateFrom || ""} onChange={(e) => onDateFrom(e.target.value)} className="w-36 h-9" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">עד-</span>
        <Input type="date" value={dateTo || ""} onChange={(e) => onDateTo(e.target.value)} className="w-36 h-9" />
      </div>
      {active && (
        <button
          onClick={() => { onType("all"); onAssign("all"); onCurrency("all"); onCategory(""); onDateFrom(""); onDateTo(""); }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" /> נקה סינונים
        </button>
      )}
    </div>
  );
}