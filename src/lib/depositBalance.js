// חישוב יתרת פיקדון: יתרה = סכום התחלתי + הפקדות (hk_deposit) - הפחתות (hk_deduction/redemption/manual_deduction)
export const ADDITION_TYPES = ['hk_deposit'];
export const DEDUCTION_TYPES = ['hk_deduction', 'redemption', 'manual_deduction'];

export function computeDepositBalance(initialAmount, txs = []) {
  const init = Number(initialAmount) || 0;
  let additions = 0;
  let deductions = 0;
  for (const t of txs || []) {
    const amt = Number(t.amount) || 0;
    if (ADDITION_TYPES.includes(t.type)) additions += amt;
    else if (DEDUCTION_TYPES.includes(t.type)) deductions += amt;
  }
  return init + additions - deductions;
}

// פרסור רשימת הוראות קבע של פיקדון. תומך בפורמט החדש (hk_instructions JSON)
// ובתאימות לאחור לשדות הבודדים (hk_instruction_number/hk_amount/hk_type).
export function parseHkInstructions(dep) {
  if (!dep) return [];
  if (dep.hk_instructions) {
    try {
      const arr = JSON.parse(dep.hk_instructions);
      if (Array.isArray(arr)) {
        return arr
          .filter((x) => x && (x.number || x.amount || x.type))
          .map((x) => ({
            number: String(x.number || '').trim(),
            amount: x.amount != null && x.amount !== '' ? Number(x.amount) : null,
            type: x.type === 'deposit' ? 'deposit' : 'deduction',
          }));
      }
    } catch {}
  }
  const num = String(dep.hk_instruction_number || '').trim();
  if (!num && (dep.hk_amount == null || dep.hk_amount === '')) return [];
  return [{
    number: num,
    amount: dep.hk_amount != null && dep.hk_amount !== '' ? Number(dep.hk_amount) : null,
    type: dep.hk_type === 'deposit' ? 'deposit' : 'deduction',
  }];
}

export function signForType(type) {
  return ADDITION_TYPES.includes(type) ? '+' : '-';
}