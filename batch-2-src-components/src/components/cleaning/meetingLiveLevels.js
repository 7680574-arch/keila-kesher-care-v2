// רמות צפיפות: קודם מוסיפים עמודות, ואחר כך מצמצמים גובה (טקסט ומרווחים)
const L = (cols, problem, solution, pad, rowPad, gap, icon, sIcon) => ({
  cols, problem, solution, pad, rowPad, gap, icon, sIcon,
});

export const LEVELS = [
  L(1, "text-2xl", "text-xl", "p-4", "px-4 py-3", "gap-4", "w-7 h-7", "w-6 h-6"),
  L(2, "text-2xl", "text-xl", "p-4", "px-4 py-3", "gap-4", "w-7 h-7", "w-6 h-6"),
  L(3, "text-xl", "text-lg", "p-3", "px-3 py-2", "gap-3", "w-6 h-6", "w-5 h-5"),
  L(3, "text-lg", "text-base", "p-3", "px-3 py-2", "gap-3", "w-5 h-5", "w-5 h-5"),
  L(4, "text-lg", "text-base", "p-3", "px-3 py-2", "gap-3", "w-5 h-5", "w-5 h-5"),
  L(4, "text-base", "text-sm", "p-2", "px-2 py-1.5", "gap-2", "w-5 h-5", "w-4 h-4"),
  L(5, "text-base", "text-sm", "p-2", "px-2 py-1.5", "gap-2", "w-5 h-5", "w-4 h-4"),
  L(5, "text-sm", "text-xs", "p-2", "px-2 py-1", "gap-1.5", "w-4 h-4", "w-4 h-4"),
  L(6, "text-sm", "text-xs", "p-1.5", "px-2 py-1", "gap-1.5", "w-4 h-4", "w-4 h-4"),
];