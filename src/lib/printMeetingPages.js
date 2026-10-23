const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// מדפיס דפים עם כותרת שם הישיבה ושורות ריקות למילוי עצמי
export function printMeetingPages(meeting, { pages = 2, rowsPerPage = 22 } = {}) {
  const title = esc(meeting?.title || "ישיבה");
  const meta = [meeting?.date, meeting?.time, meeting?.location].filter(Boolean).map(esc).join(" | ");
  const rows = Array.from({ length: rowsPerPage }, () => '<div class="line"></div>').join("");
  const sheet = (n) => `
    <section class="page">
      <h1>${title}</h1>
      <div class="meta">${meta}</div>
      <div class="who">שם: ______________________________</div>
      <div class="lines">${rows}</div>
      <div class="num">עמוד ${n}</div>
    </section>`;
  const body = Array.from({ length: pages }, (_, i) => sheet(i + 1)).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Heebo, Arial, sans-serif; margin: 0; color: #111; }
    .page { height: 266mm; display: flex; flex-direction: column; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 26px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; color: #555; font-size: 13px; min-height: 16px; margin-bottom: 10px; }
    .who { font-size: 15px; margin-bottom: 6px; }
    .lines { flex: 1; display: flex; flex-direction: column; }
    .line { flex: 1; border-bottom: 1px solid #999; }
    .num { text-align: center; font-size: 11px; color: #888; margin-top: 6px; }
  </style></head><body>${body}</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}