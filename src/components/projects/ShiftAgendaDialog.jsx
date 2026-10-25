import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function ShiftAgendaDialog({ data, onChoose, saving }) {
  if (!data) return null;
  const abs = Math.abs(data.delta);
  const dir = data.delta > 0 ? "יתאחרו" : "יוקדמו";
  const text = data.deleted
    ? `הנושא "${data.title}" נמחק. האם לעדכן את שעות ההתחלה של ${data.count} הנושאים הבאים כך שיוקדמו ב-${abs} דקות?`
    : `שעת הסיום של "${data.title}" השתנתה. האם לעדכן את שעות ההתחלה של ${data.count} הנושאים הבאים כך ש${dir} ב-${abs} דקות?`;
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onChoose(null)}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">לעדכן את הנושאים הבאים?</DialogTitle>
          <DialogDescription className="text-right">{text}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button disabled={saving} onClick={() => onChoose(true)}>כן, עדכן את הבאים</Button>
          <Button variant="outline" disabled={saving} onClick={() => onChoose(false)}>
            {data.deleted ? "לא, השאר את השעות" : "לא, רק את הנושא הזה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}