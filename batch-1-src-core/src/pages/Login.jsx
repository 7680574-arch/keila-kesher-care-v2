import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

const LOGO_URL = "https://media.base44.com/images/public/6a832ad9b93533ce28187f0f/757c4e80f_.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError("אימייל או סיסמה שגויים");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", returnTo);
  };

  return (
    <div dir="rtl" className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-hidden bg-slate-900">
      {/* Tiled logo background (פסיפס) */}
      <div
        className="absolute inset-0 bg-repeat"
        style={{
          backgroundImage: `url(${LOGO_URL})`,
          backgroundSize: "220px 220px",
        }}
        aria-hidden="true"
      />
      {/* Dark overlay so the form stays legible */}
      <div className="absolute inset-0 bg-slate-950/80" aria-hidden="true" />
      {/* Subtle brand gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-slate-950/60" aria-hidden="true" />

      {/* Centered login card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white/40 p-8 sm:p-10">
          {/* Logo header */}
          <div className="flex flex-col items-center mb-8">
            <img
              src={LOGO_URL}
              alt="קופת הצדקה - צדקת רבי מאיר בעל הנס"
              className="w-20 h-20 object-contain rounded-2xl bg-white shadow-sm mb-4"
            />
            <h1 className="text-2xl font-bold text-slate-900 text-center">כניסה למערכת</h1>
            <p className="text-sm text-slate-500 mt-1 text-center">מערכת ניהול התיקים הקהילתית</p>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium mb-5 bg-white"
            onClick={handleGoogle}
          >
            <GoogleIcon className="w-5 h-5 ml-2" />
            המשך עם Google
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">או</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10 h-12 bg-slate-50"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700">סיסמה</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  שכחת סיסמה?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 h-12 bg-slate-50"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 font-medium mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מתחבר...
                </>
              ) : (
                "כניסה"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            אין לך חשבון?{" "}
            <Link
              to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
              className="text-primary font-medium hover:underline"
            >
              צור חשבון
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/70 mt-5">
          קופת הצדקה · צדקת רבי מאיר בעל הנס · קרית צאנז עיה"ק טבריה ת"ו
        </p>
      </div>
    </div>
  );
}