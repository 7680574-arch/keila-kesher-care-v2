export const memberAddress = (m) => {
  if (!m) return "";
  return [
    m.street || null,
    m.house_number ? `מס' ${m.house_number}` : null,
    m.apartment ? `דירה ${m.apartment}` : null,
  ].filter(Boolean).join(" ");
};