import React, { useEffect, useMemo, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus, Trash2, Pencil, Search, Download, Coins, SlidersHorizontal, Users, List, ChevronDown,
} from "lucide-react";
import CopyPhonesButton from "@/components/CopyPhonesButton";
import ColumnHeader from "@/components/ColumnHeader";
import ColumnOrderButton from "@/components/ColumnOrderButton";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import StickyScrollBar from "@/components/StickyScrollBar";
import { parseTitlesJson } from "@/lib/formFields";

const fmt = (n) => `₪${Number(n || 0).toLocaleString("he-IL")}`;
const parseArr = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
const parseObj = (s) => { try { const o = JSON.parse(s || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; } catch { return {}; } };
const uid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const METHOD_LABELS = { points: "לפי נקודות", children: "לפי ילדים", from_distribution: "מחלוקה קיימת", rules: "חוקי חלוקה חכמה" };
const FIELD_LABELS = { children_count: "מספר ילדים", family_size: "מספר נפשות", points: "נקודות", neighborhood: "שכונה", city: "עיר", received_from_distribution: "קבלה מחלוקה", form_column: "עמודה מטופס" };
const OP_LABELS = { ">=": "≥", "<=": "≤", ">": ">", "<": "<", "==": "=", "!=": "≠", is_yes: "סומן כן", is_no: "לא סומן / ריק", has_text: "מכיל טקסט כלשהו", not_found: "לא נמצא בטופס" };
const CALC_LABELS = { per_person: "קבוע לכל נפש", per_child: "× מספר ילדים", per_point: "× נקודות", per_point_per_person: "₪ לנקודה × נפש", per_point_per_child: "₪ לנקודה × ילדים", fixed: "סכום קבוע" };
const defaultOpForField = (field) => (field === "received_from_distribution" ? "received" : field === "form_column" ? "is_yes" : field === "neighborhood" || field === "city" ? "==" : ">=");
const YES_VALUES = ["כן", "yes", "true", "1", "✓", "v", "כ", "true"];
const NO_VALUES = ["לא", "no", "false", "0", "", "ל", "false", null];

const emptyCat = () => ({ id: uid(), name: "", method: "points", base_amount: 0, fund_participation: 100, distribution_id: "", conditions: [], calculations: [] });

export default function HolidaySupportTable({ dist, members, onChange }) {
  const { toast } = useToast();
  const tableScrollRef = useRef(null);
  const [categories, setCategories] = useState(() => parseArr(dist?.categories));
  const [points, setPoints] = useState(() => parseObj(dist?.points));
  const [vouchersOverrides, setVouchersOverrides] = useState(() => parseObj(dist?.vouchers_overrides));
  const [allDists, setAllDists] = useState([]);
  const [distRecipients, setDistRecipients] = useState({});
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [showVoucherBreakdown, setShowVoucherBreakdown] = useState(false);
  const [sortState, setSortState] = useState({ key: "last_name", dir: "asc" });
  const [filters, setFilters] = useState({});
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [draft, setDraft] = useState(emptyCat());
  const [saving, setSaving] = useState(false);
  const [listCat, setListCat] = useState(null);
  const [previewCat, setPreviewCat] = useState(null);
  const [formConfigs, setFormConfigs] = useState([]);
  const [formDataMap, setFormDataMap] = useState({});
  const [loadingForms, setLoadingForms] = useState(false);
  const saveTimer = useRef(null);
  const pointsTimer = useRef(null);
  const overridesTimer = useRef(null);
  const pointsRefs = useRef({});
  const [stickyOffsets, setStickyOffsets] = useState([]);
  const tableRef = useRef(null);
  const [colOrder, setColOrder] = useColumnOrder("holiday_cols_" + (dist?.id || "default"), []);

  useEffect(() => {
    const measure = () => {
      const ths = tableRef.current?.querySelectorAll("thead tr:first-child > th") || [];
      const offsets = [];
      let cum = 0;
      for (let i = 0; i < 2 && i < ths.length; i++) { offsets.push(cum); cum += ths[i].offsetWidth; }
      setStickyOffsets(offsets);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [members.length, categories.length]);

  // list of distributions for picker
  useEffect(() => {
    base44.entities.Distribution.list("-created_date", 500).then(setAllDists).catch(() => {});
  }, []);

  // load form configs for form_column conditions
  useEffect(() => {
    base44.entities.FormConfig.list("-created_date", 200).then(setFormConfigs).catch(() => {});
  }, []);

  // collect form_ids referenced in form_column conditions (both draft and saved categories)
  const formIdsNeeded = useMemo(() => {
    const ids = new Set();
    const collect = (conds) => (conds || []).forEach((c) => {
      if (c.field === "form_column" && c.form_id) ids.add(c.form_id);
    });
    categories.forEach((c) => collect(c.conditions));
    collect(draft.conditions);
    return Array.from(ids);
  }, [categories, draft.conditions]);

  // load form data for each needed form_id
  useEffect(() => {
    if (formIdsNeeded.length === 0) { setFormDataMap({}); return; }
    let cancelled = false;
    setLoadingForms(true);
    (async () => {
      const map = { ...formDataMap };
      for (const fid of formIdsNeeded) {
        if (map[fid]) continue;
        const cfg = formConfigs.find((c) => c.id === fid);
        if (!cfg) continue;
        try {
          let allRecords = [];
          let lastId = 0;
          let hasMore = true;
          while (hasMore) {
            const res = await base44.functions.invoke("nedarimForms", { tofesId: cfg.tofes_id, lastId, maxId: 500 });
            const data = res.data || res;
            if (data.error) throw new Error(data.error);
            const page = Array.isArray(data.records) ? data.records : [];
            allRecords = [...allRecords, ...page];
            lastId = data.lastId || (page.length ? Number(page[page.length - 1].ID) : lastId);
            hasMore = !!data.hasMore && page.length > 0;
          }
          const recMap = {};
          const idField = cfg.id_field || "Field1";
          allRecords.forEach((r) => {
            const idNum = String(r[idField] || "").trim();
            if (idNum) recMap[idNum] = r;
          });
          map[fid] = recMap;
        } catch (e) { /* skip on error */ }
      }
      if (!cancelled) { setFormDataMap(map); setLoadingForms(false); }
    })();
    return () => { cancelled = true; };
  }, [formIdsNeeded.join(","), formConfigs.length]);

  // load recipients for every from_distribution category and every distribution referenced in rules conditions
  const fromDistIds = useMemo(() => {
    const ids = new Set();
    categories.forEach((c) => {
      if (c.method === "from_distribution" && c.distribution_id) ids.add(c.distribution_id);
      (c.conditions || []).forEach((cond) => {
        if (cond.field === "received_from_distribution") {
          const vals = Array.isArray(cond.values) ? cond.values : (cond.value ? [cond.value] : []);
          vals.forEach((v) => { if (v && !String(v).startsWith("local:")) ids.add(v); });
        }
      });
    });
    return Array.from(ids);
  }, [categories]);
  useEffect(() => {
    if (fromDistIds.length === 0) { setDistRecipients({}); return; }
    Promise.all(fromDistIds.map((did) => base44.entities.DistributionRecipient.filter({ distribution_id: did }, "-created_date", 5000)))
      .then((results) => {
        const map = {};
        results.forEach((recs, i) => {
          const m = {};
          recs.forEach((r) => { if (r.member_id) m[r.member_id] = { amount: Number(r.amount) || 0, fund_participation: Number(r.fund_participation) || 0 }; });
          map[fromDistIds[i]] = m;
        });
        setDistRecipients(map);
      })
      .catch(() => {});
  }, [fromDistIds.join(",")]);

  const getFieldValue = (field, m) => {
    if (field === "children_count") return Number(m.children_count) || 0;
    if (field === "family_size") return Number(m.family_size) || 0;
    if (field === "points") return Number(points[m.id]) || 0;
    if (field === "neighborhood") return m.neighborhood || "";
    if (field === "city") return m.city || "";
    return null;
  };
  const evalCondition = (cond, m, seen = new Set()) => {
    if (cond.field === "received_from_distribution") {
      const ids = Array.isArray(cond.values) ? cond.values : (cond.value ? [cond.value] : []);
      const checkOne = (id) => {
        if (typeof id === "string" && id.startsWith("local:")) {
          const catId = id.slice(6);
          if (seen.has(catId)) return false; // מניעת רקורסיה אינסופית
          const cat = categories.find((c) => c.id === catId);
          return !!cat && memberAmount(cat, m, seen) > 0;
        }
        return !!distRecipients[id]?.[m.id];
      };
      const receivedInAny = ids.some(checkOne);
      return cond.op === "received" ? receivedInAny : !receivedInAny;
    }
    if (cond.field === "form_column") {
      const formMap = formDataMap[cond.form_id] || {};
      const record = formMap[String(m.id_number || "").trim()];
      if (cond.op === "not_found") return !record;
      if (!record) return false;
      const raw = record[cond.form_column];
      if (raw == null) return cond.op === "is_no";
      const rawStr = String(raw).trim().toLowerCase();
      if (cond.op === "has_text") return String(raw).trim() !== "";
      if (cond.op === "is_yes") return YES_VALUES.includes(rawStr);
      if (cond.op === "is_no") return NO_VALUES.includes(rawStr);
      if (cond.op === "==" || cond.op === "!=") {
        return cond.op === "==" ? rawStr === String(cond.value).trim().toLowerCase() : rawStr !== String(cond.value).trim().toLowerCase();
      }
      const numVal = Number(String(raw).replace(/[^0-9.\-]/g, "")) || 0;
      const numTarget = Number(cond.value) || 0;
      switch (cond.op) {
        case ">=": return numVal >= numTarget;
        case "<=": return numVal <= numTarget;
        case ">": return numVal > numTarget;
        case "<": return numVal < numTarget;
        default: return true;
      }
    }
    const raw = getFieldValue(cond.field, m);
    if (cond.field === "neighborhood" || cond.field === "city") {
      return cond.op === "==" ? String(raw) === String(cond.value) : String(raw) !== String(cond.value);
    }
    const v = Number(cond.value) || 0;
    switch (cond.op) {
      case ">=": return raw >= v;
      case "<=": return raw <= v;
      case ">": return raw > v;
      case "<": return raw < v;
      case "==": return raw === v;
      default: return true;
    }
  };
  const matchesAllConditions = (cat, m, seen = new Set()) => {
    const conds = cat.conditions || [];
    if (conds.length === 0) return true;
    const includes = conds.filter((c) => (c.mode || "include") === "include");
    const excludes = conds.filter((c) => c.mode === "exclude");
    if (includes.length > 0 && !includes.every((c) => evalCondition(c, m, seen))) return false;
    if (excludes.some((c) => evalCondition(c, m, seen))) return false;
    return true;
  };
  const rulesCalcTotal = (cat, m) => (cat.calculations || []).reduce((sum, calc) => {
    const amt = Number(calc.amount) || 0;
    const pts = Number(points[m.id]) || 0;
    if (calc.type === "per_child") return sum + amt * (Number(m.children_count) || 0);
    if (calc.type === "per_point") return sum + amt * pts;
    if (calc.type === "per_point_per_person") return sum + amt * pts * (Number(m.family_size) || 0);
    if (calc.type === "per_point_per_child") return sum + amt * pts * (Number(m.children_count) || 0);
    return sum + amt;
  }, 0);
  const conditionLabel = (cond) => {
    const fname = FIELD_LABELS[cond.field] || cond.field;
    const modeSuffix = cond.mode === "exclude" ? " (לא יקבל)" : "";
    if (cond.field === "received_from_distribution") {
      const ids = Array.isArray(cond.values) ? cond.values : (cond.value ? [cond.value] : []);
      const names = ids.map((id) => {
        if (typeof id === "string" && id.startsWith("local:")) {
          const cat = categories.find((c) => c.id === id.slice(6));
          return cat ? `${cat.name} (חוקים)` : "חוקים";
        }
        return allDists.find((d) => d.id === id)?.title || "חלוקה";
      }).join(", ") || "—";
      return `${cond.op === "received" ? "קיבל" : "לא קיבל"} ב: ${names}${modeSuffix}`;
    }
    if (cond.field === "form_column") {
      const cfg = formConfigs.find((c) => c.id === cond.form_id);
      const titles = parseTitlesJson(cfg?.titles);
      const colLabel = titles[cond.form_column] || cond.form_column || "";
      const formName = cfg?.name || "טופס";
      if (cond.op === "is_yes" || cond.op === "is_no" || cond.op === "has_text" || cond.op === "not_found") return `${formName} · ${colLabel}: ${OP_LABELS[cond.op]}${modeSuffix}`;
      return `${formName} · ${colLabel} ${OP_LABELS[cond.op] || cond.op} ${cond.value}${modeSuffix}`;
    }
    if (cond.field === "neighborhood" || cond.field === "city") {
      return `${fname} ${cond.op === "==" ? "=" : "≠"} "${cond.value || ""}"${modeSuffix}`;
    }
    return `${fname} ${OP_LABELS[cond.op] || cond.op} ${cond.value}${modeSuffix}`;
  };
  const rulesBreakdown = (cat, m) => {
    if (!matchesAllConditions(cat, m)) {
      const includes = (cat.conditions || []).filter((c) => (c.mode || "include") === "include");
      const excludes = (cat.conditions || []).filter((c) => c.mode === "exclude");
      const matchedExclude = excludes.find((c) => evalCondition(c, m));
      const failedInclude = includes.find((c) => !evalCondition(c, m));
      const failReason = matchedExclude ? `נפסל כי עומד בתנאי שלילה: ${conditionLabel(matchedExclude)}` : failedInclude ? `לא עומד בתנאי: ${conditionLabel(failedInclude)}` : "לא עומד בתנאים";
      return { matched: false, total: 0, parts: [], failReason };
    }
    const parts = (cat.calculations || []).map((calc) => {
      const amt = Number(calc.amount) || 0;
      if (calc.type === "per_child") { const sub = Number(m.children_count) || 0; return { detail: `₪${amt} × ${sub} ילדים = ₪${amt * sub}` }; }
      if (calc.type === "per_point") { const sub = Number(points[m.id]) || 0; return { detail: `₪${amt} × ${sub} נקודות = ₪${amt * sub}` }; }
      if (calc.type === "per_point_per_person") { const pts = Number(points[m.id]) || 0; const fam = Number(m.family_size) || 0; return { detail: `₪${amt} × ${pts} נקודות × ${fam} נפש = ₪${amt * pts * fam}` }; }
      if (calc.type === "per_point_per_child") { const pts = Number(points[m.id]) || 0; const ch = Number(m.children_count) || 0; return { detail: `₪${amt} × ${pts} נקודות × ${ch} ילדים = ₪${amt * pts * ch}` }; }
      if (calc.type === "per_person") return { detail: `₪${amt} לנפש` };
      return { detail: `₪${amt} קבוע` };
    });
    return { matched: true, total: rulesCalcTotal(cat, m), parts, failReason: null };
  };

  const memberAmount = (cat, m, seen = new Set()) => {
    if (cat.method === "points") return (Number(cat.base_amount) || 0) * (Number(points[m.id]) || 0);
    if (cat.method === "children") return (Number(cat.base_amount) || 0) * (Number(m.children_count) || 0);
    if (cat.method === "from_distribution") return distRecipients[cat.distribution_id]?.[m.id]?.amount || 0;
    if (cat.method === "rules") {
      const newSeen = new Set(seen); newSeen.add(cat.id);
      return matchesAllConditions(cat, m, newSeen) ? rulesCalcTotal(cat, m) : 0;
    }
    return 0;
  };

  const memberTotal = (m) => categories.reduce((s, c) => s + memberAmount(c, m), 0);
  const vouchersTotal = (m) => {
    if (vouchersOverrides[m.id] != null) return Number(vouchersOverrides[m.id]) || 0;
    return categories.filter((c) => c.method === "rules").reduce((s, c) => s + memberAmount(c, m), 0);
  };

  // per-column value getters (keys: fixed cols + cat_<id> for each category + total)
  const colGet = useMemo(() => {
    const map = {
      last_name: (m) => m.last_name || "",
      first_name: (m) => m.first_name || "",
      id_number: (m) => m.id_number || "",
      mobile: (m) => m.mobile || "",
      children_count: (m) => Number(m.children_count) || 0,
      points: (m) => Number(points[m.id]) || 0,
      total: (m) => memberTotal(m),
      vouchers: (m) => vouchersTotal(m),
      v1000: (m) => voucherBreakdown(vouchersTotal(m)).c1000,
      v500: (m) => voucherBreakdown(vouchersTotal(m)).c500,
      v100: (m) => voucherBreakdown(vouchersTotal(m)).c100,
      v50: (m) => voucherBreakdown(vouchersTotal(m)).c50,
    };
    categories.forEach((c) => { map[`cat_${c.id}`] = (m) => memberAmount(c, m); });
    return map;
  }, [categories, points, distRecipients, vouchersOverrides, formDataMap]);

  const onSort = (key) => setSortState((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const onFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  // display-string getters — filter values match what the table shows
  const catDisplay = (n) => Number(n) > 0 ? fmt(n) : "—";
  const filterGet = useMemo(() => {
    const map = {
      last_name: (m) => m.last_name || "",
      first_name: (m) => m.first_name || "",
      id_number: (m) => m.id_number || "",
      mobile: (m) => m.mobile || "",
      children_count: (m) => String(Number(m.children_count) || 0),
      points: (m) => String(Number(points[m.id]) || 0),
      total: (m) => catDisplay(memberTotal(m)),
      vouchers: (m) => catDisplay(vouchersTotal(m)),
      v1000: (m) => String(voucherBreakdown(vouchersTotal(m)).c1000),
      v500: (m) => String(voucherBreakdown(vouchersTotal(m)).c500),
      v100: (m) => String(voucherBreakdown(vouchersTotal(m)).c100),
      v50: (m) => String(voucherBreakdown(vouchersTotal(m)).c50),
    };
    categories.forEach((c) => { map[`cat_${c.id}`] = (m) => catDisplay(memberAmount(c, m)); });
    return map;
  }, [categories, points, distRecipients, vouchersOverrides, formDataMap]);
  // distinct values per column for the AutoFilter lists
  const filterOptions = useMemo(() => {
    const opts = {};
    const add = (key) => {
      const map = new Map();
      members.forEach((m) => {
        const v = String(filterGet[key]?.(m) ?? "");
        const label = v === "" ? "(ריק)" : v;
        if (!map.has(v)) map.set(v, label);
      });
      opts[key] = Array.from(map, ([value, label]) => ({ value, label }));
    };
    add("last_name"); add("first_name"); add("id_number"); add("mobile");
    add("children_count"); add("points"); add("total"); add("vouchers");
    if (showVoucherBreakdown) { add("v1000"); add("v500"); add("v100"); add("v50"); }
    categories.forEach((c) => add(`cat_${c.id}`));
    return opts;
  }, [members, categories, filterGet, showVoucherBreakdown]);

  const filteredMembers = useMemo(() => {
    const q = search.trim();
    return members.filter((m) => {
      if (q && !`${m.last_name || ""} ${m.first_name || ""} ${m.name || ""} ${m.id_number || ""} ${m.mobile || ""}`.includes(q)) return false;
      if (hideZero && memberTotal(m) === 0) return false;
      for (const [key, sel] of Object.entries(filters)) {
        if (!sel || sel.length === 0) continue;
        const val = String(filterGet[key]?.(m) ?? "");
        if (!sel.includes(val)) return false;
      }
      return true;
    });
  }, [members, search, hideZero, categories, distRecipients, points, filters, filterGet]);

  const sortedMembers = useMemo(() => {
    const arr = [...filteredMembers];
    const { key, dir } = sortState;
    if (!key || !colGet[key]) return arr.sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "", "he") || (a.first_name || "").localeCompare(b.first_name || "", "he"));
    const mul = dir === "desc" ? -1 : 1;
    return arr.sort((a, b) => {
      const va = colGet[key](a), vb = colGet[key](b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
      return String(va).localeCompare(String(vb), "he") * mul;
    });
  }, [filteredMembers, sortState, colGet]);

  const phones = useMemo(() => sortedMembers.map((m) => m.mobile).filter(Boolean), [sortedMembers]);

  const tableCats = useMemo(() => [...categories.filter((c) => c.method === "points"), ...categories.filter((c) => c.method !== "points")], [categories]);
  const totalsByCat = useMemo(() => categories.map((c) => sortedMembers.reduce((s, m) => s + memberAmount(c, m), 0)), [categories, sortedMembers, distRecipients, points]);
  const tableTotalsByCat = useMemo(() => tableCats.map((c) => sortedMembers.reduce((s, m) => s + memberAmount(c, m), 0)), [tableCats, sortedMembers, distRecipients, points]);
  const grandTotal = useMemo(() => sortedMembers.reduce((s, m) => s + memberTotal(m), 0), [sortedMembers, categories, distRecipients, points]);
  const vouchersGrandTotal = useMemo(() => sortedMembers.reduce((s, m) => s + (Number(vouchersTotal(m)) || 0), 0), [sortedMembers, categories, distRecipients, points, vouchersOverrides]);
  const voucherBreakdown = (total) => {
    let remaining = Math.round(Number(total) || 0);
    const c1000 = Math.floor(remaining / 1000);
    remaining -= c1000 * 1000;
    const c500 = Math.floor(remaining / 500);
    remaining -= c500 * 500;
    const c100 = Math.floor(remaining / 100);
    remaining -= c100 * 100;
    const c50 = Math.floor(remaining / 50);
    remaining -= c50 * 50;
    return { c1000, c500, c100, c50, remainder: remaining };
  };
  const v1000Total = useMemo(() => sortedMembers.reduce((s, m) => s + voucherBreakdown(vouchersTotal(m)).c1000, 0), [sortedMembers, categories, distRecipients, points, vouchersOverrides]);
  const v500Total = useMemo(() => sortedMembers.reduce((s, m) => s + voucherBreakdown(vouchersTotal(m)).c500, 0), [sortedMembers, categories, distRecipients, points, vouchersOverrides]);
  const v100Total = useMemo(() => sortedMembers.reduce((s, m) => s + voucherBreakdown(vouchersTotal(m)).c100, 0), [sortedMembers, categories, distRecipients, points, vouchersOverrides]);
  const v50Total = useMemo(() => sortedMembers.reduce((s, m) => s + voucherBreakdown(vouchersTotal(m)).c50, 0), [sortedMembers, categories, distRecipients, points, vouchersOverrides]);
  const recipientsCount = useMemo(() => sortedMembers.filter((m) => memberTotal(m) > 0).length, [sortedMembers, categories, distRecipients, points]);
  const pointsCount = useMemo(() => sortedMembers.filter((m) => Number(points[m.id]) > 0).length, [sortedMembers, points]);

  const holidayColumns = useMemo(() => {
    const cols = [
      { key: "mobile", label: "נייד", header: <ColumnHeader label="נייד" sortDir={sortState.key === "mobile" ? sortState.dir : null} onSort={() => onSort("mobile")} filterOptions={filterOptions.mobile || []} filterValue={filters.mobile || []} onFilterChange={(v) => onFilter("mobile", v)} />, td: (m) => <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" dir="ltr">{m.mobile || "—"}</td>, total: () => <td className="px-3 py-3"></td> },
      { key: "id_number", label: "ת.ז.", header: <ColumnHeader label="ת.ז." sortDir={sortState.key === "id_number" ? sortState.dir : null} onSort={() => onSort("id_number")} filterOptions={filterOptions.id_number || []} filterValue={filters.id_number || []} onFilterChange={(v) => onFilter("id_number", v)} />, td: (m) => <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.id_number || "—"}</td>, total: () => <td className="px-3 py-3"></td> },
      { key: "children_count", label: "ילדים", header: <ColumnHeader label="ילדים" align="center" sortDir={sortState.key === "children_count" ? sortState.dir : null} onSort={() => onSort("children_count")} filterOptions={filterOptions.children_count || []} filterValue={filters.children_count || []} onFilterChange={(v) => onFilter("children_count", v)} />, td: (m) => <td className="px-3 py-2 text-center text-muted-foreground">{m.children_count || 0}</td>, total: () => <td className="px-3 py-3"></td> },
      { key: "points", label: "נקודות", header: <ColumnHeader label="נקודות" align="center" sortDir={sortState.key === "points" ? sortState.dir : null} onSort={() => onSort("points")} filterOptions={filterOptions.points || []} filterValue={filters.points || []} onFilterChange={(v) => onFilter("points", v)} />, td: (m) => (
        <td className="px-2 py-1.5 text-center">
          <Input type="text" inputMode="decimal" value={points[m.id] ?? ""} onChange={(e) => setMemberPoints(m.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const idx = sortedMembers.findIndex((x) => x.id === m.id); const nxt = sortedMembers[idx + 1]; if (nxt && pointsRefs.current[nxt.id]) pointsRefs.current[nxt.id].focus(); } }} ref={(el) => { if (el) pointsRefs.current[m.id] = el; else delete pointsRefs.current[m.id]; }} placeholder="0" className="w-20 h-8 text-center mx-auto" />
        </td>
      ), total: () => <td className="px-3 py-3"></td> },
      ...tableCats.map((c, ci) => ({ key: `cat_${c.id}`, label: c.name, header: <ColumnHeader key={c.id} align="center" label={<span className="text-foreground font-semibold">{c.name}</span>} sublabel={c.method === "points" ? `₪${c.base_amount} × נקודות` : c.method === "children" ? `₪${c.base_amount} × ילדים` : c.method === "rules" ? "חוקים" : "מחלוקה"} sortDir={sortState.key === `cat_${c.id}` ? sortState.dir : null} onSort={() => onSort(`cat_${c.id}`)} filterOptions={filterOptions[`cat_${c.id}`] || []} filterValue={filters[`cat_${c.id}`] || []} onFilterChange={(v) => onFilter(`cat_${c.id}`, v)} />, td: (m) => { const amt = memberAmount(c, m); return <td className={`px-3 py-2 text-center whitespace-nowrap ${amt > 0 ? "font-medium" : "text-muted-foreground"}`}>{amt > 0 ? fmt(amt) : "—"}</td>; }, total: () => <td className="px-3 py-3 text-center whitespace-nowrap">{fmt(tableTotalsByCat[ci])}</td> })),
      { key: "vouchers", label: "סה״כ תוים", header: <ColumnHeader label="סה״כ תוים" align="center" sortDir={sortState.key === "vouchers" ? sortState.dir : null} onSort={() => onSort("vouchers")} filterOptions={filterOptions.vouchers || []} filterValue={filters.vouchers || []} onFilterChange={(v) => onFilter("vouchers", v)} />, td: (m) => (
        <td className="px-2 py-1.5 text-center">
          <Input type="text" inputMode="decimal" value={vouchersOverrides[m.id] != null ? String(vouchersOverrides[m.id]) : String(vouchersTotal(m))} onChange={(e) => setMemberVouchers(m.id, e.target.value)} placeholder="אוטומטי" title={vouchersOverrides[m.id] != null ? "עריכה ידנית — רוקנו כדי לחזור לאוטומטי" : "סכום אוטומטי מחוקי החלוקה"} className={`w-24 h-8 text-center mx-auto ${vouchersOverrides[m.id] != null ? "bg-amber-50 border-amber-400 text-amber-800 font-semibold" : "text-muted-foreground"}`} />
        </td>
      ), total: () => <td className="px-3 py-3 text-center whitespace-nowrap text-amber-700 font-semibold">{fmt(vouchersGrandTotal)}</td> },
      ...(showVoucherBreakdown ? [
        { key: "v1000", label: "תווי 1000", header: <ColumnHeader label={<span className="text-violet-700">תווי 1000</span>} align="center" sortDir={sortState.key === "v1000" ? sortState.dir : null} onSort={() => onSort("v1000")} filterOptions={filterOptions.v1000 || []} filterValue={filters.v1000 || []} onFilterChange={(v) => onFilter("v1000", v)} />, td: (m) => { const bd = voucherBreakdown(vouchersTotal(m)); return <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-violet-700">{bd.c1000 > 0 ? bd.c1000 : "—"}</td>; }, total: () => <td className="px-3 py-3 text-center whitespace-nowrap text-violet-700 font-bold">{v1000Total}</td> },
        { key: "v500", label: "תווי 500", header: <ColumnHeader label={<span className="text-emerald-700">תווי 500</span>} align="center" sortDir={sortState.key === "v500" ? sortState.dir : null} onSort={() => onSort("v500")} filterOptions={filterOptions.v500 || []} filterValue={filters.v500 || []} onFilterChange={(v) => onFilter("v500", v)} />, td: (m) => { const bd = voucherBreakdown(vouchersTotal(m)); return <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-emerald-700">{bd.c500 > 0 ? bd.c500 : "—"}</td>; }, total: () => <td className="px-3 py-3 text-center whitespace-nowrap text-emerald-700 font-bold">{v500Total}</td> },
        { key: "v100", label: "תווי 100", header: <ColumnHeader label={<span className="text-sky-700">תווי 100</span>} align="center" sortDir={sortState.key === "v100" ? sortState.dir : null} onSort={() => onSort("v100")} filterOptions={filterOptions.v100 || []} filterValue={filters.v100 || []} onFilterChange={(v) => onFilter("v100", v)} />, td: (m) => { const bd = voucherBreakdown(vouchersTotal(m)); return <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-sky-700">{bd.c100 > 0 ? bd.c100 : "—"}</td>; }, total: () => <td className="px-3 py-3 text-center whitespace-nowrap text-sky-700 font-bold">{v100Total}</td> },
        { key: "v50", label: "תווי 50", header: <ColumnHeader label={<span className="text-amber-700">תווי 50</span>} align="center" sortDir={sortState.key === "v50" ? sortState.dir : null} onSort={() => onSort("v50")} filterOptions={filterOptions.v50 || []} filterValue={filters.v50 || []} onFilterChange={(v) => onFilter("v50", v)} />, td: (m) => { const bd = voucherBreakdown(vouchersTotal(m)); return <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-amber-700">{bd.c50 > 0 ? bd.c50 : "—"}</td>; }, total: () => <td className="px-3 py-3 text-center whitespace-nowrap text-amber-700 font-bold">{v50Total}</td> },
      ] : []),
      { key: "total", label: "סה״כ", header: <ColumnHeader label={<span className="text-primary">סה״כ</span>} align="center" sortDir={sortState.key === "total" ? sortState.dir : null} onSort={() => onSort("total")} filterOptions={filterOptions.total || []} filterValue={filters.total || []} onFilterChange={(v) => onFilter("total", v)} />, td: (m) => <td className="px-3 py-2 text-center font-bold text-primary whitespace-nowrap">{memberTotal(m) > 0 ? fmt(memberTotal(m)) : "—"}</td>, total: () => <td className="px-3 py-3 text-center text-primary whitespace-nowrap">{fmt(grandTotal)}</td> },
    ];
    return cols;
  }, [tableCats, showVoucherBreakdown, sortState, filters, filterOptions, points, vouchersOverrides, sortedMembers, tableTotalsByCat, vouchersGrandTotal, v1000Total, v500Total, v100Total, v50Total, grandTotal]);
  const orderedCols = useMemo(() => [...colOrder.map((k) => holidayColumns.find((c) => c.key === k)).filter(Boolean), ...holidayColumns.filter((c) => !colOrder.includes(c.key))], [colOrder, holidayColumns]);

  const fundPct = (c) => (c.fund_participation != null ? Number(c.fund_participation) : 100);
  const fundCostByCat = useMemo(() => categories.map((c, i) => {
    if (c.method === "from_distribution") {
      return sortedMembers.reduce((s, m) => s + (distRecipients[c.distribution_id]?.[m.id]?.fund_participation || 0), 0);
    }
    return Math.round(totalsByCat[i] * fundPct(c) / 100);
  }), [categories, totalsByCat, sortedMembers, distRecipients]);
  const totalFundCost = useMemo(() => fundCostByCat.reduce((s, v) => s + v, 0), [fundCostByCat]);
  const pointsDistribution = useMemo(() => {
    const map = new Map();
    sortedMembers.forEach((m) => {
      const p = Number(points[m.id]) || 0;
      if (p > 0) map.set(p, (map.get(p) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [sortedMembers, points]);

  const openAddCat = () => { setEditingCat(null); setDraft(emptyCat()); setCatOpen(true); };
  const openEditCat = (c) => {
    setEditingCat(c);
    let d = { ...c };
    if (d.method === "rules") {
      // נקה תנאי received_from_cat ישנים שכבר לא נתמכים (הוחלף ב-received_from_distribution)
      d.conditions = (d.conditions || []).filter((c) => c.field !== "received_from_cat");
      if (!d.conditions) d.conditions = [];
      if (!d.calculations) d.calculations = [{ id: uid(), type: d.rules_amount_type === "per_child" ? "per_child" : "per_person", amount: Number(d.rules_amount) || 0 }];
      d.conditions = d.conditions || [];
      d.calculations = d.calculations || [];
    }
    setDraft(d);
    setCatOpen(true);
  };

  const validateCat = () => {
    if (!draft.name.trim()) { toast({ title: "נא להזין שם קטגוריה", variant: "destructive" }); return false; }
    if ((draft.method === "points" || draft.method === "children") && !(Number(draft.base_amount) > 0)) {
      toast({ title: "נא להזין סכום בסיס", variant: "destructive" }); return false;
    }
    if (draft.method === "from_distribution" && !draft.distribution_id) {
      toast({ title: "נא לבחור חלוקה", variant: "destructive" }); return false;
    }
    if (draft.method === "rules" && !((draft.calculations || []).some((c) => Number(c.amount) > 0))) {
      toast({ title: "נא להוסיף לפחות חישוב אחד עם סכום", variant: "destructive" }); return false;
    }
    return true;
  };
  const onSaveClick = () => {
    if (!validateCat()) return;
    if (draft.method === "rules") { setPreviewCat({ ...draft }); return; }
    saveCat();
  };
  const saveCat = async () => {
    setSaving(true);
    try {
      const clean = { ...draft, name: draft.name.trim() };
      delete clean.rules_min_children; delete clean.rules_not_received_cat; delete clean.rules_amount_type; delete clean.rules_amount;
      let next;
      if (editingCat) next = categories.map((c) => (c.id === editingCat.id ? clean : c));
      else next = [...categories, clean];
      setCategories(next);
      await base44.entities.Distribution.update(dist.id, { categories: JSON.stringify(next) });
      setCatOpen(false);
      setPreviewCat(null);
      onChange?.();
    } catch (e) {
      toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const removeCat = async (c) => {
    if (!confirm(`למחוק את הקטגוריה "${c.name}"?`)) return;
    const next = categories.filter((x) => x.id !== c.id);
    setCategories(next);
    try { await base44.entities.Distribution.update(dist.id, { categories: JSON.stringify(next) }); onChange?.(); }
    catch (e) { toast({ title: "שגיאה במחיקה", description: e.message, variant: "destructive" }); }
  };

  const setMemberPoints = (memberId, value) => {
    setPoints((prev) => {
      const next = { ...prev };
      const n = Number(value);
      if (value === "" || Number.isNaN(n) || n === 0) delete next[memberId];
      else next[memberId] = n;
      return next;
    });
  };
  const setMemberVouchers = (memberId, value) => {
    setVouchersOverrides((prev) => {
      const next = { ...prev };
      const n = Number(value);
      if (value === "" || Number.isNaN(n)) delete next[memberId];
      else next[memberId] = n;
      return next;
    });
  };

  // debounced persist on categories changes
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await base44.entities.Distribution.update(dist.id, { categories: JSON.stringify(categories) }); }
      catch (e) { /* silent */ }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [categories]);

  // debounced persist on points changes
  useEffect(() => {
    if (pointsTimer.current) clearTimeout(pointsTimer.current);
    pointsTimer.current = setTimeout(async () => {
      try { await base44.entities.Distribution.update(dist.id, { points: JSON.stringify(points) }); }
      catch (e) { /* silent */ }
    }, 600);
    return () => { if (pointsTimer.current) clearTimeout(pointsTimer.current); };
  }, [points]);
  // debounced persist on vouchers overrides
  useEffect(() => {
    if (overridesTimer.current) clearTimeout(overridesTimer.current);
    overridesTimer.current = setTimeout(async () => {
      try { await base44.entities.Distribution.update(dist.id, { vouchers_overrides: JSON.stringify(vouchersOverrides) }); }
      catch (e) { /* silent */ }
    }, 600);
    return () => { if (overridesTimer.current) clearTimeout(overridesTimer.current); };
  }, [vouchersOverrides]);

  const exportCsv = () => {
    const vCols = showVoucherBreakdown ? ["תווי 1000", "תווי 500", "תווי 100", "תווי 50"] : [];
    const header = ["שם משפחה", "שם פרטי", "ת.ז.", "נייד", "ילדים", "נקודות", ...categories.map((c) => c.name), "סה״כ תוים", ...vCols, "סהכ"];
    const rows = sortedMembers.map((m) => {
      const bd = voucherBreakdown(vouchersTotal(m));
      const vCells = showVoucherBreakdown ? [bd.c1000, bd.c500, bd.c100, bd.c50] : [];
      return [
        m.last_name || "", m.first_name || "", m.id_number || "", m.mobile || "", m.children_count || 0, points[m.id] || 0,
        ...categories.map((c) => memberAmount(c, m)), vouchersTotal(m), ...vCells, memberTotal(m),
      ];
    });
    const vTotals = showVoucherBreakdown ? [v1000Total, v500Total, v100Total, v50Total] : [];
    const all = [header, ...rows, ["", "", "", "", "סה״כ נקודות/סכום", ...totalsByCat, vouchersGrandTotal, ...vTotals, grandTotal]];
    const csv = "\uFEFF" + all.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `${(dist.title || "תמיכת חגים").replace(/[\\/]/g, "-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const distName = (id) => allDists.find((d) => d.id === id)?.title || "—";

  return (
    <div className="space-y-5">
      {/* Category management */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-primary" /> קטגוריות תמיכה ({categories.length})</h2>
          <Button size="sm" onClick={openAddCat}><Plus className="w-4 h-4 ml-1" /> הוסף קטגוריה</Button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">הגדירו נקודות לכל חבר בעמודת הנקודות, ואז הוסיפו קטגוריית נקודות כדי לחשב סכומי תמיכה.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map((c, i) => (
              <div key={c.id} className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-fuchsia-800">{c.name}</span>
                <span className="text-xs text-fuchsia-600">
                  {c.method === "points" && `· ₪${c.base_amount} × נקודות`}
                  {c.method === "children" && `· ₪${c.base_amount} × ילדים`}
                  {c.method === "from_distribution" && `· מחלוקה: ${distName(c.distribution_id)}`}
                  {c.method === "rules" && `· ${(c.conditions||[]).length} תנאים · ${(c.calculations||[]).length} חישובים`}
                </span>
                <span className="text-xs text-muted-foreground">· {fmt(totalsByCat[i])}</span>
                {c.method === "rules" && <button onClick={() => setListCat(c)} title="רשימת מקבלים והסבר" className="text-muted-foreground hover:text-primary"><List className="w-3.5 h-3.5" /></button>}
                <button onClick={() => openEditCat(c)} className="text-muted-foreground hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeCat(c)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Users className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{recipientsCount}</p>
          <p className="text-xs text-muted-foreground">מקבלים עם סכום</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-50 text-fuchsia-700 flex items-center justify-center"><Coins className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{pointsCount}</p>
          <p className="text-xs text-muted-foreground mb-2">חברים עם נקודות</p>
          <div className="space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
            {pointsDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין נקודות</p>
            ) : pointsDistribution.map(([p, cnt]) => (
              <div key={p} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p} נקודות</span>
                <span className="font-medium">{cnt} חברים</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Coins className="w-5 h-5" /></div>
          <p className="text-2xl font-bold mt-2">{fmt(grandTotal)}</p>
          <p className="text-xs text-muted-foreground">סה״כ תמיכה למקבלים</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 lg:col-span-2">
          <p className="text-xs text-muted-foreground mb-2 font-semibold">סה״כ לקטגוריה</p>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין קטגוריות</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-right font-medium pb-1.5">קטגוריה</th>
                  <th className="text-center font-medium pb-1.5">סה״כ למקבלים</th>
                  <th className="text-center font-medium pb-1.5">עלות לקופה</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5"><span className="truncate block max-w-[120px]">{c.name}</span></td>
                    <td className="py-1.5 text-center whitespace-nowrap font-medium">{fmt(totalsByCat[i])}</td>
                    <td className="py-1.5 text-center whitespace-nowrap text-amber-700 font-medium">{fmt(fundCostByCat[i])}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t border-border">
                  <td className="pt-2">סה״כ כללי</td>
                  <td className="pt-2 text-center whitespace-nowrap text-primary">{fmt(grandTotal)}</td>
                  <td className="pt-2 text-center whitespace-nowrap text-amber-700">{fmt(totalFundCost)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש חבר קהילה..." className="pr-9" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} className="w-4 h-4 accent-primary" />
          הצג רק בעלי סכום
        </label>
        <Button size="sm" variant={showVoucherBreakdown ? "default" : "outline"} onClick={() => setShowVoucherBreakdown((v) => !v)}><Coins className="w-4 h-4 ml-1" /> חישוב תוים 1000/500/100/50</Button>
        <div className="flex gap-2 mr-auto">
          <ColumnOrderButton columns={holidayColumns.map((c) => ({ key: c.key, label: c.label }))} order={colOrder.length ? colOrder : holidayColumns.map((c) => c.key)} onOrderChange={setColOrder} defaultOrder={holidayColumns.map((c) => c.key)} />
          <CopyPhonesButton phones={phones} />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={sortedMembers.length === 0}><Download className="w-4 h-4 ml-1" /> ייצוא</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div ref={tableScrollRef} className="overflow-x-auto scrollbar-thin">
          <table ref={tableRef} className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <ColumnHeader stickyRight={stickyOffsets[0] ?? 0} stickyShadow label="שם משפחה" sortDir={sortState.key === "last_name" ? sortState.dir : null} onSort={() => onSort("last_name")} filterOptions={filterOptions.last_name || []} filterValue={filters.last_name || []} onFilterChange={(v) => onFilter("last_name", v)} />
                <ColumnHeader stickyRight={stickyOffsets[1] ?? 0} label="שם פרטי" sortDir={sortState.key === "first_name" ? sortState.dir : null} onSort={() => onSort("first_name")} filterOptions={filterOptions.first_name || []} filterValue={filters.first_name || []} onFilterChange={(v) => onFilter("first_name", v)} />
                {orderedCols.map((c) => <React.Fragment key={c.key}>{c.header}</React.Fragment>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedMembers.length === 0 && (
                <tr><td colSpan={2 + orderedCols.length} className="px-4 py-10 text-center text-muted-foreground">אין חברים להצגה</td></tr>
              )}
              {sortedMembers.map((m) => (
                <tr key={m.id} className="hover:bg-secondary/30">
                  <td style={{ position: "sticky", right: stickyOffsets[0] ?? 0, zIndex: 2, boxShadow: "-3px 0 4px rgba(0,0,0,0.07)" }} className="px-3 py-2 font-medium bg-card">{m.last_name || ""}</td>
                  <td style={{ position: "sticky", right: stickyOffsets[1] ?? 0, zIndex: 2 }} className="px-3 py-2 bg-card">{m.first_name || ""}</td>
                  {orderedCols.map((c) => <React.Fragment key={c.key}>{c.td(m)}</React.Fragment>)}
                </tr>
              ))}
            </tbody>
            {sortedMembers.length > 0 && (
              <tfoot className="bg-secondary/50 border-t border-border">
                <tr className="text-right font-semibold">
                  <td style={{ position: "sticky", right: stickyOffsets[0] ?? 0, zIndex: 2, boxShadow: "-3px 0 4px rgba(0,0,0,0.07)" }} className="px-3 py-3 bg-secondary/50" colSpan={2}>סה״כ ({sortedMembers.length} חברים)</td>
                  {orderedCols.map((c) => <React.Fragment key={c.key}>{c.total()}</React.Fragment>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <StickyScrollBar targetRef={tableScrollRef} className="rounded-b-2xl" />
      {categories.length > 0 && (
        <p className="text-xs text-muted-foreground">הנקודות והסכומים מתעדכנים ונשמרים אוטומטית.</p>
      )}

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] !flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-2"><DialogTitle>{editingCat ? "עריכת קטגוריה" : "הוספת קטגוריה"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 px-6 overflow-y-auto scrollbar-thin flex-1 min-h-0">
            <div className="space-y-1.5">
              <Label>שם הקטגוריה *</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="לדוגמה: מתנדבים" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>סוג חישוב</Label>
              <Select value={draft.method} onValueChange={(v) => setDraft((d) => ({ ...d, method: v, ...(v === "rules" ? { conditions: d.conditions || [], calculations: d.calculations || [] } : {}) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(draft.method === "points" || draft.method === "children") && (
              <div className="space-y-1.5">
                <Label>סכום בסיס (₪) *</Label>
                <Input type="number" min="0" value={draft.base_amount || ""} onChange={(e) => setDraft((d) => ({ ...d, base_amount: Number(e.target.value) || 0 }))} placeholder="לדוגמה 100" />
                <p className="text-xs text-muted-foreground">
                  {draft.method === "points" ? "הסכום מוכפל בנקודות שמוגדרות לכל חבר בעמודת הנקודות." : "הסכום מוכפל במספר הילדים של כל חבר."}
                </p>
              </div>
            )}
            {draft.method === "from_distribution" && (
              <div className="space-y-1.5">
                <Label>בחירת חלוקה קיימת *</Label>
                <Select value={draft.distribution_id} onValueChange={(v) => setDraft((d) => ({ ...d, distribution_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר חלוקה..." /></SelectTrigger>
                  <SelectContent>
                    {allDists.filter((d) => d.id !== dist.id).map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">הסכומים מתוך החלוקה שנבחרה יופיעו כעמודה בטבלה.</p>
              </div>
            )}
            {draft.method === "rules" && (
              <div className="space-y-4 rounded-lg border border-fuchsia-100 bg-fuchsia-50/50 p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>תנאים ({(draft.conditions || []).length})</Label>
                    <div className="flex items-center gap-2">
                      {loadingForms && <span className="text-xs text-muted-foreground">טוען נתוני טפסים…</span>}
                      <Button size="sm" variant="outline" type="button" onClick={() => setDraft((d) => ({ ...d, conditions: [...(d.conditions || []), { id: uid(), field: "children_count", op: ">=", value: 0, mode: "include" }] }))}><Plus className="w-3.5 h-3.5" /> הוסף תנאי</Button>
                    </div>
                  </div>
                  {(draft.conditions || []).map((cond) => (
                    <div key={cond.id} className="flex items-center gap-2 flex-wrap bg-card border rounded-md p-2">
                      <Select value={cond.mode || "include"} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, mode: v } : x)) }))}>
                        <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="include">כן יקבל</SelectItem>
                          <SelectItem value="exclude">לא יקבל</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={cond.field} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, field: v, op: defaultOpForField(v), value: v === "received_from_distribution" || v === "form_column" ? "" : x.value, ...(v === "received_from_distribution" ? { values: Array.isArray(x.values) ? x.values : (x.value ? [x.value] : []) } : {}), ...(v === "form_column" ? { form_id: x.form_id || "", form_column: x.form_column || "" } : {}) } : x)) }))}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {cond.field === "received_from_distribution" ? (
                        <>
                          <Select value={cond.op} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, op: v } : x)) }))}>
                            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="received">קיבל</SelectItem>
                              <SelectItem value="not_received">לא קיבל</SelectItem>
                            </SelectContent>
                          </Select>
                          {(() => {
                            const selected = Array.isArray(cond.values) ? cond.values : (cond.value ? [cond.value] : []);
                            const toggle = (id) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, values: selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id] } : x)) }));
                            const label = selected.length === 0 ? "בחר חלוקות..." : selected.length === 1 ? (allDists.find((d) => d.id === selected[0])?.title || "חלוקה") : `${selected.length} חלוקות נבחרו`;
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" className="flex-1 h-8 text-xs flex items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 shadow-sm hover:bg-accent">
                                    <span className={selected.length === 0 ? "text-muted-foreground" : ""}>{label}</span>
                                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0" align="start">
                                  <div className="max-h-64 overflow-y-auto scrollbar-thin p-1">
                                    {allDists.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">טוען חלוקות…</div>}
                                    {allDists.map((d) => {
                                      const checked = selected.includes(d.id);
                                      return (
                                        <button key={d.id} type="button" onClick={() => toggle(d.id)} className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs text-right hover:bg-accent">
                                          <Checkbox checked={checked} className="pointer-events-none" />
                                          <span className="flex-1 truncate">{d.title}{d.date ? ` (${d.date})` : ""}{d.id === dist?.id ? " (נוכחית)" : ""}</span>
                                        </button>
                                      );
                                    })}
                                    {categories.filter((c) => c.method === "rules" && c.id !== editingCat?.id).length > 0 && (
                                      <div className="px-2 py-1 text-xs text-muted-foreground font-semibold border-t border-border">חוקים בחלוקה נוכחית</div>
                                    )}
                                    {categories.filter((c) => c.method === "rules" && c.id !== editingCat?.id).map((c) => {
                                      const localId = `local:${c.id}`;
                                      const checked = selected.includes(localId);
                                      return (
                                        <button key={localId} type="button" onClick={() => toggle(localId)} className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs text-right hover:bg-accent">
                                          <Checkbox checked={checked} className="pointer-events-none" />
                                          <span className="flex-1 truncate">{c.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                        </>
                      ) : cond.field === "form_column" ? (
                        <>
                          <Select value={cond.form_id || ""} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, form_id: v, form_column: "" } : x)) }))}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="בחר טופס..." /></SelectTrigger>
                            <SelectContent>
                              {formConfigs.length === 0 ? <div className="px-2 py-1.5 text-xs text-muted-foreground">אין טפסים מוגדרים</div> : formConfigs.map((fc) => <SelectItem key={fc.id} value={fc.id}>{fc.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {cond.form_id && (() => {
                            const cfg = formConfigs.find((c) => c.id === cond.form_id);
                            const titles = parseTitlesJson(cfg?.titles);
                            const colOptions = Object.entries(titles).filter(([k]) => k !== "ID" && k !== "CreatedDate");
                            return (
                              <Select value={cond.form_column || ""} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, form_column: v } : x)) }))}>
                                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="בחר עמודה..." /></SelectTrigger>
                                <SelectContent>
                                  {colOptions.length === 0 ? <div className="px-2 py-1.5 text-xs text-muted-foreground">אין עמודות</div> : colOptions.map(([code, label]) => <SelectItem key={code} value={code}>{label || code}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                          <Select value={cond.op} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, op: v } : x)) }))}>
                            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="is_yes">סומן כן</SelectItem>
                              <SelectItem value="is_no">לא סומן / ריק</SelectItem>
                              <SelectItem value="has_text">מכיל טקסט כלשהו</SelectItem>
                              <SelectItem value="not_found">לא נמצא בטופס</SelectItem>
                              <SelectItem value="==">שווה</SelectItem>
                              <SelectItem value="!=">שונה</SelectItem>
                              <SelectItem value=">=">≥</SelectItem>
                              <SelectItem value="<=">≤</SelectItem>
                              <SelectItem value=">">גדול מ-</SelectItem>
                              <SelectItem value="<">קטן מ-</SelectItem>
                            </SelectContent>
                          </Select>
                          {cond.op !== "is_yes" && cond.op !== "is_no" && cond.op !== "has_text" && cond.op !== "not_found" && (
                            <Input
                              type={cond.op === "==" || cond.op === "!=" ? "text" : "number"}
                              value={cond.value || ""}
                              onChange={(e) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, value: e.target.value } : x)) }))}
                              placeholder="ערך"
                              className="flex-1 h-8 text-sm"
                            />
                          )}
                        </>
                      ) : cond.field === "neighborhood" || cond.field === "city" ? (
                        <>
                          <Select value={cond.op} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, op: v } : x)) }))}>
                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="==">שווה</SelectItem>
                              <SelectItem value="!=">שונה</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input value={cond.value || ""} onChange={(e) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, value: e.target.value } : x)) }))} placeholder="ערך" className="flex-1 h-8 text-sm" />
                        </>
                      ) : (
                        <>
                          <Select value={cond.op} onValueChange={(v) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, op: v } : x)) }))}>
                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value=">=">≥</SelectItem>
                              <SelectItem value="<=">≤</SelectItem>
                              <SelectItem value=">">גדול מ-</SelectItem>
                              <SelectItem value="<">קטן מ-</SelectItem>
                              <SelectItem value="==">שווה</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" value={cond.value || ""} onChange={(e) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x) => (x.id === cond.id ? { ...x, value: Number(e.target.value) || 0 } : x)) }))} placeholder="ערך" className="flex-1 h-8 text-sm" />
                        </>
                      )}
                      <Button size="icon" variant="ghost" type="button" onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((x) => x.id !== cond.id) }))} className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  {(draft.conditions || []).length === 0 && <p className="text-xs text-muted-foreground">אין תנאים — כל החברים ייכללו בחישוב.</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>חישובים ({(draft.calculations || []).length})</Label>
                    <Button size="sm" variant="outline" type="button" onClick={() => setDraft((d) => ({ ...d, calculations: [...(d.calculations || []), { id: uid(), type: "per_person", amount: 0 }] }))}><Plus className="w-3.5 h-3.5" /> הוסף חישוב</Button>
                  </div>
                  {(draft.calculations || []).map((calc) => (
                    <div key={calc.id} className="flex items-center gap-2 bg-card border rounded-md p-2">
                      <Input type="number" min="0" value={calc.amount || ""} onChange={(e) => setDraft((d) => ({ ...d, calculations: d.calculations.map((x) => (x.id === calc.id ? { ...x, amount: Number(e.target.value) || 0 } : x)) }))} placeholder="₪" className="w-24 h-8 text-sm" />
                      <Select value={calc.type} onValueChange={(v) => setDraft((d) => ({ ...d, calculations: d.calculations.map((x) => (x.id === calc.id ? { ...x, type: v } : x)) }))}>
                        <SelectTrigger className="flex-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CALC_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" type="button" onClick={() => setDraft((d) => ({ ...d, calculations: d.calculations.filter((x) => x.id !== calc.id) }))} className="h-8 w-8 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  {(draft.calculations || []).length === 0 && <p className="text-xs text-muted-foreground">אין חישובים — הסכום יהיה 0.</p>}
                </div>
                <p className="text-xs text-muted-foreground">תנאי "כן יקבל" — חייב לעמוד בכולם. תנאי "לא יקבל" — מי שעומד בו נפסל. מי שעומד בכל ה"כן יקבל" ובאף "לא יקבל" מקבל את סכום החישובים. אחרי שמירה, לחצו על סמל הרשימה כדי לראות מקבלים עם הסבר.</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 pt-3 border-t border-border bg-background rounded-b-lg">
            <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
            <Button type="button" disabled={saving} onClick={onSaveClick}>{saving ? "שומר…" : editingCat ? "שמור שינויים" : "הוסף קטגוריה"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview before saving rules category */}
      <Dialog open={!!previewCat} onOpenChange={(o) => !o && setPreviewCat(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>תצוגה מקדימה — {previewCat?.name}</DialogTitle></DialogHeader>
          {previewCat && (() => {
            const previewMembers = [...members].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "", "he") || (a.first_name || "").localeCompare(b.first_name || "", "he"));
            const recipients = previewMembers.map((m) => rulesBreakdown(previewCat, m)).filter((bd) => bd.matched && bd.total > 0);
            const totalSum = recipients.reduce((s, bd) => s + bd.total, 0);
            return (
              <>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <span><strong className="text-foreground">{recipients.length}</strong> מקבלים</span>
                  <span>סה"כ: <strong className="text-primary">{fmt(totalSum)}</strong></span>
                </div>
                {recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">אין מקבלים העומדים בתנאים. בדקו את התנאים והחישובים.</p>
                ) : (
                  <div className="max-h-[55vh] overflow-y-auto scrollbar-thin border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="text-right px-3 py-2 font-medium">שם</th>
                          <th className="text-right px-3 py-2 font-medium">ת.ז.</th>
                          <th className="text-center px-3 py-2 font-medium">סכום</th>
                          <th className="text-right px-3 py-2 font-medium">הסבר</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewMembers.map((m) => {
                          const bd = rulesBreakdown(previewCat, m);
                          if (!bd.matched || bd.total === 0) return null;
                          return (
                            <tr key={m.id}>
                              <td className="px-3 py-2 font-medium">{m.last_name} {m.first_name}</td>
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.id_number || "—"}</td>
                              <td className="px-3 py-2 text-center font-bold text-primary whitespace-nowrap">{fmt(bd.total)}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{bd.parts.map((p) => p.detail).join(" + ")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" type="button">חזרה לעריכה</Button></DialogClose>
                  <Button type="button" disabled={saving} onClick={saveCat}>{saving ? "שומר…" : "אישור והוספה לטבלה"}</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Preview before saving rules category */}
      <Dialog open={!!previewCat} onOpenChange={(o) => !o && setPreviewCat(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>תצוגה מקדימה — {previewCat?.name}</DialogTitle></DialogHeader>
          {previewCat && (() => {
            const previewMembers = [...members].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "", "he") || (a.first_name || "").localeCompare(b.first_name || "", "he"));
            const recipients = previewMembers.map((m) => rulesBreakdown(previewCat, m)).filter((bd) => bd.matched && bd.total > 0);
            const totalSum = recipients.reduce((s, bd) => s + bd.total, 0);
            return (
              <>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <span><strong className="text-foreground">{recipients.length}</strong> מקבלים</span>
                  <span>סה"כ: <strong className="text-primary">{fmt(totalSum)}</strong></span>
                </div>
                {recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">אין מקבלים העומדים בתנאים. בדקו את התנאים והחישובים.</p>
                ) : (
                  <div className="max-h-[55vh] overflow-y-auto scrollbar-thin border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="text-right px-3 py-2 font-medium">שם</th>
                          <th className="text-right px-3 py-2 font-medium">ת.ז.</th>
                          <th className="text-center px-3 py-2 font-medium">סכום</th>
                          <th className="text-right px-3 py-2 font-medium">הסבר</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {previewMembers.map((m) => {
                          const bd = rulesBreakdown(previewCat, m);
                          if (!bd.matched || bd.total === 0) return null;
                          return (
                            <tr key={m.id}>
                              <td className="px-3 py-2 font-medium">{m.last_name} {m.first_name}</td>
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.id_number || "—"}</td>
                              <td className="px-3 py-2 text-center font-bold text-primary whitespace-nowrap">{fmt(bd.total)}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">{bd.parts.map((p) => p.detail).join(" + ")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline" type="button">חזרה לעריכה</Button></DialogClose>
                  <Button type="button" disabled={saving} onClick={saveCat}>{saving ? "שומר…" : "אישור והוספה לטבלה"}</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Recipients list with explanation for rules category */}
      <Dialog open={!!listCat} onOpenChange={(o) => !o && setListCat(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>רשימת מקבלים — {listCat?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-right px-3 py-2 font-medium">שם</th>
                  <th className="text-right px-3 py-2 font-medium">ת.ז.</th>
                  <th className="text-center px-3 py-2 font-medium">סכום</th>
                  <th className="text-right px-3 py-2 font-medium">הסבר</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listCat && [...members].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "", "he") || (a.first_name || "").localeCompare(b.first_name || "", "he")).map((m) => {
                  const bd = rulesBreakdown(listCat, m);
                  if (!bd.matched || bd.total === 0) return null;
                  return (
                    <tr key={m.id}>
                      <td className="px-3 py-2 font-medium">{m.last_name} {m.first_name}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{m.id_number || "—"}</td>
                      <td className="px-3 py-2 text-center font-bold text-primary whitespace-nowrap">{fmt(bd.total)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{bd.parts.map((p) => p.detail).join(" + ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" type="button">סגור</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}