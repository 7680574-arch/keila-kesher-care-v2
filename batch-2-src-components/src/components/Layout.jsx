import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import { HeartPulse, Menu, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

import { getAllowedTabs, canAccess, NAV_ITEMS } from "@/lib/userTabs";

// ניווט ראשי — מקור יחיד ב-userTabs (NAV_ITEMS)
const nav = NAV_ITEMS;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [formsNew, setFormsNew] = useState(0);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const isCasesLike = u?.role === "guest" || u?.role === "cases" || (u?.role === "user" && !u?.allowed_tabs);
      if (isCasesLike) {
        try {
          const res = await base44.functions.invoke("syncUserAuthorizedCases", {});
          const data = res?.data || res || {};
          u = { ...u, data: { ...(u.data || {}), authorized_cases: data.authorized_cases || [] } };
          if (data.role) u = { ...u, role: data.role };
        } catch (e) {}
      }
      setUser(u);
    }).catch(() => setUser(null));
  }, []);

  // תג שורות חדשות בטפסים — נטען למנהלים בלבד ומתרענן בכל מעבר דף
  useEffect(() => {
    if (!user || user.role !== "admin") { setFormsNew(0); return; }
    base44.entities.FormConfig.list("-created_date", 200)
      .then((list) => setFormsNew((list || []).reduce((s, c) => s + (c.new_count || 0), 0)))
      .catch(() => setFormsNew(0));
  }, [user, location.pathname]);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  if (user?.role === "guest" || user?.role === "cases") {
    const authorized = user?.data?.authorized_cases || [];
    if (authorized.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30" dir="rtl">
          <div className="text-center max-w-sm px-6">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold">אין לך תיקים מורשים</h2>
            <p className="text-muted-foreground mt-2 mb-6">פנה למנהל המערכת כדי לקבל גישה לתיק.</p>
            <Button variant="outline" onClick={() => base44.auth.logout(window.location.href)}>התנתק</Button>
          </div>
        </div>
      );
    }
    const onCase = location.pathname.startsWith("/cases/");
    const currentId = onCase ? location.pathname.split("/cases/")[1]?.split("/")[0] : null;
    if (!onCase || !authorized.includes(currentId)) {
      return <Navigate to={`/cases/${authorized[0]}`} replace />;
    }
    return (
      <div className="min-h-screen bg-muted/30" dir="rtl">
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 h-16 bg-card/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" />
            <span className="font-bold text-sm">מרכז קהילה — תיק משותף</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user.full_name || user.email}</span>
            <Button variant="outline" size="sm" onClick={() => base44.auth.logout(window.location.href)}>התנתק</Button>
          </div>
        </header>
        <main className="p-5 md:p-10 max-w-5xl mx-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-72 bg-card border-l border-border transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 h-20 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                <HeartPulse className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">מרכז קהילה</p>
                <p className="text-xs text-muted-foreground">ניהול תיקים מורכבים</p>
              </div>
            </div>
            <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
            {(() => {
              const visible = nav.filter((item) => {
                if (item.systemOnly) return user?.role === "admin";
                if (user?.role === "admin") return true;
                return getAllowedTabs(user).includes(item.path);
              });
              const compact = visible.length > 9;
              return visible.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 rounded-xl text-sm font-medium transition-all",
                      compact ? "py-2" : "py-3",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", !compact && "shrink-0")} strokeWidth={active ? 2.4 : 2} />
                    {item.label}
                    {item.path === "/forms" && formsNew > 0 && (
                      <span className="mr-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                        {formsNew}
                      </span>
                    )}
                  </Link>
                );
              });
            })()}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="rounded-2xl bg-gradient-to-br from-secondary to-muted/50 p-4">
              <p className="text-xs font-semibold text-foreground">משתמש מחובר</p>
              {user ? (
                <div className="mt-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.full_name || "—"}</p>
                  {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">—</p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 lg:mr-72 min-w-0">
        <header className="sticky top-0 z-20 lg:hidden flex items-center justify-between px-5 h-16 bg-card/80 backdrop-blur border-b border-border">
          <button className="text-muted-foreground" onClick={() => setOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm">מרכז קהילה</span>
        </header>
        <main className="p-5 md:p-10 max-w-7xl mx-auto">
        {user && user.role !== "admin" && !canAccess(user, location.pathname) ? (
          (() => {
            const allowed = getAllowedTabs(user);
            if (allowed.length > 0) {
              return <Navigate to={allowed[0]} replace />;
            }
            return (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShieldCheck className="w-12 h-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold">אין לך גישה לדף זה</h2>
                <p className="text-muted-foreground mt-2">פנה למנהל המערכת כדי לקבל הרשאות גישה.</p>
              </div>
            );
          })()
        ) : <Outlet />}
        </main>
      </div>
    </div>
  );
}