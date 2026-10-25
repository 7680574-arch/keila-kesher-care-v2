import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { STATUS_OPTIONS, STATUS_LABELS, STATUS_STYLES, URGENCY_LABELS, URGENCY_STYLES } from "@/lib/maintenanceLabels";

export default function MaintenanceRequestDetailDialog({ request, open, onClose, onUpdated }) {
  const { toast } = useToast();
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loadingImg, setLoadingImg] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status || "new");
    setNotes(request.notes || "");
    setImageUrl(null);
    if (request.image_uri) {
      setLoadingImg(true);
      base44.integrations.Core.CreateFileSignedUrl({ file_uri: request.image_uri })
        .then((r) => setImageUrl(r?.signed_url || null))
        .catch(() => setImageUrl(null))
        .finally(() => setLoadingImg(false));
    }
  }, [request]);

  const save = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const updated = await base44.entities.MaintenanceRequest.update(request.id, { status, notes });
      toast({ title: "הקריאה עודכנה" });
      onUpdated?.(updated);
    } catch (e) {
      toast({ title: "שגיאה בעדכון", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge className={URGENCY_STYLES[request.urgency]}>דחיפות: {URGENCY_LABELS[request.urgency] || request.urgency}</Badge>
            <Badge className={STATUS_STYLES[request.status]}>{STATUS_LABELS[request.status] || request.status}</Badge>
          </div>
          <div className="text-muted-foreground"><span className="font-medium text-foreground">מיקום: </span>{request.location || "—"}</div>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">פותח הקריאה: </span>
            {request.requester_name || "—"}
            {request.requester_phone ? ` · ${request.requester_phone}` : ""}
            {request.requester_email ? ` · ${request.requester_email}` : ""}
          </div>
          <div>
            <span className="font-medium">תיאור התקלה:</span>
            <div className="whitespace-pre-wrap mt-1 rounded-lg bg-muted/40 p-3">{request.description}</div>
          </div>
          {request.image_uri && (
            <div>
              <span className="font-medium">תמונה מצורפת:</span>
              <div className="mt-1">
                {loadingImg ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="תמונה מצורפת" className="rounded-xl max-h-64 w-auto border border-border" />
                ) : (
                  <p className="text-muted-foreground">לא ניתן לטעון את התמונה</p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2 border-t border-border pt-3">
            <div className="space-y-1.5">
              <Label>סטטוס טיפול</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>הערות טיפול</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="עדכוני טיפול, פעולות שבוצעו וכו'" />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              עדכן טיפול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}