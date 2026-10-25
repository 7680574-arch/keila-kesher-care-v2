import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, STATUS_STYLES, PRIORITY_STYLES, STATUS_OPTIONS } from "@/lib/serviceLabels";

const parseMessages = (str) => {
  if (!str) return [];
  try { const a = JSON.parse(str); return Array.isArray(a) ? a : []; } catch { return []; }
};

const fmtTime = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

export default function ServiceRequestDetailDialog({ request, currentUser, isAdmin, open, onClose, onUpdated }) {
  const [status, setStatus] = useState("new");
  const [assigneeId, setAssigneeId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const assigneeOptions = useMemo(() => {
    return (users || []).filter((u) => u.role === "admin" || (u.allowed_tabs && String(u.allowed_tabs).includes("/service")));
  }, [users]);

  useEffect(() => {
    if (request) {
      setStatus(request.status || "new");
      setAssigneeId(request.assignee_id || "");
      setMessages(parseMessages(request.messages));
      setDraft("");
    }
  }, [request]);

  useEffect(() => {
    if (isAdmin) {
      import("@/api/base44Client").then(({ base44 }) => {
        base44.entities.User.list("-created_date", 500).then(setUsers).catch(() => {});
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  if (!request) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const res = await base44.functions.invoke("updateServiceRequest", { id: request.id, message: text });
      const data = res.data || {};
      setDraft("");
      if (data.request && onUpdated) onUpdated(data.request);
    } finally {
      setSending(false);
    }
  };

  const saveAdminFields = async () => {
    setLoading(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const payload = { id: request.id };
      if (status !== request.status) payload.status = status;
      const chosen = assigneeOptions.find((u) => u.id === assigneeId);
      if (assigneeId !== (request.assignee_id || "")) {
        payload.assignee_id = assigneeId || "";
        payload.assignee_name = chosen ? (chosen.full_name || chosen.email || "") : "";
      }
      const res = await base44.functions.invoke("updateServiceRequest", payload);
      const data = res.data || {};
      if (data.request && onUpdated) onUpdated(data.request);
    } finally {
      setLoading(false);
    }
  };

  const hasAdminChanges = status !== (request.status || "new") || assigneeId !== (request.assignee_id || "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{request.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className={STATUS_STYLES[request.status] || "bg-slate-100 text-slate-600"}>{STATUS_LABELS[request.status] || request.status}</Badge>
            <Badge className={PRIORITY_STYLES[request.priority] || "bg-slate-100 text-slate-600"}>דחיפות: {PRIORITY_LABELS[request.priority] || request.priority}</Badge>
            <Badge variant="outline">{CATEGORY_LABELS[request.category] || request.category || "—"}</Badge>
            {request.assignee_name && <Badge variant="outline" className="bg-primary/5">אחראי: {request.assignee_name}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">פותח הקריאה:</span> <span className="font-medium">{request.requester_name || "—"}</span></div>
            <div><span className="text-muted-foreground">טלפון:</span> <span className="font-medium">{request.phone || "—"}</span></div>
            <div><span className="text-muted-foreground">כתובת:</span> <span className="font-medium">{request.address || "—"}</span></div>
            <div><span className="text-muted-foreground">תאריך פתיחה:</span> <span className="font-medium">{request.created_date ? new Date(request.created_date).toLocaleDateString("he-IL") : "—"}</span></div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">תיאור הבעיה</p>
            <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3">{request.description || "—"}</div>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-card">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">סטטוס טיפול</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">אחראי מקושר</label>
                <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="ללא אחראי" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא אחראי</SelectItem>
                    {assigneeOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}{u.role === "admin" ? " (מנהל)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {hasAdminChanges && (
                <div className="col-span-2">
                  <Button size="sm" onClick={saveAdminFields} disabled={loading}>{loading ? "שומר..." : "שמירת שינויים"}</Button>
                </div>
              )}
            </div>
          )}

          {/* Chat */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/40 text-sm font-medium">צ'אט טיפול</div>
            <div ref={scrollRef} className="max-h-72 min-h-[120px] overflow-y-auto scrollbar-thin p-3 space-y-2 bg-secondary/20">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">אין עדיין הודעות. שלחו הודעה לפותח הקריאה או למנהל.</p>
              ) : messages.map((m) => {
                const mine = m.author_id === currentUser?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold opacity-90">{m.author_name || (m.author_role === "admin" ? "מנהל" : "פותח הקריאה")}</span>
                        {m.author_role === "admin" && <span className="text-[10px] bg-white/20 rounded px-1">מנהל</span>}
                        <span className="text-[10px] opacity-70">{fmtTime(m.at)}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap leading-snug">{m.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t p-2 flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="כתוב הודעה..."
                className="resize-none max-h-24 min-h-[40px] text-sm"
              />
              <Button size="icon" onClick={send} disabled={sending || !draft.trim()} className="h-9 w-9 shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}