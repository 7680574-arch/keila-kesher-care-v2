import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Layers } from "lucide-react";

const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function ExportRoundDialog({
  open,
  onOpenChange,
  currentFund,
  currentCount,
  totalCount,
  onChoose,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            ייצוא איסופים
          </DialogTitle>
          <DialogDescription>בחרו אילו נתוני איסוף להוריד</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <button
            onClick={() => onChoose("current")}
            className="w-full text-right rounded-xl border p-3 hover:bg-amber-50 hover:border-amber-300 transition flex items-center gap-3"
          >
            <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">איסוף נוכחי בלבד</span>
              <span className="block text-xs text-muted-foreground">
                {currentFund || "—"} · {currentCount} רשומות
              </span>
            </span>
          </button>

          <button
            onClick={() => onChoose("all")}
            className="w-full text-right rounded-xl border p-3 hover:bg-primary/5 hover:border-primary/30 transition flex items-center gap-3"
          >
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block font-medium">כל האיסופים (כולל קודמים)</span>
              <span className="block text-xs text-muted-foreground">
                {totalCount} רשומות · כל הסבבים
              </span>
            </span>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}