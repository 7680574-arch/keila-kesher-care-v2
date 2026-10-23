import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteOldBackupsCard({ refreshKey, disabled }) {
  const { toast } = useToast();
  const [oldCount, setOldCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [keep, setKeep] = useState(1);
  const keepNum = Math.max(1, parseInt(keep, 10) || 1);

  const load = async () => {
    const res = await base44.functions.invoke("backupAllToDrive", { mode: "list_old", keep: keepNum });
    setOldCount(res.data.old.length);
  };

  useEffect(() => {
    load().catch(() => setOldCount(null));
  }, [refreshKey, keepNum]);

  const remove = async () => {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const res = await base44.functions.invoke("backupAllToDrive", { mode: "delete_old", keep: keepNum });
      toast({ title: `נמחקו ${res.data.deleted} גיבויים ישנים` });
      await load();
    } catch (e) {
      toast({ title: "המחיקה נכשלה", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <Trash2 className="w-6 h-6 text-destructive" />
      <h2 className="font-bold">מחיקת גיבויים קודמים מהדרייב</h2>
      <p className="text-sm text-muted-foreground">
        מוחק את תיקיות הגיבוי הישנות ומשאיר רק את האחרונות (הן עוברות לפח של הדרייב).
        {oldCount !== null && ` כרגע יש ${oldCount} גיבויים למחיקה.`}
      </p>
      <div className="flex items-center gap-2 text-sm">
        <span>כמה גיבויים אחרונים להשאיר:</span>
        <Input
          type="number"
          min={1}
          value={keep}
          onChange={(e) => setKeep(e.target.value)}
          className="w-20"
        />
      </div>
      <Button
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={busy || disabled || !oldCount}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        מחק גיבויים קודמים
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק {oldCount} גיבויים ישנים?</AlertDialogTitle>
            <AlertDialogDescription>
              {keepNum === 1 ? "הגיבוי האחרון יישאר." : `${keepNum} הגיבויים האחרונים יישארו.`} הגיבויים הישנים יועברו לפח של הדרייב.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}