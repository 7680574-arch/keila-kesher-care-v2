import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Phone, FileText, Users, MapPin, Send, Pencil } from "lucide-react";

const noteTypes = [
  { value: "note", label: "תיעוד", icon: FileText },
  { value: "call", label: "שיחת טלפון", icon: Phone },
  { value: "visit", label: "ביקור", icon: MapPin },
  { value: "meeting", label: "פגישה", icon: Users },
  { value: "document", label: "מסמך", icon: FileText },
  { value: "referral", label: "הפניה", icon: Send },
];

export default function CaseNoteForm({ onSubmit, initial = null, onDone }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState("note");

  useEffect(() => {
    if (initial) {
      setContent(initial.content || "");
      setType(initial.type || "note");
    }
  }, [initial]);

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;
    onSubmit({ content, type });
    if (!initial) {
      setContent("");
      setType("note");
    }
    if (onDone) onDone();
  };

  return (
    <form onSubmit={submit} className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Pencil className="w-4 h-4" />
        {initial ? "עריכת תיעוד" : "תיעוד חדש"}
      </div>
      <div className="flex flex-wrap gap-2">
        {noteTypes.map((t) => {
          const Icon = t.icon;
          const active = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <Textarea
        rows={3}
        placeholder="תעדו פעולה, תצפית, או עדכון..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            ביטול
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!content.trim()}>
          <Send className="w-4 h-4 ml-1" />
          {initial ? "עדכון תיעוד" : "הוספת תיעוד"}
        </Button>
      </div>
    </form>
  );
}