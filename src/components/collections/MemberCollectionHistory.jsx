import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const fmt = (n) => (Number(n) || 0).toLocaleString("he-IL");

export default function MemberCollectionHistory({
  member,
  collections,
  currentFund,
  onDelete,
  open,
  onOpenChange,
}) {
  const rows = useMemo(() => {
    if (!member) return [];
    return collections
      .filter((c) => c.member_id === member.id)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [member, collections]);

  const totalAll = useMemo(
    () => rows.reduce((s, c) => s + (c.amount || 0), 0),
    [rows]
  );
  const totalCurrent = useMemo(
    () =>
      rows
        .filter((c) => c.fund === currentFund)
        .reduce((s, c) => s + (c.amount || 0), 0),
    [rows, currentFund]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" />
            היסטוריית איסופים
          </DialogTitle>
          <DialogDescription>
            {member ? `${member.first_name || ""} ${member.last_name || ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 flex-wrap mb-3">
          <Badge variant="secondary" className="text-xs">
            סה"כ כל הסבבים: ₪{fmt(totalAll)}
          </Badge>
          <Badge className="text-xs bg-amber-500 hover:bg-amber-500">
            סבב נוכחי ({currentFund || "—"}): ₪{fmt(totalCurrent)}
          </Badge>
          <span className="text-xs text-muted-foreground">{rows.length} רשומות</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            אין איסופים קודמים לחבר זה
          </p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-lg border scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-right font-medium px-3 py-2">סבב / קמפיין</th>
                  <th className="text-right font-medium px-3 py-2">תאריך</th>
                  <th className="text-right font-medium px-3 py-2">סכום</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className={c.fund === currentFund ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                        {c.fund || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.date || "—"}</td>
                    <td className={`px-3 py-2 font-semibold ${c.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {c.amount < 0 ? `−₪${fmt(Math.abs(c.amount))}` : `₪${fmt(c.amount)}`}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(c)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}