import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, RefreshCw, Coins } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { computeDepositBalance, signForType, ADDITION_TYPES, parseHkInstructions } from "@/lib/depositBalance";

const PAY_METHODS = { cash: "מזומן", check: "המחאה", transfer: "העברה", card: "אשראי", other: "אחר" };
const TYPE_LABELS = { hk_deduction: "הו״ק הפחתה", hk_deposit: "הו״ק הפקדה", redemption: "פירעון", manual_deduction: "הפחתה ידנית" };
const SOURCE_LABELS = { manual: "ידני", nedarim_history: "נדרים (היסטוריה)", nedarim_sync: "נדרים (סנכרון)" };

function fmt(n) {
  const v = Number(n) || 0;
  return "₪" + v.toLocaleString("he-IL");
}
function fmtDate(s) {
  if (!s) return "—";
  return String(s).slice(0, 10);
}

export default function DepositDetailDialog({ open, onOpenChange, deposit, onSaved }) {
  const { toast } = useToast();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "redemption", amount: "", date: "", payment_method: "transfer", notes: "" });
  const [savingTx, setSavingTx] = useState(false);

  const load = useCallback(async () => {
    if (!deposit?.id) return;
    setLoading(true);
    try {
      const page = await base44.entities.DepositTransaction.filter(
        { deposit_id: deposit.id },
        { sort: "-date", limit: 500 }
      );
      setTxs(page.items || []);
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [deposit?.id]);

  useEffect(() => {
    if (open && deposit?.id) {
      load();
      setForm({ type: "redemption", amount: "", date: new Date().toISOString().slice(0, 10), payment_method: "transfer", notes: "" });
      setShowForm(false);
    } else {
      setTxs([]);
    }
  }, [open, deposit?.id, load]);

  const balance = computeDepositBalance(deposit?.initial_amount, txs);

  const syncFromNedarim = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncDepositHK", { deposit_id: deposit.id });
      const data = res?.data || res || {};
      const created = data.totalCreated || 0;
      toast({ title: created ? `נוספו ${created} תנועות הו״ק מנדרים` : "אין תנועות חדשות לסנכרן" });
      load();
      onSaved?.();
    } catch (e) {
      toast({ title: "שגיאה בסנכרון", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const saveTx = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast({ title: "יש להזין סכום חיובי", variant: "destructive" });
      return;
    }
    setSavingTx(true);
    try {
      await base44.entities.DepositTransaction.create({
        deposit_id: deposit.id,
        member_id: deposit.member_id || "",
        type: form.type,
        amount: Number(form.amount) || 0,
        date: form.date,
        payment_method: form.payment_method,
        source: "manual",
        notes: form.notes.trim(),
      });
      toast({ title: "התנועה נוספה" });
      setForm({ type: "redemption", amount: "", date: new Date().toISOString().slice(0, 10), payment_method: "transfer", notes: "" });
      setShowForm(false);
      load();
      onSaved?.();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingTx(false);
    }
  };

  const deleteTx = async (t) => {
    if (!confirm("למחוק תנועה זו?")) return;
    try {
      await base44.entities.DepositTransaction.delete(t.id);
      toast({ title: "התנועה נמחקה" });
      load();
      onSaved?.();
    } catch (e) {
      toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-thin" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            פיקדון — {deposit?.name}
            {deposit?.id_number && <span className="text-sm font-normal text-muted-foreground">· {deposit.id_number}</span>}
          </DialogTitle>
        </DialogHeader>

        {deposit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="סכום התחלתי" value={fmt(deposit.initial_amount)} />
            <Stat label="יתרה נוכחית" value={fmt(balance)} highlight={balance < 0} />
            <Stat label="הוראות קבע" value={(() => { const l = parseHkInstructions(deposit); return l.length ? `${l.length} הו״ק` : "—"; })()} />
            <Stat label="סטטוס" value={TYPE_LABELS[deposit.status] || deposit.status || "—"} />
          </div>
        )}

        {deposit && parseHkInstructions(deposit).length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">הוראות קבע (סנכרון מנדרים פלוס)</p>
            <div className="flex flex-wrap gap-2">
              {parseHkInstructions(deposit).map((it, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-sm bg-card border border-border rounded-lg px-2.5 py-1.5">
                  <span className="tabular-nums font-medium">{it.number}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${it.type === "deposit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {it.type === "deposit" ? "הפקדה" : "הפחתה"}
                  </span>
                  {it.amount != null && <span className="text-xs text-muted-foreground">{fmt(it.amount)}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-4 h-4" /> {showForm ? "סגירה" : "הוספת פירעון / הפחתה"}
            </Button>
            {deposit && parseHkInstructions(deposit).length > 0 && (
              <Button size="sm" variant="outline" onClick={syncFromNedarim} disabled={syncing}>
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {syncing ? "מסנכרן..." : "סנכרן הו״ק מנדרים"}
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>סוג תנועה</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="redemption">פירעון</SelectItem>
                    <SelectItem value="manual_deduction">הפחתה ידנית</SelectItem>
                    <SelectItem value="hk_deduction">הו״ק הפחתה ידני</SelectItem>
                    <SelectItem value="hk_deposit">הו״ק הפקדה ידני</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>סכום *</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>אמצעי תשלום</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAY_METHODS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>הערות</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
              <Button size="sm" onClick={saveTx} disabled={savingTx}>{savingTx ? "שומר..." : "שמור תנועה"}</Button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">תנועות פיקדון</p>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : txs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">אין תנועות עדיין.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {["תאריך", "סוג", "סכום", "אמצעי תשלום", "מקור", "הערות", ""].map((h) => (
                        <th key={h} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t, idx) => (
                      <tr key={t.id} className={cn("border-t border-border", idx % 2 && "bg-muted/10")}>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{TYPE_LABELS[t.type] || t.type}</td>
                        <td className={cn("px-3 py-2 font-semibold whitespace-nowrap", ADDITION_TYPES.includes(t.type) ? "text-emerald-600" : "text-destructive")}>{signForType(t.type)}{fmt(t.amount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{PAY_METHODS[t.payment_method] || t.payment_method || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{SOURCE_LABELS[t.source] || t.source}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{t.notes || "—"}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteTx(t)} className="p-1 rounded-lg hover:bg-destructive/10 text-destructive" title="מחיקת שורה">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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