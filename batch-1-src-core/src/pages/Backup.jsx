import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DatabaseBackup, Download, Loader2, Cloud } from "lucide-react";
import { BACKUP_ENTITIES } from "@/lib/backupEntities";
import BackupResultsList from "@/components/backup/BackupResultsList";
import DeleteOldBackupsCard from "@/components/backup/DeleteOldBackupsCard";

const LABELS = Object.fromEntries(BACKUP_ENTITIES.map((e) => [e.name, e.label]));

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Backup() {
  const { toast } = useToast();
  const [driveBusy, setDriveBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState([]);
  const [folderName, setFolderName] = useState("");

  const backupToDrive = async () => {
    setDriveBusy(true);
    setResults([]);
    setFolderName("");
    try {
      const res = await base44.functions.invoke("backupAllToDrive", { mode: "drive" });
      const data = res.data;
      setResults((data.results || []).map((r) => ({ ...r, label: LABELS[r.entity] })));
      setFolderName(`${data.rootFolder} / ${data.folderName}`);
      const failed = (data.results || []).filter((r) => !r.ok).length;
      toast({
        title: failed ? `הגיבוי הסתיים עם ${failed} כשלונות` : "הגיבוי נשמר בדרייב",
        variant: failed ? "destructive" : undefined,
      });
    } catch (e) {
      toast({ title: "הגיבוי נכשל", description: e.message, variant: "destructive" });
    }
    setDriveBusy(false);
  };

  const downloadLocal = async () => {
    setLocalBusy(true);
    setResults([]);
    setFolderName("");
    const out = [];
    for (let i = 0; i < BACKUP_ENTITIES.length; i++) {
      const ent = BACKUP_ENTITIES[i];
      setProgress(`${i + 1}/${BACKUP_ENTITIES.length} — ${ent.label}`);
      try {
        const res = await base44.functions.invoke("backupAllToDrive", { mode: "csv", entity: ent.name });
        downloadText(`${ent.name}.csv`, res.data.csv);
        out.push({ entity: ent.name, label: ent.label, ok: true, count: res.data.count });
      } catch (e) {
        out.push({ entity: ent.name, label: ent.label, ok: false, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setResults(out);
    setProgress("");
    setLocalBusy(false);
    toast({ title: "ההורדה הסתיימה" });
  };

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <DatabaseBackup className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">גיבוי נתונים</h1>
          <p className="text-sm text-muted-foreground">
            ייצוא כל הטבלאות לקבצי CSV — לדרייב או למחשב (למנהלים בלבד)
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <Cloud className="w-6 h-6 text-primary" />
          <h2 className="font-bold">גיבוי לגוגל דרייב</h2>
          <p className="text-sm text-muted-foreground">
            נוצרת תיקייה חדשה עם תאריך ושעה, ובתוכה קובץ CSV לכל טבלה.
          </p>
          <Button onClick={backupToDrive} disabled={driveBusy || localBusy} className="w-full">
            {driveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
            {driveBusy ? "מגבה... (עשוי לקחת דקות)" : "גבה הכל לדרייב"}
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <Download className="w-6 h-6 text-primary" />
          <h2 className="font-bold">הורדה למחשב</h2>
          <p className="text-sm text-muted-foreground">
            מוריד קובץ CSV לכל טבלה. ייתכן שהדפדפן ישאל אם לאפשר הורדות מרובות.
          </p>
          <Button variant="outline" onClick={downloadLocal} disabled={driveBusy || localBusy} className="w-full">
            {localBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {localBusy ? progress : "הורד הכל למחשב"}
          </Button>
        </div>
      </div>

      <DeleteOldBackupsCard refreshKey={folderName} disabled={driveBusy || localBusy} />

      {folderName && (
        <p className="text-sm">
          נשמר בדרייב בתיקייה: <span className="font-semibold">{folderName}</span>
        </p>
      )}
      <BackupResultsList results={results} />
    </div>
  );
}