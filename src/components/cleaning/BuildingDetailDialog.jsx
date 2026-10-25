import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, DoorOpen, ListChecks, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import CleaningTaskDialog from "./CleaningTaskDialog";
import MemberPicker from "@/components/MemberPicker";

const EMPTY = {
  name: "", address: "", responsible_name: "",
  responsible_phone: "", status: "dirty", notes: "",
};

function parseResidents(r) {
  if (!r) return [];
  try {
    const arr = typeof r === "string" ? JSON.parse(r) : r;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export default function BuildingDetailDialog({
  open, onOpenChange, building,
  onUpdateBuilding,
  tasks, buildings, volunteers, committee,
  onSaveTask, onDeleteTask, onToggleTask,
}) {
  const [tab, setTab] = useState("info");
  const [form, setForm] = useState(EMPTY);
  const [savingBld, setSavingBld] = useState(false);

  const [resForm, setResForm] = useState({ name: "", apartment: "", phone: "" });
  const [resEditIdx, setResEditIdx] = useState(-1);

  const [taskDlg, setTaskDlg] = useState({ open: false, editing: null });

  useEffect(() => {
    if (open && building) {
      setForm({ ...EMPTY, ...building });
      setTab("info");
    }
    setResForm({ name: "", apartment: "", phone: "" });
    setResEditIdx(-1);
  }, [open, building]);

  const residents = parseResidents(building?.residents);
  const buildingTasks = useMemo(
    () => (tasks || []).filter((t) => t.building_id === building?.id),
    [tasks, building?.id]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const residentOptions = residents.map((r, i) => ({ ...r, id: String(i), id_number: r.apartment ? `דירה ${r.apartment}` : "" }));
  const pickResponsible = (id) => {
    const r = residents[Number(id)];
    if (r) setForm((f) => ({ ...f, responsible_name: r.name || "", responsible_phone: r.phone || r.mobile || f.responsible_phone }));
  };

  const saveBuilding = async () => {
    if (!form.name?.trim()) return;
    setSavingBld(true);
    try {
      await onUpdateBuilding(building.id, {
        name: form.name,
        address: form.address,
        responsible_name: form.responsible_name,
        responsible_phone: form.responsible_phone,
        status: form.status,
        notes: form.notes,
      });
    } finally { setSavingBld(false); }
  };

  const persistResidents = async (list) => {
    await onUpdateBuilding(building.id, { residents: JSON.stringify(list) });
  };

  const addOrUpdateResident = async () => {
    if (!resForm.name.trim()) return;
    const list = [...residents];
    if (resEditIdx >= 0) {
      list[resEditIdx] = { ...list[resEditIdx], ...resForm };
    } else {
      list.push({ ...resForm });
    }
    await persistResidents(list);
    setResForm({ name: "", apartment: "", phone: "" });
    setResEditIdx(-1);
  };

  const editResident = (i) => {
    setResForm({ ...residents[i] });
    setResEditIdx(i);
  };

  const deleteResident = async (i) => {
    const list = residents.filter((_, idx) => idx !== i);
    await persistResidents(list);
    if (resEditIdx === i) { setResForm({ name: "", apartment: "", phone: "" }); setResEditIdx(-1); }
  };

  const STATUS_LABEL = { clean: "נוקה", dirty: "לא נוקה", in_progress: "בטיפול" };

  if (!building) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {building.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1">
          {[
            { id: "info", label: "פרטי בניין", icon: Building2 },
            { id: "residents", label: `דיירים (${residents.length})`, icon: DoorOpen },
            { id: "tasks", label: `משימות והערות (${buildingTasks.length})`, icon: ListChecks },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "info" && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>שם / מספר בניין *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>כתובת</Label>
              <Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>סטטוס ניקיון</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dirty">לא נוקה</SelectItem>
                    <SelectItem value="in_progress">בטיפול</SelectItem>
                    <SelectItem value="clean">נוקה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <span className={cn("text-xs font-medium px-2 py-1 rounded-full", {
                  "bg-emerald-100 text-emerald-700": building.status === "clean",
                  "bg-rose-100 text-rose-700": building.status === "dirty",
                  "bg-amber-100 text-amber-700": building.status === "in_progress",
                })}>
                  נוכחי: {STATUS_LABEL[building.status]}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>אחראי</Label>
                {residentOptions.length > 0 && (
                  <MemberPicker value="" onChange={pickResponsible} members={residentOptions} placeholder="בחר מתוך הדיירים" />
                )}
                <Input value={form.responsible_name || ""} onChange={(e) => set("responsible_name", e.target.value)} placeholder="או הקלד שם" />
              </div>
              <div className="grid gap-1.5">
                <Label>טלפון אחראי</Label>
                <Input value={form.responsible_phone || ""} onChange={(e) => set("responsible_phone", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>הערות</Label>
              <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveBuilding} disabled={savingBld || !form.name?.trim()}>
                {savingBld ? "שומר..." : "שמור שינויים"}
              </Button>
            </div>
          </div>
        )}

        {tab === "residents" && (
          <div className="grid gap-3">
            <div className="border border-border rounded-md p-3 bg-muted/30">
              <Label className="mb-2 block">{resEditIdx >= 0 ? "עריכת דייר" : "הוספת דייר"}</Label>
              <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-2">
                <Input placeholder="שם מלא" value={resForm.name} onChange={(e) => setResForm({ ...resForm, name: e.target.value })} />
                <Input placeholder="דירה" value={resForm.apartment} onChange={(e) => setResForm({ ...resForm, apartment: e.target.value })} />
                <Input placeholder="טלפון" value={resForm.phone} onChange={(e) => setResForm({ ...resForm, phone: e.target.value })} />
                <div className="flex gap-1">
                  <Button size="sm" onClick={addOrUpdateResident} disabled={!resForm.name.trim()}>
                    {resEditIdx >= 0 ? "עדכן" : "הוסף"}
                  </Button>
                  {resEditIdx >= 0 && (
                    <Button size="sm" variant="ghost" onClick={() => { setResForm({ name: "", apartment: "", phone: "" }); setResEditIdx(-1); }}>בטל</Button>
                  )}
                </div>
              </div>
            </div>
            {residents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין דיירים רשומים. הוסף דייר למעלה.</p>
            ) : (
              <div className="border border-border rounded-md max-h-[40vh] overflow-y-auto scrollbar-thin divide-y divide-border">
                {residents.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium truncate">{r.name}</span>
                      <span className="text-muted-foreground text-xs mr-2">
                        {r.apartment ? `דירה ${r.apartment}` : ""}
                        {r.apartment && r.phone ? " · " : ""}
                        {r.phone || ""}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => editResident(i)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteResident(i)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "tasks" && (
          <div className="grid gap-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTaskDlg({ open: true, editing: null })}>
                <Plus className="w-4 h-4" /> הוסף משימה / הערה
              </Button>
            </div>
            {buildingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין משימות או הערות מקושרות לבניין זה.</p>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto scrollbar-thin">
                {buildingTasks.map((t) => {
                  const isTask = t.type !== "note";
                  return (
                    <div key={t.id} className="border border-border rounded-lg p-3 bg-card flex items-start gap-3">
                      {isTask && (
                        <Checkbox checked={t.status === "done"} onCheckedChange={() => onToggleTask(t)} className="mt-1" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn("font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</p>
                          <span className={cn("text-[11px] px-1.5 py-0.5 rounded", isTask ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            {isTask ? "משימה" : "הערה"}
                          </span>
                        </div>
                        {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {isTask && t.due_date && <span>תאריך יעד: {t.due_date}</span>}
                          {t.assignee_name && <span>נציג: {t.assignee_name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setTaskDlg({ open: true, editing: t })}><Pencil className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDeleteTask(t)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
        </DialogFooter>
      </DialogContent>

      <CleaningTaskDialog
        open={taskDlg.open}
        onOpenChange={(o) => setTaskDlg({ open: o, editing: null })}
        editing={taskDlg.editing}
        onSave={onSaveTask}
        buildings={buildings}
        volunteers={volunteers}
        committee={committee}
      />
    </Dialog>
  );
}