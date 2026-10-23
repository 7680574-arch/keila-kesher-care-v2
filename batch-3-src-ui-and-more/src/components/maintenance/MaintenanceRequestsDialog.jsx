import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Wrench } from "lucide-react";
import { STATUS_LABELS, STATUS_STYLES, URGENCY_LABELS, URGENCY_STYLES } from "@/lib/maintenanceLabels";
import MaintenanceRequestFormDialog from "./MaintenanceRequestFormDialog";
import MaintenanceRequestDetailDialog from "./MaintenanceRequestDetailDialog";

export default function MaintenanceRequestsDialog({ open, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.MaintenanceRequest.filter({}, { sort: "-created_date", limit: 100 });
      setRows(page.items || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              אחזקת בית הספר
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{rows.length} קריאות</p>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4" />
              קריאה חדשה
            </Button>
          </div>
          <div className="max-h-[55vh] overflow-auto scrollbar-thin rounded-xl border border-border">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">אין קריאות עדיין</div>
            ) : (
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-right px-3 py-2">כותרת</th>
                    <th className="text-right px-3 py-2">מיקום</th>
                    <th className="text-right px-3 py-2">דחיפות</th>
                    <th className="text-right px-3 py-2">סטטוס</th>
                    <th className="text-right px-3 py-2">תאריך</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(r)}>
                      <td className="px-3 py-2 font-medium">{r.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.location || "—"}</td>
                      <td className="px-3 py-2">
                        <Badge className={URGENCY_STYLES[r.urgency]}>{URGENCY_LABELS[r.urgency] || r.urgency}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={STATUS_STYLES[r.status]}>{STATUS_LABELS[r.status] || r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.created_date ? new Date(r.created_date).toLocaleDateString("he-IL") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MaintenanceRequestFormDialog open={formOpen} onClose={() => setFormOpen(false)} onCreated={load} />
      <MaintenanceRequestDetailDialog
        request={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdated={(u) => {
          setRows((prev) => prev.map((r) => (r.id === u.id ? { ...r, ...u } : r)));
          setSelected(u);
        }}
      />
    </>
  );
}