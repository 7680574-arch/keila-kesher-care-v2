import { calcEndTime } from "@/lib/agendaTime";

// בניית ישויות ה-HTML בקוד כדי למנוע פירוק תווים מיוחדים
const AMP = "&" + "amp;";
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const QUOT = "&" + "quot;";
const ESC = { "&": AMP, "<": LT, ">": GT, '"': QUOT };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ESC[c]);

// מדפיס רק את סדר היום של פרויקט (יעד)
export function printAgenda(goal, agenda) {
  const rows = agenda.map((a, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(a.time)}${calcEndTime(a.time, a.duration_minutes) ? " – " + esc(calcEndTime(a.time, a.duration_minutes)) : ""}</td>
      <td><b>${esc(a.title)}</b>${a.notes ? `<div class="sub">${esc(a.notes)}</div>` : ""}</td>
      <td>${a.duration_minutes ? esc(a.duration_minutes) + " דק'" : ""}</td>
      <td>${esc(a.assignee_name)}</td>
    </tr>`).join("");

  const html = "<!doctype html><html lang=\"he\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>" + esc(goal.title) + "</title>" +
  "<style>" +
    "@page { size: A4; margin: 14mm; }" +
    "body { font-family: Heebo, Arial, sans-serif; color: #111; margin: 0; }" +
    "h1 { font-size: 24px; text-align: center; margin: 0 0 4px; }" +
    ".meta { text-align: center; color: #555; font-size: 13px; margin-bottom: 14px; }" +
    "h2 { font-size: 17px; margin: 18px 0 6px; border-bottom: 2px solid #14688f; padding-bottom: 3px; }" +
    "table { width: 100%; border-collapse: collapse; font-size: 13px; }" +
    "th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: right; vertical-align: top; }" +
    "th { background: #eef3f6; }" +
    ".n { width: 28px; text-align: center; }" +
    ".sub { color: #555; font-size: 12px; white-space: pre-wrap; }" +
    ".empty { color: #777; font-size: 13px; }" +
    "tr { page-break-inside: avoid; }" +
  "</style></head><body>" +
    "<h1>" + esc(goal.title) + "</h1>" +
    (goal.target_date ? "<div class=\"meta\">תאריך יעד: " + esc(goal.target_date) + "</div>" : "") +
    "<h2>סדר יום</h2>" +
    (agenda.length
      ? "<table><thead><tr><th class=\"n\">#</th><th>שעה</th><th>נושא</th><th>משך</th><th>אחראי</th></tr></thead><tbody>" + rows + "</tbody></table>"
      : "<p class=\"empty\">אין נושאים בסדר היום</p>") +
    "</body></html>";

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}