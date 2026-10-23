// כל עמודות טופס הרישום (691) לפי סדר הטופס, כפי שהן מוצגות ברשימת הקהילה.
// fin: הנתון נלקח מהניהול הכלכלי (CommunityFinance) ; money: מוצג כסכום ; noFilter: ללא סינון בכותרת ; popup: חלון פרטי ילדים
const col = (key, label, extra = {}) => ({ key, label, ...extra });
const money = { fin: true, money: true };

const CHILD_FIELDS = [
  ["name", "שם פרטי"],
  ["id_number", "ת.ז."],
  ["birth_date", "ת.לידה לועזי"],
  ["gender", "מגדר"],
];

const CHILD_COLUMNS = Array.from({ length: 15 }, (_, i) =>
  CHILD_FIELDS.map(([field, label]) => col(`child_${i + 1}_${field}`, `ילד ${i + 1} ${label}`, { noFilter: true }))
).flat();

export const FORM_COLUMNS = [
  col("id_number", "ת.ז."),
  col("phone", "טלפון קווי"),
  col("mobile", "נייד"),
  col("birth_date", "ת.לידה לועזי"),
  col("email", "מייל"),
  col("occupation", "עיסוק"),
  col("personal_scholarship", "סכום הכנסה /מלגה", money),
  col("city", "עיר"),
  col("street", "רחוב"),
  col("house_number", "מספר"),
  col("apartment", "דירה"),
  col("spouse_name", "פרטי האשה - שם פרטי"),
  col("spouse_id", "פרטי האשה - ת.ז."),
  col("spouse_birth_date", "פרטי האשה - ת.לידה לועזי"),
  col("spouse_phone", "פרטי האשה - נייד"),
  col("spouse_occupation", "פרטי האשה - עיסוק"),
  col("spouse_scholarship", "פרטי האשה - סכום הכנסה /מלגה", money),
  col("bank_name", "שם בנק"),
  col("bank_number", "מספר בנק"),
  col("branch_number", "מספר סניף"),
  col("account_number", "מספר חשבון"),
  col("father_last_name", "הורי הבעל - שם משפחה"),
  col("father_first_name", "הורי הבעל - שם פרטי אב"),
  col("father_mother_first_name", "הורי הבעל - שם פרטי אם"),
  col("father_phone", "הורי הבעל - טלפון"),
  col("father_city", "הורי הבעל - עיר"),
  col("mother_last_name", "הורי האשה - שם משפחה"),
  col("mother_first_name", "הורי האשה - שם פרטי אב"),
  col("mother_mother_first_name", "הורי האשה - שם פרטי אם"),
  col("mother_phone", "הורי האשה - טלפון"),
  col("mother_city", "הורי האשה - עיר"),
  col("installments_income", "הכנסה מקצבאות", money),
  col("fixed_income", "הכנסה קבועה", money),
  col("total_income", 'סה"כ הכנסות', { ...money, cls: "font-medium" }),
  col("tuition_expense", 'הוצאות מטפלות שכ"ל', money),
  col("special_children_expense", "הוצאות חריגות-ילדים", money),
  col("rent_expense", "הוצאות דיור", money),
  col("total_debt", "סך חובות כללי", { ...money, cls: "text-destructive" }),
  col("debt_reason", "ממה נוצרו החובות?", { fin: true }),
  col("monthly_repayment", "סכום החזר חודשי", money),
  col("total_expenses", 'סה"כ הוצאות', { ...money, cls: "font-medium" }),
  col("children_count", "ילדים"),
  col("children_details", "פרטי ילדים", { popup: true }),
  ...CHILD_COLUMNS,
  col("form_update_date", "תאריך עדכון"),
];

export const FIN_KEYS = new Set(FORM_COLUMNS.filter((c) => c.fin).map((c) => c.key));
export const DEFAULT_FREE_ORDER = FORM_COLUMNS.map((c) => c.key);
export const CHILD_KEY_RE = /^child_(\d+)_(.+)$/;