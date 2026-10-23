import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DonorFormDialog from "@/components/donors/DonorFormDialog";
import DonorHistoryDialog from "@/components/donors/DonorHistoryDialog";
import { Heart, Plus, Pencil, Trash2, Loader2, Search, History } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Donors() {
  const { toast } = useToast();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState(null); // donor object or null for new
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [historyDonor, setHistoryDonor] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = debounced
        ? { $or: [
            { name: { $regex: debounced, $options: "i" } },
            { id_number: { $regex: debounced, $options: "i" } },
            { phone: { $regex: debounced, $options: "i" } },
            { mobile: { $regex: debounced, $options: "i" } },
            { company: { $regex: debounced, $options: "i" } },
          ] }
        : {};
      const page = await base44.entities.Donor.filter(q, { sort: "-created_date", limit: 200 });
      setDonors(page.items || []);
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debounced, toast]);

  useEffect(() => { load(); }, [debounced]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (d) => { setEditing(d); setDialogOpen(true); };
  const openHistory = (d) => setHistoryDonor(d);

  const saveDonor = async (form) => {
    try {
      const payload = {
        name: form.name?.trim(),
        id_number: form.id_number?.trim() || null,
        phone: form.phone?.trim() || null,
        mobile: form.mobile?.trim() || null,
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        company: form.company?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (editing?.id) {
        await base44.entities.Donor.update(editing.id, payload);
        toast({ title: "התורם עודכן" });
      } else {
        await base44.entities.Donor.create({ ...payload, source: "manual" });
        toast({ title: "התורם נוסף" });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (d) => {
    if (!confirm(`למחוק את התורם "${d.name}"?`)) return;
    setSavingId(d.id);
    try {
      await base44.entities.Donor.delete(d.id);
      toast({ title: "התורם נמחק" });
      load();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Heart className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">תורמים</h1>
            <p className="text-sm text-muted-foreground">תורמים שאינם חלק מרשימת הקהילה</p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> תורם חדש
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם / ת״ז / טלפון / חברה..." className="pr-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : donors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-border">
          <Heart className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>אין תורמים עדיין.</p>
          <p className="text-sm mt-1">ניתן להוסיף תורם ידנית או ממסך שיוך תרומות נדרים.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {["שם", "ת\"ז", "חברה", "טלפון", "נייד", "עיר", "כתובת", "הערות", "", ""].map((h) => (
                    <th key={h} className="text-right px-3 py-3 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donors.map((d, idx) => (
                  <tr key={d.id} className={cn("border-t border-border hover:bg-muted/30", idx % 2 && "bg-muted/10")}>
                    <td className="px-3 py-2.5 font-medium">
                      <button
                        onClick={() => openHistory(d)}
                        className="text-right hover:text-primary hover:underline inline-flex items-center gap-1"
                        title="היסטוריית תרומות"
                      >
                        {d.name}
                        <History className="w-3.5 h-3.5 opacity-50" />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{d.id_number || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 max-w-[140px] truncate">{d.company || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{d.phone || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{d.mobile || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5">{d.city || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate" title={d.address || ""}>{d.address || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 max-w-[220px] truncate" title={d.notes || ""}>{d.notes || <span className="text-muted-foreground/40">—</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openHistory(d)} title="היסטוריית תרומות">
                        <History className="w-4 h-4" />
                      </Button>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="עריכה">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(d)} disabled={savingId === d.id} title="מחיקה">
                          {savingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            {donors.length} תורמים
          </div>
        </div>
      )}

      <DonorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        donor={editing}
        onSaved={saveDonor}
      />

      <DonorHistoryDialog
        open={!!historyDonor}
        onOpenChange={(o) => !o && setHistoryDonor(null)}
        donor={historyDonor}
      />
    </div>
  );
}