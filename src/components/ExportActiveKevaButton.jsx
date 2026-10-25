import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { rowsToCsv, downloadCsv } from "@/lib/exportCsv";

const MIN_AMOUNT = 300;
const MONTHS_BACK = 3;

function sinceISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - MONTHS_BACK);
  return d.toISOString().slice(0, 10);
}

async function fetchCharges() {
  const query = {
    currency: 1,
    amount: { $gte: MIN_AMOUNT },
    transaction_date: { $gte: sinceISO() },
    transaction_type: { $in: ['הו"ק', 'הו"ק בנקאי'] },
  };
  let all = [];
  let cursor;
  do {
    const page = await base44.entities.NedarimDonation.filter(query, { sort: "-transaction_date", limit: 1000, cursor });
    all = all.concat(page.items || []);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return all;
}

function groupByKeva(charges) {
  const map = new Map();
  charges.forEach((r) => {
    const keva = String(r.keva_id || "");
    if (keva.startsWith("-")) return;
    const key = keva || `name:${r.client_name}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r, charges_count: 1 });
      return;
    }
    const latest = (r.transaction_date || "") > (prev.transaction_date || "") ? r : prev;
    map.set(key, { ...latest, charges_count: prev.charges_count + 1 });
  });
  return Array.from(map.values()).sort((a, b) => (a.client_name || "").localeCompare(b.client_name || "", "he"));
}

const COLUMNS = [
  { header: "שם", get: (r) => r.client_name },
  { header: "ת\"ז", get: (r) => r.zeout },
  { header: "טלפון", get: (r) => r.phone },
  { header: "כתובת", get: (r) => r.address },
  { header: "מספר הו\"ק", get: (r) => r.keva_id },
  { header: "סוג", get: (r) => r.transaction_type },
  { header: "סכום חיוב אחרון (₪)", get: (r) => r.amount },
  { header: "תאריך חיוב אחרון", get: (r) => r.transaction_date },
  { header: "מספר חיובים ב-3 חודשים", get: (r) => r.charges_count },
  { header: "קטגוריה", get: (r) => r.groupe },
];

export default function ExportActiveKevaButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const exportNow = async () => {
    setLoading(true);
    try {
      const rows = groupByKeva(await fetchCharges());
      if (rows.length === 0) {
        toast({ title: "אין בעלי הו״ק פעילים לייצוא" });
        return;
      }
      downloadCsv(`בעלי-הוק-פעילים-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(rows, COLUMNS));
      toast({ title: "הקובץ הורד", description: `${rows.length} בעלי הו״ק פעילים` });
    } catch (e) {
      toast({ title: "שגיאה בייצוא", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={exportNow} disabled={loading} title="בעלי הו״ק בשקלים מ-300 ₪ ומעלה שחויבו ב-3 החודשים האחרונים">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      ייצוא הו״ק פעילים לאקסל
    </Button>
  );
}