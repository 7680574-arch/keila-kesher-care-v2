import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

export default function RegistrationSheetDialog({ open, onOpenChange, onConfirm, initial }) {
  const [count, setCount] = useState(initial || "");

  useEffect(() => {
    if (open) setCount(initial || "");
  }, [open, initial]);

  const submit = () => {
    const n = Number(count) || 0;
    if (n > 0) onConfirm(n);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>דף רישום</DialogTitle></DialogHeader>
        <div className="space-y-2 py-2">
          <Label>כמה שורות להדפיס?</Label>
          <Input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="לדוגמה 50"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <p className="text-xs text-muted-foreground">המספר יישמר בחלוקה לשימוש חוזר.</p>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          <Button type="button" disabled={!(Number(count) > 0)} onClick={submit}>הדפסה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}