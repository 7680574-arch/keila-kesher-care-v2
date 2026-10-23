// ייצוא טבלת המצטבר לפי גן לקובץ אקסל המשחזר במדויק את התצוגה באתר:
// שורת כותרת כפולה עם תאי גן ממוזגים (colSpan=2), RTL, עיצוב ₪ ושורת "סה"כ".
// משתמש ב-HTML הנפתח ישירות ב-Excel (ללא ספרייה חיצונית) כדי לשמר תאים ממוזגים וכיווניות.
export function exportPivotExcel(rows, filename = "תנועות_מכירה_מצטבר_לפי_גן.xls") {
  const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  const gardenSet = new Set();
  const productMap = new Map();
  for (const r of rows) {
    const garden = (r.department || "").trim() || "ללא גן";
    gardenSet.add(garden);
    const key = `${r.sku || ""}|${r.product_name || ""}|${r.unit_price ?? 0}`;
    if (!productMap.has(key)) productMap.set(key, { name: r.product_name, sku: r.sku, unit_price: r.unit_price, gardens: {} });
    const p = productMap.get(key);
    if (!p.gardens[garden]) p.gardens[garden] = { qty: 0, total: 0 };
    p.gardens[garden].qty += Number(r.quantity) || 0;
    p.gardens[garden].total += Number(r.line_total) || 0;
  }
  const gardens = Array.from(gardenSet).sort((a, b) => a.localeCompare(b, "he"));
  const products = Array.from(productMap.values());
  const totalsByGarden = {};
  for (const g of gardens) totalsByGarden[g] = { qty: 0, total: 0 };
  for (const p of products) {
    for (const g of gardens) {
      const c = p.gardens[g];
      if (c) { totalsByGarden[g].qty += c.qty; totalsByGarden[g].total += c.total; }
    }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&" + "amp;", "<": "&" + "lt;", ">": "&" + "gt;" }[ch]));
  const headBg = "background:#f3f4f6";
  const gardenBg = "background:#eaf3f7";

  let html = `<html dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
  html += `<head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>מצטבר</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>`;
  html += `<body><table border="1" dir="rtl" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Arial;font-size:11px">`;

  // שורת כותרת ראשונה — שם מוצר / קוד מוצר / מחיר יחידה ממוזגים לשתי שורות, כל גן ממוזג לשתי עמודות עם סה"כ כספי מתחת
  html += `<thead><tr>`;
  html += `<th rowspan="2" style="${headBg}">שם מוצר</th>`;
  html += `<th rowspan="2" style="${headBg}">קוד מוצר</th>`;
  html += `<th rowspan="2" style="${headBg}">מחיר יחידה</th>`;
  for (const g of gardens) {
    html += `<th colspan="2" style="text-align:center;${gardenBg}"><b>${esc(g)}</b><br/>${fmt(totalsByGarden[g].total)}</th>`;
  }
  html += `</tr>`;
  // שורת כותרת שנייה — כמות / סכום לכל גן
  html += `<tr>`;
  for (const g of gardens) {
    html += `<th style="${headBg}">כמות</th><th style="${headBg}">סכום</th>`;
  }
  html += `</tr></thead>`;

  // גוף הטבלה — מוצרים
  html += `<tbody>`;
  for (const p of products) {
    html += `<tr>`;
    html += `<td>${esc(p.name)}</td>`;
    html += `<td style="color:#6b7280">${esc(p.sku)}</td>`;
    html += `<td>${fmt(p.unit_price)}</td>`;
    for (const g of gardens) {
      const c = p.gardens[g];
      html += `<td style="text-align:center">${c ? c.qty : ""}</td><td style="text-align:center">${c ? fmt(c.total) : ""}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody>`;

  // שורת "סה"כ" — סיכום לפי גן (ללא סה"כ כללי)
  html += `<tfoot><tr style="${headBg};font-weight:bold">`;
  html += `<td>סה"כ</td><td></td><td></td>`;
  for (const g of gardens) {
    html += `<td style="text-align:center">${totalsByGarden[g].qty}</td><td style="text-align:center">${fmt(totalsByGarden[g].total)}</td>`;
  }
  html += `</tr></tfoot>`;

  html += `</table></body></html>`;

  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}