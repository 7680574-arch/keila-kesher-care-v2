import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, X, UserPlus, Printer } from "lucide-react";
import { printMeetingPages } from "@/lib/printMeetingPages";
import { cn } from "@/lib/utils";
import CleaningTaskDialog from "@/components/cleaning/CleaningTaskDialog";
import MemberPicker from "@/components/MemberPicker";
import MeetingLiveFullscreen from "@/components/cleaning/MeetingLiveFullscreen";
import MeetingTabsBar from "@/components/cleaning/MeetingTabsBar";
import { base44 } from "@/api/base44Client";

const EMPTY = { title: "", date: "", time: "", location: "", agenda: "", summary: "", notes: "" };

export function parseParticipants(p) {
  if (!p) return [];
  try {
    const arr = typeof p === "string" ? JSON.parse(p) : p;
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export default function MeetingDetailDialog({
  open, onOpenChange, meeting, onSaveMeeting, tasks, buildings, volunteers, committee,
  onSaveTask, onDeleteTask, onToggleTask,
}) {
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState(EMPTY);
  const [participants, setParticipants] = useState([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [taskDlg, setTaskDlg] = useState({ open: false, editing: null });
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!open || members.length) return;
    base44.entities.CommunityMember
      .filter({}, { sort: "name", limit: 3000, fields: ["name", "id_number", "phone", "mobile"] })
      .then((p) => setMembers(p.items || []));
  }, [open, members.length]);

  useEffect(() => {
    if (!open) return;
    setTab("details");
    setForm(meeting ? { ...EMPTY, ...meeting } : EMPTY);
    setParticipants(parseParticipants(meeting?.participants));
    setNewName("");
  }, [open, meeting?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const meetingTasks = useMemo(
    () => (meeting ? tasks.filter((t) => t.meeting_id === meeting.id) : []),
    [tasks, meeting]
  );

  // For an existing meeting, participant changes are saved immediately so they are never lost on close.
  const persistParticipants = (next) => {
    setParticipants(next);
    if (meeting) onSaveMeeting({ participants: JSON.stringify(next) }, meeting);
  };

  const addParticipant = (name) => {
    const n = (name || "").trim();
    if (!n || participants.includes(n)) return;
    persistParticipants([...participants, n]);
    setNewName("");
  };

  const save = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      const { id, created_date, updated_date, created_by_id, created_by, ...data } = form;
      await onSaveMeeting({ ...data, participants: JSON.stringify(participants) }, meeting);
      if (!meeting) onOpenChange(false);
    } finally { setSaving(false); }
  };

  const saveTask = (data) => onSaveTask({ ...data, meeting_id: meeting.id }, taskDlg.editing);

  const TABS = [
    { id: "details", label: "פרטים ומשתתפים" },
    { id: "live", label: "מהלך פגישה", disabled: !meeting },
    { id: "summary", label: "סיכום" },
    { id: "tasks", label: `משימות והערות (${meetingTasks.length})`, disabled: !meeting },
  ];

  return (
    <>
    {open && tab === "live" && meeting && (
      <MeetingLiveFullscreen
        meeting={meeting}
        tabs={TABS}
        tab={tab}
        participants={participants}
        onTabChange={setTab}
        onClose={() => onOpenChange(false)}
      />
    )}
    <Dialog open={open && tab !== "live"} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{meeting ? `ישיבה: ${meeting.title}` : "ישיבה חדשה"}</DialogTitle></DialogHeader>

        <MeetingTabsBar tabs={TABS} tab={tab} onChange={setTab} />

        {tab === "details" && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>נושא הישיבה *</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>תאריך</Label>
                <Input type="date" value={form.date || ""} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>שעה</Label>
                <Input type="time" value={form.time || ""} onChange={(e) => set("time", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>מקום</Label>
                <Input value={form.location || ""} onChange={(e) => set("location", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>משתתפים ({participants.length})</Label>
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm rounded-full px-2.5 py-1">
                    {p}
                    <button onClick={() => persistParticipants(participants.filter((x) => x !== p))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
                {participants.length === 0 && <span className="text-sm text-muted-foreground">אין משתתפים עדיין</span>}
              </div>
              <MemberPicker
                value=""
                onChange={(id) => addParticipant(members.find((m) => m.id === id)?.name)}
                members={members}
                placeholder="בחר משתתף מרשימת הקהילה"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="או הוסף שם משתתף ידנית"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(newName); } }}
                />
                <Button type="button" variant="outline" onClick={() => addParticipant(newName)}><Plus className="w-4 h-4" /> הוסף</Button>
              </div>
              {committee.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus className="w-3 h-3" /> הוסף מחברי הועדה:</span>
                  {committee.filter((c) => !participants.includes(c.name)).map((c) => (
                    <button key={c.id} onClick={() => addParticipant(c.name)} className="text-xs border border-border rounded-full px-2 py-0.5 hover:bg-muted">
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>סדר יום</Label>
              <Textarea rows={3} value={form.agenda || ""} onChange={(e) => set("agenda", e.target.value)} />
            </div>
          </div>
        )}

        {tab === "summary" && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>סיכום ישיבה</Label>
              <Textarea rows={9} value={form.summary || ""} onChange={(e) => set("summary", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>הערות</Label>
              <Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
        )}

        {tab === "tasks" && meeting && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTaskDlg({ open: true, editing: null })}><Plus className="w-4 h-4" /> הוסף משימה / הערה</Button>
            </div>
            {meetingTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">אין משימות או הערות לישיבה זו.</div>
            )}
            {meetingTasks.map((t) => {
              const isTask = t.type !== "note";
              return (
                <div key={t.id} className="border border-border rounded-lg p-3 flex items-start gap-3">
                  {isTask && <Checkbox checked={t.status === "done"} onCheckedChange={() => onToggleTask(t)} className="mt-1" />}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium", t.status === "done" && "line-through text-muted-foreground")}>
                      {t.title}
                      <span className="mr-2 text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{isTask ? "משימה" : "הערה"}</span>
                    </p>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {(t.assignee_name || t.committee_member_id) && (
                        <span>👤 {committee.find((c) => c.id === t.committee_member_id)?.name || t.assignee_name}</span>
                      )}
                      {isTask && t.due_date && <span>📅 {t.due_date}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setTaskDlg({ open: true, editing: t })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDeleteTask(t)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        )}

        {tab !== "live" && (
          <div className="flex justify-end gap-2 pt-2">
            {meeting && (
              <Button variant="outline" className="ml-auto" onClick={() => printMeetingPages(meeting)}>
                <Printer className="w-4 h-4" /> הדפס דפים
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
            <Button onClick={save} disabled={saving || !form.title?.trim()}>{saving ? "שומר..." : "שמור"}</Button>
          </div>
        )}

        <CleaningTaskDialog
          open={taskDlg.open}
          onOpenChange={(o) => setTaskDlg({ open: o, editing: null })}
          editing={taskDlg.editing}
          onSave={saveTask}
          buildings={buildings}
          volunteers={volunteers}
          committee={committee}
        />
      </DialogContent>
    </Dialog>
    </>
  );
}