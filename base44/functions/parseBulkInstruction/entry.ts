import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'user') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const instruction = (body?.instruction || "").trim().slice(0, 1000);
    const tasks = Array.isArray(body?.tasks)
      ? body.tasks.filter((t) => typeof t === "string" && t.trim()).slice(0, 50).map((t) => t.slice(0, 200))
      : [];
    if (!instruction) return Response.json({ error: 'חסרה הוראה לפענוח' }, { status: 400 });

    const taskList = tasks.length ? tasks.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(אין משימות מוגדרות בחלוקה זו)';

    const prompt = `אתה מפרש הוראה בעברית לפעולה גורפת על רשימת מקבלי חלוקה. החזר אך ורק אובייקט JSON תואם לסכמה.

משימות החלוקה הזמינות (יש להשתמש בשם מדויק מהרשימה):
${taskList}

סוגי תנאי (condition) אפשריים בלבד:
- { "type": "all" } — כל המקבלים
- { "type": "task_done", "task": "<שם משימה מדויק>" } — מי שביצע משימה בודדת
- { "type": "task_done", "tasks": ["<שם משימה>", "<שם משימה>"] } — מי שביצע את כל המשימות ברשימה (AND — כולן חייבות להתקיים)
- { "type": "task_not_done", "task": "<שם משימה מדויק>" } — מי שטרם ביצע משימה בודדת
- { "type": "task_not_done", "tasks": ["<שם משימה>", "<שם משימה>"] } — מי שטרם ביצע אף אחת מהמשימות ברשימה
- { "type": "status_delivered" } — מי שכבר סומן כנמסר
- { "type": "status_pending" } — מי שעדיין ממתין

סוגי פעולה (change) אפשריים בלבד:
- { "type": "mark_delivered" } — סמן כנמסר
- { "type": "mark_pending" } — בטל סימון נמסר
- { "type": "set_amount", "amount": <מספר> } — קבע סכום/כמות
- { "type": "complete_task", "task": "<שם משימה מדויק>" } — סמן משימה כבוצעה למקבל
- { "type": "uncomplete_task", "task": "<שם משימה מדויק>" } — בטל סימון משימה

הוראה לפענוח:
"""${instruction}"""

כללים:
- בחר תנאי ופעולה מתאימים בלבד מהרשימות שמעל.
- כאשר מוזכרות מספר משימות (למשל את שתי המשימות, את כל המשימות), השתמש ב- tasks (מערך) עם סמנטיקת AND — כל המשימות במערך חייבות להתקיים. אל תשתמש ב- task הבודד במקרה כזה.
- אם מוזכרת משימה, השתמש בשם מדויק מרשימת המשימות. אם השם לא קייק, החזר { "error": "..." }.
- אם ההוראה אינה ברורה או לא ניתנת לפענוח, החזר { "error": "תיאור הבעיה" }.
- אל תמציא סוגים שלא מופיעים ברשימות.

החזר בדיוק: { "condition": {...}, "change": {...} } או { "error": "..." }`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          condition: {
            type: "object",
            properties: {
              type: { type: "string" },
              task: { type: "string" },
              tasks: { type: "array", items: { type: "string" } }
            }
          },
          change: {
            type: "object",
            properties: {
              type: { type: "string" },
              task: { type: "string" },
              amount: { type: "number" }
            }
          },
          error: { type: "string" }
        }
      }
    });

    const cond = res?.condition;
    const ch = res?.change;
    if (cond && ch && cond.type && ch.type) {
      return Response.json({ condition: cond, change: ch });
    }
    const errMsg = (typeof res?.error === "string" && res.error.trim() && res.error.trim().toLowerCase() !== "null") ? res.error : "";
    return Response.json({ error: errMsg || "לא הצלחתי לפענח את ההוראה — נסו לנסח אותה אחרת." });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}