import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const norm = (v) => (v == null ? "" : String(v).trim());
const normId = (v) => String(v || "").replace(/\D/g, "");
const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const normDate = (v) => {
  const s = norm(v);
  if (!s) return "";
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
};
const concatName = (first, last) => {
  const f = norm(first), l = norm(last);
  if (!f && !l) return "";
  return (f + " " + l).trim();
};

const CHILDREN_GENDER = { "1": "זכר", "2": "נקבה", M: "זכר", F: "נקבה", male: "זכר", female: "נקבה" };
const parseChildren = (rec) => {
  const out = [];
  for (let i = 0; i < 15; i++) {
    const base = 29 + i * 4;
    const name = rec[`Field${base}`];
    const id = rec[`Field${base + 1}`];
    const birth = rec[`Field${base + 2}`];
    const g = rec[`Field${base + 3}`];
    if (!name && !id && !birth) continue;
    out.push({ name: norm(name), id_number: norm(id), birth_date: normDate(birth), gender: CHILDREN_GENDER[g] || norm(g) });
  }
  return out;
};

async function fetchAllFormRecords(base44, configId, tofesId) {
  const all = [];
  let lastId = 0;
  for (let i = 0; i < 40; i++) {
    const res = await base44.functions.invoke('nedarimForms', { configId, tofesId, lastId, maxId: 500 });
    const data = res && res.data ? res.data : res;
    if (data.error) throw new Error(data.error);
    const recs = Array.isArray(data.records) ? data.records : [];
    all.push(...recs);
    if (!data.hasMore) break;
    lastId = data.lastId;
  }
  return all;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const configs = await base44.entities.FormConfig.list('-created_date', 200);
    const cfg = (configs || []).find((c) => String(c.tofes_id) === '691');
    if (!cfg) throw new Error('לא נמצא טופס 691 בהגדרות');

    const formRecs = await fetchAllFormRecords(base44, cfg.id, cfg.tofes_id);

    const members = await base44.entities.CommunityMember.list('-created_date', 3000);
    const fin = await base44.entities.CommunityFinance.list('-year', 3000).catch(() => []);
    const years = Array.from(new Set((fin || []).map((f) => f.year).filter(Boolean))).sort().reverse();
    const fYear = years[0] || String(new Date().getFullYear());

    const memberById = {};
    for (const m of members) { const d = normId(m.id_number); if (d) memberById[d] = m; }
    const finById = {};
    for (const f of fin || []) { const d = normId(f.id_number); if (d) finById[`${d}|${f.year}`] = f; }

    const memberUpdates = [];
    const memberCreates = [];
    const finUpdates = [];
    const finCreates = [];
    let noId = 0;

    for (const rec of formRecs) {
      const id = normId(rec.Field3);
      if (!id) { noId++; continue; }
      const existing = memberById[id];

      const m = {};
      const setM = (field, val) => { const v = norm(val); if (v) m[field] = v; };
      setM('first_name', rec.Field2);
      setM('last_name', rec.Field1);
      const name = concatName(rec.Field2, rec.Field1);
      if (name) m.name = name;
      setM('id_number', rec.Field3);
      setM('phone', rec.Field4);
      setM('mobile', rec.Field5);
      const bd = normDate(rec.Field6); if (bd) m.birth_date = bd;
      setM('occupation', rec.Field7);
      setM('email', rec.Field3Max);
      setM('city', rec.Field8);
      setM('street', rec.Field9);
      setM('house_number', rec.Field10);
      setM('apartment', rec.Field11);
      const addr = [rec.Field8, rec.Field9, rec.Field10, rec.Field11 ? "/" + rec.Field11 : ""].map(norm).filter(Boolean).join(" ");
      if (addr.trim()) m.address = addr.trim();
      setM('spouse_name', rec.Field12);
      setM('spouse_id', rec.Field13);
      const sbd = normDate(rec.Field14); if (sbd) m.spouse_birth_date = sbd;
      setM('spouse_phone', rec.Field15);
      setM('spouse_occupation', rec.Field16);
      setM('bank_name', rec.Field17);
      setM('bank_number', rec.Field18);
      setM('branch_number', rec.Field19);
      setM('account_number', rec.Field20);
      setM('father_last_name', rec.Field21);
      setM('father_first_name', rec.Field22);
      setM('father_mother_first_name', rec.Field4Max);
      setM('father_phone', rec.Field23);
      setM('father_city', rec.Field24);
      setM('mother_last_name', rec.Field25);
      setM('mother_first_name', rec.Field26);
      setM('mother_mother_first_name', rec.Field5Max);
      setM('mother_phone', rec.Field27);
      setM('mother_city', rec.Field28);
      setM('form_update_date', rec.UpdateDate);
      const cc = num(rec.Field90);
      if (cc != null) m.children_count = cc;
      const kids = parseChildren(rec);
      if (kids.length) m.children_json = JSON.stringify(kids);

      const fdata = {};
      const setF = (field, val) => { const n = num(val); if (n != null) fdata[field] = n; };
      setF('personal_scholarship', rec.Field91);
      setF('spouse_scholarship', rec.Field92);
      setF('fixed_income', rec.Field94);
      setF('installments_income', rec.Field93);
      setF('total_income', rec.Field95);
      setF('tuition_expense', rec.Field96);
      setF('special_children_expense', rec.Field97);
      setF('rent_expense', rec.Field100);
      setF('total_expenses', rec.Field1Max);
      setF('total_debt', rec.Field98);
      setF('monthly_repayment', rec.Field89);
      const dr = norm(rec.Field7Max); if (dr) fdata.debt_reason = dr;

      if (existing) {
        if (Object.keys(m).length) memberUpdates.push({ id: existing.id, ...m });
      } else {
        const finalName = m.name || `חבר קהילה ${id}`;
        memberCreates.push({ ...m, id_number: rec.Field3 || id, name: finalName });
      }

      if (Object.keys(fdata).length) {
        const ef = finById[`${id}|${fYear}`];
        if (ef) finUpdates.push({ id: ef.id, ...fdata });
        else finCreates.push({ ...fdata, id_number: rec.Field3 || id, year: fYear, name: m.name || existing?.name || "" });
      }
    }

    if (!dryRun) {
      const batch = async (arr, fn) => { for (let i = 0; i < arr.length; i += 500) await fn(arr.slice(i, i + 500)); };
      await batch(memberUpdates, (a) => base44.entities.CommunityMember.bulkUpdate(a));
      await batch(memberCreates, (a) => base44.entities.CommunityMember.bulkCreate(a));
      await batch(finUpdates, (a) => base44.entities.CommunityFinance.bulkUpdate(a));
      await batch(finCreates, (a) => base44.entities.CommunityFinance.bulkCreate(a));
    }

    return Response.json({
      ok: true,
      dryRun,
      formRecs: formRecs.length,
      noId,
      memberUpdates: memberUpdates.length,
      memberCreates: memberCreates.length,
      finUpdates: finUpdates.length,
      finCreates: finCreates.length,
      fYear,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}