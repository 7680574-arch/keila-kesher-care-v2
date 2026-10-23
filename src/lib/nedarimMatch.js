export const digits = (s) => (s || "").toString().replace(/\D/g, "");
export const normName = (s) => (s || "").toString().replace(/['"`\-.]/g, "").replace(/\s+/g, " ").trim();

// מציאת הנמען הכי מתאים לחיוב לפי: טלפון (מועדף), 4 ספרות כרטיס (מול חיובים שויכו - חברים בלבד), או שם.
// מחפש גם בחברי הקהילה וגם ברשימת התורמים. מחזיר { entity, kind, reason } או null.
export function bestEntityMatch(row, members, donors, lastNumMap) {
  let best = null, bestKind = "member", bestScore = 0, bestReason = "";
  const dName = normName(row.client_name);
  const dPhone = digits(row.phone);
  const cardZeout = row.last_num && lastNumMap[row.last_num] ? digits(lastNumMap[row.last_num]) : "";

  const phoneScore = (m) => {
    const mPhones = [m.phone, m.mobile].map(digits).filter(Boolean);
    if (!dPhone || !mPhones.length) return { score: 0, reason: "" };
    if (mPhones.some((p) => p.length >= 7 && (p.endsWith(dPhone.slice(-7)) || dPhone.endsWith(p.slice(-7))))) {
      return { score: 1.0, reason: `טלפון תואם (${row.phone})` };
    }
    return { score: 0, reason: "" };
  };
  const nameScore = (m) => {
    const mFull = normName(m.name);
    if (!dName || !mFull) return { score: 0, reason: "" };
    if (dName === mFull) return { score: 0.85, reason: "שם זהה" };
    if (dName.includes(mFull) || mFull.includes(dName)) return { score: 0.75, reason: "שם כולל" };
    const dt = dName.split(" "), mt = mFull.split(" ");
    const common = mt.filter((t) => t.length > 1 && dt.includes(t));
    const overlap = common.length;
    if (overlap >= 2) return { score: 0.6 + overlap * 0.05, reason: `שם דומה (${common.join(", ")})` };
    if (overlap === 1 && (dt.length <= 2 || mt.length <= 2)) return { score: 0.5, reason: `שם דומה (${common.join(", ")})` };
    return { score: 0, reason: "" };
  };

  const candidates = [
    ...members.map((m) => ({ entity: m, kind: "member" })),
    ...donors.map((d) => ({ entity: d, kind: "donor" })),
  ];
  for (const { entity, kind } of candidates) {
    let score = 0, reason = "";
    const ph = phoneScore(entity);
    if (ph.score > score) { score = ph.score; reason = ph.reason; }
    if (kind === "member" && cardZeout && entity.id_number && digits(entity.id_number) === cardZeout) {
      if (0.95 > score) { score = 0.95; reason = `כרטיס ••${row.last_num} שויך בעבר לחבר זה`; }
    }
    const nm = nameScore(entity);
    if (nm.score > score) { score = nm.score; reason = nm.reason; }
    if (score > bestScore) { bestScore = score; best = entity; bestKind = kind; bestReason = reason; }
  }
  return bestScore >= 0.5 ? { entity: best, kind: bestKind, reason: bestReason } : null;
}