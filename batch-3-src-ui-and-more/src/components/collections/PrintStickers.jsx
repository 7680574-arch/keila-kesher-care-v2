import React from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

const barcodeSvg = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, v, {
      format: "CODE128",
      width: 1.1,
      height: 26,
      displayValue: true,
      fontSize: 7,
      textMargin: 1,
      margin: 0,
    });
    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    return svg.outerHTML;
  } catch (e) {
    return "";
  }
};

const PER_PAGE = 24; // TW-2324: 3 עמודות × 8 שורות
const buildingKey = (m) => {
  const street = (m.street || "").trim();
  const house = (m.house_number || "").trim();
  if (street || house) return `${street} ${house}`.trim();
  return (m.address || "ללא כתובת").trim();
};

const numVal = (s) => {
  const n = parseInt(String(s || "").replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 99999 : n;
};

const fullName = (m) => m.name || [m.first_name, m.last_name].filter(Boolean).join(" ") || "";

const fullAddress = (m) => {
  const parts = [];
  const street = (m.street || "").trim();
  const house = (m.house_number || "").trim();
  if (street) parts.push(house ? `${street} ${house}` : street);
  else if (house) parts.push(`בית ${house}`);
  if (m.apartment) parts.push(`דירה ${m.apartment}`);
  if (m.city) parts.push(m.city);
  return parts.join(", ");
};

const escapeHtml = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function PrintStickers({ members, disabled }) {
  const handlePrint = () => {
    const list = (members || []).filter((m) => fullName(m));

    // קיבוץ לפי בניין
    const groups = {};
    list.forEach((m) => {
      const key = buildingKey(m);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    const buildings = Object.keys(groups)
      .map((key) => ({
        key,
        members: groups[key].sort((a, b) => numVal(a.apartment) - numVal(b.apartment)),
      }))
      .sort((a, b) => {
        const sa = (a.key || "").replace(/[0-9]/g, "").trim();
        const sb = (b.key || "").replace(/[0-9]/g, "").trim();
        if (sa !== sb) return sa.localeCompare(sb, "he");
        return numVal(a.key) - numVal(b.key);
      });

    // אריזה לעמודים — המדבקה הראשונה בכל עמוד שמורה לאינדקס הבניינים (23 חברים לעמוד).
    // בניין לא מתפצל בין עמודים (אלא אם גדול מעמוד שלם).
    const MAX = PER_PAGE - 1;
    const pages = [];
    let current = { buildings: [], members: [] };
    for (const b of buildings) {
      if (b.members.length > MAX) {
        if (current.members.length) {
          pages.push(current);
          current = { buildings: [], members: [] };
        }
        for (let i = 0; i < b.members.length; i += MAX) {
          pages.push({ buildings: [b.key], members: b.members.slice(i, i + MAX) });
        }
        continue;
      }
      if (current.members.length + b.members.length > MAX) {
        pages.push(current);
        current = { buildings: [], members: [] };
      }
      current.buildings.push(b.key);
      current.members.push(...b.members);
    }
    if (current.members.length) pages.push(current);

    const pagesHtml = pages
      .map((page) => {
        const half = Math.ceil(page.buildings.length / 2);
        const col1 = page.buildings.slice(0, half).map((k) => `<div>${escapeHtml(k)}</div>`).join("");
        const col2 = page.buildings.slice(half).map((k) => `<div>${escapeHtml(k)}</div>`).join("");
        const cells = [`<div class="label index"><div class="idx-title">בניינים בעמוד</div><div class="idx-cols"><div class="idx-col">${col1}</div><div class="idx-col">${col2}</div></div></div>`];
        for (let i = 0; i < MAX; i++) {
          const m = page.members[i];
          if (!m) cells.push(`<div class="label empty"></div>`);
          else {
            const bc = barcodeSvg(m.id_number);
            cells.push(`<div class="label">
              <div class="name">${escapeHtml(fullName(m))}</div>
              <div class="addr">${escapeHtml(fullAddress(m))}</div>
              ${bc ? `<div class="barcode">${bc}</div>` : `<div class="no-bc">— אין ת.ז. —</div>`}
            </div>`);
          }
        }
        return `<div class="page"><div class="grid">${cells.join("")}</div></div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>מדבקות - איסוף קופות</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Heebo', 'Arial', sans-serif; }
  .page {
    width: 210mm;
    height: 297mm;
    padding: 8.5mm 0;
    margin: 0 auto;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 70mm);
    grid-template-rows: repeat(8, 35mm);
    width: 210mm;
  }
  .label {
    border: 0.4mm dotted #bbb;
    padding: 1.5mm 3mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    overflow: hidden;
    text-align: center;
  }
  .label.empty { border-color: transparent; }
  .label.index {
    align-items: stretch;
    text-align: center;
    gap: 0.4mm;
  }
  .idx-title {
    font-size: 8pt;
    font-weight: 700;
    color: #0369a1;
    margin-bottom: 1mm;
    border-bottom: 0.3mm solid #cbd5e1;
    padding-bottom: 0.6mm;
    width: 100%;
    text-align: center;
  }
  .idx-cols {
    display: flex;
    gap: 2mm;
    width: 100%;
    justify-content: center;
  }
  .idx-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2mm;
  }
  .idx-col > div {
    font-size: 6.5pt;
    line-height: 1.15;
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-size: 11pt;
    font-weight: 700;
    line-height: 1.15;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .addr {
    font-size: 8pt;
    line-height: 1.15;
    color: #475569;
    margin-top: 0.5mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .barcode {
    margin-top: 1mm;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .barcode svg {
    height: 11mm;
    max-width: 100%;
    width: auto;
  }
  .no-bc {
    margin-top: 1mm;
    font-size: 6.5pt;
    color: #94a3b8;
    letter-spacing: 0.2pt;
  }
  @media screen {
    body { background: #e5e7eb; padding: 16px; }
    .page { box-shadow: 0 1px 4px rgba(0,0,0,.2); margin-bottom: 16px; background: #fff; }
  }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("יש לאפשר חלונות קופצים כדי להדפיס מדבקות.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <Button variant="outline" onClick={handlePrint} disabled={disabled}>
      <Printer className="w-4 h-4" /> הדפסת מדבקות
    </Button>
  );
}