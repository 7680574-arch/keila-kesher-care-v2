export const URGENCY_LABELS = {
  low: "נמוכה",
  medium: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};

export const URGENCY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export const URGENCY_OPTIONS = Object.entries(URGENCY_LABELS).map(([value, label]) => ({ value, label }));

export const STATUS_LABELS = {
  new: "חדשה",
  in_progress: "בטיפול",
  resolved: "טופל",
  closed: "סגורה",
};

export const STATUS_STYLES = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));