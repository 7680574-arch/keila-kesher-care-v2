export const FIELD_CODES = [
  "Field1", "Field2", "Field3", "Field4", "Field5", "Field6", "Field7",
  "Field16", "Field21", "Field22", "Field23", "Field89", "Field90", "Field91",
  "Field92", "Field93", "Field94", "Field95", "Field96", "Field97", "Field98", "Field100",
  "Field1Max", "Field2Max", "Field3Max", "Field4Max", "Field7Max", "UpdateDate"
];

const TABLE_CODE_RE = /^(Field\d+(?:Max)?|UpdateDate|ID|CreatedDate)$/;

export function parseTitlesTable(text) {
  const map = {};
  (text || "").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:=|:|\||\t|\s{2,})\s*(.+)$/);
    if (m && TABLE_CODE_RE.test(m[1])) map[m[1]] = m[2].trim();
  });
  return map;
}

export function parseTitles(text) {
  const map = {};
  (text || "").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*[=:]\s*(.+)$/);
    if (m) map[m[1]] = m[2].trim();
  });
  return map;
}

export function formatTitles(map) {
  return Object.entries(map || {})
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

export function titleFor(titles, code) {
  return (titles && titles[code]) || code;
}

// עמודות לפי סדר כותרות הטופס (כמו בנדרים פלוס), ואחריהן שדות נוספים שלא הוגדרה להם כותרת.
// המפתחות נאספים מכל הרשומות, כי ה-API מחזיר את השדות בסדר אקראי.
export function orderedColumns(records, titles, { hideEmpty = false } = {}) {
  const present = new Set();
  (records || []).forEach((r) => Object.keys(r).forEach((k) => {
    if (!hideEmpty || (r[k] !== "" && r[k] != null)) present.add(k);
  }));
  const fixed = ["ID", "CreatedDate"];
  const fromTitles = Object.keys(titles || {}).filter((k) => present.has(k) && !fixed.includes(k));
  const rest = [...present].filter((k) => !fixed.includes(k) && !fromTitles.includes(k));
  return [...fixed.filter((k) => present.has(k) || !hideEmpty), ...fromTitles, ...rest];
}

export function parseTitlesJson(str) {
  if (!str) return {};
  try { return JSON.parse(str) || {}; } catch { return parseTitles(str); }
}