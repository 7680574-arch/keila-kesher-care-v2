import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const STATUS = { planning: "תכנון", active: "פעיל", completed: "הושלם" };

export default function FundraisingEventFormDialog({ open, onOpenChange, initial, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", date: "", goal_amount: "", status: "planning", event_type: "invitees", linked_event_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [linkEvents, setLinkEvents] = useState([]);

  useEffect(() => {
    if (open) setForm({ title: "", date: "", goal_amount: "", status: "planning", event_type: "invitees", linked_event_id: "", notes: "", ...(initial || {}) });
    if (open) {
      base44.entities.FundraisingEvent.list("-date", 500).then((evs) => setLinkEvents(evs.filter((e) => e.event_type !== "community"))).catch(() => {});
    }
  }, [open, initial]);

  const save = async () => {
    if (!form.title?.trim()) { toast({ title: "נא להזין שם אירוע", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { ...form, goal_amount: Number(form.goal_amount) || 0 };
      const saved = initial?.id
        ? await base44.entities.FundraisingEvent.update(initial.id, payload)
        : await base44.entities.FundraisingEvent.create(payload);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial?.id ? "עריכת אירוע התרמה" : "אירוע התרמה חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>שם האירוע / קמפיין</Label>
            <Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="לדוגמה: ערב התרמה חנוכה" />
          </div>
          <div className="space-y-1.5"><Label>סוג אירוע</Label>
            <Select value={form.event_type || "invitees"} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="invitees">אירוע למוזמנים</SelectItem>
                <SelectItem value="community">קמפיין קהילתי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.event_type === "community" && (
            <div className="space-y-1.5"><Label>אירוע התרמה למוזמנים לשייך</Label>
              <Select value={form.linked_event_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, linked_event_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר אירוע מוזמנים" /></SelectTrigger>
                <SelectContent>
                  {linkEvents.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}{e.date ? ` · ${new Date(e.date).toLocaleDateString("he-IL")}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>תאריך</Label><Input type="date" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>יעד תרומה ₪</Label><Input type="number" value={form.goal_amount || ""} onChange={(e) => setForm((f) => ({ ...f, goal_amount: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>סטטוס</Label>
            <Select value={form.status || "planning"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>הערות</Label><Input value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={save} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}