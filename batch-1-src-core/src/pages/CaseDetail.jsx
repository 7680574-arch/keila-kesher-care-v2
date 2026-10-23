import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowRight, Pencil, Trash2, Phone, FileText, Users, MapPin, Send,
  Calendar, User as UserIcon, Stethoscope, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge, CaseTypeBadge } from "@/components/badges";
import { Input } from "@/components/ui/input";
import CaseForm from "@/components/CaseForm";
import CaseNoteForm from "@/components/CaseNoteForm";
import CaseTasks, { nextDueDate } from "@/components/CaseTasks";
import CaseFinance from "@/components/CaseFinance";
import CaseDocuments from "@/components/CaseDocuments";
import CaseAccessPanel from "@/components/CaseAccessPanel";
import { useAuth } from "@/lib/AuthContext";

const noteIcons = { note: FileText, call: Phone, visit: MapPin, meeting: Users, document: FileText, referral: Send };
const noteLabels = { note: "תיעוד", call: "שיחת טלפון", visit: "ביקור", meeting: "פגישה", document: "מסמך", referral: "הפניה" };

export default function CaseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isGuest = user?.role === "guest";
  const canReadAll = user?.role === "admin" || user?.role === "user";
  const [caseItem, setCaseItem] = useState(null);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [noteSearch, setNoteSearch] = useState("");

  const load = async () => {
    const c = await base44.entities.Case.get(id);
    let n, t;
    if (canReadAll) {
      [n, t] = await Promise.all([
        base44.entities.CaseNote.filter({ case_id: id }, "-created_date"),
        base44.entities.Task.filter({ case_id: id }, "due_date"),
      ]);
    } else {
      const res = await base44.functions.invoke("getCaseAuthorizedData", { case_id: id });
      const data = res.data || res;
      n = data.notes || [];
      t = data.tasks || [];
    }
    const all = await base44.entities.CommunityMember.list("-created_date", 2000);
    setCaseItem(c);
    setNotes(n);
    setTasks(t);
    setAllClients(all);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const addTask = async (data) => {
    await base44.entities.Task.create({
      ...data,
      case_id: caseItem.id,
      client_id: caseItem.client_id,
      client_name: caseItem.client_name,
      case_title: caseItem.title,
    });
    load();
  };
  const toggleTask = async (t) => {
    const nextStatus = t.status === "done" ? "pending" : "done";
    await base44.entities.Task.update(t.id, { status: nextStatus });
    // When completing a recurring task, spawn the next occurrence.
    if (nextStatus === "done" && t.recurrence && t.recurrence !== "none") {
      const nextDate = nextDueDate(t.due_date, t.recurrence);
      if (nextDate) {
        await base44.entities.Task.create({
          title: t.title,
          case_id: t.case_id,
          client_id: t.client_id,
          client_name: t.client_name,
          case_title: t.case_title,
          status: "pending",
          priority: t.priority,
          due_date: nextDate,
          due_time: t.due_time,
          assigned_to: t.assigned_to,
          recurrence: t.recurrence,
          notes: t.notes,
        });
      }
    }
    load();
  };
  const deleteTask = async (t) => {
    if (!confirm("מחיקת משימה?")) return;
    await base44.entities.Task.delete(t.id);
    load();
  };

  const saveEdit = async (data) => {
    await base44.entities.Case.update(caseItem.id, data);
    setEditOpen(false);
    load();
  };

  const removeCase = async () => {
    if (!confirm("האם למחוק את התיק?")) return;
    await base44.entities.Case.delete(caseItem.id);
    window.location.href = "/cases";
  };

  const submitNote = async (data) => {
    if (editNote) {
      await base44.entities.CaseNote.update(editNote.id, { content: data.content, type: data.type, author: user?.full_name || editNote.author });
      setEditNote(null);
    } else {
      await base44.entities.CaseNote.create({
        content: data.content,
        type: data.type,
        case_id: caseItem.id,
        client_id: caseItem.client_id,
        author: user?.full_name || "",
        action_date: new Date().toISOString().slice(0, 10),
        action_time: new Date().toTimeString().slice(0, 5),
      });
    }
    load();
  };

  const removeNote = async (noteId) => {
    if (!confirm("מחיקת תיעוד?")) return;
    await base44.entities.CaseNote.delete(noteId);
    load();
  };

  const noteQ = noteSearch.trim();
  const filteredNotes = noteQ ? notes.filter((n) => `${n.content || ""} ${noteLabels[n.type] || n.type || ""} ${n.author || ""} ${n.action_date || ""}`.includes(noteQ)) : notes;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!caseItem) return <p className="text-muted-foreground">תיק לא נמצא</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!isGuest && (
          <Link to="/cases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowRight className="w-4 h-4" /> חזרה לתיקים
          </Link>
        )}
        {!isGuest && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 ml-1" /> עריכה
            </Button>
            <Button variant="outline" size="sm" onClick={removeCase} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <CaseTypeBadge type={caseItem.type} />
              <StatusBadge status={caseItem.status} />
              <PriorityBadge priority={caseItem.priority} />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">{caseItem.title}</h1>
            {caseItem.client_name && (
              <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-primary mt-1 hover:underline">
                <UserIcon className="w-3.5 h-3.5" /> {caseItem.client_name}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-5 grid sm:grid-cols-3 gap-4 text-sm">
          {caseItem.opened_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" /> נפתח: {caseItem.opened_date}
            </div>
          )}
          {caseItem.assigned_worker && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserIcon className="w-4 h-4" /> מטפל: {caseItem.assigned_worker}
            </div>
          )}
          {caseItem.case_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" /> מספר: {caseItem.case_number}
            </div>
          )}
        </div>

        {caseItem.description && (
          <div className="mt-5 rounded-xl bg-secondary/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">תיאור</p>
            <p className="text-sm whitespace-pre-wrap">{caseItem.description}</p>
          </div>
        )}
        {caseItem.summary && (
          <div className="mt-3 rounded-xl bg-accent/5 border border-accent/20 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">סיכום</p>
            <p className="text-sm whitespace-pre-wrap">{caseItem.summary}</p>
          </div>
        )}
      </div>

      <CaseTasks caseItem={caseItem} tasks={tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />

      {!isGuest && <CaseFinance caseItem={caseItem} />}

      <CaseDocuments caseItem={caseItem} />

      {!isGuest && (user?.role === "admin" || caseItem?.created_by_id === user?.id) && (
        <CaseAccessPanel caseItem={caseItem} onUpdated={load} />
      )}

      <div className="space-y-4">
        <h2 className="font-semibold text-lg">תיעוד ופעילויות ({notes.length})</h2>
        <CaseNoteForm key={editNote ? `edit-${editNote.id}` : "new"} initial={editNote} onSubmit={submitNote} onDone={() => setEditNote(null)} />

        {notes.length > 0 && (
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="חיפוש בתיעודים..." className="pr-9" />
          </div>
        )}

        <div className="space-y-3">
          {filteredNotes.length === 0 && (
            <div className="bg-card rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">
              {notes.length === 0 ? "אין תיעודים עדיין — הוסיפו את הפעולה הראשונה" : "לא נמצאו תיעודים לחיפוש"}
            </div>
          )}
          {filteredNotes.map((n) => {
            const Icon = noteIcons[n.type] || FileText;
            return (
              <div key={n.id} className="bg-card rounded-2xl border border-border p-4 flex gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">{noteLabels[n.type] || n.type}</span>
                      {n.action_date && (
                        <span className="text-xs text-muted-foreground">
                          {n.action_date}{n.action_time ? ` · ${n.action_time}` : ""}
                          {n.author && ` · ${n.author}`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditNote(n)}
                        className="text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition"
                        title="עריכת תיעוד"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeNote(n.id)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap">{n.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CaseForm open={editOpen} onOpenChange={setEditOpen} onSubmit={saveEdit} initial={caseItem} members={allClients} />
    </div>
  );
}