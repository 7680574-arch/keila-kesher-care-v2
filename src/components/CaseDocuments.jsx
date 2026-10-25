import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Download, Files, Loader2, CloudUpload, CheckCircle2 } from "lucide-react";

function fileEmoji(name) {
  if (!name) return "📄";
  const ext = name.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "🖼️";
  return "📄";
}

export default function CaseDocuments({ caseItem }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const fileRef = useRef(null);
  const canSync = user?.role === "admin" || caseItem?.created_by_id === user?.id;

  const load = async () => {
    setLoading(true);
    const canReadAll = user?.role === "admin" || user?.role === "user";
    let d;
    if (canReadAll) {
      d = await base44.entities.CaseDocument.filter({ case_id: caseItem.id }, "-uploaded_date");
    } else {
      const res = await base44.functions.invoke("getCaseAuthorizedData", { case_id: caseItem.id });
      d = (res.data || res).documents || [];
    }
    setDocs(d);
    setLoading(false);
  };

  const syncToDrive = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await base44.functions.invoke("syncCaseDocumentsToDrive", { case_id: caseItem.id });
      const { synced, skipped, failed } = res.data || res;
      setSyncMsg(`סונכרנו ${synced || 0} מסמכים${skipped ? `, ${skipped} כבר סונכרנו` : ""}${failed ? `, ${failed} נכשלו` : ""}`);
      load();
    } catch (e) {
      setSyncMsg("שגיאה בסנכרון: " + (e.message || ""));
    } finally {
      setSyncing(false);
    }
  };
  useEffect(() => { if (caseItem?.id) load(); }, [caseItem?.id]);

  const reset = () => {
    setTitle("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file || !title.trim()) return;
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.CaseDocument.create({
        case_id: caseItem.id,
        client_id: caseItem.client_id,
        title: title.trim(),
        file_url,
        file_name: file.name,
        file_type: file.type,
        uploaded_date: new Date().toISOString().slice(0, 10),
      });
      setOpen(false);
      reset();
      await load();
      syncToDrive();
    } catch (e) {
      alert("שגיאה בהעלאת הקובץ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("מחיקת מסמך?")) return;
    await base44.entities.CaseDocument.delete(id);
    load();
  };

  return (
    <div className="bg-card rounded-2xl border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="font-semibold flex items-center gap-2">
          <Files className="w-4 h-4 text-primary" /> מסמכים ({docs.length})
          {syncMsg && <span className="text-xs font-normal text-muted-foreground mr-2">{syncMsg}</span>}
        </h2>
        <div className="flex gap-2">
          {canSync && (
            <Button size="sm" variant="outline" onClick={syncToDrive} disabled={syncing || loading || docs.length === 0}>
              {syncing ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <CloudUpload className="w-4 h-4 ml-1" />}
              {syncing ? "מסנכרן…" : "סנכרן ל-Drive"}
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="w-4 h-4 ml-1" /> הוסף מסמך
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {loading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">טוען…</p>}
        {!loading && docs.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">אין מסמכים בתיק זה — הוסיפו חשבוניות, קבלות וכו׳</p>
        )}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-secondary/40 transition">
            <span className="text-xl shrink-0">{fileEmoji(d.file_name)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{d.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {d.file_name} {d.uploaded_date ? `· ${d.uploaded_date}` : ""}
              </p>
            </div>
            {d.drive_file_id ? (
              <>
                <span title="מסונכרן ל-Google Drive" className="inline-flex items-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <a href={`https://drive.google.com/file/d/${d.drive_file_id}/view`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0">
                  <FileText className="w-4 h-4" /> פתח ב-Drive
                </a>
              </>
            ) : (
              <a href={d.file_url} target="_blank" rel="noreferrer" download={d.file_name}
                 className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0">
                <Download className="w-4 h-4" /> הורד
              </a>
            )}
            <button onClick={() => remove(d.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת מסמך לתיק</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>שם / תיאור המסמך *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: חשבונית מרץ" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>קובץ *</Label>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:ml-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
              />
              {file && <p className="text-xs text-muted-foreground">נבחר: {file.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" onClick={submit} disabled={saving || !file || !title.trim()}>
              {saving ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" /> מעלה…</>) : "העלאה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}