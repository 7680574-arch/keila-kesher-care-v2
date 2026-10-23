import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

export default function ManualAssignmentUndo({ record, onUpdated }) {
  const [saving, setSaving] = useState(false);
  if (!record.manual_assigned || (!record.zeout && !record.donor_id)) return null;

  const undo = async () => {
    const label = record.keva_id ? `החיובים ששויכו ידנית לאותו נמען בהו״ק ${record.keva_id}` : "החיוב ששויך ידנית";
    if (!window.confirm(`לבטל את השיוך של ${label}?`)) return;
    setSaving(true);
    try {
      const target = record.donor_id ? { donor_id: record.donor_id } : { zeout: record.zeout, donor_id: { $in: ["", null] } };
      const query = { manual_assigned: true, ...target, ...(record.keva_id ? { keva_id: record.keva_id } : { id: record.id }) };
      // בשיוך לתורם הת"ז המקורית מנדרים נשארת ללא שינוי.
      const cleared = record.donor_id ? { donor_id: "", manual_assigned: false } : { zeout: "", manual_assigned: false };
      let more;
      do {
        const result = await base44.entities.NedarimDonation.updateMany(query, { $set: cleared });
        more = !!result.has_more;
      } while (more);
      await onUpdated();
      toast({ title: "השיוך הידני בוטל" });
    } catch (error) {
      toast({ title: "שגיאה בביטול השיוך", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return <button type="button" onClick={undo} disabled={saving} className="text-[11px] text-muted-foreground hover:text-destructive underline disabled:opacity-50" title="בטל שיוך ידני">{saving ? "מבטל..." : "בטל"}</button>;
}