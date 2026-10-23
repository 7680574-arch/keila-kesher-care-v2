import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, CalendarDays, Users, Coins, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import FundraisingEventFormDialog from "@/components/FundraisingEventFormDialog";
import { cn } from "@/lib/utils";

const STATUS = { planning: "תכנון", active: "פעיל", completed: "הושלם" };
const STATUS_COLOR = {
  planning: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const ETYPE = { invitees: "מוזמנים", community: "קהילתי" };
const ETYPE_COLOR = { invitees: "bg-violet-100 text-violet-700 border-violet-200", community: "bg-teal-100 text-teal-700 border-teal-200" };
const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function DonationsEvents() {
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [donations, setDonations] = useState([]);
  const [invitees, setInvitees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [ev, don, inv] = await Promise.all([
        base44.entities.FundraisingEvent.list("-date", 200),
        base44.entities.Donation.list("-date", 5000),
        base44.entities.FundraisingInvitee.list("-created_date", 5000),
      ]);
      setEvents(ev); setDonations(don); setInvitees(inv);
    } catch (e) {
      toast({ title: "שגיאה בטעינה", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim();
    return events.filter((e) => {
      if (fStatus !== "all" && e.status !== fStatus) return false;
      if (q && !`${e.title} ${e.notes || ""}`.includes(q)) return false;
      return true;
    });
  }, [events, search, fStatus]);

  const raisedByEvent = (eid) => donations.filter((d) => d.event_id === eid).reduce((s, d) => s + (d.amount || 0), 0);
  const invCount = (eid) => invitees.filter((i) => i.event_id === eid).length;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4" /> אירוע התרמה חדש</Button>
      </div>

      {loading && <p className="text-center py-10 text-muted-foreground">טוען אירועים...</p>}
      {!loading && events.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed">
          <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-muted-foreground">עדיין אין אירועי התרמה. לחץ על "אירוע התרמה חדש" כדי להתחיל.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש אירוע…" className="pr-9" />
          </div>
          <div className="w-40">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="סטטוס" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="planning">תכנון</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {!loading && events.length > 0 && filteredEvents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>אין אירועים התואמים לסינון.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEvents.map((ev) => {
          const raised = raisedByEvent(ev.id);
          const cnt = invCount(ev.id);
          const goal = ev.goal_amount || 0;
          const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
          return (
            <Link key={ev.id} to={`/donations/events/${ev.id}`} className="rounded-2xl border bg-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold truncate">{ev.title}</h3>
                  {ev.date && <p className="text-xs text-muted-foreground mt-0.5">{new Date(ev.date).toLocaleDateString("he-IL")}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border whitespace-nowrap", ETYPE_COLOR[ev.event_type] || ETYPE_COLOR.invitees)}>{ETYPE[ev.event_type] || "מוזמנים"}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border whitespace-nowrap", STATUS_COLOR[ev.status] || STATUS_COLOR.planning)}>{STATUS[ev.status] || ev.status}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> {cnt} מוזמנים</span>
                <span className="inline-flex items-center gap-1"><Coins className="w-4 h-4" /> ₪{fmt(raised)}{goal ? ` / ₪${fmt(goal)}` : ""}</span>
              </div>
              {goal > 0 && (
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-rose-500 to-rose-600" style={{ width: `${pct}%` }} />
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <FundraisingEventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={() => load()}
      />
    </div>
  );
}