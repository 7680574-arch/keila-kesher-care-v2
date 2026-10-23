import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { TABS, getAllowedTabs } from "@/lib/userTabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ShieldCheck, Search, Loader2, UserPlus } from "lucide-react";

export default function UserAccess() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [q, setQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const { toast } = useToast();

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast({ title: "יש להזין כתובת אימייל", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      // inviteUser מקבל רצק "user" או "admin" — לתפקידים אחרים נזמין כ-user ונעדכן את התפקיד
      const inviteAs = inviteRole === "user" || inviteRole === "admin" ? inviteRole : "user";
      await base44.users.inviteUser(email, inviteAs);
      if (inviteRole !== inviteAs) {
        try {
          const found = await base44.entities.User.filter({ email });
          const nu = Array.isArray(found) && found.length ? found[0] : null;
          if (nu) await base44.entities.User.update(nu.id, { role: inviteRole });
        } catch (_) {}
      }
      toast({ title: "ההזמנה נשלחה בהצלחה", description: email });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      await load();
    } catch (e) {
      toast({
        title: "שגיאה בשליחת ההזמנה",
        description: e?.message || "",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.User.list();
      setUsers(list);
    } catch (e) {
      toast({ title: "שגיאה בטעינת משתמשים", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (u, path) => {
    if (u.role === "admin") return;
    const current = getAllowedTabs(u);
    const added = !current.includes(path);
    const next = added ? [...current, path] : current.filter((p) => p !== path);
    const changedLabel = TABS.find((t) => t.path === path)?.label || path;
    const prevHadAny = current.length > 0;
    const isApproval = !prevHadAny && added;
    setSavingId(u.id);
    try {
      const res = await base44.functions.invoke("updateUserAllowedTabs", {
        user_id: u.id,
        allowed_tabs: next,
      });
      const clean = Array.isArray(res?.allowed_tabs) ? res.allowed_tabs : next;
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id ? { ...x, allowed_tabs: JSON.stringify(clean) } : x
        )
      );
      const allowedLabels = TABS.filter((t) =>
        next.includes(t.path)
      ).map((t) => t.label);
      try {
        await base44.functions.invoke("sendAccessUpdateEmail", {
          email: u.email,
          full_name: u.full_name,
          allowed_labels: allowedLabels,
          changed_label: changedLabel,
          added,
          is_approval: isApproval,
        });
      } catch (mailErr) {
        // ההרשאה נשמרה — שגיאת המייל לא תחזיר את המצב לאחור
        toast({
          title: "ההרשאה נשמרה, אך שליחת מייל העדכון נכשלה",
          description: mailErr?.message || "",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "שגיאה בשמירת ההרשאות", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const changeRole = async (u, role) => {
    if (u.role === role || u.role === "admin") return;
    setSavingId(u.id);
    try {
      await base44.entities.User.update(u.id, { role });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role } : x))
      );
      toast({ title: "התפקיד עודכן בהצלחה" });
    } catch (e) {
      toast({
        title: "שגיאה בעדכון התפקיד",
        description: e?.message || "",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      !q ||
      (u.full_name || "").includes(q) ||
      (u.email || "").includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">ניהול גישות משתמשים</h1>
          <p className="text-sm text-muted-foreground">
            סמן לכל משתמש אילו לשוניות יהיו זמינות לו. מנהלי מערכת תמיד רואים הכל.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative max-w-md flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש משתמש לפי שם או אימייל"
            className="pr-9"
          />
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4" />
          הזמנת משתמש
        </Button>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הזמנת משתמש חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">כתובת אימייל</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">תפקיד</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">משתמש</SelectItem>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="telclick_manager">מנהלת משרד טלקליק</SelectItem>
                  <SelectItem value="cases">תיקים</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              ביטול
            </Button>
            <Button onClick={invite} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "שלח הזמנה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-right font-semibold px-4 py-3 sticky right-0 bg-muted/50">
                  משתמש
                </th>
                {TABS.map((t) => (
                  <th key={t.path} className="font-semibold px-3 py-3 text-center min-w-[110px]">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const allowed = getAllowedTabs(u);
                const isAdmin = u.role === "admin";
                const isTelclickMgr = u.role === "telclick_manager";
                const roleLabel = isAdmin ? "מנהל" : isTelclickMgr ? "מנהלת משרד טלקליק" : "משתמש";
                const roleClass = isAdmin
                  ? "bg-primary/10 text-primary"
                  : isTelclickMgr
                    ? "bg-accent/15 text-accent"
                    : "bg-secondary text-secondary-foreground";
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3 sticky right-0 bg-card">
                      <p className="font-medium">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email || ""}</p>
                      {isAdmin ? (
                        <span
                          className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${roleClass}`}
                        >
                          {roleLabel}
                        </span>
                      ) : savingId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1.5" />
                      ) : (
                        <Select
                          value={u.role || "user"}
                          onValueChange={(r) => changeRole(u, r)}
                        >
                          <SelectTrigger className="mt-1 h-7 w-[170px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">משתמש</SelectItem>
                            <SelectItem value="telclick_manager">מנהלת משרד טלקליק</SelectItem>
                            <SelectItem value="cases">תיקים</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    {TABS.map((t) => (
                      <td key={t.path} className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center">
                          {savingId === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Checkbox
                              checked={isAdmin || allowed.includes(t.path)}
                              disabled={isAdmin}
                              onCheckedChange={() => toggle(u, t.path)}
                            />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={TABS.length + 1} className="text-center text-muted-foreground py-10">
                    לא נמצאו משתמשים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}