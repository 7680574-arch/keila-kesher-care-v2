import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtAmount(n, currency) {
  const sym = currency === 2 ? "$" : "₪";
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString("he-IL");
}
function fmtDate(s) {
  if (!s) return "—";
  return String(s).replace(/(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}):\d{2}/, "$1 $2");
}
function fmtDateOnly(s) {
  if (!s) return "—";
  return String(s).slice(0, 10);
}
const PAY_METHODS = { cash: "מזומן", check: "המחאה", transfer: "העברה", card: "אשראי", other: "אחר" };
const COLL_STATUS = { collected: "נאסף", pending: "ממתין" };
const TIME_RANGES = [
  { key: "all", label: "הכל" },
  { key: "year", label: "שנה" },
  { key: "month", label: "חודש" },
];

export default function MemberDonationsDialog({ open, onOpenChange, member }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [collections, setCollections] = useState([]);
  const [collTotal, setCollTotal] = useState(0);
  const [distributions, setDistributions] = useState([]);
  const [distTotal, setDistTotal] = useState(0);
  const [distTitles, setDistTitles] = useState({});
  const [holidayDonations, setHolidayDonations] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [depositTxs, setDepositTxs] = useState([]);
  const [timeRange, setTimeRange] = useState("all");

  const idDigits = (member?.id_number || "").replace(/\D/g, "");
  const spouseRaw = (member?.spouse_id || "").replace(/\D/g, "");
  const spouseDigits = spouseRaw.length >= 5 ? spouseRaw : "";

  const dateFrom = useMemo(() => {
    if (timeRange === "all") return null;
    const d = new Date();
    if (timeRange === "month") d.setMonth(d.getMonth() - 1);
    if (timeRange === "year") d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, [timeRange]);

  const query = useCallback(() => {
    if (!idDigits) return null;
    const q = spouseDigits
      ? { $or: [{ zeout: { $regex: idDigits, $options: "i" } }, { zeout: { $regex: spouseDigits, $options: "i" } }] }
      : { zeout: { $regex: idDigits, $options: "i" } };
    if (dateFrom) q.transaction_date = { $gte: dateFrom };
    return q;
  }, [idDigits, spouseDigits, dateFrom]);

  const collQuery = useCallback(() => {
    if (!idDigits) return null;
    return { $or: [
      { id_number: { $regex: idDigits, $options: "i" } },
      ...(member?.id ? [{ member_id: member.id }] : []),
    ] };
  }, [idDigits, member?.id]);

  const distQuery = useCallback(() => {
    if (!idDigits) return null;
    return { $or: [
      { id_number: { $regex: idDigits, $options: "i" } },
      ...(member?.id ? [{ member_id: member.id }] : []),
    ] };
  }, [idDigits, member?.id]);

  const donQuery = useCallback(() => {
    if (!idDigits) return null;
    const and = [
      { $or: [
        { id_number: { $regex: idDigits, $options: "i" } },
        ...(member?.id ? [{ member_id: member.id }] : []),
      ] },
      { payment_method: { $ne: "card" } },
      { source: { $ne: "imported" } },
    ];
    if (dateFrom) and.push({ date: { $gte: dateFrom } });
    return { $and: and };
  }, [idDigits, member?.id, dateFrom]);

  const load = useCallback(async () => {
    const q = query();
    const cq = collQuery();
    if (!q) return;
    setLoading(true);
    try {
      const dq = donQuery();
      const [page, agg, collPage, collAgg, distPage, distAgg, donPage] = await Promise.all([
        base44.entities.NedarimDonation.filter(q, { sort: "-transaction_date", limit: 100 }),
        base44.entities.NedarimDonation.aggregate({ query: q, sum: "amount" }).catch(() => null),
        cq
          ? base44.entities.Collection.filter(cq, { sort: "-date", limit: 200 })
          : Promise.resolve({ items: [] }),
        cq
          ? base44.entities.Collection.aggregate({ query: cq, sum: "amount" }).catch(() => null)
          : Promise.resolve(null),
        ...(dqr => dqr
          ? [
              base44.entities.DistributionRecipient.filter(dqr, { sort: "-created_date", limit: 200 }),
              base44.entities.DistributionRecipient.aggregate({ query: dqr, sum: "amount" }).catch(() => null),
            ]
          : [Promise.resolve({ items: [] }), Promise.resolve(null)]
        )(distQuery()),
        dq
          ? base44.entities.Donation.filter(dq, { sort: "-date", limit: 200 })
          : Promise.resolve({ items: [] }),
      ]);
      setRecords(page.items || []);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
      setTotal(Number(agg?.rows?.[0]?.sum_amount) || 0);
      setCollections(collPage.items || []);
      setCollTotal(Number(collAgg?.rows?.[0]?.sum_amount) || 0);
      setHolidayDonations(donPage.items || []);
      // פקדונות של החבר + פירעונות
      let depItems = [];
      let depTxItems = [];
      if (member?.id) {
        const depPage = await base44.entities.Deposit.filter({ member_id: member.id }, { sort: "-created_date", limit: 100 });
        depItems = depPage.items || [];
        if (depItems.length) {
          const depIds = depItems.map((d) => d.id);
          const depTxPage = await base44.entities.DepositTransaction.filter(
            { deposit_id: { $in: depIds } },
            { sort: "-date", limit: 500 }
          );
          depTxItems = depTxPage.items || [];
        }
      }
      setDeposits(depItems);
      setDepositTxs(depTxItems);
      const distItems = distPage.items || [];
      setDistributions(distItems);
      setDistTotal(Number(distAgg?.rows?.[0]?.sum_amount) || 0);
      const distIds = [...new Set(distItems.map((d) => d.distribution_id).filter(Boolean))];
      if (distIds.length) {
        base44.entities.Distribution.filter({ id: { $in: distIds } }, { limit: 200, fields: ["id", "title"] })
          .then((p) => {
            const map = {};
            (p.items || []).forEach((d) => { map[d.id] = d.title; });
            setDistTitles(map);
          })
          .catch(() => {});
      }
    } catch {
      setRecords([]); setTotal(0); setCollections([]); setCollTotal(0);
      setDistributions([]); setDistTotal(0); setDistTitles({});
      setHolidayDonations([]);
      setDeposits([]); setDepositTxs([]);
    } finally {
      setLoading(false);
    }
  }, [query, collQuery, distQuery, donQuery]);

  useEffect(() => {
    if (open && idDigits) {
      load();
    } else {
      setRecords([]); setTotal(0); setCursor(null); setHasMore(false);
      setCollections([]); setCollTotal(0);
      setDistributions([]); setDistTotal(0); setDistTitles({});
      setHolidayDonations([]);
      setDeposits([]); setDepositTxs([]);
    }
  }, [open, idDigits, load]);

  const loadMore = async () => {
    const q = query();
    if (!q || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.NedarimDonation.filter(q, { sort: "-transaction_date", limit: 100, cursor });
      setRecords((p) => [...p, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } finally { setLoadingMore(false); }
  };

  const sumShown = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const hasDonations = records.length > 0 || holidayDonations.length > 0;
  const hasCollections = collections.length > 0;
  const hasDistributions = distributions.length > 0;
  const depositNetBalance = useMemo(() => {
    if (!deposits.length) return 0;
    const totalInit = deposits.reduce((s, d) => s + (Number(d.initial_amount) || 0), 0);
    const additions = depositTxs.filter((t) => t.type === "hk_deposit").reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const deductions = depositTxs.filter((t) => ["hk_deduction", "redemption", "manual_deduction"].includes(t.type)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return totalInit + additions - deductions;
  }, [deposits, depositTxs]);
  const redemptionTxs = useMemo(() => depositTxs.filter((t) => t.type === "redemption"), [depositTxs]);
  const hasDeposits = deposits.length > 0;
  const DIST_STATUS = { pending: "ממתין", delivered: "נמסר" };

  const mergedRecords = useMemo(() => {
    const nedarim = records.map((r) => ({
      key: r.id || r.transaction_id,
      sortDate: r.transaction_date || "",
      date: fmtDate(r.transaction_time),
      amount: Number(r.amount) || 0,
      currency: r.currency,
      category: r.groupe || "",
      confirmation: r.confirmation || "",
      card: r.last_num ? `••${r.last_num}` : "",
      comments: [r.transaction_type, r.comments].filter(Boolean).join(" · "),
    }));
    const holiday = holidayDonations.map((r) => ({
      key: `d_${r.id}`,
      sortDate: r.date || "",
      date: fmtDateOnly(r.date),
      amount: Number(r.amount) || 0,
      currency: 1,
      category: PAY_METHODS[r.payment_method] || r.payment_method || "",
      confirmation: r.receipt_number || "",
      card: "",
      comments: [r.campaign, r.notes].filter(Boolean).join(" · "),
    }));
    return [...nedarim, ...holiday].sort((a, b) => (b.sortDate || "").localeCompare(a.sortDate || ""));
  }, [records, holidayDonations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto scrollbar-thin" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            תרומות ואיסופים
            {member?.name && <span className="text-sm font-normal text-muted-foreground">· {member.name}</span>}
            {member?.id_number && <span className="text-sm font-normal text-muted-foreground">· {member.id_number}</span>}
          </DialogTitle>
        </DialogHeader>

        {!idDigits ? (
          <div className="text-center py-10 text-muted-foreground">
            <Coins className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>אין תעודת זהות בכרטיס החבר — לא ניתן לשייך תרומות ואיסופים.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : (!hasDonations && !hasCollections && !hasDeposits) ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>לא נמצאו תרומות, איסופים או חלוקות משויכים לחבר זה.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">סה״כ תרומות נדרים</p>
                  <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
                </div>
                <p className="text-lg font-bold mt-1">{fmtAmount(total, 1)}</p>
              </div>
              <Stat label="סה״כ איסופי קופות" value={fmtAmount(collTotal, 1)} />
              <Stat label="סה״כ חלוקות" value={fmtAmount(distTotal, 1)} />
              {hasDeposits && <Stat label="יתרת פקדונות" value={fmtAmount(depositNetBalance, 1)} highlight={depositNetBalance < 0} />}
            </div>

            {hasDonations && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">תרומות (נדרים פלוס + חגים ללא אשראי)</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          {["תאריך", "סכום", "קטגוריה", "אישור", "כרטיס", "סוג / הערות"].map((h) => (
                            <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mergedRecords.map((r, idx) => (
                          <tr key={r.key} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                            <td className="px-3 py-2 whitespace-nowrap">{r.date || "—"}</td>
                            <td className={cn("px-3 py-2 font-semibold whitespace-nowrap", r.amount < 0 && "text-destructive")}>{fmtAmount(r.amount, r.currency)}</td>
                            <td className="px-3 py-2 max-w-[140px] truncate">{r.category || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.confirmation || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.card || "—"}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate">{r.comments || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMore && (
                    <div className="flex justify-center px-4 py-2.5 border-t border-border">
                      <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? "טוען..." : "טען עוד"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {hasDistributions && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">חלוקות שהתקבלו</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          {["חלוקה", "שווי למקבל", "השתתפות אברך", "השתתפות קופה", "סטטוס", "הערות"].map((h) => (
                            <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {distributions.map((d, idx) => (
                          <tr key={d.id} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={distTitles[d.distribution_id] || ""}>{distTitles[d.distribution_id] || d.distribution_id || "—"}</td>
                            <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmtAmount(d.amount, 1)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{d.member_participation != null ? fmtAmount(d.member_participation, 1) : "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{d.fund_participation != null ? fmtAmount(d.fund_participation, 1) : "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{DIST_STATUS[d.status] || d.status || "—"}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate">{d.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {hasDeposits && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">פקדונות — פירעונות</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          {["תאריך", "סכום פירעון", "אמצעי תשלום", "הערות"].map((h) => (
                            <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {redemptionTxs.map((t, idx) => (
                          <tr key={t.id} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDateOnly(t.date)}</td>
                            <td className="px-3 py-2 font-semibold text-destructive whitespace-nowrap">{fmtAmount(-(Number(t.amount) || 0), 1)}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{PAY_METHODS[t.payment_method] || t.payment_method || "—"}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{t.notes || "—"}</td>
                          </tr>
                        ))}
                        {redemptionTxs.length === 0 && (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">אין פירעונות עדיין</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {hasCollections && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">איסופי קופות</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          {["תאריך", "סכום", "קרן / קמפיין", "אמצעי תשלום", "מס׳ קבלה", "סטטוס", "הערות"].map((h) => (
                            <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {collections.map((c, idx) => (
                          <tr key={c.id} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDateOnly(c.date)}</td>
                            <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmtAmount(c.amount, 1)}</td>
                            <td className="px-3 py-2 max-w-[160px] truncate">{c.fund || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{PAY_METHODS[c.payment_method] || c.payment_method || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{c.receipt_number || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{COLL_STATUS[c.status] || c.status || "—"}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate">{c.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-bold mt-0.5", highlight && "text-destructive")}>{value}</p>
    </div>
  );
}

function TimeRangeFilter({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden bg-muted/30">
      {TIME_RANGES.map((r, i) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          className={cn(
            "px-2 py-0.5 text-[11px] font-medium transition-colors",
            i > 0 && "border-r border-border",
            value === r.key
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}