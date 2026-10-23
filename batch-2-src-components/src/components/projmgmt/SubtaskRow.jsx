import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function SubtaskRow({ sub, onToggle, onDelete, onSaveSummary, onSaveCost }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sub.summary || "");
  const [costDraft, setCostDraft] = useState(sub.cost ?? "");
  const done = sub.status === "done";

  const commit = () => {
    onSaveSummary(draft);
    setEditing(false);
  };

  return (
    <div className="py-2 border-t border-border last:border-0">
      <div className="flex items-center gap-2">
        <Checkbox checked={done} onCheckedChange={() => onToggle()} />
        <span className={cn("text-sm flex-1", done && "text-muted-foreground line-through")}>{sub.title}</span>
        <button onClick={onDelete} className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-muted transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mr-6 mt-2 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14">עלות ₪</span>
          <Input
            type="number"
            min="0"
            step="any"
            className="h-8 w-24 text-xs"
            value={costDraft}
            onChange={(e) => setCostDraft(e.target.value)}
            onBlur={() => {
              const n = costDraft === "" ? undefined : Number(costDraft);
              if ((sub.cost ?? undefined) !== n) onSaveCost?.(n);
            }}
            placeholder="0"
          />
        </div>
        {editing ? (
          <Textarea
            rows={2}
            className="text-xs"
            placeholder="סיכום תת-משימה..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } }}
          />
        ) : (
          <div onClick={() => setEditing(true)} className="cursor-text">
            {sub.summary ? (
              <p className="text-xs text-muted-foreground italic">סיכום: {sub.summary}</p>
            ) : (
              <p className="text-xs text-muted-foreground/60">+ הוסף סיכום</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}