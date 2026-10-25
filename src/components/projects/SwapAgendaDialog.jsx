import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function SwapAgendaDialog({ data, onChoose, saving }) {
  if (!data) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onChoose(null)}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">לעדכן את שעות הנושאים?</DialogTitle>
          <DialogDescription className="text-right">
            הנושאים "{data.firstTitle}" ו-"{data.secondTitle}" הוחלפו במקומם. האם לחשב מחדש את שעות ההתחלה שלהם לפי הסדר החדש?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button disabled={saving} onClick={() => onChoose(true)}>כן, עדכן שעות</Button>
          <Button variant="outline" disabled={saving} onClick={() => onChoose(false)}>לא, השאר את השעות</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}