import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Coins, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import DepositFormDialog from "@/components/deposits/DepositFormDialog";
import DepositDetailDialog from "@/components/deposits/DepositDetailDialog";
import FinanceSummaryCards from "@/components/deposits/FinanceSummaryCards";
import LashavuaTab from "@/components/lashavua/LashavuaTab";
import { parseHkInstructions } from "@/lib/depositBalance";

const STATUS_LABELS = { active: "פעיל", redeemed: "נפרע", closed: "סגור" };
const STATUS_CLASS = {
  active: "bg-emerald-100 text-emerald-700",
  redeemed: "bg-blue-100 text-blue-700",
  closed: "bg-muted text-muted-foreground",
};

function fmt(n) {
  const v = Number(n) || 0;
  return "₪" + v.toLocaleString("he-IL");
}

export default function Deposits() {
  const { toast } = useToast();
  const [deposits, setDeposits] = useState([]);
  const [balances, setBalances] = useState({});
  const [members, setMembers] = useState([]);
  const [lashavuaBalances, setLashavuaBalances] = useState({ lashavua: 0, supermarket: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editDep, setEditDep] = useState(null);
  const [detailDep, setDetailDep] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [depPage, dedAgg, addAgg, memPage, incAgg, trnAgg] = await Promise.all([
        base44.entities.Deposit.filter({}, { sort: "-created_date", limit: 500 }),
        base44.entities.DepositTransaction.aggregate({ query: { type: { $in: ["hk_deduction", "redemption", "manual_deduction"] } }, groupBy: "deposit_id", sum: "amount" }).catch(() => null),
        base44.entities.DepositTransaction.aggregate({ query: { type: "hk_deposit" }, groupBy: "deposit_id", sum: "amount" }).catch(() => null),
        base44.entities.CommunityMember.filter({}, { sort: "last_name", limit: 2000, fields: ["id", "name", "id_number", "phone", "mobile"] }),
        base44.entities.LashavuaTovaTransaction.aggregate({ query: { kind: "income", legacy: { $ne: true } }, groupBy: "bucket", sum: ["amount", "commission"] }).catch(() => null),
        base44.entities.LashavuaTovaTransaction.aggregate({ query: { kind: "transfer", legacy: { $ne: true } }, groupBy: "bucket", sum: ["amount", "commission"] }).catch(() => null),
      ]);
      const balMap = {};
      (dedAgg?.rows || []).forEach((r) => { balMap[r.deposit_id] = (balMap[r.deposit_id] || 0) - (Number(r.sum_amount) || 0); });
      (addAgg?.rows || []).forEach((r) => { balMap[r.deposit_id] = (balMap[r.deposit_id] || 0) + (Number(r.sum_amount) || 0); });
      setBalances(balMap);
      setDeposits(depPage.items || []);
      setMembers(memPage.items || []);
      // חישוב יתרות לשבוע מטובה וסופרים (זהה ללוגיקה ב-LashavuaTab)
      const inc = { lashavua: { a: 0, c: 0 }, supermarket: { a: 0, c: 0 }, expenses: { a: 0, c: 0 } };
      const trn = { lashavua: { a: 0, c: 0 }, supermarket: { a: 0, c: 0 }, expenses: { a: 0, c: 0 } };
      (incAgg?.rows || []).forEach((r) => { const b = r.bucket || "lashavua"; if (inc[b]) { inc[b].a += Number(r.sum_amount) || 0; inc[b].c += Number(r.sum_commission) || 0; } });
      (trnAgg?.rows || []).forEach((r) => { const b = r.bucket || "lashavua"; if (trn[b]) { trn[b].a += Number(r.sum_amount) || 0; trn[b].c += Number(r.sum_commission) || 0; } });
      const expTotal = trn.expenses.a + trn.expenses.c;
      setLashavuaBalances({
        lashavua: inc.lashavua.a - inc.lashavua.c - (trn.lashavua.a + trn.lashavua.c) - expTotal,
        supermarket: inc.supermarket.a - inc.supermarket.c - (trn.supermarket.a + trn.supermarket.c),
      });
    } catch {
      setDeposits([]); setBalances({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const depositsTotal = useMemo(
    () => deposits.reduce((s, d) => s + (Number(d.initial_amount) || 0) + (balances[d.id] || 0), 0),
    [deposits, balances]
  );

  const filtered = useMemo(() => {
    const s = search.trim();
    if (!s) return deposits;
    return deposits.filter((d) =>
      [d.name, d.id_number, d.hk_instruction_number, d.notes].some((f) =>
        String(f || "").includes(s)
      )
    );
  }, [deposits, search]);

  const onDelete = async (d) => {
    if (!confirm(`למחוק את הפיקדון של ${d.name}?`)) return;
    try {
      const txs = await base44.entities.DepositTransaction.filter({ deposit_id: d.id }, { limit: 2000, fields: ["id"] });
      const ids = (txs.items || []).map((t) => t.id);
      if (ids.length) await base44.entities.DepositTransaction.deleteMany({ id: { $in: ids } });
      await base44.entities.Deposit.delete(d.id);
      toast({ title: "הפיקדון נמחק" });
      load();
    } catch (e) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">פקדונות וקופות</h1>
        </div>
      </div>

      <FinanceSummaryCards
        depositsTotal={depositsTotal}
        lashavuaBalance={lashavuaBalances.lashavua}
        supermarketBalance={lashavuaBalances.supermarket}
      />

      <Tabs defaultValue="deposits" className="w-full">
        <TabsList>
          <TabsTrigger value="deposits">פקדונות</TabsTrigger>
          <TabsTrigger value="lashavua">לשבוע מטובה</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-5 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button onClick={() => { setEditDep(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4" /> פיקדון חדש
            </Button>
            <div className="relative max-w-md flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם / ת.ז. / מספר הו״ק..." className="pr-9" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Coins className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>אין פקדונות. לחץ על ״פיקדון חדש״ כדי להתחיל.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {["שם", "ת.ז.", "סכום התחלתי", "יתרה נוכחית", "הוראות קבע", "סטטוס", "פעולות"].map((h) => (
                        <th key={h} className="text-right px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d, idx) => {
                    const adj = balances[d.id] || 0;
                    const bal = (Number(d.initial_amount) || 0) + adj;
                    return (
                      <tr key={d.id} className={idx % 2 ? "bg-muted/10" : ""}>
                        <td className="px-4 py-3 font-medium hover:text-primary cursor-pointer" onClick={() => setDetailDep(d)}>
                          <span className="underline decoration-dotted">{d.name}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.id_number || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{fmt(d.initial_amount)}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">{fmt(bal)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const list = parseHkInstructions(d);
                            if (!list.length) return <span className="text-muted-foreground/40">—</span>;
                            return (
                              <div className="flex flex-col gap-1">
                                {list.map((it, i) => (
                                  <span key={i} className="inline-flex items-center gap-1">
                                    <span className="tabular-nums">{it.number || "—"}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${it.type === "deposit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                      {it.type === "deposit" ? "הפקדה" : "הפחתה"}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[d.status] || STATUS_CLASS.active}`}>
                            {STATUS_LABELS[d.status] || d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditDep(d); setFormOpen(true); }} className="p-1.5 rounded-lg hover:bg-secondary" title="עריכה"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => onDelete(d)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" title="מחיקה"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DepositFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditDep(null); }} members={members} editDep={editDep} onSaved={load} />
          <DepositDetailDialog open={!!detailDep} onOpenChange={(o) => !o && setDetailDep(null)} deposit={detailDep} members={members} onSaved={load} />
        </TabsContent>

        <TabsContent value="lashavua" className="mt-4">
          <LashavuaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}