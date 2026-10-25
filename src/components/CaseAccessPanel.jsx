import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, UserPlus, X, Loader2 } from "lucide-react";

export default function CaseAccessPanel({ caseItem, onUpdated }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const list = Array.isArray(caseItem.authorized_emails) ? caseItem.authorized_emails : [];

  const add = async () => {
    if (!email.trim()) return;
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageCaseAccess", { case_id: caseItem.id, email: email.trim(), action: "add" });
      setEmail("");
      setMsg("המורשה נוסף וקיבל הזמנה במייל");
      onUpdated?.();
    } catch (e) {
      setMsg("שגיאה: " + (e?.response?.data?.error || e.message || ""));
    } finally { setBusy(false); }
  };

  const remove = async (em) => {
    setBusy(true); setMsg("");
    try {
      await base44.functions.invoke("manageCaseAccess", { case_id: caseItem.id, email: em, action: "remove" });
      setMsg("המורשה הוסר");
      onUpdated?.();
    } catch (e) {
      setMsg("שגיאה: " + (e?.response?.data?.error || e.message || ""));
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4 text-primary" /> מורשים לתיק ({list.length})
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        הוסף מורשה בכתובת מייל — הוא יקבל הזמנה למערכת ויוכל לצפות בתיק זה בלבד, לערוך משימות, ולהעלות ולצפות במסמכים ובתיעוד.
      </p>
      <div className="flex gap-2 mb-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="כתובת מייל של המורשה"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={busy || !email.trim()}>
          {busy ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <UserPlus className="w-4 h-4 ml-1" />} הוסף
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground mb-3">{msg}</p>}
      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((em) => (
            <div key={em} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
              <span className="text-sm truncate">{em}</span>
              <button onClick={() => remove(em)} disabled={busy} className="text-muted-foreground hover:text-destructive transition shrink-0" title="הסר מורשה">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}