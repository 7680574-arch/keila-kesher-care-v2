const toMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

const fmt = (total) => {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// מחשב שעת סיום (HH:MM) לפי שעת התחלה ומשך בדקות. מחזיר "" אם אין שעה או משך.
export function calcEndTime(time, minutes) {
  const start = toMin(time);
  if (start === null || !minutes) return "";
  return fmt(start + Number(minutes));
}

// שעת סיום בדקות (ללא חיתוך ל-24 שעות), או null אם אין שעה
export function endMinutes(time, minutes) {
  const start = toMin(time);
  return start === null ? null : start + (Number(minutes) || 0);
}

// אחרי החלפת שני נושאים סמוכים: הראשון (החדש) מתחיל בשעת ההתחלה של הנושא שהיה קודם, והשני ממשיך מיד אחריו
export function swapTimes(first, second, startTime) {
  const start = toMin(startTime);
  if (start === null) return [];
  return [
    { id: first.id, time: fmt(start) },
    { id: second.id, time: fmt(start + (Number(first.duration_minutes) || 0)) },
  ];
}

// מחזיר רשימת עדכוני שעה לנושאים שאחרי הנושא שנערך, מוזזים בהפרש (בדקות)
export function shiftFollowing(following, delta) {
  return following
    .filter((a) => toMin(a.time) !== null)
    .map((a) => ({ id: a.id, time: fmt(toMin(a.time) + delta) }));
}