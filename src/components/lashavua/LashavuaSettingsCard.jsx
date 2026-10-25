import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save, Building2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function LashavuaSettingsCard({ setting, onSaved, onSynced }) {
  const { toast } = useToast();
  const [mosadId, setMosadId] = useState("");
  const [mosadName, setMosadName] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setMosadId(setting?.mosad_id || "");
    setMosadName(setting?.mosad_name || "");
  }, [setting]);

  const save = async () => {
    if (!mosadId.trim()) { toast({ title: "יש להזין קוד קופה", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let rec;
      if (setting?.id) {
        rec = await base44.entities.LashavuaTovaSetting.update(setting.id, { mosad_id: mosadId.trim(), mosad_name: mosadName.trim() });
      } else {
        rec = await base44.entities.LashavuaTovaSetting.create({ mosad_id: mosadId.trim(), mosad_name: mosadName.trim() });
      }
      toast({ title: "הקוד נשמר" });
      onSaved?.(rec);
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const sync = async () => {
    if (!mosadId.trim()) { toast({ title: "יש להזין ולשמור קוד קופה תחילה", variant: "destructive" }); return; }
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("lashavuaTovaSync", { mosadId: mosadId.trim() });
      const d = res?.data || {};
      if (d.error) { toast({ title: "הסנכרון נכשל", description: d.error, variant: "destructive" }); return; }
      const stamp = new Date().toISOString();
      let rec = setting;
      if (setting?.id) {
        rec = await base44.entities.LashavuaTovaSetting.update(setting.id, {
          mosad_id: mosadId.trim(), mosad_name: mosadName.trim(),
          last_synced_at: stamp, last_synced_count: d.newCount || 0
        });
      }
      toast({ title: `הסנכרון הסתיים — ${d.newCount || 0} רשומות חדשות` });
      onSynced?.(rec);
    } catch (e) {
      toast({ title: "שגיאה בסנכרון", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">הגדרות קופת נדרים פלוס</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label>קוד קופה (MosadId)</Label>
          <Input value={mosadId} onChange={(e) => setMosadId(e.target.value)} placeholder="לדוגמה 7001539" />
        </div>
        <div className="space-y-1.5">
          <Label>שם הקופה</Label>
          <Input value={mosadName} onChange={(e) => setMosadName(e.target.value)} placeholder="לשבוע מטובה" />
        </div>
        <Button variant="outline" onClick={save} disabled={saving}>
          <Save className="w-4 h-4 ml-1" />{saving ? "שומר…" : "שמור"}
        </Button>
        <Button onClick={sync} disabled={syncing || saving}>
          <RefreshCw className={`w-4 h-4 ml-1 ${syncing ? "animate-spin" : ""}`} />{syncing ? "מסנכרן…" : "סנכרן עכשיו"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        הסנכרון מושך היסטוריית עסקאות אשראי מהקופה של "לשבוע מטובה" ומזין אותן כהכנסות. העברות ותנועות "סופרים" נוספות ידנית.
      </p>
    </div>
  );
}