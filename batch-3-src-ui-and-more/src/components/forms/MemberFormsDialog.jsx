import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, RefreshCw, AlertCircle } from "lucide-react";
import { titleFor, parseTitlesJson, orderedColumns } from "@/lib/formFields";

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

export default function MemberFormsDialog({ open, onOpenChange, member, forms }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !member || !forms.length) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setResults({});
      const mid = onlyDigits(member.id_number);
      const next = {};
      await Promise.all(forms.map(async (f) => {
        try {
          // טעינת כל הרשומות (עמוד אחר עמוד) עם מפתח ה-API של הטופס
          let recs = [];
          let lastId = 0;
          let err = "";
          for (let i = 0; i < 20; i++) {
            const res = await base44.functions.invoke("nedarimForms", { configId: f.id, tofesId: f.tofes_id, lastId, maxId: 500 });
            const data = res.data || res;
            if (data.error) { err = data.error; break; }
            recs = recs.concat(Array.isArray(data.records) ? data.records : []);
            if (!data.hasMore) break;
            lastId = data.lastId;
          }
          const matched = mid
            ? recs.filter((r) => onlyDigits(r[f.id_field]) === mid)
            : [];
          next[f.id] = { matched, total: recs.length, error: err };
        } catch (e) {
          next[f.id] = { matched: [], total: 0, error: e.message || "שגיאה" };
        }
        if (!cancelled) setResults({ ...next });
      }));
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [open, member, forms]);

  const titleMapOf = (f) => parseTitlesJson(f.titles);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[88vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0 m-0 space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            טפסים · {member?.name || ""}
            {member?.id_number && <span className="text-sm font-normal text-muted-foreground">· {member.id_number}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto scrollbar-thin px-6 py-4 flex-1 min-h-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw className="w-4 h-4 animate-spin" /> טוען טפסים מנדרים פלוס...
            </div>
          )}

          {!loading && !forms.length && (
            <p className="text-sm text-muted-foreground py-6 text-center">לא הוגדרו טפסים. יש להוסיף טופס בעמוד הטפסים.</p>
          )}

          <div className="space-y-5">
            {forms.map((f) => {
              const r = results[f.id];
              const titles = titleMapOf(f);
              return (
                <div key={f.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                    <div>
                      <p className="font-semibold text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">טופס {f.tofes_id} · שדה מזהה {f.id_field}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r ? (r.error ? "—" : `${r.matched.length} מתוך ${r.total}`) : "..."}
                    </span>
                  </div>
                  {r?.error && (
                    <div className="flex items-start gap-2 px-4 py-3 text-xs text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {r.error}
                    </div>
                  )}
                  {r && !r.error && r.matched.length === 0 && (
                    <p className="px-4 py-3 text-xs text-muted-foreground">אין רשומות תואמות לחבר זה.</p>
                  )}
                  {r && !r.error && r.matched.length > 0 && (
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/30 text-muted-foreground">
                          <tr className="text-right">
                            <th className="px-3 py-2 font-semibold">מזהה</th>
                            {orderedColumns(r.matched, titles, { hideEmpty: true }).filter((k) => k !== "ID" && k !== "CreatedDate").map((k) => (
                              <th key={k} className="px-3 py-2 font-semibold whitespace-nowrap">{titleFor(titles, k)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {r.matched.map((rec) => (
                            <tr key={rec.ID} className="hover:bg-muted/20">
                              <td className="px-3 py-2 font-mono text-muted-foreground">{rec.ID}</td>
                              {orderedColumns(r.matched, titles, { hideEmpty: true }).filter((k) => k !== "ID" && k !== "CreatedDate").map((k) => (
                                <td key={k} className="px-3 py-2 max-w-[220px] truncate" title={String(rec[k] ?? "")}>
                                  {rec[k] || <span className="text-muted-foreground/40">—</span>}
                                </td>
                              ))}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}