import React, { useState } from "react";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { base44 } from "@/api/base44Client";

export default function SyncFormsToCommunityButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await base44.functions.invoke("syncFormsToCommunity", {});
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || "שגיאה בסנכרון");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog onOpenChange={(open) => { if (!open) { setResult(null); setError(""); } }}>
      <AlertDialogTrigger asChild>
        <Button variant="outline"><RefreshCw className="w-4 h-4 ml-1" /> סנכרון מהטופס</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            דריסת נתונים מטופס 691
          </AlertDialogTitle>
          <AlertDialogDescription>
            הפעולה תעדכן את רשימת הקהילה והנתונים הכלכליים מתוך רשומות טופס הרישום.
            שדות שאינם מלאים בטופס יישמרו כפי שהם; חברים שברשימה בלבד לא ייגעו.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/5 border border-destructive/30 rounded-lg px-3 py-2">{error}</div>
        )}
        {result && (
          <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 space-y-1">
            <p className="font-semibold text-emerald-800">הסנכרון הושלם ({result.fYear})</p>
            <ul className="text-emerald-700">
              <li>{result.memberUpdates} חברים עודכנו</li>
              <li>{result.memberCreates} חברים חדשים נוצרו</li>
              <li>{result.finUpdates} רשומות כלכליות עודכנו</li>
              <li>{result.finCreates} רשומות כלכליות חדשות</li>
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>סגור</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); run(); }}
            disabled={busy}
            className="bg-primary"
          >
            {busy ? <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> מסנכרן...</> : "אשר ובצע סנכרון"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}