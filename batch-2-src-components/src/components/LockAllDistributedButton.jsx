import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LockKeyhole, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { lockMany } from "@/lib/distributionLock";

export default function LockAllDistributedButton({ distributions, recipients, onDone }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const unlocked = distributions.filter((d) => !d.data_locked);
  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allChecked = unlocked.length > 0 && unlocked.every((d) => selected.has(d.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(unlocked.map((d) => d.id)));

  const run = async () => {
    const list = unlocked.filter((d) => selected.has(d.id));
    if (!list.length) return;
    setBusy(true);
    try {
      const page = await base44.entities.CommunityMember.filter({}, { limit: 5000 });
      await lockMany(list, recipients, page.items || []);
      toast({ title: `נקבעו הנתונים של ${list.length} חלוקות` });
      setOpen(false);
      setSelected(new Set());
      onDone();
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LockKeyhole className="w-4 h-4 ml-1" /> קביעת נתונים לחלוקות
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>סמן את החלוקות שברצונך לקבוע</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto space-y-1">
            {unlocked.length > 0 && (
              <label className="flex items-center gap-2 px-2 py-2 border-b border-border font-medium cursor-pointer">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} /> בחר הכל ({unlocked.length})
              </label>
            )}
            {distributions.map((d) => (
              d.data_locked ? (
                <div key={d.id} className="flex items-center gap-2 px-2 py-2 text-muted-foreground">
                  <Lock className="w-4 h-4 text-amber-700" /> {d.title}
                  <span className="text-xs mr-auto">כבר קבועה</span>
                </div>
              ) : (
                <label key={d.id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                  <span>{d.title}</span>
                  {d.date && <span className="text-xs text-muted-foreground mr-auto">{d.date}</span>}
                </label>
              )
            ))}
            {distributions.length === 0 && <p className="text-center text-muted-foreground py-6">אין חלוקות.</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={run} disabled={busy || selected.size === 0}>
              {busy ? "קובע…" : `קבע נתונים (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}