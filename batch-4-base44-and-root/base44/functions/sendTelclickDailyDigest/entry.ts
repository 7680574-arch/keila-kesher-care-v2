import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const STATUS_KEYS = ["busy", "ringing", "available_answered", "available_missed", "available", "unavailable", "other"];
const LABELS = {
  busy: "בשיחה",
  ringing: "מצלצל אצלה",
  available_answered: "זמינה · נענתה",
  available_missed: "זמינה · לא נענתה",
  available: "זמין",
  unavailable: "לא זמין",
  other: "אחר",
};
const COLORS = {
  busy: rgb(0.086, 0.639, 0.290),
  ringing: rgb(0.918, 0.502, 0.047),
  available_answered: rgb(0.145, 0.390, 0.922),
  available_missed: rgb(0.863, 0.145, 0.145),
  available: rgb(0.416, 0.451, 0.537),
  unavailable: rgb(0.322, 0.322, 0.357),
  other: rgb(0.659, 0.333, 0.973),
};
const HEX = {
  busy: "#16a34a",
  ringing: "#ea580c",
  available_answered: "#2563eb",
  available_missed: "#dc2626",
  available: "#6a7389",
  unavailable: "#52525b",
  other: "#a855f7",
};

const FONT_URL = "https://cdn.jsdelivr.net/gh/openmaptiles/fonts@master/noto-sans/NotoSansHebrew-Regular.ttf";
let _fontBytes = null;
async function getFont() {
  if (_fontBytes) return _fontBytes;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error("font fetch failed: " + res.status);
  _fontBytes = await res.arrayBuffer();
  return _fontBytes;
}

const israelDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const israelTime = (d) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

const rtl = (s) => String(s == null ? "" : s).split("").reverse().join("");

const fmtDur = (s) => {
  s = Math.round(s || 0);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} min ${r} sec` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
};

function toBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function escapeHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function aggregate(logs) {
  const chrono = [...logs].sort((a, b) => new Date(a.fetched_at) - new Date(b.fetched_at));
  const span = chrono.length;
  const first = span ? new Date(chrono[0].fetched_at) : null;
  const last = span ? new Date(chrono[span - 1].fetched_at) : null;
  const totalSec = first && last ? (last - first) / 1000 : 0;
  const avgInterval = span > 1 ? totalSec / (span - 1) : 0;

  const repMap = new Map();
  chrono.forEach((l) => {
    let reps = [];
    try { reps = JSON.parse(l.reps); } catch (_) {}
    reps.forEach((r) => {
      if (!r.name) return;
      if (!repMap.has(r.name)) repMap.set(r.name, { name: r.name, total: 0, statuses: {} });
      const e = repMap.get(r.name);
      e.total++;
      const k = STATUS_KEYS.includes(r.status) ? r.status : "other";
      e.statuses[k] = (e.statuses[k] || 0) + 1;
    });
  });
  const reps = Array.from(repMap.values()).sort((a, b) => b.total - a.total);
  return { chrono, span, first, last, totalSec, avgInterval, reps };
}

async function buildPdf(data, todayStr) {
  const { reps, span, first, last, avgInterval } = data;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(await getFont(), { subset: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const he = (s) => font.encodeText(rtl(s));
  const heW = (s, size = 10) => font.widthOfTextAtSize(rtl(s), size);

  const PAGE_W = 595.28, PAGE_H = 841.89;
  const M = 40;
  const USABLE = PAGE_W - M * 2;
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - M; };

  page.drawText(he(`סיכום יומי מרכזייה · ${todayStr}`), { x: M, y, size: 16, font, color: rgb(0.047, 0.278, 0.431) });
  y -= 22;
  const rangeTxt = span
    ? `ריענונים: ${span} · טווח ${israelTime(first)}–${israelTime(last)} · ממוצע ${fmtDur(avgInterval)} · עובדות: ${reps.length}`
    : "אין לוגים להיום";
  page.drawText(he(rangeTxt), { x: M, y, size: 10, font, color: rgb(0.4, 0.45, 0.55) });
  y -= 26;

  let lx = M;
  STATUS_KEYS.forEach((k) => {
    if (lx > PAGE_W - M - 80) { lx = M; y -= 14; }
    page.drawRectangle({ x: lx, y, size: 10, color: COLORS[k] });
    page.drawText(he(LABELS[k]), { x: lx + 14, y: y + 1, size: 9, font, color: rgb(0.2, 0.23, 0.29) });
    lx += 14 + heW(LABELS[k], 9) + 16;
  });
  y -= 24;

  const BAR_H = 16;
  reps.forEach((r) => {
    if (y < 90) { newPage(); }
    page.drawText(he(r.name), { x: M, y, size: 11, font, color: rgb(0.1, 0.13, 0.18) });
    const totalLabel = `סהכ ${r.total} · ${fmtDur(r.total * avgInterval)}`;
    const tw = heW(totalLabel, 9);
    page.drawText(he(totalLabel), { x: PAGE_W - M - tw, y, size: 9, font, color: rgb(0.4, 0.45, 0.55) });
    y -= 6;
    const barY = y - BAR_H;
    page.drawRectangle({ x: M, y: barY, width: USABLE, height: BAR_H, color: rgb(0.93, 0.94, 0.96) });
    let bx = M;
    STATUS_KEYS.forEach((k) => {
      const c = r.statuses[k] || 0;
      if (!c) return;
      const w = (c / r.total) * USABLE;
      page.drawRectangle({ x: bx, y: barY, width: w, height: BAR_H, color: COLORS[k] });
      bx += w;
    });
    page.drawRectangle({ x: M, y: barY, width: USABLE, height: BAR_H, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.5 });
    y = barY - 12;
    const parts = STATUS_KEYS.filter((k) => r.statuses[k]).map((k) => `${LABELS[k]} ${r.statuses[k]}`);
    page.drawText(he(parts.join(" · ")), { x: M, y, size: 8.5, font, color: rgb(0.35, 0.4, 0.46) });
    y -= 30;
  });

  if (y < 120) newPage();
  y -= 6;
  page.drawText(he("טבלת סיכום לפי עובדת"), { x: M, y, size: 13, font, color: rgb(0.047, 0.278, 0.431) });
  y -= 18;

  const colDefs = [
    { key: "name", label: "עובדת", width: 130, he: true },
    { key: "total", label: "סהכ", width: 44 },
    { key: "busy", label: "בשיחה", width: 52, he: true },
    { key: "ringing", label: "מצלצל", width: 52, he: true },
    { key: "available_answered", label: "נענתה", width: 52, he: true },
    { key: "available_missed", label: "לא נענתה", width: 56, he: true },
    { key: "available", label: "זמין", width: 44, he: true },
    { key: "unavailable", label: "לא זמין", width: 54, he: true },
    { key: "other", label: "אחר", width: 40, he: true },
  ];
  const totalW = colDefs.reduce((s, c) => s + c.width, 0);
  const startX = M + Math.max(0, USABLE - totalW);
  const colX = [];
  let acc = startX;
  colDefs.forEach((c) => { colX.push(acc); acc += c.width; });

  const rowH = 20;
  const drawHeader = () => {
    page.drawRectangle({ x: startX, y: y - rowH + 4, width: totalW, height: rowH, color: rgb(0.93, 0.95, 0.97) });
    colDefs.forEach((c, i) => {
      if (c.he) {
        const w = font.widthOfTextAtSize(rtl(c.label), 9);
        page.drawText(he(c.label), { x: colX[i] + (c.width - w) / 2, y: y - rowH + 9, size: 9, font, color: rgb(0.1, 0.13, 0.18) });
      } else {
        const w = helv.widthOfTextAtSize(c.label, 9);
        page.drawText(helv.encodeText(c.label), { x: colX[i] + (c.width - w) / 2, y: y - rowH + 9, size: 9, font: helv, color: rgb(0.1, 0.13, 0.18) });
      }
    });
    y -= rowH;
  };
  drawHeader();

  reps.forEach((r, idx) => {
    if (y < M + rowH + 20) { newPage(); drawHeader(); }
    if (idx % 2 === 1) {
      page.drawRectangle({ x: startX, y: y - rowH + 4, width: totalW, height: rowH, color: rgb(0.97, 0.98, 0.99) });
    }
    colDefs.forEach((c, i) => {
      const val = c.key === "name" ? r.name : (c.key === "total" ? r.total : (r.statuses[c.key] || 0));
      const txt = String(val);
      if (c.he) {
        const w = font.widthOfTextAtSize(rtl(txt), 9);
        page.drawText(he(txt), { x: colX[i] + (c.width - w) / 2, y: y - rowH + 9, size: 9, font, color: rgb(0.15, 0.18, 0.23) });
      } else {
        const w = helv.widthOfTextAtSize(txt, 9);
        page.drawText(helv.encodeText(txt), { x: colX[i] + (c.width - w) / 2, y: y - rowH + 9, size: 9, font: helv, color: rgb(0.15, 0.18, 0.23) });
      }
    });
    y -= rowH;
  });
  page.drawRectangle({ x: startX, y: y, width: totalW, height: (reps.length + 1) * rowH, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.5 });

  page.drawText(he(`הופק אוטומטית · ${new Date().toLocaleString("he-IL")}`), { x: M, y: 24, size: 8, font, color: rgb(0.6, 0.63, 0.68) });

  const bytes = await doc.save();
  return new Uint8Array(bytes);
}

function buildHtml(data, todayStr) {
  const { reps, span, first, last, avgInterval } = data;
  const fmtDate = new Date(todayStr + "T00:00:00").toLocaleDateString("he-IL");
  const bars = reps.map((r) => {
    const segs = STATUS_KEYS.map((k) => {
      const c = r.statuses[k] || 0;
      if (!c) return "";
      const pct = (c / r.total) * 100;
      return `<div title="${LABELS[k]}: ${c}" style="background:${HEX[k]};width:${pct}%;height:100%;"></div>`;
    }).join("");
    const counts = STATUS_KEYS.filter((k) => r.statuses[k]).map((k) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;margin-left:10px;font-size:12px;color:#475569"><span style="width:8px;height:8px;border-radius:2px;background:${HEX[k]};display:inline-block"></span>${LABELS[k]} ${r.statuses[k]}</span>`).join("");
    return `<div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div style="font-weight:700;font-size:15px;color:#0f172a">${escapeHtml(r.name)}</div>
        <div style="font-size:12px;color:#64748b">סהכ ${r.total} · ${fmtDur(r.total * avgInterval)}</div>
      </div>
      <div style="display:flex;width:100%;height:22px;border-radius:6px;overflow:hidden;background:#eef2f6">${segs}</div>
      <div style="margin-top:4px">${counts}</div>
    </div>`;
  }).join("");

  const tableRows = reps.map((r) => `<tr>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600">${escapeHtml(r.name)}</td>
    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${r.total}</td>
    ${STATUS_KEYS.map((k) => `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:${HEX[k]}">${r.statuses[k] || 0}</td>`).join("")}
  </tr>`).join("");

  return `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;max-width:680px;margin:0 auto;background:#fbfcfd;padding:24px">
    <div style="background:#14688f;padding:20px 24px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">סיכום יומי מרכזייה · ${fmtDate}</h1>
      <p style="color:#cfe8f3;margin:6px 0 0;font-size:14px">${span ? `ריענונים: ${span} · טווח ${israelTime(first)}–${israelTime(last)} · עובדות: ${reps.length}` : "אין לוגים להיום"}</p>
    </div>
    <div style="background:#fff;padding:20px 24px;border-radius:0 0 12px 12px;border:1px solid #dfe5ec;border-top:0">
      ${reps.length ? bars : '<p style="text-align:center;color:#64748b;padding:24px">אין לוגים להיום.</p>'}
      ${reps.length ? `<h2 style="font-size:16px;color:#14688f;margin:20px 0 10px">טבלת סיכום</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#0f172a">
        <thead><tr style="background:#eef4f8">
          <th style="padding:10px;text-align:right">עובדת</th>
          <th style="padding:10px;text-align:center">סהכ</th>
          ${STATUS_KEYS.map((k) => `<th style="padding:10px;text-align:center;color:${HEX[k]}">${LABELS[k]}</th>`).join("")}
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>` : ""}
      <a href="https://keila-kesher-care.base44.app/telclick" style="display:inline-block;margin-top:18px;background:#14688f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;">מעבר למוניטור המרכזייה</a>
      <p style="font-size:12px;color:#64748b;margin-top:18px">מצורף קובץ PDF עם הטבלה והגרפים. הודעה אוטומטית ממערכת קהילה-קשר.</p>
    </div>
  </div>`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    let body = null;
    try { body = await req.json(); } catch (_) {}

    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}

    let authed = false;
    if (user && user.role === "admin") {
      authed = true;
    } else {
      const expected = secrets.get("TELCLICK_WORKFLOW_SECRET");
      const given = (body && body.secret) || req.headers.get("x-telclick-secret");
      if (expected && given === expected) authed = true;
    }
    if (!authed) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const today = israelDate();
    const start = new Date(today + "T00:00:00"); start.setDate(start.getDate() - 1);
    const end = new Date(today + "T00:00:00"); end.setDate(end.getDate() + 1);
    const { items } = await base44.asServiceRole.entities.TelclickLog.filter(
      { fetched_at: { $gte: start.toISOString(), $lt: end.toISOString() } },
      { sort: "fetched_at", limit: 5000 }
    );
    const logs = items.filter((l) => israelDate(new Date(l.fetched_at)) === today);
    const data = aggregate(logs);

    let recipients = [];
    if (body && body.to) recipients = [body.to];
    else if (user && user.email) recipients = [user.email];
    else {
      const users = await base44.asServiceRole.entities.User.list();
      recipients = users.filter((u) => u.role === "admin" && u.email).map((u) => u.email);
    }
    if (!recipients.length) return Response.json({ error: "no recipients" }, { status: 400 });

    const html = buildHtml(data, today);
    let pdfBytes = null;
    try { pdfBytes = await buildPdf(data, today); } catch (e) { /* PDF optional */ }

    const subject = `סיכום יומי מרכזייה · ${new Date(today + "T00:00:00").toLocaleDateString("he-IL")}`;
    const attachments = pdfBytes
      ? [{ filename: `telclick_daily_${today}.pdf`, content: toBase64(pdfBytes) }]
      : undefined;

    let sent = 0;
    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          html,
          from_name: "מרכז קהילה",
          attachments,
        });
        sent++;
      } catch (_) {}
    }

    return Response.json({ sent, recipients, logs: logs.length, reps: data.reps.length, today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}