import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, CalendarDays, Users, ListChecks } from "lucide-react";
import { parseParticipants } from "@/components/cleaning/MeetingDetailDialog";

export default function MeetingsTab({ meetings, tasks, onAdd, onOpen, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">ישיבות ({meetings.length})</h2>
        <Button size="sm" onClick={onAdd}><Plus className="w-4 h-4" /> הוסף ישיבה</Button>
      </div>
      {meetings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">אין ישיבות עדיין. לחץ על הוסף ישיבה.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {meetings.map((m) => {
            const count = tasks.filter((t) => t.meeting_id === m.id).length;
            const people = parseParticipants(m.participants);
            return (
              <div
                key={m.id}
                onClick={() => onOpen(m)}
                className="border border-border rounded-lg p-4 bg-card cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <p className="font-bold">{m.title}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <CalendarDays className="w-4 h-4" />
                  {m.date || "ללא תאריך"}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}
                </p>
                <div className="flex gap-4 mt-2 text-sm text-primary">
                  <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> {people.length} משתתפים</span>
                  <span className="inline-flex items-center gap-1"><ListChecks className="w-4 h-4" /> {count} משימות/הערות</span>
                </div>
                {m.summary && <p className="text-sm text-muted-foreground mt-2 border-t border-border pt-2 line-clamp-2">{m.summary}</p>}
                <div className="flex justify-end gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => onOpen(m)}><Pencil className="w-4 h-4" /> ערוך</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(m)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}