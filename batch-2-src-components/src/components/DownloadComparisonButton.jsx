import React, { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import {
  FIELD_MAP_691, parseFormChildren, parseMemberChildren,
  childrenEqual, compareField, norm, normId,
} from "@/lib/formFieldMap";

const esc = (s) => String(s ?? "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");

const STATUS_PILL = {
  same: '<span class="pill ok">זהה</span>',
  diff: '<span class="pill no">שונה ⚠</span>',
  only_form: '<span class="pill partial">ריק ברשימה</span>',
  only_member: '<span class="pill meta">ריק בטופס</span>',
  both_empty: '<span class="pill mute">—</span>',
};

const fetchAllFormRecords = async (configId, tofesId) => {
  const all = [];
  let lastId = 0;
  for (let i = 0; i < 40; i++) {
    const res = await base44.functions.invoke("nedarimForms", { configId, tofesId, lastId, maxId: 500 });
    const data = res.data || res;
    if (data.error) throw new Error(data.error);
    const recs = Array.isArray(data.records) ? data.records : [];
    all.push(...recs);
    if (!data.hasMore) break;
    lastId = data.lastId;
  }
  return all;
};

const buildReport = (members, formRecs, finMap, fYear) => {
  const byId = {};
  for (const m of members) {
    const id = normId(m.id_number);
    if (id) byId[id] = m;
  }
  const matched = [];
  const formOnly = [];
  for (const rec of formRecs) {
    const id = normId(rec.Field3);
    if (!id) continue;
    const m = byId[id];
    if (m) matched.push({ rec, member: m });
    else formOnly.push(rec);
  }

  // שדות רלוונטיים להחלטת דריסה: פרטי זהות/כתובת/טלפון (חבר + בן/בת זוג), מספר ילדים, סכומי הכנסות/הוצאות
  const RELEVANT = {
    Field1: true, Field2: true, Field3: true, Field4: true, Field5: true, Field6: true,
    Field8: true, Field9: true, Field10: true, Field11: true,
    Field12: true, Field13: true, Field14: true, Field15: true, Field16: true,
    Field90: true,
    Field94: true, Field93: true, Field95: true, Field96: true, Field97: true,
    Field100: true, Field1Max: true, Field98: true, Field89: true,
  };
  const DECISION = new Set(["diff", "only_form", "only_member"]);

  const rows = [];
  let withDiffs = 0;

  for (const { rec, member } of matched) {
    const fin = finMap[`${normId(member.id_number)}|${fYear}`] || null;
    const diffRows = [];

    for (const [code, map] of Object.entries(FIELD_MAP_691)) {
      if (!RELEVANT[code]) continue;
      const formVal = rec[code] ?? "";
      let memberVal = "";
      if (map.ent === "member") memberVal = member[map.field] ?? "";
      else if (map.ent === "fin") memberVal = fin ? (fin[map.field] ?? "") : "";
      const status = compareField(formVal, memberVal);
      if (!DECISION.has(status)) continue;
      diffRows.push(`<tr class="${status}"><td>${esc(map.label)}${map.partial ? `<br><small>${esc(map.partial)}</small>` : ""}</td><td>${esc(formVal) || "—"}</td><td>${esc(memberVal) || "—"}</td>${STATUS_PILL[status]}</tr>`);
    }

    // ילדים — מספר או פרטים שונים
    const formKids = parseFormChildren(rec);
    const memberKids = parseMemberChildren(member.children_json);
    const kidsSame = childrenEqual(formKids, memberKids);
    const kidStatus = formKids.length === 0 && memberKids.length === 0 ? "both_empty" : kidsSame ? "same" : "diff";
    if (DECISION.has(kidStatus)) {
      diffRows.push(`<tr class="${kidStatus}"><td>פרטי ילדים (${formKids.length} בטופס / ${memberKids.length} ברשימה)</td><td>${formKids.map((k) => esc(`${k.name} ${k.id_number || ""} ${k.birth_date || ""} ${k.gender || ""}`)).join("<br>") || "—"}</td><td>${memberKids.map((k) => esc(`${k.name} ${k.id_number || ""} ${k.birth_date || ""} ${k.gender || ""}`)).join("<br>") || "—"}</td>${STATUS_PILL[kidStatus]}</tr>`);
    }

    if (!diffRows.length) continue;
    withDiffs++;
    rows.push(`<section class="mem">
      <h3>${esc(member.name || "")} <span class="id">· ת.ז. ${esc(member.id_number || "")}</span></h3>
      <table><thead><tr><th>שדה</th><th>בטופס</th><th>ברשימת הקהילה</th><th>סטטוס</th></tr></thead><tbody>${diffRows.join("")}</tbody></table></section>`);
  }

  // חברים ברשימה שאין להם רשומת טופס
  const memberIds = new Set(matched.map((x) => normId(x.member.id_number)));
  const memberOnly = members.filter((m) => normId(m.id_number) && !memberIds.has(normId(m.id_number)));

  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>השוואת נתונים — טופס מול רשימת קהילה</title>
<style>
  :root{--primary:#14688f;--border:#dfe5ec;--muted:#65758b;--bg:#fbfcfd}
  *{box-sizing:border-box}
  body{margin:0;font-family:"Heebo",Arial,sans-serif;background:var(--bg);color:#1f2937;line-height:1.6}
  .wrap{max-width:1200px;margin:0 auto;padding:24px 20px 64px}
  h1{font-size:26px;color:var(--primary);margin:0 0 6px}
  .sub{color:var(--muted);font-size:14px;margin:0 0 16px}
  .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0 24px}
  .card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px}
  .card .n{font-size:26px;font-weight:700;line-height:1}
  .card .l{color:var(--muted);font-size:12px;margin-top:4px}
  .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin:10px 0 20px}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .dot{width:10px;height:10px;border-radius:999px;display:inline-block}
  section.mem{background:#fff;border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:14px 0}
  section.mem h3{margin:0 0 10px;font-size:16px;color:var(--primary)}
  section.mem h3 .id{color:var(--muted);font-weight:400;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
  th,td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--border);vertical-align:top}
  th{background:#f1f5f9;font-weight:700;color:#334155;font-size:11px}
  tr.same{background:#f0fdf4}tr.diff{background:#fef2f2}tr.only_form{background:#fffbeb}tr.only_member{background:#f5f3ff}tr.both_empty{opacity:.6}
  .pill{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:600;white-space:nowrap}
  .ok{background:#d1fae5;color:#065f46}.no{background:#fee2e2;color:#991b1b}.partial{background:#fef3c7;color:#92400e}.meta{background:#e0e7ff;color:#3730a3}.mute{background:#f1f5f9;color:#64748b}
  small{color:var(--muted);font-weight:400}
  .nomatch{margin-top:24px}
  .nomatch ul{columns:3;font-size:12px;color:var(--muted)}
  footer{margin-top:32px;color:var(--muted);font-size:11px;border-top:1px solid var(--border);padding-top:12px}
</style></head><body><div class="wrap">
<h1>השוואת נתונים — רק חברים עם הבדלים</h1>
<p class="sub">מוצגים רק חברים שיש להם הבדל בפרטי זהות/כתובת/טלפון (של החבר ושל בן/בת הזוג), במספר הילדים או בסכומי הכנסות/הוצאות. שאר החברים אינם מופיעים.</p>
<div class="summary">
  <div class="card"><div class="n">${withDiffs}</div><div class="l">חברים עם הבדלים לבדיקה</div></div>
  <div class="card"><div class="n">${matched.length - withDiffs}</div><div class="l">זהים לחלוטין (לא מוצגים)</div></div>
  <div class="card"><div class="n">${formOnly.length}</div><div class="l">בטופס ללא רשומה ברשימה</div></div>
</div>
<div class="legend">
  <span><i class="dot" style="background:#d1fae5"></i> זהה</span>
  <span><i class="dot" style="background:#fee2e2"></i> שונה — נדרשת החלטה</span>
  <span><i class="dot" style="background:#fef3c7"></i> ריק ברשימה (יתווסק מהטופס)</span>
  <span><i class="dot" style="background:#e0e7ff"></i> ריק בטופס (יישמר הקיים)</span>
</div>
${withDiffs ? rows.join("") : `<section class="mem"><p style="margin:0;color:var(--muted)">לא נמצאו הבדלים בשדות הרלוונטיים (פרטי זהות/כתובת/טלפון, ילדים, סכומים). אין מה לדרוס.</p></section>`}
${memberOnly.length ? `<div class="nomatch"><h3>ברשימה ללא רשומת טופס (${memberOnly.length})</h3><ul>${memberOnly.map((m) => `<li>${esc(m.name || "")} · ${esc(m.id_number || "")}</li>`).join("")}</ul></div>` : ""}
<footer>נוצר אוטומטית · מערכת קהילה-קשר · נתונים כלכליים משנת ${esc(fYear)}</footer>
</div></body></html>`;
};

export default function DownloadComparisonButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const run = async () => {
    setBusy(true);
    setStatus("טוען הגדרות טפסים...");
    try {
      const configs = await base44.entities.FormConfig.list("-created_date", 200);
      const cfg = (configs || []).find((c) => String(c.tofes_id) === "691");
      if (!cfg) throw new Error("לא נמצא טופס 691 בהגדרות");

      setStatus("טוען רשומות טופס מנדרים פלוס...");
      const formRecs = await fetchAllFormRecords(cfg.id, cfg.tofes_id);

      setStatus("טוען רשימת קהילה ונתונים כלכליים...");
      const [members, fin] = await Promise.all([
        base44.entities.CommunityMember.list("-created_date", 3000),
        base44.entities.CommunityFinance.list("-year", 3000).catch(() => []),
      ]);

      const years = Array.from(new Set((fin || []).map((f) => f.year).filter(Boolean))).sort().reverse();
      const fYear = years[0] || "";
      const finMap = {};
      for (const f of fin || []) {
        const d = normId(f.id_number);
        if (d) finMap[`${d}|${f.year}`] = f;
      }

      setStatus("בונה דוח...");
      const html = buildReport(members || [], formRecs, finMap, fYear);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "השוואת_נתונים_טופס_מול_רשימה.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || "שגיאה בהפקת הדוח");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <Button variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <FileDown className="w-4 h-4 ml-1" />}
      {busy ? (status || "מכין דוח...") : "השוואת נתונים בפועל"}
    </Button>
  );
}