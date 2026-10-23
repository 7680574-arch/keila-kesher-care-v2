import React from "react";
import { cn } from "@/lib/utils";

export default function MeetingTabsBar({ tabs, tab, onChange }) {
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px disabled:opacity-40",
            tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >{t.label}</button>
      ))}
    </div>
  );
}