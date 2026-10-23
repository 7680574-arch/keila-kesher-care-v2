export function rowsToCsv(rows, columns) {
  const esc = (v) => {
    let s = v == null ? "" : String(v);
    // Neutralize spreadsheet formula injection: prefix dangerous leading chars.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => esc(c.get(r))).join(",")).join("\r\n");
  return "\uFEFF" + header + "\r\n" + body;
}

export function downloadCsv(fileName, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}