// Shared CSV import utilities used by the community + finance importers.

export const decodeFile = async (f) => {
  const buf = await f.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf).replace(/^\uFEFF/, "");
  const hebrew = (utf8.match(/[\u0590-\u05FF]/g) || []).length;
  if (hebrew > 3) return utf8;
  return new TextDecoder("windows-1255").decode(buf).replace(/^\uFEFF/, "");
};

export const parseCSV = (text) => {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const sample = lines[0];
  const delim = (sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length ? ";" : ",";
  const parseLine = (line) => {
    const out = [];
    let cur = "", inq = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inq && line[i + 1] === '"') { cur += '"'; i++; }
        else inq = !inq;
      } else if (ch === delim && !inq) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  let lastValid = -1;
  const nonEmpty = (idx) => rows.some((r) => (r[idx] || "").trim() !== "");
  for (let i = 0; i < headers.length; i++) { if (nonEmpty(i) || headers[i]) lastValid = i; }
  const cols = lastValid + 1;
  return { headers: headers.slice(0, cols), rows: rows.map((r) => r.slice(0, cols)) };
};

export const norm = (s) => (s || "").toLowerCase().replace(/[\s_\-"'".]/g, "");

export const autoDetect = (headers, fields) => {
  const result = {};
  for (const f of fields) {
    let found = -1;
    for (const opt of f.opts) {
      const target = norm(opt);
      for (let i = 0; i < headers.length; i++) {
        if (norm(headers[i]) === target || norm(headers[i]).includes(target)) { found = i; break; }
      }
      if (found >= 0) break;
    }
    result[f.key] = found;
  }
  return result;
};

export const num = (v) => {
  const n = Number((v || "").toString().replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};