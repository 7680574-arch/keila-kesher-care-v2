import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

/** Create / edit a distribution group and choose which distributions belong to it. */
export default function GroupFormDialog({ open, onOpenChange, onSaved, group, distributions }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const editing = !!group?.id;

  useEffect(() => {
    if (!open) return;
    setName(group?.name || "");
    setMembers(new Set(group ? distributions.filter((d) => d.group_id === group.id).map((d) => d.id) : []));
  }, [open, group, distributions]);

  const toggle = (id) => setMembers((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const saved = editing
        ? await base44.entities.DistributionGroup.update(group.id, { name: name.trim() })
        : await base44.entities.DistributionGroup.create({ name: name.trim() });
      const gid = editing ? group.id : saved.id;
      const toAdd = distributions.filter((d) => members.has(d.id) && d.group_id !== gid);
      const toRemove = distributions.filter((d) => !members.has(d.id) && d.group_id === gid);
      await Promise.all([
        ...toAdd.map((d) => base44.entities.Distribution.update(d.id, { group_id: gid })),
        ...toRemove.map((d) => base44.entities.Distribution.update(d.id, { group_id: "" })),
      ]);
      onOpenChange(false);
      onSaved?.();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{editing ? "עריכת קבוצת חלוקות" : "קבוצת חלוקות חדשה"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם הקבוצה *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: פסח תשפ״ז" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>החלוקות בקבוצה ({members.size})</Label>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {distributions.length === 0 && <p className="p-4 text-sm text-center text-muted-foreground">אין חלוקות.</p>}
              {distributions.map((d) => (
                <label key={d.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted">
                  <Checkbox checked={members.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                  <span className="text-sm">{d.title}</span>
                  {d.group_id && d.group_id !== group?.id && members.has(d.id) && (
                    <span className="text-xs text-amber-700 mr-auto">יועבר מקבוצה אחרת</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          <Button type="button" disabled={saving || !name.trim()} onClick={submit}>
            {saving ? "שומר…" : editing ? "שמור שינויים" : "צור קבוצה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}