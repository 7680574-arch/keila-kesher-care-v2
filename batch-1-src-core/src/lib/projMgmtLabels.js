export const GOAL_STATUS_COLORS = {
  active: "#2ECC8A",
  completed: "#C9B3F5",
  draft: "#B8EFF5",
  paused: "#FF8077",
};

export const GOAL_STATUS_LABELS = {
  active: "פעיל",
  draft: "טיוטה",
  completed: "הושלם",
  paused: "מושהה",
};

export const GOAL_STATUS_OPTIONS = ["draft", "active", "paused", "completed"];

export const TASK_STATUS_DOT = {
  done: "#2ECC8A",
  in_progress: "#C9B3F5",
  blocked: "#FF8077",
  need_help: "#FF8077",
  pending: "#C9B3F5",
};

export const TASK_STATUS_LABELS = {
  done: "הושלם",
  in_progress: "בביצוע",
  blocked: "חסום",
  need_help: "זקוק לעזרה",
  pending: "ממתין",
};

export const TASK_STATUS_OPTIONS = ["pending", "in_progress", "blocked", "need_help", "done"];

export const UPDATE_STATUS_OPTIONS = [
  { value: "on_track", label: "בדרך הנכונה" },
  { value: "blocked", label: "חסום" },
  { value: "need_help", label: "זקוק לעזרה" },
  { value: "done", label: "הושלם" },
];

export const UPDATE_TO_TASK_STATUS = {
  on_track: "in_progress",
  blocked: "blocked",
  need_help: "need_help",
  done: "done",
};