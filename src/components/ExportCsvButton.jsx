import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { rowsToCsv, downloadCsv } from "@/lib/exportCsv";

export default function ExportCsvButton({ allRows, filteredRows, columns, fileName }) {
  const [open, setOpen] = useState(false);

  const doExport = (which) => {
    const rows = which === "all" ? allRows : filteredRows;
    downloadCsv(fileName, rowsToCsv(rows, columns));
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="w-4 h-4 ml-1" /> ייצוא CSV
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ייצוא ל-CSV</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">בחרו אילו רשומות לייצא. הקובץ יישמר להורדה וניתן לפתיחה ב-Excel להדפסה או שמירה מחוץ למערכת.</p>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              type="button"
              onClick={() => doExport("filtered")}
              className="text-right rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition"
            >
              <p className="font-semibold text-sm">סינון נוכחי</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredRows.length} רשומות</p>
            </button>
            <button
              type="button"
              onClick={() => doExport("all")}
              className="text-right rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition"
            >
              <p className="font-semibold text-sm">כל הרשימה</p>
              <p className="text-xs text-muted-foreground mt-1">{allRows.length} רשומות</p>
            </button>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}