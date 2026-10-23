import React from "react";
import { Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProjectParticipantsFilter({ tasks, taskFilter, stateFilter, onTaskChange, onStateChange, resultCount, totalCount }) {
  const hasTasks = tasks.length > 0;
  return (
    <div className="bg-card rounded-2xl border border-border p-3 flex items-center gap-2 flex-wrap text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground font-semibold"><Filter className="w-4 h-4" />סינון לפי משימה</span>
      <Select value={taskFilter} onValueChange={onTaskChange} dir="rtl">
        <SelectTrigger className="w-44 h-8"><SelectValue placeholder="בחר משימה" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל המשימות</SelectItem>
          {tasks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={stateFilter} onValueChange={onStateChange} dir="rtl" disabled={!taskFilter || taskFilter === "all"}>
        <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">הכל</SelectItem>
          <SelectItem value="done">בוצע</SelectItem>
          <SelectItem value="not_done">לא בוצע</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground mr-auto">
        {hasTasks ? `${resultCount} מתוך ${totalCount}` : "אין משימות לסינון"}
      </span>
    </div>
  );
}