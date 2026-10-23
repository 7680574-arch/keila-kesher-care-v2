import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Plus, UserPlus, Phone, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/badges";
import ClientForm from "@/components/ClientForm";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const load = async () => {
    const [c, k] = await Promise.all([
      base44.entities.Client.list("-created_date"),
      base44.entities.Case.list(),
    ]);
    setClients(c);
    setCases(k);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const caseCount = useMemo(() => {
    const m = {};
    cases.forEach((x) => { m[x.client_id] = (m[x.client_id] || 0) + 1; });
    return m;
  }, [cases]);

  const filtered = clients.filter((c) => {
    const q = search.trim();
    if (!q) return true;
    return (c.full_name || "").includes(q) || (c.id_number || "").includes(q) || (c.phone || "").includes(q);
  });

  const saveClient = async (data) => {
    if (editClient) {
      await base44.entities.Client.update(editClient.id, data);
    } else {
      await base44.entities.Client.create(data);
    }
    setFormOpen(false);
    setEditClient(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">לקוחות</h1>
          <p className="text-muted-foreground mt-1">{clients.length} לקוחות רשומים</p>
        </div>
        <Button
          onClick={() => { setEditClient(null); setFormOpen(true); }}
          className="bg-primary"
        >
          <UserPlus className="w-4 h-4 ml-2" /> לקוח חדש
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם, תעודת זהות או טלפון..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center">
          <p className="text-muted-foreground">לא נמצאו לקוחות</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/15 to-accent/15 text-primary flex items-center justify-center font-bold text-sm">
                    {(c.full_name || "?").slice(0, 2)}
                  </div>
                  <div>
                    <Link to={`/clients/${c.id}`} className="font-semibold hover:text-primary transition">
                      {c.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.id_number || "—"}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {c.phone && (
                  <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone}</p>
                )}
                {c.address && (
                  <p className="truncate text-xs">{c.address}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {caseCount[c.id] || 0} תיקים
                </span>
                <Link to={`/clients/${c.id}`} className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-2 transition-all">
                  פתיחה <ChevronLeft className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientForm open={formOpen} onOpenChange={setFormOpen} onSubmit={saveClient} initial={editClient} />
    </div>
  );
}