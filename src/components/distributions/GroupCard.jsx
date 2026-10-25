import React from "react";
import { FolderOpen, Pencil, Trash2 } from "lucide-react";

/** A folder-style tile for a distribution group. */
export default function GroupCard({ group, count, onOpen, onEdit, onDelete }) {
  return (
    <div
      onClick={onOpen}
      className="bg-card rounded-2xl border border-border p-5 hover:border-primary hover:shadow-md transition cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
          <button type="button" title="עריכה" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-muted-foreground hover:text-primary">
            <Pencil className="w-4 h-4" />
          </button>
          <button type="button" title="מחיקת קבוצה" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h3 className="font-semibold text-lg mt-3 group-hover:text-primary transition">{group.name}</h3>
      <p className="text-sm text-muted-foreground">{count} חלוקות</p>
    </div>
  );
}