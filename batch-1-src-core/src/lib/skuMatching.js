// התאמת מוצרים עם קוד "####" / "****" למוצרים קיימים לפי דמיון בשם ובמחיר.

export const isHashSku = (sku) => {
  const s = (sku || "").trim();
  return !!s && /^[*#\s]+$/.test(s);
};

const norm = (s) =>
  (s || "").toLowerCase().replace(/["'`׳״.,()\-_/\\*#:;]+/g, " ").replace(/\s+/g, " ").trim();

const grams = (s) => {
  const t = s.replace(/\s/g, "");
  const m = new Map();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
};

const prep = (name) => {
  const n = norm(name);
  return { n, g: grams(n) };
};

const dice = (a, b) => {
  let sa = 0, sb = 0, inter = 0;
  for (const v of a.values()) sa += v;
  for (const v of b.values()) sb += v;
  if (!sa || !sb) return 0;
  for (const [k, v] of a) inter += Math.min(v, b.get(k) || 0);
  return (2 * inter) / (sa + sb);
};

const nameSim = (a, b) => {
  if (!a.n || !b.n) return 0;
  if (a.n === b.n) return 1;
  const [short, long] = a.n.length <= b.n.length ? [a.n, b.n] : [b.n, a.n];
  if (short.length >= 3 && long.includes(short)) return 0.9;
  return dice(a.g, b.g);
};

const priceSim = (a, b) => {
  if (!a || !b) return 0;
  const d = Math.abs(a - b);
  if (d < 0.01) return 1;
  return d / Math.max(a, b) <= 0.1 ? 0.5 : 0;
};

// מוצרים קיימים עם קוד תקין (שם + מחיר + קוד)
export function buildCandidates(rows) {
  const map = new Map();
  for (const r of rows) {
    const sku = (r.sku || "").trim();
    if (!sku || isHashSku(sku)) continue;
    const price = Number(r.unit_price) || 0;
    const key = `${sku}|${r.product_name || ""}|${price}`;
    if (!map.has(key)) map.set(key, { sku, name: r.product_name || "", price, ...prep(r.product_name) });
  }
  return Array.from(map.values());
}

// קבוצות שורות עם קוד סולמיות — לפי קוד + שם + מחיר
export function buildHashGroups(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!isHashSku(r.sku)) continue;
    const price = Number(r.unit_price) || 0;
    const key = `${r.sku}|${r.product_name || ""}|${price}`;
    if (!map.has(key)) map.set(key, { key, sku: r.sku, name: r.product_name || "", price, ids: [] });
    map.get(key).ids.push(r.id);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// עד 5 הצעות מובילות (הצעה אחת לכל קוד מוצר)
export function suggest(group, candidates) {
  const g = prep(group.name);
  const bySku = new Map();
  for (const c of candidates) {
    const ns = nameSim(g, c);
    const ps = priceSim(group.price, c.price);
    if (ns < 0.5 && !(ps === 1 && ns >= 0.3)) continue;
    const score = ns * 0.75 + ps * 0.25;
    const prev = bySku.get(c.sku);
    if (!prev || score > prev.score) bySku.set(c.sku, { sku: c.sku, name: c.name, price: c.price, score });
  }
  return Array.from(bySku.values()).sort((a, b) => b.score - a.score).slice(0, 5);
}

export const confidence = (score) => {
  if (score >= 0.85) return { label: "התאמה גבוהה", cls: "bg-green-100 text-green-700" };
  if (score >= 0.65) return { label: "התאמה בינונית", cls: "bg-amber-100 text-amber-700" };
  return { label: "התאמה נמוכה", cls: "bg-red-100 text-red-700" };
};