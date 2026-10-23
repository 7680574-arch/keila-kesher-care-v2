import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowRight, Phone, Mail, MapPin, Calendar, User, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, GenderText, CaseTypeBadge, PriorityBadge } from "@/components/badges";
import ClientForm from "@/components/ClientForm";
import CaseForm from "@/components/CaseForm";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [clientCases, setClientCases] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);

  const load = async () => {
    const [c, cases, all] = await Promise.all([
      base44.entities.Client.get(id),
      base44.entities.Case.filter({ client_id: id }),
      base44.entities.Client.list(),
    ]);
    setClient(c);
    setClientCases(cases);
    setAllClients(all);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const saveClient = async (data) => {
    await base44.entities.Client.update(client.id, data);
    setEditOpen(false);
    load();
  };

  const saveCase = async (data) => {
    const payload = { ...data, client_id: client.id, client_name: client.full_name };
    await base44.entities.Case.create(payload);
    setCaseOpen(false);
    load();
  };

  const removeClient = async () => {
    if (!confirm("האם למחוק את הלקוח לצמיתות?")) return;
    await base44.entities.Client.delete(client.id);
    navigate("/clients");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!client) return <p className="text-muted-foreground">לקוח לא נמצא</p>;

  const age = client.date_of_birth
    ? new Date().getFullYear() - new Date(client.date_of_birth).getFullYear()
    : null;

  return (
    <div className="space-y-6">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
        <ArrowRight className="w-4 h-4" /> חזרה ללקוחות
      </Link>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="bg-gradient-to-l from-primary/5 to-accent/5 p-6 flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-xl font-bold">
            {(client.full_name || "?").slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold">{client.full_name}</h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              ת.ז {client.id_number || "—"}
              {age ? ` · גיל ${age}` : ""}
              {" · "}<GenderText gender={client.gender} />
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 ml-1" /> עריכה
            </Button>
            <Button variant="outline" size="sm" onClick={removeClient} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {client.phone && (
            <InfoRow icon={Phone} label="טלפון" value={client.phone} />
          )}
          {client.email && (
            <InfoRow icon={Mail} label="אימייל" value={client.email} />
          )}
          {client.address && (
            <InfoRow icon={MapPin} label="כתובת" value={client.address} />
          )}
          {client.date_of_birth && (
            <InfoRow icon={Calendar} label="תאריך לידה" value={client.date_of_birth} />
          )}
          {client.emergency_contact && (
            <InfoRow icon={User} label="איש קשר לחירום" value={client.emergency_contact} />
          )}
        </div>

        {client.notes && (
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">הערות כלליות</p>
              <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">תיקים ({clientCases.length})</h2>
          <Button size="sm" onClick={() => setCaseOpen(true)}>
            <Plus className="w-4 h-4 ml-1" /> תיק חדש
          </Button>
        </div>
        <div className="divide-y divide-border">
          {clientCases.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">אין תיקים עדיין</p>
          )}
          {clientCases.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-secondary/50 transition">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.description || ""}</p>
              </div>
              <CaseTypeBadge type={c.type} />
              <PriorityBadge priority={c.priority} />
              <StatusBadge status={c.status} />
            </Link>
          ))}
        </div>
      </div>

      <ClientForm open={editOpen} onOpenChange={setEditOpen} onSubmit={saveClient} initial={client} />
      <CaseForm open={caseOpen} onOpenChange={setCaseOpen} onSubmit={saveCase} clients={allClients} defaultClientId={client.id} />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}