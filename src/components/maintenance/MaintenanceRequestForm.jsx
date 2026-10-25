import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ImagePlus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { URGENCY_OPTIONS } from "@/lib/maintenanceLabels";

const empty = { title: "", description: "", location: "", urgency: "medium", requester_name: "", requester_phone: "", requester_email: "" };

export default function MaintenanceRequestForm({ onSubmitted, submitLabel = "שלח קריאה" }) {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImageFile(null);
    setPreview(null);
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "יש למלא כותרת ותיאור", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let image_uri = "";
      if (imageFile) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: imageFile });
        image_uri = file_uri;
      }
      await base44.functions.invoke("submitMaintenanceRequest", { ...form, image_uri });
      toast({ title: "הקריאה נשלחה", description: "נציג יחזור אליך בהקדם האפשרי." });
      setForm(empty);
      clearImage();
      onSubmitted?.();
    } catch (err) {
      toast({ title: "שגיאה בשליחה", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>כותרת הקריאה *</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="לדוגמה: ברז דולף בכיתה ג'" />
      </div>
      <div className="space-y-1.5">
        <Label>תיאור התקלה *</Label>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="פרט את הבעיה, מתי התחילה וכו'" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>מיקום בבית הספר</Label>
          <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="כיתה, קומה, אזור" />
        </div>
        <div className="space-y-1.5">
          <Label>דחיפות</Label>
          <select
            value={form.urgency}
            onChange={(e) => set("urgency", e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>שם מלא</Label>
          <Input value={form.requester_name} onChange={(e) => set("requester_name", e.target.value)} placeholder="שם פותח הקריאה" />
        </div>
        <div className="space-y-1.5">
          <Label>טלפון</Label>
          <Input value={form.requester_phone} onChange={(e) => set("requester_phone", e.target.value)} placeholder="ליצירת קשר" />
        </div>
        <div className="space-y-1.5">
          <Label>אימייל</Label>
          <Input type="email" value={form.requester_email} onChange={(e) => set("requester_email", e.target.value)} placeholder="אימייל" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>צירוף תמונה (לפי הצורך)</Label>
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="תצוגה מקדימה" className="rounded-xl max-h-40 w-auto border border-border" />
            <button type="button" onClick={clearImage} className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow" title="הסר תמונה">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40 w-fit">
            <ImagePlus className="w-4 h-4" />
            בחר תמונה
            <input type="file" accept="image/*" onChange={onImage} className="hidden" />
          </label>
        )}
      </div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saving ? "שולח..." : submitLabel}
      </Button>
    </form>
  );
}