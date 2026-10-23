import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ChevronDown, ChevronLeft, Trash2, FolderOpen, FileText } from "lucide-react";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export default function SalesUploadsList({ rows, onRowDelete, onTitleChange, onDeleteUpload }) {
  const { toast } = useToast();
  const [open, setOpen] = useState({});
  const [editTitle, setEditTitle] = useState({});

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.upload_id || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    const arr = Array.from(map.entries()).map(([id, items]) => {
      const dates = items.map((i) => i.transaction_date).filter(Boolean).sort();
      const gardens = Array.from(new Set(items.map((i) => i.department).filter(Boolean)));
      return {
        upload_id: id,
        title: items[0]?.upload_title || (id ? "ללא כותרת" : "שורות ישנות (ללא העלאה)"),
        count: items.length,
        total: items.reduce((s, i) => s + (Number(i.line_total) || 0), 0),
        date: dates[0] || "",
        gardens: gardens.join(", "),
        items,
      };
    });
    arr.sort((a, b) => (b.upload_id || "").localeCompare(a.upload_id || ""));
    return arr;
  }, [rows]);

  const toggle = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const startEdit = (g) => setEditTitle((p) => ({ ...p, [g.upload_id]: g.title }));
  const commitEdit = async (g) => {
    const val = (editTitle[g.upload_id] ?? "").trim();
    setEditTitle((p) => { const n = { ...p }; delete n[g.upload_id]; return n; });
    if (!val || val === g.title) return;
    try {
      await onTitleChange(g.upload_id, val);
    } catch (e) {
      toast({ title: "שגיאה בעדכון כותרת", description: e.message, variant: "destructive" });
    }
  };

  if (!rows.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>אין עדיין תנועות שמורות.</p>
        <p className="text-sm mt-1">העל/י קובץ PDF כדי להתחיל.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((g) => {
        const isOpen = open[g.upload_id];
        const isEditing = editTitle[g.upload_id] !== undefined;
        return (
          <div key={g.upload_id || "none"} className="bg-card">
            <div className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30">
              <button onClick={() => toggle(g.upload_id)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editTitle[g.upload_id]}
                    onChange={(e) => setEditTitle((p) => ({ ...p, [g.upload_id]: e.target.value }))}
                    onBlur={() => commitEdit(g)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(g); }}
                    className="h-8 max-w-md"
                    autoFocus
                  />
                ) : (
                  <button onClick={() => startEdit(g)} className="text-right block w-full">
                    <p className="font-semibold truncate">{g.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {g.date || "ללא תאריך"} · גן: {g.gardens || "—"} · {g.count} שורות · סה"כ {fmt(g.total)}
                    </p>
                  </button>
                )}
              </div>
              {!isEditing && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(g)} title="עריכת כותרת">ערוך כותרת</Button>
                  {onDeleteUpload && (
                    <Button variant="ghost" size="sm" onClick={() => onDeleteUpload(g)} className="text-destructive hover:text-destructive" title={g.upload_id ? "מחיקת כל ההעלאה" : "מחיקת כל השורות הישנות"}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isOpen && (
              <div className="px-5 pb-4 overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold">תאריך</th>
                      <th className="text-right px-3 py-2 font-semibold">הזמנה</th>
                      <th className="text-right px-3 py-2 font-semibold">לקוח</th>
                      <th className="text-right px-3 py-2 font-semibold">מחלקה</th>
                      <th className="text-right px-3 py-2 font-semibold">שם מוצר</th>
                      <th className="text-right px-3 py-2 font-semibold">כמות</th>
                      <th className="text-right px-3 py-2 font-semibold">סה"כ</th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.items.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{t.transaction_date || "—"}</td>
                        <td className="px-3 py-2">{t.order_number || "—"}</td>
                        <td className="px-3 py-2">{t.customer_name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{t.department || "—"}</td>
                        <td className="px-3 py-2 font-medium">{t.product_name}</td>
                        <td className="px-3 py-2">{t.quantity ?? 0}</td>
                        <td className="px-3 py-2 font-medium">{fmt(t.line_total)}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => onRowDelete(t)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחיקה">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}