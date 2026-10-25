import React from "react";
import { Wallet, TrendingDown, Scale, ListChecks } from "lucide-react";
import { fmtMoney, ACCENTS } from "@/lib/projectLabels";

function Stat({ label, value, sub, accent, Icon }) {
  const a = ACCENTS[accent];
  return (
    <div className="proj-card proj-card-hover p-4 flex items-start gap-3">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${a.bg}`}>
        <Icon className={`w-5 h-5 ${a.text}`} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${a.dot}`} />{label}</p>
        <p className={`text-xl font-bold mt-1 ${a.text}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// totals: { income, expense, tasksOpen, tasksDone, participants, confirmed }
export default function ProjectSummary({ project, totals }) {
  const balance = totals.income - totals.expense;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat accent="green" Icon={Wallet} label="הכנסות" value={fmtMoney(totals.income)} sub={project.income_goal ? `יעד: ${fmtMoney(project.income_goal)}` : null} />
      <Stat accent="coral" Icon={TrendingDown} label="הוצאות" value={fmtMoney(totals.expense)} sub={project.budget ? `תקציב: ${fmtMoney(project.budget)}` : null} />
      <Stat accent={balance < 0 ? "pink" : "blue"} Icon={Scale} label="יתרה" value={fmtMoney(balance)} />
      <Stat accent="purple" Icon={ListChecks} label="משימות" value={`${totals.tasksDone}/${totals.tasksOpen + totals.tasksDone}`} sub={`${totals.confirmed} אישרו הגעה מתוך ${totals.participants}`} />
    </div>
  );
}