import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, TrendingDown, Wallet, Plus, Trash2, Check, Pencil } from "lucide-react";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function CaseFinance({ caseItem }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("income");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ amount: "", date: today(), description: "", category: "", paid: true });
  const [showAll, setShowAll] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const filteredTxns = filterType === "all" ? txns : txns.filter((t) => t.type === filterType);
  const visible = showAll ? filteredTxns : filteredTxns.slice(0, 5);

  const load = async () => {
    setLoading(true);
    const t = await base44.entities.CaseTransaction.filter({ case_id: caseItem.id }, "-date");
    setTxns(t);
    setLoading(false);
  };
  useEffect(() => { if (caseItem?.id) load(); }, [caseItem?.id]);

  const openAdd = (t) => {
    setType(t);
    setEditingId(null);
    setForm({ amount: "", date: today(), description: "", category: t === "income" ? "תרומה" : "תשלום", paid: true });
    setOpen(true);
  };
  const openEdit = (t) => {
    setType(t.type);
    setEditingId(t.id);
    setForm({ amount: String(t.amount || ""), date: t.date || today(), description: t.description || "", category: t.category || "", paid: t.paid !== false });
    setOpen(true);
  };
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    const payload = {
      type,
      amount: amt,
      date: form.date,
      description: form.description,
      category: form.category,
      paid: form.paid,
    };
    if (editingId) {
      await base44.entities.CaseTransaction.update(editingId, payload);
    } else {
      await base44.entities.CaseTransaction.create({ case_id: caseItem.id, client_id: caseItem.client_id, ...payload });
    }
    setEditingId(null);
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    if (!confirm("מחיקת רשומה כספית?")) return;
    await base44.entities.CaseTransaction.delete(id);
    load();
  };

  const togglePaid = async (t) => {
    const next = t.paid === false;
    setTxns((prev) => prev.map((x) => (x.id === t.id ? { ...x, paid: next } : x)));
    await base44.entities.CaseTransaction.update(t.id, { paid: next });
  };

  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
  const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
  const balance = income - expense;
  const incomePending = txns.filter((t) => t.type === "income" && t.paid === false).reduce((s, t) => s + (t.amount || 0), 0);
  const expensePending = txns.filter((t) => t.type === "expense" && t.paid === false).reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" /> תיעוד כספי ({txns.length})
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openAdd("income")} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <Plus className="w-4 h-4 ml-1" /> הוסף תרומה
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAdd("expense")} className="text-rose-700 border-rose-200 hover:bg-rose-50">
            <Plus className="w-4 h-4 ml-1" /> הוסף תשלום
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-border">
        <button
          onClick={() => { setFilterType("income"); setShowAll(false); }}
          className={`rounded-xl bg-emerald-50 p-3 text-right transition hover:bg-emerald-100 ${filterType === "income" ? "ring-2 ring-emerald-400" : ""}`}
        >
          <p className="text-xs text-emerald-700 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> תרומות</p>
          <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(income)}</p>
          {incomePending > 0 && <p className="text-xs text-amber-600 mt-0.5">ממתין להתקבל: {fmt(incomePending)}</p>}
        </button>
        <button
          onClick={() => { setFilterType("expense"); setShowAll(false); }}
          className={`rounded-xl bg-rose-50 p-3 text-right transition hover:bg-rose-100 ${filterType === "expense" ? "ring-2 ring-rose-400" : ""}`}
        >
          <p className="text-xs text-rose-700 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> תשלומים</p>
          <p className="text-lg font-bold text-rose-700 mt-1">{fmt(expense)}</p>
          {expensePending > 0 && <p className="text-xs text-amber-600 mt-0.5">טרם שולמו: {fmt(expensePending)}</p>}
        </button>
        <button
          onClick={() => { setFilterType("all"); setShowAll(false); }}
          className={`rounded-xl p-3 text-right transition ${balance >= 0 ? "bg-primary/5 hover:bg-primary/10" : "bg-amber-50 hover:bg-amber-100"} ${filterType === "all" ? "ring-2 ring-primary" : ""}`}
        >
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> יתרה · הצג הכל</p>
          <p className={`text-lg font-bold mt-1 ${balance >= 0 ? "text-primary" : "text-amber-700"}`}>{fmt(balance)}</p>
        </button>
      </div>

      {filterType !== "all" && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">מציג: {filterType === "income" ? "תרומות בלבד" : "תשלומים בלבד"}</span>
          <button onClick={() => setFilterType("all")} className="text-xs text-primary hover:underline">הצג הכל</button>
        </div>
      )}

      <div className="divide-y divide-border">
        {loading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">טוען…</p>}
        {!loading && filteredTxns.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">אין תנועות כספיות בתיק זה עדיין</p>
        )}
        {visible.map((t) => {
          const isIncome = t.type === "income";
          return (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-secondary/40 transition">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {t.description || (isIncome ? "תרומה" : "תשלום")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.date}{t.category ? ` · ${t.category}` : ""}
                </p>
              </div>
              <span className={`text-sm font-bold shrink-0 ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                {isIncome ? "+" : "−"} {fmt(t.amount)}
              </span>
              {t.paid === false ? (
                <button
                  onClick={() => togglePaid(t)}
                  className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 whitespace-nowrap shrink-0"
                  title={isIncome ? "סמן כהתקבל" : "סמן כשולם"}
                >
                  {isIncome ? "סמן כהתקבל" : "סמן כשולם"}
                </button>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                  <Check className="w-3 h-3" /> {isIncome ? "התקבל" : "שולם"}
                </span>
              )}
              <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition shrink-0" title="עריכה">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {filteredTxns.length > 5 && (
        <div className="px-5 py-3 border-t border-border">
          <button onClick={() => setShowAll((s) => !s)} className="w-full text-sm text-primary hover:underline">
            {showAll ? "מזעור רשימה" : `הצג את כל ${filteredTxns.length} התנועות`}
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? (type === "income" ? "עריכת תרומה" : "עריכת תשלום") : (type === "income" ? "הוספת תרומה" : "הוספת תשלום")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>סכום (₪) *</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => update("amount", e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>תאריך</Label>
                <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>קטגוריה</Label>
                <Input value={form.category} onChange={(e) => update("category", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>תיאור / פרטים</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
              <Checkbox checked={form.paid} onCheckedChange={(c) => update("paid", c)} id="paid" />
              <span>{type === "income" ? "התרומה כבר התקבלה" : "התשלום כבר שולם"}</span>
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" onClick={submit}>שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}