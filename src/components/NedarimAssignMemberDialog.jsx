import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import MemberPicker from "@/components/MemberPicker";
import { bestEntityMatch } from "@/lib/nedarimMatch";

const fmtAmount = (n, currency) => {
  const sym = currency === 2 ? "$" : "₪";
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + sym + Math.abs(v).toLocaleString("he-IL");
};

// דיאלוג שיוך רשומת נדרים (בעיקר הו"ק בנקאי ללא ת"ז) לחבר קהילה או לתורם מרשימת התורמים.
export default function NedarimAssignMemberDialog({ open, onOpenChange, record, onAssigned }) {
  const [members, setMembers] = useState([]);
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [entityId, setEntityId] = useState(null);
  const [pickKind, setPickKind] = useState("member");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [suggestion, setSuggestion] = useState(null); // { reason }
  const [lastNumMap, setLastNumMap] = useState({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr("");
    Promise.all([
      base44.entities.CommunityMember.filter(
        {}, { limit: 3000, fields: ["name", "id_number", "phone", "mobile"] }
      ),
      base44.entities.Donor.filter(
        {}, { sort: "name", limit: 3000, fields: ["name", "id_number", "phone", "mobile", "address"] }
      ),
    ])
      .then(([mp, dp]) => {
        setMembers(mp.items || []);
        setDonors(dp.items || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => { setEntityId(null); setPickKind("member"); setErr(""); setSuggestion(null); }, [open, record?.id]);

  // כרטיס אשראי (4 ספרות) ששויך בעבר לת"ז מסוימת - משמש להצעה
  useEffect(() => {
    if (!open || !record?.last_num) { setLastNumMap({}); return; }
    base44.entities.NedarimDonation.filter(
      { last_num: record.last_num, zeout: { $nin: ["", null] } },
      { fields: ["last_num", "zeout"], limit: 1 }
    )
      .then((p) => {
        const r = (p.items || [])[0];
        setLastNumMap(r ? { [r.last_num]: r.zeout } : {});
      })
      .catch(() => setLastNumMap({}));
  }, [open, record?.id, record?.last_num]);

  // בחירה אוטומטית של ההצעה הכי מתאימה (שם / טלפון / כרטיס), אלא אם המשתמש כבר בחר
  useEffect(() => {
    if (!open || !record || loading || entityId) return;
    if (!members.length && !donors.length) return;
    const res = bestEntityMatch(record, members, donors, lastNumMap);
    if (res) {
      setEntityId(res.entity.id);
      setPickKind(res.kind);
      setSuggestion({ reason: res.reason });
    }
  }, [open, record, loading, members, donors, lastNumMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const combined = useMemo(
    () => [
      ...members.map((m) => ({ ...m, _tag: null })),
      ...donors.map((d) => ({ ...d, _tag: "תורם" })),
    ],
    [members, donors]
  );

  const selectedMember = members.find((m) => m.id === entityId);
  const selectedDonor = donors.find((d) => d.id === entityId);
  const kind = pickKind;

  const addDonorFromRecord = async () => {
    if (!record) return;
    const parts = [];
    if (record.last_num) parts.push(`כרטיס ••${record.last_num}`);
    if (record.keva_id) parts.push(`הו"ק ${record.keva_id}`);
    try {
      const d = await base44.entities.Donor.create({
        name: record.client_name || "תורם ללא שם",
        id_number: record.zeout || null,
        phone: record.phone || null,
        address: record.address || null,
        notes: parts.join(" · ") || null,
        source: "nedarim",
      });
      setDonors((prev) => [d, ...prev]);
      setEntityId(d.id);
      setPickKind("donor");
      setSuggestion(null);
    } catch (e) {
      setErr(e.message);
    }
  };

  const confirm = async () => {
    if (!record) return;
    const member = kind === "member" ? selectedMember : null;
    const donor = kind === "donor" ? selectedDonor : null;
    if (kind === "member" && !member) return;
    if (kind === "donor" && !donor) return;
    if (kind === "member" && !member.id_number) {
      setErr('חבר הקהילה שנבחר אינו מכיל ת"ז. נא להשלים ת"ז בכרטיס החבר ולנסות שוב.');
      return;
    }
    setSaving(true);
    setErr("");
    try {
      // שאילתת בלק לפי סוג שיוך:
      // - תורם: כל חיובי ההו"ק ללא תורם, כולל אחים עם אותה ת"ז (שומרים את הת"ז — לא מוחקים).
      // - חבר קהילה: רק חיובים ללא ת"ז וללא תורם (מציבים את ת"ז חבר הקהילה).
      const donorBulk = record.keva_id
        ? (record.zeout
            ? { keva_id: record.keva_id, donor_id: { $in: ["", null] }, $or: [{ zeout: { $in: ["", null] } }, { zeout: record.zeout }] }
            : { keva_id: record.keva_id, donor_id: { $in: ["", null] } })
        : null;
      const memberBulk = record.keva_id
        ? { keva_id: record.keva_id, zeout: { $in: ["", null] }, donor_id: { $in: ["", null] } }
        : null;
      const bulkQuery = kind === "donor" ? donorBulk : memberBulk;
      let bulkCount = 1;
      if (bulkQuery) {
        try {
          const c = await base44.entities.NedarimDonation.count(bulkQuery);
          bulkCount = Number(c) || 1;
        } catch {}
      }
      if (kind === "donor") {
        const donorId = donor.id;
        await base44.entities.NedarimDonation.update(record.id, { donor_id: donorId, manual_assigned: true });
        if (donorBulk) {
          let more = true;
          let guard = 0;
          while (more && guard < 10) {
            const res = await base44.entities.NedarimDonation.updateMany(donorBulk, { $set: { donor_id: donorId, manual_assigned: true } });
            more = !!res?.has_more;
            guard++;
          }
        }
        onAssigned?.(record.id, null, donor.name, record.keva_id, bulkCount, "donor", donorId);
      } else {
        const zeout = member.id_number;
        await base44.entities.NedarimDonation.update(record.id, { zeout, manual_assigned: true });
        if (memberBulk) {
          let more = true;
          let guard = 0;
          while (more && guard < 10) {
            const res = await base44.entities.NedarimDonation.updateMany(memberBulk, { $set: { zeout, manual_assigned: true } });
            more = !!res?.has_more;
            guard++;
          }
        }
        onAssigned?.(record.id, zeout, member.name, record.keva_id, bulkCount, "member", null);
      }
      onOpenChange(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>שיוך חיוב לחבר קהילה / תורם</DialogTitle>
        </DialogHeader>
        {record && (
          <div className="text-sm space-y-1 text-muted-foreground bg-muted/30 rounded-lg p-3">
            <p>תורם: <span className="text-foreground font-medium">{record.client_name || "—"}</span></p>
            <p>סכום: <span className="text-foreground font-medium">{fmtAmount(record.amount, record.currency)}</span></p>
            <p>תאריך: <span className="text-foreground font-medium">{record.transaction_date || "—"}</span></p>
            {record.keva_id && <p>הו״ק: <span className="text-foreground font-medium tabular-nums">{record.keva_id}</span></p>}
          </div>
        )}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">בחר/י חבר קהילה או תורם מהרשימה. לתורם שאינו בקהילה ניתן ללחוץ "הוסף לרשימת התורמים".</p>
          {record?.keva_id && (
            <p className="text-xs text-primary/80 bg-primary/5 rounded-md px-2 py-1.5">כל החיובים עם אותו מספר הו״ק ({record.keva_id}) ישויכו אוטומטית לאותו נמען.</p>
          )}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex-1">
                <MemberPicker
                  value={entityId}
                  onChange={(mid) => {
                    setEntityId(mid);
                    setPickKind(donors.some((d) => d.id === mid) ? "donor" : "member");
                    setSuggestion(null);
                  }}
                  members={combined}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0" onClick={addDonorFromRecord} title="הוסף לרשימת התורמים">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          )}
          {suggestion && (
            <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 bg-primary/5 rounded px-1.5 py-0.5">
              ✨ הצעה אוטומטית{suggestion.reason ? ` — ${suggestion.reason}` : ""}
            </span>
          )}
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={confirm} disabled={(!selectedMember && !selectedDonor) || saving || loading}>
            {saving ? "שומר..." : "שייך"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}