import {
  FolderKanban, Gift, Contact, Wallet, Coins, PiggyBank,
  Sparkles, FileText, CreditCard, PhoneCall, Wrench, ShieldCheck, Receipt, Heart, SprayCan, DatabaseBackup, ListChecks, Briefcase,
} from "lucide-react";

// מקור יחיד לרשימת הלשוניות (גם לניווט וגם לניהול גישות).
// דגלים:
//   adminOnly  — ברירת מחדל למנהל בלבד, אך ניתן להעניק למשתמשים נוספים דרך ניהול גישות.
//   systemOnly — מערכתי (ניהול גישות עצמו): למנהל בלבד ואינו מופיע בטבלת ההקצאה.
// הערה: כל לשונית חדשה שמתווספת כאן מופיעה אוטומטית בניהול גישות.
//        יש להוסיף גם את הנתיב ל-VALID_TAB_PATHS ב-base44/functions/updateUserAllowedTabs/entry.ts
//        כדי ששמירת ההרשאה תאושר גם בצד השרת.
export const NAV_ITEMS = [
  { path: "/cases", label: "תיקים", icon: FolderKanban },
  { path: "/tasks", label: "משימות ותזכורות", icon: ListChecks },
  { path: "/projects", label: "פרויקטים", icon: Briefcase },
  { path: "/distributions", label: "חלוקות חגים", icon: Gift },
  { path: "/community", label: "רשימת קהילה", icon: Contact },
  { path: "/finance", label: "ניהול כלכלי", icon: Wallet },
  { path: "/collections", label: "איסוף קופות", icon: Coins },
  { path: "/deposits", label: "פקדונות", icon: PiggyBank },
  { path: "/donations", label: "תרומות חגים", icon: Sparkles },
  { path: "/forms", label: "טפסים", icon: FileText },
  { path: "/nedarim-donations", label: "תרומות נדרים", icon: CreditCard, adminOnly: true },
  { path: "/donors", label: "תורמים", icon: Heart, adminOnly: true },
  { path: "/telclick", label: "מרכזייה טלקליק", icon: PhoneCall },
  { path: "/service", label: "שירות רזאור", icon: Wrench },
  { path: "/invoices", label: "חשבוניות", icon: Receipt },
  { path: "/cleaning", label: "ניהול ניקיון", icon: SprayCan },
  { path: "/user-access", label: "ניהול גישות", icon: ShieldCheck, adminOnly: true, systemOnly: true },
  { path: "/backup", label: "גיבוי", icon: DatabaseBackup, adminOnly: true, systemOnly: true },
];

// רשימת הלשוניות שניתנות להקצאה למשתמש (כולל adminOnly, למעט systemOnly = ניהול גישות)
export const TABS = NAV_ITEMS.filter((t) => !t.systemOnly).map((t) => ({
  path: t.path,
  label: t.label,
}));

const parseTabs = (u) => {
  if (!u?.allowed_tabs) return [];
  try {
    const arr = JSON.parse(u.allowed_tabs);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
};

// מחזיר את רשימת הנתיבים שהמשתמש מורשה לראות
export const getAllowedTabs = (user) => {
  if (!user) return [];
  if (user.role === "admin") return TABS.map((t) => t.path);
  return parseTabs(user);
};

// האם למשתמש יש גישה לנתיב נתון (כולל נתיבי משנה)
export const canAccess = (user, path) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return getAllowedTabs(user).some(
    (p) => path === p || (p !== "/" && path.startsWith(p + "/"))
  );
};