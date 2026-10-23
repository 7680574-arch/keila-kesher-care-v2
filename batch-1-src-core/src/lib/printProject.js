import { PARTICIPANT_STATUS } from "@/lib/projectLabels";
import { calcEndTime } from "@/lib/agendaTime";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// מדפיס סדר יום + רשימת מוזמנים של פרויקט
export function printProject(project, agenda, participants) {
  const meta = [project.start_date, project.location].filter(Boolean).map(esc).join(" | ");
  const agendaRows = agenda.map((a, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td>${esc(a.time)}${calcEndTime(a.time, a.duration_minutes) ? " – " + esc(calcEndTime(a.time, a.duration_minutes)) : ""}</td>
      <td><b>${esc(a.title)}</b>${a.notes ? `<div class="sub">${esc(a.notes)}</div>` : ""}</td>
      <td>${a.duration_minutes ? esc(a.duration_minutes) + " דק'" : ""}</td>
      <td>${esc(a.assignee_name)}</td>
    </tr>`).join("");
  const guestRows = participants.map((p, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td><b>${esc(p.title)}</b></td>
      <td>${esc(p.phone)}</td>
      <td>${esc(PARTICIPANT_STATUS[p.status] || "")}</td>
      <td class="box"></td>
    </tr>`).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(project.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Heebo, Arial, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 24px; text-align: center; margin: 0 0 4px; }
    .meta { text-align: center; color: #555; font-size: 13px; margin-bottom: 14px; min-height: 16px; }
    h2 { font-size: 17px; margin: 18px 0 6px; border-bottom: 2px solid #14688f; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: right; vertical-align: top; }
    th { background: #eef3f6; }
    .n { width: 28px; text-align: center; }
    .box { width: 60px; }
    .sub { color: #555; font-size: 12px; white-space: pre-wrap; }
    .empty { color: #777; font-size: 13px; }
    .guests { page-break-before: auto; }
    tr { page-break-inside: avoid; }
  </style></head><body>
    <h1>${esc(project.title)}</h1>
    <div class="meta">${meta}</div>
    <h2>סדר יום</h2>
    ${agenda.length ? `<table><thead><tr><th class="n">#</th><th>שעה</th><th>נושא</th><th>משך</th><th>אחראי</th></tr></thead><tbody>${agendaRows}</tbody></table>` : '<p class="empty">אין נושאים בסדר היום</p>'}
    <div class="guests"><h2>מוזמנים (${participants.length})</h2>
    ${participants.length ? `<table><thead><tr><th class="n">#</th><th>שם</th><th>טלפון</th><th>סטטוס</th><th>נוכחות</th></tr></thead><tbody>${guestRows}</tbody></table>` : '<p class="empty">אין מוזמנים</p>'}</div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}