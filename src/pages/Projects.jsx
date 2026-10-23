import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import GoalCard from "@/components/projmgmt/GoalCard";
import GoalCreationWizard from "@/components/projmgmt/GoalCreationWizard";

const FILTERS = ["all", "active", "completed", "draft", "paused"];
const FILTER_LABELS = { all: "הכל", active: "פעיל", completed: "הושלם", draft: "טיוטה", paused: "מושהה" };

export default function Projects() {
  const [showWizard, setShowWizard] = useState(false);
  const [filter, setFilter] = useState("all");
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [goalPage, taskPage] = await Promise.all([
        base44.entities.Goal.filter({}, { sort: "-created_date", limit: 100 }),
        base44.entities.ProjectTask.filter({}, { sort: "-created_date", limit: 500 }),
      ]);
      setGoals(goalPage.items || []);
      setTasks(taskPage.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    base44.functions.invoke("listAssignableUsers", {}).then((res) => setUsers(res?.data?.users || []));
  }, []);

  const filteredGoals = filter === "all" ? goals : goals.filter((g) => g.status === filter);
  const countFor = (s) => (s === "all" ? goals.length : goals.filter((g) => g.status === s).length);

  const handleDeleteGoal = async (goalId) => {
    await base44.entities.ProjectTask.deleteMany({ goal_id: goalId });
    await base44.entities.Goal.delete(goalId);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">פרויקטים</h1>
          <p className="text-muted-foreground mt-1">{goals.length} פרויקטים במערכת</p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="bg-primary">
          <Plus className="w-4 h-4 ml-2" /> פרויקט חדש
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-secondary"
              )}
            >
              {FILTER_LABELS[f]} ({countFor(f)})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filteredGoals.length > 0 ? (
        <div className="space-y-3">
          {filteredGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} tasks={tasks} onDelete={handleDeleteGoal} onEdit={load} />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <Target className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">אין פרויקטים עדיין</p>
          <Button onClick={() => setShowWizard(true)} className="bg-primary">
            <Plus className="w-4 h-4 ml-2" /> צור/י פרויקט
          </Button>
        </div>
      )}

      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <GoalCreationWizard
            teamMembers={users}
            onComplete={() => { setShowWizard(false); load(); }}
            onCancel={() => setShowWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}