// מיפוי שדות טופס רישום (691) ← שדות רשימת הקהילה / ניהול כלכלי
// ent: "member" = CommunityMember, "fin" = CommunityFinance
// partial: התאמה חלקית (הטופס מכיל פחות פרטים מהשדה ברשימה)

export const FIELD_MAP_691 = {
  Field1: { ent: "member", field: "last_name", label: "שם משפחה" },
  Field2: { ent: "member", field: "first_name", label: "שם פרטי" },
  Field3: { ent: "member", field: "id_number", label: "ת.ז.", key: true },
  Field4: { ent: "member", field: "phone", label: "טלפון קווי" },
  Field5: { ent: "member", field: "mobile", label: "נייד" },
  Field6: { ent: "member", field: "birth_date", label: "תאריך לידה" },
  Field7: { ent: "member", field: "occupation", label: "עיסוק" },
  Field3Max: { ent: "member", field: "email", label: "אימייל" },
  Field8: { ent: "member", field: "city", label: "עיר" },
  Field9: { ent: "member", field: "street", label: "רחוב" },
  Field10: { ent: "member", field: "house_number", label: "מספר בית" },
  Field11: { ent: "member", field: "apartment", label: "דירה" },
  Field12: { ent: "member", field: "spouse_name", label: "שם בן/בת זוג", partial: "בטופס רק שם פרטי" },
  Field13: { ent: "member", field: "spouse_id", label: "ת.ז. בן/בת זוג" },
  Field14: { ent: "member", field: "spouse_birth_date", label: "ת. לידה בן/בת זוג" },
  Field15: { ent: "member", field: "spouse_phone", label: "טלפון בן/בת זוג" },
  Field16: { ent: "member", field: "spouse_occupation", label: "עיסוק בן/בת זוג" },
  Field17: { ent: "member", field: "bank_name", label: "שם בנק" },
  Field18: { ent: "member", field: "bank_number", label: "מספר בנק" },
  Field19: { ent: "member", field: "branch_number", label: "מספר סניף" },
  Field20: { ent: "member", field: "account_number", label: "מספר חשבון" },
  Field21: { ent: "member", field: "father_last_name", label: "הורי הבעל - שם משפחה" },
  Field22: { ent: "member", field: "father_first_name", label: "הורי הבעל - שם פרטי אב" },
  Field4Max: { ent: "member", field: "father_mother_first_name", label: "הורי הבעל - שם פרטי אם" },
  Field23: { ent: "member", field: "father_phone", label: "הורי הבעל - טלפון" },
  Field24: { ent: "member", field: "father_city", label: "הורי הבעל - עיר" },
  Field25: { ent: "member", field: "mother_last_name", label: "הורי האשה - שם משפחה" },
  Field26: { ent: "member", field: "mother_first_name", label: "הורי האשה - שם פרטי אב" },
  Field5Max: { ent: "member", field: "mother_mother_first_name", label: "הורי האשה - שם פרטי אם" },
  Field27: { ent: "member", field: "mother_phone", label: "הורי האשה - טלפון" },
  Field28: { ent: "member", field: "mother_city", label: "הורי האשה - עיר" },
  Field91: { ent: "fin", field: "personal_scholarship", label: "סכום הכנסה /מלגה (אישי)" },
  Field92: { ent: "fin", field: "spouse_scholarship", label: "סכום הכנסה /מלגה (בת זוג)" },
  UpdateDate: { ent: "member", field: "form_update_date", label: "תאריך עדכון בטופס" },
  Field90: { ent: "member", field: "children_count", label: "מספר ילדים" },
  // שדות כלכליים ← CommunityFinance
  Field94: { ent: "fin", field: "fixed_income", label: "הכנסה קבועה" },
  Field93: { ent: "fin", field: "installments_income", label: "הכנסה ממקצבאות" },
  Field95: { ent: "fin", field: "total_income", label: 'סה"כ הכנסות' },
  Field96: { ent: "fin", field: "tuition_expense", label: 'הוצאות מטפלות שכ"ל' },
  Field97: { ent: "fin", field: "special_children_expense", label: "הוצאות חריגות ילדים" },
  Field100: { ent: "fin", field: "rent_expense", label: "הוצאות דיור" },
  Field1Max: { ent: "fin", field: "total_expenses", label: 'סה"כ הוצאות' },
  Field98: { ent: "fin", field: "total_debt", label: "סך חובות כללי" },
  Field7Max: { ent: "fin", field: "debt_reason", label: "ממה נוצרו החובות" },
  Field89: { ent: "fin", field: "monthly_repayment", label: "סכום החזר חודשי" },
};

// שדות בטופס 691 שאין להם שדה מקביל ברשימת הקהילה
export const UNMATCHED_691 = [];

// ילדים: Field29-88 — 15 ילדים × 4 שדות (שם פרטי, ת.ז., ת. לידה, מגדר)
export const CHILDREN_FIELDS = Array.from({ length: 15 }, (_, i) => {
  const base = 29 + i * 4;
  return {
    index: i + 1,
    name: `Field${base}`,
    id: `Field${base + 1}`,
    birth: `Field${base + 2}`,
    gender: `Field${base + 3}`,
  };
});

export const GENDER_LABELS = { 1: "זכר", 2: "נקבה", M: "זכר", F: "נקבה", male: "זכר", female: "נקבה" };

// נרמול ערך להשוואה (הסרת רווחים מיותרים, הזרת אפסים מובילים בת.ז., וכו')
export const norm = (v) => {
  if (v == null) return "";
  let s = String(v).trim();
  // תאריכים: אם מספרי/פורמט אחיד, נשאיר כמות שהוא
  return s;
};

export const normId = (v) => String(v || "").replace(/\D/g, "");

// פיענוח ילדים מרשומת טופס למערך
export const parseFormChildren = (rec) => {
  const out = [];
  for (const cf of CHILDREN_FIELDS) {
    const name = rec[cf.name];
    if (!name && !rec[cf.id] && !rec[cf.birth]) continue;
    out.push({
      name: rec[cf.name] || "",
      id_number: rec[cf.id] || "",
      birth_date: rec[cf.birth] || "",
      gender: GENDER_LABELS[rec[cf.gender]] || rec[cf.gender] || "",
    });
  }
  return out;
};

// פיענוח children_json מרשימת הקהילה
export const parseMemberChildren = (json) => {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((c) => ({
      name: c.name || "",
      id_number: c.id_number || "",
      birth_date: c.birth_date || "",
      gender: c.gender || "",
    }));
  } catch {
    return [];
  }
};

export const childrenEqual = (a, b) => {
  if (a.length !== b.length) return false;
  return a.every((c, i) =>
    norm(c.name) === norm(b[i]?.name || "") &&
    normId(c.id_number) === normId(b[i]?.id_number || "") &&
    norm(c.birth_date) === norm(b[i]?.birth_date || "") &&
    norm(c.gender) === norm(b[i]?.gender || "")
  );
};

// סטטוס השוואה לשדה בודד
export const compareField = (formVal, memberVal) => {
  const f = norm(formVal);
  const m = norm(memberVal);
  if (!f && !m) return "both_empty";
  if (!f) return "only_member";
  if (!m) return "only_form";
  if (f === m) return "same";
  return "diff";
};