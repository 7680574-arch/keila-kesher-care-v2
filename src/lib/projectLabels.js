export const KIND_LABELS = { event: "אירוע", campaign: "קמפיין" };
export const STATUS_LABELS = {
  planning: "בתכנון", active: "פעיל", completed: "הסתיים", cancelled: "בוטל",
};
export const STATUS_STYLES = {
  planning: "bg-[#FFE98A]/70 text-[#7a6200] ring-[#e6c800]/40",
  active: "bg-[#2ECC8A]/20 text-[#0f7a50] ring-[#2ECC8A]/50",
  completed: "bg-[#C9B3F5]/40 text-[#5b3fa0] ring-[#C9B3F5]/70",
  cancelled: "bg-[#FF8077]/25 text-[#b3342b] ring-[#FF8077]/50",
};
// פס צבע עליון בכרטיס פרויקט, לפי סטטוס
export const STATUS_BAR = {
  planning: "bg-[#F5F01A]",
  active: "bg-[#2ECC8A]",
  completed: "bg-[#C9B3F5]",
  cancelled: "bg-[#FF8077]",
};
// צבעי אקסנט לכרטיסי סיכום
export const ACCENTS = {
  green: { bg: "bg-[#2ECC8A]/15", dot: "bg-[#2ECC8A]", text: "text-[#0f7a50]" },
  coral: { bg: "bg-[#FF8077]/15", dot: "bg-[#FF8077]", text: "text-[#b3342b]" },
  blue: { bg: "bg-[#B8EFF5]/60", dot: "bg-[#4CC3D6]", text: "text-[#13717f]" },
  purple: { bg: "bg-[#C9B3F5]/35", dot: "bg-[#A98BEA]", text: "text-[#5b3fa0]" },
  pink: { bg: "bg-[#F9AEBE]/40", dot: "bg-[#F58AA0]", text: "text-[#a8324f]" },
};
export const PARTICIPANT_STATUS = {
  invited: "הוזמן", confirmed: "אישר הגעה", declined: "סירב", attended: "הגיע",
};
export const fmtMoney = (n) => `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;