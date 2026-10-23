import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lightbulb, Plus } from "lucide-react";
import { LiveItemActions } from "@/components/cleaning/MeetingLiveItem";

export function SolutionRow({ s, lv, canDelete, onDelete }) {
  return (
    <div className={`flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg ${lv.rowPad} ${lv.solution}`}>
      <Lightbulb className={`${lv.sIcon} text-emerald-600 mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0 break-words"><span className="whitespace-pre-wrap">{s.text}</span></div>
      <LiveItemActions canDelete={canDelete(s)} onDelete={() => onDelete(s)} />
    </div>
  );
}

export function ProblemCard({ p, solutions, lv, canDelete, onDelete, onAddSolution }) {
  return (
    <div className={`border border-rose-200 rounded-xl bg-rose-50/40 flex flex-col ${lv.pad} ${lv.gap}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`${lv.icon} text-rose-600 mt-0.5 shrink-0`} />
        <div className={`flex-1 min-w-0 font-semibold break-words ${lv.problem}`}>
          <span className="whitespace-pre-wrap">{p.text}</span>
        </div>
        <Button size="sm" variant="ghost" className="text-emerald-700 shrink-0" onClick={() => onAddSolution(p.id)}>
          <Plus className="w-4 h-4" /> פתרון
        </Button>
        <LiveItemActions canDelete={canDelete(p)} onDelete={() => onDelete(p)} />
      </div>
      {solutions.map((s) => (
        <SolutionRow key={s.id} s={s} lv={lv} canDelete={canDelete} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function GeneralSolutionsCard({ solutions, lv, canDelete, onDelete }) {
  return (
    <div className={`flex flex-col ${lv.gap}`}>
      <p className="font-medium text-muted-foreground">פתרונות כלליים</p>
      {solutions.map((s) => (
        <SolutionRow key={s.id} s={s} lv={lv} canDelete={canDelete} onDelete={onDelete} />
      ))}
    </div>
  );
}