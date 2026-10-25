import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Loader2, Check } from "lucide-react";

// existingMemberIds: Set of member ids already invited; onAdd(members[])
export default function CommunityInviteesDialog({ open, onOpenChange, existingMemberIds, onAdd, saving }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState({});

  useEffect(() => { if (open) { setTerm(""); setPicked({}); } }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const q = term.trim();
      const query = q ? { $or: [
        { name: { $regex: q, $options: "i" } },
        { id_number: { $regex: q } },
        { phone: { $regex: q } },
        { mobile: { $regex: q } },
      ] } : {};
      const page = await base44.entities.CommunityMember.filter(query, { sort: "name", limit: 30 });
      setResults(page.items);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [term, open]);

  const toggle = (m) => setPicked((p) => {
    const n = { ...p };
    if (n[m.id]) delete n[m.id]; else n[m.id] = m;
    return n;
  });
  const count = Object.keys(picked).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>הוספת מוזמנים מרשימת הקהילה</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <Input className="pr-9" placeholder="חיפוש לפי שם / ת״ז / טלפון" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">לא נמצאו תוצאות</p>
          ) : results.map((m) => {
            const already = existingMemberIds.has(m.id);
            const on = !!picked[m.id];
            return (
              <button key={m.id} disabled={already} onClick={() => toggle(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-right text-sm ${already ? "opacity-50" : "hover:bg-muted/50"}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-primary-foreground" : "border-slate-300"}`}>
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">{m.name}</span>
                <span className="text-xs text-muted-foreground">{already ? "כבר מוזמן" : (m.mobile || m.phone || "")}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button disabled={!count || saving} onClick={() => onAdd(Object.values(picked))}>
            {saving ? "מוסיף..." : `הוסף ${count || ""} מוזמנים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}