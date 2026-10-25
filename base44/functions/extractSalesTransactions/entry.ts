import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "מספר הזמנה" },
          transaction_date: { type: "string", description: "YYYY-MM-DD" },
          transaction_time: { type: "string", description: "HH:MM" },
          customer_name: { type: "string", description: "שם לקוח" },
          department: { type: "string", description: "מחלקה" },
          product_name: { type: "string", description: "שם מוצר" },
          sku: { type: "string", description: "קוד מוצר" },
          quantity: { type: "number", description: "כמות, יכול להיות שלילי" },
          unit_price: { type: "number", description: "מחיר יחידה" },
          line_total: { type: "number", description: "סכום שורה" },
        },
        required: ["product_name"],
      },
    },
  },
};

const PROMPT = [
  "הקובץ המצורף הוא דוח תנועות מכירה שמיוצא מאקסל ״בלי קווים״, בעברית (כיווניות RTL).",
  "מבנה הקובץ:",
  "1) בלוק טקסט עברי: שמות מוצרים מופיעים כל אחד בשורה משלו, וביניהם חוזרת שורת שם הלקוח והמחלקה (למשל ״בריכטא חנה גן חובה״). שמות המוצרים מופיעים בסדר זהה לסדר השורות בטבלה המספרית.",
  "2) טבלה מספרית: כל שורה מכילה עמודות בסדר: סכום שורה, מחיר יחידה, כמות, קוד מוצר (sku), תאריך ושעה (DD/MM/YYYY HH:MM), מספר הזמנה, מספר שורה.",
  "בחלק מהשורות עמודת שם המוצר בתוך הטבלה מופיעה משובשת (תווים זרים) — התעלם ממנה והשתמש בשם המוצר מהבלוק הטקסטואלי לפי הסדר.",
  "שם הלקוח והמחלקה חוזרים על עצמם לכל השורות (אותו לקוח לכל ההזמנה).",
  "משימה: חלץ את כל שורות המכירה ללא יוצא מן הכלל — גם אם יש עשרות או מאות שורות ומספר עמודים, אסור לדלג על אף שורה ואסור לקצר/לסכם. עבור על כל עמוד ועל כל שורה במסמך אחת לאחת מתחילתו ועד סופו. התאם כל שם מוצר מהבלוק הטקסטואלי לשורה המתאימה בטבלה לפי סדר הופעתן.",
  "תאריך בפורמט YYYY-MM-DD, שעה HH:MM. כמות/מחיר/סכום כמספרים (כמות שלילית = זיכוי). התעלם משורות שהן רק כותרות, סיכומים או שורות ריקות.",
  "חשוב מאוד: מספר השורות שתחזיר חייב להיות שווה למספר שורות הנתונים הקיימות בפועל במסמך (כל מספרי השורה הרציפים שמופיעים בטבלה המספרית) — ודא שלא חסר אף מספר שורה.",
].join(" ");

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'user') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { file_url } = body;
    if (!file_url || typeof file_url !== 'string') {
      return Response.json({ error: 'חסר כתובת קובץ' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT,
      file_urls: [file_url],
      response_json_schema: SCHEMA,
      model: "claude-sonnet-5",
    });
    console.log("InvokeLLM raw result keys:", Object.keys(result || {}), "full:", JSON.stringify(result).slice(0, 500));

    const out = result?.transactions || result?.output || result;
    const list = Array.isArray(out) ? out : (out && Array.isArray(out.transactions) ? out.transactions : (out && typeof out === 'object' ? [out] : []));

    const clean = list.map((r) => {
      const num = (v) => {
        const n = Number(String(v ?? '').replace(/[₪,]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };
      return {
        order_number: String(r?.order_number ?? '').trim(),
        transaction_date: String(r?.transaction_date ?? '').trim(),
        transaction_time: String(r?.transaction_time ?? '').trim(),
        customer_name: String(r?.customer_name ?? '').trim(),
        department: String(r?.department ?? '').trim(),
        product_name: String(r?.product_name ?? '').trim(),
        sku: String(r?.sku ?? '').trim(),
        quantity: num(r?.quantity),
        unit_price: num(r?.unit_price),
        line_total: num(r?.line_total),
      };
    }).filter((r) => r.product_name);

    return Response.json({ transactions: clean, count: clean.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}