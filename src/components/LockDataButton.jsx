import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, LockOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { lockDistribution, unlockDistribution } from "@/lib/distributionLock";

export default function LockDataButton({ dist, recipients, members, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const locked = !!dist.data_locked;

  const toggle = async () => {
    const msg = locked
      ? "לבטל את קיבוע הנתונים? החלוקה תתעדכן שוב לפי נתוני הקהילה."
      : "לקבוע את נתוני החלוקה? נתוני המקבלים (למשל מספר ילדים ונפשות) יישמרו כפי שהם עכשיו, ולא יתעדכנו יותר משינויים ברשימת הקהילה.";
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const patch = locked ? await unlockDistribution(dist) : await lockDistribution(dist, recipients, members);
      onChanged(patch);
      toast({ title: locked ? "הקיבוע בוטל" : "הנתונים נקבעו" });
    } catch (e) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Button variant={locked ? "default" : "outline"} size="sm" onClick={toggle} disabled={busy} title={locked ? "הנתונים קבועים — לחץ לביטול" : "קבע את נתוני המקבלים כפי שהם עכשיו"}>
      {locked ? <Lock className="w-4 h-4 ml-1" /> : <LockOpen className="w-4 h-4 ml-1" />}
      {busy ? "שומר…" : locked ? "נתונים קבועים" : "קבע נתונים"}
    </Button>
  );
}