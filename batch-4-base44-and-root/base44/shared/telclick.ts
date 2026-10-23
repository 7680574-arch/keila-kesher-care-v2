export const MONITOR_URL = "https://app.telclick.co.il/V3/live_monitor.php?from=0&count=62&size=15&w=1280&h=768&wc=4&hc=4&fx=6&demo=no&code=f631d8a88ebd33d521445e8faf51f50e&all=no&sp=20&not=5&get=1";

export function statusFrom(color) {
  const c = (color || "").toLowerCase();
  if (c === "0bc319") return { status: "busy", statusLabel: "בשיחה" };
  if (c === "e88e06") return { status: "ringing", statusLabel: "מצלצל אצלה" };
  if (c === "4c6db9") return { status: "available_answered", statusLabel: "זמינה · נענתה" };
  if (c === "dc2020") return { status: "available_missed", statusLabel: "זמינה · לא נענתה" };
  if (c === "6a7389") return { status: "available", statusLabel: "זמין" };
  if (c === "6d6d6d") return { status: "unavailable", statusLabel: "לא זמין" };
  if (c === "e4e4e4") return { status: "empty", statusLabel: "—" };
  return { status: "other", statusLabel: "אחר" };
}

export function parseTelclick(html) {
  const blocks = html.split('<div id="hcbr"').slice(1);
  const reps = [];
  for (const block of blocks) {
    const colorM = block.match(/border-bottom:[^;]*solid\s*#([0-9a-fA-F]+)/);
    const nameM = block.match(/<div id="hcbrtext"[^>]*>\s*([^<]+?)\s*</);
    const durM = block.match(/<div id="hcbrtexts">\s*([0-9:]+)/);
    const dirM = block.match(/16x16\/v3\/(in|out)\.png/);
    const phoneM = block.match(/([0-9]{2,})<br>/);
    const spanM = block.match(/<span>([^<]*)<\/span>/);
    const name = nameM ? nameM[1].trim() : "";
    if (!name) continue;
    const lastCall = spanM ? spanM[1].trim() : "";
    const color = colorM ? colorM[1] : "";
    const { status, statusLabel } = statusFrom(color);
    reps.push({
      name,
      duration: durM ? durM[1] : "",
      direction: dirM ? (dirM[1] === "in" ? "נכנסת" : "יוצאת") : "",
      phone: phoneM ? phoneM[1] : "",
      lastCall,
      color,
      status,
      statusLabel,
    });
  }
  return reps;
}

export async function fetchMonitor() {
  const res = await fetch(MONITOR_URL, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
  if (!res.ok) throw new Error("Telclick fetch failed: " + res.status);
  const html = await res.text();
  return parseTelclick(html);
}