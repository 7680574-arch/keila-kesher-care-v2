import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, ClipboardList, Loader2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import ServiceRequestFormDialog from "@/components/ServiceRequestFormDialog";
import ServiceRequestDetailDialog from "@/components/ServiceRequestDetailDialog";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, STATUS_STYLES, PRIORITY_STYLES } from "@/lib/serviceLabels";

export default function ServiceRequests() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ServiceRequest.list("-created_date", 500);
      setRequests(list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
    load();
  }, [load]);

  const isAdmin = user?.role === "admin";

  // קישור ישיר מהמייל: /service?open=<id>
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get("open");
    if (!openId || requests.length === 0) return;
    const found = requests.find((r) => r.id === openId);
    if (found) setSelected(found);
  }, [requests]);

  const stats = {
    total: requests.length,
    new: requests.filter((r) => r.status === "new").length,
    inProgress: requests.filter((r) => r.status === "in_progress").length,
    resolved: requests.filter((r) => r.status === "resolved").length,
  };

  const columns = [
    {
      key: "title",
      field: "title",
      header: "כותרת",
      sortable: true,
      filterable: true,
      render: (r) => <span className="font-medium">{r.title}</span>,
    },
    ...(isAdmin
      ? [{
          key: "requester",
          field: "requester_name",
          header: "פותח הקריאה",
          sortable: true,
          filterable: true,
          hideOnMobile: true,
          render: (r) => r.requester_name || "—",
        }]
      : []),
    {
      key: "category",
      field: "category",
      header: "קטגוריה",
      sortable: true,
      filterable: true,
      hideOnMobile: true,
      render: (r) => CATEGORY_LABELS[r.category] || r.category || "—",
    },
    {
      key: "priority",
      field: "priority",
      header: "דחיפות",
      sortable: true,
      filterable: true,
      render: (r) => (
        <Badge className={PRIORITY_STYLES[r.priority] || "bg-slate-100 text-slate-600"}>{PRIORITY_LABELS[r.priority] || r.priority}</Badge>
      ),
    },
    {
      key: "status",
      field: "status",
      header: "סטטוס",
      sortable: true,
      filterable: true,
      render: (r) => (
        <Badge className={STATUS_STYLES[r.status] || "bg-slate-100 text-slate-600"}>{STATUS_LABELS[r.status] || r.status}</Badge>
      ),
    },
    {
      key: "created_date",
      field: "created_date",
      header: "תאריך פתיחה",
      sortable: true,
      hideOnMobile: true,
      render: (r) => (r.created_date ? new Date(r.created_date).toLocaleDateString("he-IL") : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Wrench className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">שירות רזאור</h1>
            <p className="text-sm text-muted-foreground">פתיחת קריאות שירות ומעקב טיפול</p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4" />
          פתיחת קריאה
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="סך הכל קריאות" value={stats.total} />
        <StatCard label="חדשות" value={stats.new} tone="blue" />
        <StatCard label="בטיפול" value={stats.inProgress} tone="amber" />
        <StatCard label="טופלו" value={stats.resolved} tone="green" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border bg-card">
          <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold">אין קריאות שירות</h2>
          <p className="text-muted-foreground mt-1">לחץ על "פתיחת קריאה" כדי לדווח על בעיה.</p>
        </div>
      ) : (
        <DataTable
          rows={requests}
          columns={columns}
          pageSize={20}
          getRowId={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          emptyMessage="אין קריאות"
        />
      )}

      <ServiceRequestFormDialog open={formOpen} onClose={() => setFormOpen(false)} onCreated={load} />
      <ServiceRequestDetailDialog
        request={selected}
        currentUser={user}
        isAdmin={isAdmin}
        open={!!selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setRequests((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
          setSelected(updated);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    blue: "from-blue-500/10 to-blue-500/5 text-blue-700",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-700",
    green: "from-green-500/10 to-green-500/5 text-green-700",
    default: "from-primary/10 to-primary/5 text-primary",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone] || tones.default} p-4`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}