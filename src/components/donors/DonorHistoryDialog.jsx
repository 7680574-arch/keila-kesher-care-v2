import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtAmount(n, currency) {
  const sym = currency === 2 ? "$" : "₪";
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString("he-IL");
}
function fmtDateTime(s) {
  if (!s) return "—";
  return s.replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}):\d{2}/, "$1 $2");
}
function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", accent)}>{value}</p>
    </div>
  );
}

export default function DonorHistoryDialog({ open, onOpenChange, donor }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({ count: 0, total: 0, lastDate: "—" });

  const load = useCallback(async () => {
    if (!donor?.id) return;
    setLoading(true);
    try {
      const query = { donor_id: donor.id };
      const page = await base44.entities.NedarimDonation.filter(query, {
        sort: "-transaction_id_num", limit: 100,
      });
      const items = page.items || [];
      setRecords(items);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
      try {
        const agg = await base44.entities.NedarimDonation.aggregate({
          query, sum: "amount",
        });
        const row = agg?.rows?.[0] || (Array.isArray(agg) ? agg[0] : agg) || {};
        const count = Number(row.count) || 0;
        const total = Number(row.sum_amount) || 0;
        const last = items[0];
        setStats({
          count,
          total,
          lastDate: last ? fmtDateTime(last.transaction_time) : "—",
        });
      } catch {
        const total = items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        setStats({
          count: items.length, total,
          lastDate: items[0] ? fmtDateTime(items[0].transaction_time) : "—",
        });
      }
    } catch {
      setRecords([]);
      setStats({ count: 0, total: 0, lastDate: "—" });
    } finally {
      setLoading(false);
    }
  }, [donor?.id]);

  useEffect(() => {
    if (open) load();
    else {
      setRecords([]);
      setCursor(null);
      setHasMore(false);
      setStats({ count: 0, total: 0, lastDate: "—" });
    }
  }, [open, donor?.id]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const query = { donor_id: donor.id };
      const page = await base44.entities.NedarimDonation.filter(query, {
        sort: "-transaction_id_num", limit: 100, cursor,
      });
      setRecords((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>היסטוריית תרומות · {donor?.name || ""}</DialogTitle>
        </DialogHeader>

        {donor?.company && (
          <p className="text-sm text-muted-foreground -mt-2">{donor.company}</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Stat label="מספר תרומות" value={stats.count.toLocaleString("he-IL")} />
          <Stat label={'סה"כ גובה'} value={fmtAmount(stats.total, 1)} accent="text-primary" />
          <Stat label="תרומה אחרונה" value={stats.lastDate} />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl">
            <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>אין תרומות משויכות לתורם זה.</p>
            <p className="text-sm mt-1">ניתן לשייך תרומות ממסך תרומות נדרים.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden max-h-[55vh] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  {["תאריך", "סכום", "קטגוריה", "הו״ק", "אישור", "כרטיס"].map((h) => (
                    <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id || r.transaction_id} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(r.transaction_time)}</td>
                    <td className={cn("px-3 py-2 font-semibold whitespace-nowrap", Number(r.amount) < 0 && "text-destructive")}>
                      {fmtAmount(r.amount, r.currency)}
                    </td>
                    <td className="px-3 py-2 max-w-[140px] truncate">{r.groupe || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.keva_id ? (
                        <span className="tabular-nums text-primary font-medium">{r.keva_id}</span>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.confirmation || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.last_num ? `••${r.last_num}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              {loadingMore ? "טוען..." : "טען עוד"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}