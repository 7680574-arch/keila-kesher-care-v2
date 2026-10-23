import React, { useState } from "react";
import { Plus, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProjectTasksBar({ tasks, hideTasks, onHideToggle, onAdd, onRemove }) {
  const [newTask, setNewTask] = useState("");
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="font-semibold">משימות המוזמנים:</Label>
        <Button size="sm" variant="outline" onClick={onHideToggle} className="h-8">
          {hideTasks ? (<><Eye className="w-4 h-4" /> הצג משימות</>) : (<><EyeOff className="w-4 h-4" /> הסתר משימות</>)}
        </Button>
        {!hideTasks && (
          <>
            {tasks.length === 0 && <span className="text-sm text-muted-foreground">אין משימות עדיין</span>}
            {tasks.map((t, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 text-sm bg-secondary px-2 py-1 rounded-full">
                {t}
                <button onClick={() => onRemove(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { if (onAdd(newTask.trim())) setNewTask(""); } }} placeholder="משימה חדשה" className="w-40 h-8" />
              <Button size="sm" onClick={() => { if (onAdd(newTask.trim())) setNewTask(""); }} disabled={!newTask.trim()} className="h-8"><Plus className="w-4 h-4" /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}