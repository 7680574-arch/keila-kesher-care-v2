import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { ProblemCard, GeneralSolutionsCard } from "@/components/cleaning/MeetingLiveCard";
import { LEVELS } from "@/components/cleaning/meetingLiveLevels";
import useFitLevel from "@/components/cleaning/useFitLevel";

// מחלק כרטיסים לעמודות - כל כרטיס לעמודה הכי קצרה כרגע
function distribute(cards, n) {
  const cols = Array.from({ length: n }, () => ({ h: 0, items: [] }));
  cards.forEach((c) => {
    const target = cols.reduce((a, b) => (b.h < a.h ? b : a));
    target.items.push(c);
    target.h += c.weight;
  });
  return cols.map((c) => c.items);
}

export default function MeetingLiveTab({ meetingId, participants = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [draft, setDraft] = useState(null); // { kind, problem_id, text }
  const [saving, setSaving] = useState(false);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    const p = await base44.entities.MeetingItem.filter({ meeting_id: meetingId }, { sort: "created_date", limit: 500 });
    setItems(p.items || []);
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    base44.auth.me().then(setMe);
    load();
    // כל שינוי באחד המשתתפים מרענן את הרשימה מהשרת; רענון תקופתי כגיבוי
    const unsub = base44.entities.MeetingItem.subscribe(() => load());
    const timer = setInterval(load, 5000);
    return () => { unsub(); clearInterval(timer); };
  }, [load]);

  const submit = async () => {
    if (!draft?.text?.trim()) return;
    setSaving(true);
    try {
      const created = await base44.entities.MeetingItem.create({
        meeting_id: meetingId,
        kind: draft.kind,
        text: draft.text.trim(),
        problem_id: draft.problem_id || undefined,
        author_name: me?.full_name || me?.email || "",
      });
      setItems((arr) => (arr.some((i) => i.id === created.id) ? arr : [...arr, created]));
      setDraft(null);
    } finally { setSaving(false); }
  };

  const remove = async (item) => {
    setItems((arr) => arr.filter((i) => i.id !== item.id));
    await base44.entities.MeetingItem.delete(item.id);
  };

  const problems = items.filter((i) => i.kind === "problem");
  const solutionsFor = (pid) => items.filter((i) => i.kind === "solution" && i.problem_id === pid);
  const generalSolutions = items.filter((i) => i.kind === "solution" && !problems.some((p) => p.id === i.problem_id));
  const canDelete = (i) => !!me && (me.role === "admin" || i.created_by_id === me.id);
  const addSolution = (problemId) => setDraft({ kind: "solution", problem_id: problemId, text: "" });

  const signature = items.map((i) => `${i.id}:${i.text.length}:${i.problem_id || ""}`).join(",");
  const level = useFitLevel(boxRef, signature, LEVELS.length - 1);
  const lv = LEVELS[level];

  const cards = problems.map((p) => {
    const sols = solutionsFor(p.id);
    return {
      key: p.id,
      weight: 1 + p.text.length / 40 + sols.reduce((n, s) => n + 1 + s.text.length / 50, 0),
      node: <ProblemCard p={p} solutions={sols} lv={lv} canDelete={canDelete} onDelete={remove} onAddSolution={addSolution} />,
    };
  });
  if (generalSolutions.length > 0) {
    cards.push({
      key: "general",
      weight: 1 + generalSolutions.reduce((n, s) => n + 1 + s.text.length / 50, 0),
      node: <GeneralSolutionsCard solutions={generalSolutions} lv={lv} canDelete={canDelete} onDelete={remove} />,
    });
  }
  const colCount = Math.max(1, Math.min(lv.cols, cards.length));
  const columns = distribute(cards, colCount);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {participants.map((name) => (
            <span key={name} className="inline-flex items-center bg-primary/10 text-primary text-sm font-medium rounded-lg px-3 py-1.5">
              {name}
            </span>
          ))}
          {participants.length === 0 && <span className="text-sm text-muted-foreground">אין משתתפים בישיבה</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-rose-300 text-rose-700" onClick={() => setDraft({ kind: "problem", text: "" })}>
            <Plus className="w-4 h-4" /> הוסף בעיה
          </Button>
          <Button variant="outline" className="border-emerald-300 text-emerald-700" onClick={() => setDraft({ kind: "solution", text: "" })}>
            <Plus className="w-4 h-4" /> הוסף פתרון
          </Button>
        </div>
      </div>

      {draft && (
        <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-2">
          <p className="font-medium">{draft.kind === "problem" ? "בעיה חדשה" : draft.problem_id ? "פתרון לבעיה" : "פתרון חדש"}</p>
          {draft.kind === "solution" && !draft.problem_id && problems.length > 0 && (
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
              value=""
              onChange={(e) => setDraft({ ...draft, problem_id: e.target.value })}
            >
              <option value="">פתרון כללי (לא מקושר לבעיה)</option>
              {problems.map((p) => <option key={p.id} value={p.id}>קשור ל: {p.text.slice(0, 60)}</option>)}
            </select>
          )}
          <Textarea autoFocus rows={2} className="text-lg" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDraft(null)}>ביטול</Button>
            <Button onClick={submit} disabled={saving || !draft.text.trim()}>{saving ? "שומר..." : "הוסף"}</Button>
          </div>
        </div>
      )}

      <div
        ref={boxRef}
        className={`flex-1 min-h-0 ${level >= LEVELS.length - 1 ? "overflow-y-auto" : "overflow-hidden"}`}
      >
        {loading && <p className="text-muted-foreground text-center py-6">טוען...</p>}
        {!loading && items.length === 0 && (
          <div className="text-center py-12 text-lg text-muted-foreground border border-dashed border-border rounded-lg">
            עדיין לא נוספו בעיות או פתרונות. לחצו "הוסף בעיה" כדי להתחיל.
          </div>
        )}
        {cards.length > 0 && (
          <div className={`grid items-start ${lv.gap}`} style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
            {columns.map((col, i) => (
              <div key={i} className={`flex flex-col min-w-0 ${lv.gap}`}>
                {col.map((c) => <React.Fragment key={c.key}>{c.node}</React.Fragment>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}