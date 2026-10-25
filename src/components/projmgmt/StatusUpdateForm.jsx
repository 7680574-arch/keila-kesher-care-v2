import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { UPDATE_STATUS_OPTIONS, UPDATE_TO_TASK_STATUS } from "@/lib/projMgmtLabels";

export default function StatusUpdateForm({ task, user, onSubmit }) {
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!status) return;
    setLoading(true);
    try {
      try {
        await base44.entities.ProjectUpdate.create({
          task_id: task.id,
          task_title: task.title,
          user_id: user?.id,
          user_name: user?.full_name || user?.email,
          status,
          message,
        });
      } catch (_) {}

      await base44.entities.ProjectTask.update(task.id, { status: UPDATE_TO_TASK_STATUS[status] });

      if (task.goal_id) {
        try {
          const page = await base44.entities.ProjectTask.filter({ goal_id: task.goal_id }, { limit: 500 });
          const allGoalTasks = page.items || [];
          const allDone = allGoalTasks.length > 0 && allGoalTasks.every((t) => t.id === task.id ? UPDATE_TO_TASK_STATUS[status] === "done" : t.status === "done");
          if (allDone) {
            await base44.entities.Goal.update(task.goal_id, { status: "completed" });
          } else {
            const g = await base44.entities.Goal.get(task.goal_id);
            if (g?.status === "completed") {
              await base44.entities.Goal.update(task.goal_id, { status: "active" });
            }
          }
        } catch (_) {}
      }

      setStatus("");
      setMessage("");
      onSubmit?.();
    } catch (err) {
      toast({ title: "שגיאה בעדכון סטטוס", description: err?.message || "משהו השתבש", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={status} onValueChange={setStatus} className="grid grid-cols-2 gap-2">
        {UPDATE_STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <RadioGroupItem value={opt.value} id={`su-${opt.value}`} />
            <Label htmlFor={`su-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
          </div>
        ))}
      </RadioGroup>
      <Textarea placeholder="הוסף הערה (אופציונלי)..." value={message} onChange={(e) => setMessage(e.target.value)} className="h-20" />
      <Button onClick={handleSubmit} disabled={!status || loading} size="sm">
        {loading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Send className="w-4 h-4 ml-1" />}
        פרסם עדכון
      </Button>
    </div>
  );
}