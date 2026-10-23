export const CATEGORY_LABELS = {
  maintenance: "אחזקה",
  switchboard: "מרכזייה",
  computers: "מחשבים",
  other: "אחר",
};

export const PRIORITY_LABELS = {
  low: "נמוכה",
  medium: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
};

export const STATUS_LABELS = {
  new: "חדשה",
  in_progress: "בטיפול",
  waiting: "ממתין לתגובה",
  resolved: "טופל",
  closed: "סגורה",
};

export const ADDRESS_OPTIONS = [
  { value: "טבריה שפע חיים", label: "טבריה שפע חיים" },
  { value: 'טבריה שז"ר', label: 'טבריה שז"ר' },
  { value: "ביתר", label: "ביתר" },
  { value: "ירושלים", label: "ירושלים" },
  { value: "פתח תקווה", label: "פתח תקווה" },
  { value: "אחר", label: "אחר" },
];

export const STATUS_STYLES = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};

export const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));