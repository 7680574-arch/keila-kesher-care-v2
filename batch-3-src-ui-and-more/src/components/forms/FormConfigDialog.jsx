import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { FIELD_CODES, parseTitles, parseTitlesTable, formatTitles, parseTitlesJson } from "@/lib/formFields";

const empty = { name: "", tofes_id: "", id_field: "Field3", api_password: "", titles: "", auto_refresh: false };

export default function FormConfigDialog({ open, onOpenChange, initial, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    if (open) {
      if (initial) {
        const titlesMap = parseTitlesJson(initial.titles);
        setForm({
          name: initial.name || "",
          tofes_id: String(initial.tofes_id || ""),
          id_field: initial.id_field || "Field3",
          api_password: initial.api_password || "",
          titles: formatTitles(titlesMap),
          auto_refresh: !!initial.auto_refresh,
        });
      } else {
        setForm(empty);
      }
      setPasteText("");
    }
  }, [open, initial]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const titlesMap = parseTitles(form.titles);

  const save = async () => {
    if (!form.name.trim() || !form.tofes_id.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        tofes_id: form.tofes_id.trim(),
        id_field: form.id_field,
        api_password: form.api_password.trim(),
        titles: JSON.stringify(parseTitles(form.titles)),
        auto_refresh: !!form.auto_refresh,
      };
      if (initial) await base44.entities.FormConfig.update(initial.id, payload);
      else await base44.entities.FormConfig.create(payload);
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{initial ? "עריכת טופס" : "הוספת טופס"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>שם טופס *</Label>
            <Input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="לדוגמה: טופס רישום ראשי" />
          </div>
          <div className="space-y-1.5">
            <Label>מספר טופס *</Label>
            <Input value={form.tofes_id} onChange={(e) => setF("tofes_id", e.target.value)} placeholder="לדוגמה: 4655" />
          </div>
          <div className="space-y-1.5">
            <Label>מפתח API (נדרים פלוס) — אופציונלי</Label>
            <Input value={form.api_password} onChange={(e) => setF("api_password", e.target.value)} placeholder="בדרך כלל אין צורך למלא" />
            <p className="text-xs text-muted-foreground">לרוב לא נדרש — המערכת משתמשת במפתח המוסד הכללי. מלא/י רק אם לטופס זה יש מפתח משלו.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
            <div>
              <Label>ריענון אוטומטי (שעתי)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">בודק פעם בשעה שורות חדשות ומסמן אותן בתג על הטופס ובלשונית הטפסים</p>
            </div>
            <Switch checked={form.auto_refresh} onCheckedChange={(v) => setF("auto_refresh", v)} />
          </div>
          <div className="space-y-1.5">
            <Label>שדה מזהה (מ&quot;ז) — באיזה שדה מאוחסן תעודת הזהות בטופס זה</Label>
            <Select value={form.id_field} onValueChange={(v) => setF("id_field", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_CODES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>הדבקת כותרות מנדרים פלוס — אופציונלי</Label>
            <textarea
              value={pasteText}
              onChange={(e) => {
                const v = e.target.value;
                setPasteText(v);
                const parsed = parseTitlesTable(v);
                if (Object.keys(parsed).length) {
                  setF("titles", formatTitles({ ...titlesMap, ...parsed }));
                }
              }}
              placeholder={"הדבק/י את טבלת הכותרות מנדרים פלוס, לדוגמה:\nField3=תעודת זהות\nField5: טלפון\nField16 | סוג עסק"}
              rows={5}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
            />
            <p className="text-xs text-muted-foreground">המערכת מזהה אוטומטית קוד שדה + כותרת (= : | או טאב). שורות ללא קוד שדה ידלגו.</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>כותרות שדות</Label>
              <span className="text-xs text-muted-foreground">ניתן לערוך ידנית · שדות עם כותרת יופיעו בחלוקה חכמה</span>
            </div>
            <div className="rounded-lg border border-border max-h-56 overflow-y-auto scrollbar-thin divide-y divide-border">
              {FIELD_CODES.map((code) => (
                <div key={code} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{code}</span>
                  <Input
                    value={titlesMap[code] || ""}
                    onChange={(e) => {
                      const next = { ...titlesMap, [code]: e.target.value };
                      if (!e.target.value) delete next[code];
                      setF("titles", formatTitles(next));
                    }}
                    placeholder={`כותרת עבור ${code}`}
                    className="flex-1 h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          <Button type="button" disabled={saving || !form.name.trim() || !form.tofes_id.trim()} onClick={save}>
            {saving ? "שומר..." : "שמירה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}