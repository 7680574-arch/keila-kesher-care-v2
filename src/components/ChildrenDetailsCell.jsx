import React from "react";
import { Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const G = { male: "זכר", female: "נקבה", M: "זכר", F: "נקבה", "1": "זכר", "2": "נקבה" };

const parse = (json) => {
  if (!json) return [];
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
};

export default function ChildrenDetailsCell({ member }) {
  const kids = parse(member.children_json);
  if (!kids.length) return <span className="text-muted-foreground">—</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
          <Users className="w-3 h-3" />
          {kids.length} ילדים
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
          <span className="text-sm font-semibold">פרטי ילדים ({kids.length})</span>
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-muted-foreground text-[10px]">
                <th className="text-right font-medium px-2 py-1.5">שם</th>
                <th className="text-right font-medium px-2 py-1.5">ת.ז.</th>
                <th className="text-right font-medium px-2 py-1.5">ת. לידה</th>
                <th className="text-right font-medium px-2 py-1.5">מגדר</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((k, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5 font-medium">{k.name || "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{k.id_number || "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{k.birth_date || "—"}</td>
                  <td className="px-2 py-1.5">{G[k.gender] || k.gender || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PopoverContent>
    </Popover>
  );
}