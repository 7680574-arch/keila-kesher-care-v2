import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// סנכרון הו"ק (הוראות קבע) מתרומות נדרים פלוס לפיקדונות.
// עבור כל פיקדון, בונה רשימת הוראות קבע מ-hk_instructions (JSON) או מהשדות הבודדים (תאימות לאחור).
// לכל הוראת קבע, מאתר עסקאות ב-NedarimDonation עם אותו keva_id ויוצר DepositTransaction בכיוון המתאים.
// דדופ לפי nedarim_transaction_id למניעת כפילויות.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const depositId = body.deposit_id || null;

    // טען פיקדונות עם הוראת קבע כלשהי (חדשה או ישנה)
    const q = depositId
      ? { id: depositId }
      : { $or: [
          { hk_instruction_number: { $exists: true, $ne: '' } },
          { hk_instructions: { $exists: true, $ne: '' } }
        ] };
    const depPage = await base44.asServiceRole.entities.Deposit.filter(q, { limit: 500 });
    const deposits = depPage.items || [];

    let totalCreated = 0;
    const perDeposit = [];
    for (const dep of deposits) {
      const instructions = parseInstructions(dep);
      if (!instructions.length) { perDeposit.push({ deposit_id: dep.id, name: dep.name, created: 0, skipped: true }); continue; }

      // דדופ גלובלי לפיקדון (כל התנועות שכבר נרשמו)
      const exPage = await base44.asServiceRole.entities.DepositTransaction.filter(
        { deposit_id: dep.id, nedarim_transaction_id: { $exists: true, $ne: '' } },
        { limit: 3000, fields: ['nedarim_transaction_id'] }
      );
      const existing = new Set((exPage.items || []).map((t) => t.nedarim_transaction_id).filter(Boolean));

      const toCreate = [];
      let scanned = 0;
      for (const instr of instructions) {
        const hk = String(instr.number || '').trim();
        if (!hk) continue;
        const ndPage = await base44.asServiceRole.entities.NedarimDonation.filter(
          { keva_id: hk },
          { limit: 2000, fields: ['transaction_id', 'amount', 'transaction_date', 'keva_id'] }
        );
        const ndList = ndPage.items || [];
        scanned += ndList.length;
        const isDeposit = instr.type === 'deposit';
        for (const nd of ndList) {
          if (!nd.transaction_id) continue;
          if (existing.has(nd.transaction_id)) continue;
          const amt = instr.amount && Number(instr.amount) > 0
            ? Number(instr.amount)
            : (Number(nd.amount) || 0);
          toCreate.push({
            deposit_id: dep.id,
            member_id: dep.member_id || '',
            type: isDeposit ? 'hk_deposit' : 'hk_deduction',
            amount: amt,
            date: nd.transaction_date || new Date().toISOString().slice(0, 10),
            payment_method: 'transfer',
            source: 'nedarim_history',
            nedarim_transaction_id: nd.transaction_id,
            notes: isDeposit ? 'הו"ק הפקדה אוטומטי מנדרים פלוס' : 'הו"ק הפחתה אוטומטי מנדרים פלוס'
          });
          existing.add(nd.transaction_id);
        }
      }
      if (toCreate.length) {
        for (let i = 0; i < toCreate.length; i += 500) {
          await base44.asServiceRole.entities.DepositTransaction.bulkCreate(toCreate.slice(i, i + 500));
        }
      }
      totalCreated += toCreate.length;
      perDeposit.push({ deposit_id: dep.id, name: dep.name, created: toCreate.length, scanned });
    }
    return Response.json({ ok: true, totalCreated, deposits: perDeposit });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// בונה רשימת הוראות קבע מהפיקדון. תומך ב-hk_instructions (JSON) ובתאימות לאחור.
function parseInstructions(dep) {
  if (dep.hk_instructions) {
    try {
      const arr = JSON.parse(dep.hk_instructions);
      if (Array.isArray(arr)) {
        const out = arr
          .filter((x) => x && (x.number || x.amount != null))
          .map((x) => ({
            number: String(x.number || '').trim(),
            amount: x.amount != null && x.amount !== '' ? Number(x.amount) : null,
            type: x.type === 'deposit' ? 'deposit' : 'deduction',
          }))
          .filter((x) => x.number);
        if (out.length) return out;
      }
    } catch {}
  }
  const num = String(dep.hk_instruction_number || '').trim();
  if (!num) return [];
  return [{
    number: num,
    amount: dep.hk_amount != null ? Number(dep.hk_amount) : null,
    type: dep.hk_type === 'deposit' ? 'deposit' : 'deduction',
  }];
}