import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function BackupResultsList({ results }) {
  if (!results?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border max-h-96 overflow-y-auto scrollbar-thin">
      {results.map((r) => (
        <div key={r.entity} className="flex items-center justify-between px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            {r.ok ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <span className="font-medium">{r.label || r.entity}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            {r.ok ? `${r.count} רשומות` : r.error}
          </span>
        </div>
      ))}
    </div>
  );
}