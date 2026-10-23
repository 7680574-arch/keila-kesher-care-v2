import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function LiveItemActions({ canDelete, onDelete }) {
  if (!canDelete) return null;
  return (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}