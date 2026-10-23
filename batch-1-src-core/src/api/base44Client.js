// Compatibility layer: keeps the existing `base44.*` calls working, but backed by Supabase.
// Goal: the ~80 UI files that import { base44 } from "@/api/base44Client" need NO changes.
// Known approximations are marked "NOTE".
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}
export const supabase = createClient(url || "http://localhost", anonKey || "missing", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ---------- helpers ----------
const PAGE = 1000; // PostgREST default max rows per request
const tableOf = (entity) => {
  if (entity === "User") return "profiles";
  if (entity === "Case") return "cases";
  return entity.replace(/(?<!^)([A-Z])/g, "_$1").toLowerCase();
};
const kebab = (s) => s.replace(/(?<!^)([A-Z])/g, "-$1").toLowerCase();
const httpError = (message, status) => Object.assign(new Error(message), { status });
const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined));
const quote = (v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const esc = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

// Mongo-style $regex -> ILIKE pattern. NOTE: approximation (anchors and ".*" supported, full regex is not).
function regexToLike(rx) {
  let s = String(rx);
  const starts = s.startsWith("^");
  const ends = s.endsWith("$") && !s.endsWith("\\$");
  if (starts) s = s.slice(1);
  if (ends) s = s.slice(0, -1);
  s = s.replace(/\.\*/g, "\u0000").replace(/\\(.)/g, "$1");
  s = esc(s).replace(/\u0000/g, "%");
  return (starts ? "" : "%") + s + (ends ? "" : "%");
}

// one field condition -> list of PostgREST "or-string" fragments (all ANDed)
function condFragments(field, val) {
  const frags = [];
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    for (const [op, v] of Object.entries(val)) {
      if (op === "$options") continue;
      if (op === "$in") frags.push(`${field}.in.(${(v || []).map(quote).join(",")})`);
      else if (op === "$nin") frags.push(`${field}.not.in.(${(v || []).map(quote).join(",")})`);
      else if (op === "$ne") frags.push(v === null ? `${field}.not.is.null` : `or(${field}.is.null,${field}.neq.${quote(v)})`);
      else if (op === "$gte") frags.push(`${field}.gte.${quote(v)}`);
      else if (op === "$gt") frags.push(`${field}.gt.${quote(v)}`);
      else if (op === "$lte") frags.push(`${field}.lte.${quote(v)}`);
      else if (op === "$lt") frags.push(`${field}.lt.${quote(v)}`);
      else if (op === "$regex") frags.push(`${field}.ilike.${quote(regexToLike(v).replace(/%/g, "*"))}`);
      else if (op === "$exists") frags.push(v ? `${field}.not.is.null` : `${field}.is.null`);
      else throw new Error(`Unsupported query operator ${op}`);
    }
  } else if (val === null) frags.push(`${field}.is.null`);
  else frags.push(`${field}.eq.${quote(val)}`);
  return frags;
}
function condToString(cond) {
  const parts = [];
  for (const [k, v] of Object.entries(cond || {})) {
    if (k === "$or") parts.push(`or(${v.map(condToString).join(",")})`);
    else if (k === "$and") parts.push(`and(${v.map(condToString).join(",")})`);
    else parts.push(...condFragments(k, v));
  }
  return parts.length === 1 ? parts[0] : `and(${parts.join(",")})`;
}

// apply a Mongo-style query object to a PostgREST builder
function applyQuery(qb, query) {
  for (const [k, v] of Object.entries(query || {})) {
    if (k === "$or") qb = qb.or(v.map(condToString).join(","));
    else if (k === "$and") qb = applyQuery(qb, Object.assign({}, ...v));
    else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const [op, x] of Object.entries(v)) {
        if (op === "$options") continue;
        if (op === "$in") qb = qb.in(k, x || []);
        else if (op === "$nin") qb = qb.not(k, "in", `(${(x || []).map(quote).join(",")})`);
        else if (op === "$ne") qb = x === null ? qb.not(k, "is", null) : qb.or(`${k}.is.null,${k}.neq.${quote(x)}`);
        else if (op === "$gte") qb = qb.gte(k, x);
        else if (op === "$gt") qb = qb.gt(k, x);
        else if (op === "$lte") qb = qb.lte(k, x);
        else if (op === "$lt") qb = qb.lt(k, x);
        else if (op === "$regex") qb = qb.ilike(k, regexToLike(x));
        else if (op === "$exists") qb = x ? qb.not(k, "is", null) : qb.is(k, null);
        else throw new Error(`Unsupported query operator ${op}`);
      }
    } else if (v === null) qb = qb.is(k, null);
    else qb = qb.eq(k, v);
  }
  return qb;
}

function applySort(qb, sort) {
  if (!sort) return qb;
  for (const part of String(sort).split(",")) {
    const s = part.trim();
    if (!s) continue;
    qb = s.startsWith("-") ? qb.order(s.slice(1), { ascending: false }) : qb.order(s.replace(/^\+/, ""), { ascending: true });
  }
  return qb;
}

// Result that works both as an array and as a page object ({items, next_cursor, has_more})
function asPage(rows, limit, skip) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  items.items = items;
  items.has_more = hasMore;
  items.next_cursor = hasMore ? String(skip + limit) : null;
  return items;
}

async function runSelect(table, query, sort, limit, skip, fields) {
  const cols = Array.isArray(fields) && fields.length ? fields.join(",") : "*";
  const want = limit + 1; // one extra row tells us if there is more
  let out = [];
  let offset = skip;
  while (out.length < want) {
    const take = Math.min(PAGE, want - out.length);
    let qb = supabase.from(table).select(cols);
    qb = applySort(applyQuery(qb, query), sort).range(offset, offset + take - 1);
    const { data, error } = await qb;
    if (error) throw httpError(error.message, error.code === "42501" ? 403 : 400);
    out = out.concat(data || []);
    if (!data || data.length < take) break;
    offset += take;
  }
  return asPage(out, limit, skip);
}

// accepts (query, sort, limit, skip) or (query, {sort, limit, skip, cursor, fields})
function parseArgs(a1, a2, a3) {
  let sort, limit, skip = 0, fields;
  if (a2 && typeof a2 === "object") {
    ({ sort, limit, fields } = a2);
    skip = a2.cursor ? Number(a2.cursor) || 0 : a2.skip || 0;
  } else {
    sort = a2; limit = a3;
  }
  return { sort, limit: limit ?? 50, skip, fields };
}

function entity(name) {
  const table = tableOf(name);
  const writeErr = (error) => { throw httpError(error.message, error.code === "42501" ? 403 : 400); };
  return {
    list: (sort, limit, skip) => {
      const o = sort && typeof sort === "object" ? parseArgs({}, sort) : { sort, limit: limit ?? 50, skip: skip || 0 };
      return runSelect(table, {}, o.sort, o.limit, o.skip, o.fields);
    },
    filter: (query, a2, a3) => {
      const o = parseArgs(query, a2, a3);
      return runSelect(table, query || {}, o.sort, o.limit, o.skip, o.fields);
    },
    get: async (id) => {
      const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      if (error) writeErr(error);
      if (!data) throw httpError(`${name} ${id} not found`, 404);
      return data;
    },
    create: async (data) => {
      const { data: row, error } = await supabase.from(table).insert(clean(data)).select().single();
      if (error) writeErr(error);
      return row;
    },
    bulkCreate: async (records) => {
      const all = [];
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500).map(clean);
        const { data, error } = await supabase.from(table).insert(chunk).select();
        if (error) writeErr(error);
        all.push(...(data || []));
      }
      return all;
    },
    update: async (id, data) => {
      const { id: _i, created_date: _c, ...rest } = clean(data);
      const { data: row, error } = await supabase.from(table).update(rest).eq("id", id).select().single();
      if (error) writeErr(error);
      return row;
    },
    // records: [{ id, ...fields }]  (NOTE: one request per record, 10 in parallel)
    bulkUpdate: async (records) => {
      const out = [];
      for (let i = 0; i < records.length; i += 10) {
        const res = await Promise.all(records.slice(i, i + 10).map(async (r) => {
          const { id, created_date: _c, ...rest } = clean(r);
          const { data, error } = await supabase.from(table).update(rest).eq("id", id).select().maybeSingle();
          if (error) writeErr(error);
          return data;
        }));
        out.push(...res);
      }
      return out;
    },
    updateMany: async (query, update) => {
      const set = update?.$set ?? update;
      const { data, error } = await applyQuery(supabase.from(table).update(clean(set)).not("id", "is", null), query).select("id");
      if (error) writeErr(error);
      return { modified_count: data?.length || 0, has_more: false };
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) writeErr(error);
      return { success: true };
    },
    deleteMany: async (query) => {
      const { data, error } = await applyQuery(supabase.from(table).delete().not("id", "is", null), query).select("id");
      if (error) writeErr(error);
      return { deleted_count: data?.length || 0 };
    },
    count: async (query) => {
      const { count, error } = await applyQuery(supabase.from(table).select("id", { count: "exact", head: true }), query);
      if (error) writeErr(error);
      return count || 0;
    },
    // NOTE: aggregated in the browser by paging rows. Fine for thousands of rows; move to a SQL function if it gets slow.
    aggregate: async ({ query = {}, groupBy, sum } = {}) => {
      const sums = sum ? (Array.isArray(sum) ? sum : [sum]) : [];
      const cols = ["id", ...(groupBy ? [groupBy] : []), ...sums].join(",");
      const groups = new Map();
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await applyQuery(supabase.from(table).select(cols), query).order("id").range(offset, offset + PAGE - 1);
        if (error) writeErr(error);
        for (const r of data || []) {
          const key = groupBy ? r[groupBy] : "__all__";
          if (!groups.has(key)) groups.set(key, { ...(groupBy ? { [groupBy]: r[groupBy] } : {}), count: 0, ...Object.fromEntries(sums.map((s) => [`sum_${s}`, 0])) });
          const g = groups.get(key);
          g.count += 1;
          for (const s of sums) g[`sum_${s}`] += Number(r[s]) || 0;
        }
        if (!data || data.length < PAGE) break;
      }
      if (!groupBy && groups.size === 0) groups.set("__all__", { count: 0, ...Object.fromEntries(sums.map((s) => [`sum_${s}`, 0])) });
      return { rows: [...groups.values()] };
    },
    // NOTE: requires the table to be added to the supabase_realtime publication (see SQL step 02)
    subscribe: (cb) => {
      const ch = supabase
        .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, (p) => {
          const type = p.eventType === "INSERT" ? "create" : p.eventType === "UPDATE" ? "update" : "delete";
          const row = p.new && p.new.id ? p.new : p.old;
          cb({ type, id: row?.id, data: p.new && p.new.id ? p.new : undefined });
        })
        .subscribe();
      return () => supabase.removeChannel(ch);
    },
  };
}

const entities = new Proxy({}, { get: (_t, name) => (typeof name === "string" ? entity(name) : undefined) });

// ---------- auth ----------
async function me() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw httpError("Authentication required", 401);
  const { data: p, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (error || !p) throw httpError("User not registered", 403);
  // allowed_tabs is kept as a JSON string so existing code (JSON.parse) keeps working
  return { ...p, allowed_tabs: JSON.stringify(p.allowed_tabs || []) };
}
const origin = () => window.location.origin;
const auth = {
  me,
  isAuthenticated: async () => !!(await supabase.auth.getSession()).data.session,
  logout: async (redirect) => { await supabase.auth.signOut(); window.location.href = "/login"; },
  redirectToLogin: () => { window.location.href = "/login"; },
  loginViaEmailPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw httpError(error.message, 401);
    return data;
  },
  register: async ({ email, password, full_name }) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: full_name || "" } } });
    if (error) throw httpError(error.message, 400);
    return data;
  },
  // NOTE: needs the Supabase "Confirm signup" email template to include {{ .Token }} (6-digit code)
  verifyOtp: async ({ email, otpCode }) => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "signup" });
    if (error) throw httpError(error.message, 400);
    return { ...data, access_token: data.session?.access_token };
  },
  resendOtp: async (email) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) throw httpError(error.message, 400);
  },
  resetPasswordRequest: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password?token=supabase` });
    if (error) throw httpError(error.message, 400);
  },
  // The recovery link signs the user in; we then just set the new password.
  resetPassword: async ({ newPassword }) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw httpError(error.message, 400);
  },
  loginWithProvider: async (provider, returnTo) => {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin()}${returnTo && returnTo.startsWith("/") ? returnTo : "/"}` } });
  },
  setToken: () => {}, // session is already stored by supabase-js
};

// ---------- server functions (Supabase Edge Functions; each must be deployed) ----------
const functions = {
  invoke: async (name, payload) => {
    const { data, error } = await supabase.functions.invoke(kebab(name), { body: payload ?? {} });
    if (error) {
      let detail = error.message;
      try { const j = await error.context?.json?.(); if (j?.error) detail = j.error; } catch { /* ignore */ }
      throw httpError(detail, error.context?.status || 500);
    }
    return { data };
  },
};

// ---------- files (Supabase Storage; buckets created in SQL step 02) ----------
const rand = () => crypto.randomUUID();
const safeName = (n) => (n || "file").replace(/[^\w.\-]+/g, "_");
const integrations = {
  Core: {
    // NOTE: public bucket (same behaviour as before). Case documents should move to a private bucket later.
    UploadFile: async ({ file }) => {
      const path = `${rand()}/${safeName(file.name)}`;
      const { error } = await supabase.storage.from("public-files").upload(path, file, { contentType: file.type || undefined });
      if (error) throw httpError(error.message, 400);
      return { file_url: supabase.storage.from("public-files").getPublicUrl(path).data.publicUrl };
    },
    UploadPrivateFile: async ({ file }) => {
      const path = `${rand()}/${safeName(file.name)}`;
      const { error } = await supabase.storage.from("private-files").upload(path, file, { contentType: file.type || undefined });
      if (error) throw httpError(error.message, 400);
      return { file_uri: path };
    },
    CreateFileSignedUrl: async ({ file_uri, expires_in }) => {
      const { data, error } = await supabase.storage.from("private-files").createSignedUrl(file_uri, expires_in || 3600);
      if (error) throw httpError(error.message, 400);
      return { signed_url: data.signedUrl };
    },
  },
};

// inviting users needs the service role -> Edge Function "invite-user" (to be written)
const users = {
  inviteUser: (email, role) => functions.invoke("inviteUser", { email, role }),
};

export const base44 = { entities, auth, functions, integrations, users };
