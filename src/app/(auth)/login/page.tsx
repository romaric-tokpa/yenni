"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email et mot de passe requis");
      return;
    }

    setSubmitting(true);
    const err = await login(email, password);
    if (err) setError(err);
    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-6 sm:p-8 max-w-md w-full animate-slide-up">
        <div className="text-center mb-6">
          <div className="mb-3 flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 flex items-center justify-center p-2">
              <img src="/api/logo" alt="Yenni" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent">
            Connexion
          </h1>
          <p className="text-slate-500 text-xs mt-1">Accède à ton espace Yenni</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Email</label>
            <input className="input-field text-sm" type="email" placeholder="jean@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Mot de passe</label>
            <div className="relative">
              <input className="input-field text-sm pr-10" type={showPwd ? "text" : "password"}
                placeholder="Ton mot de passe" value={password}
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-1 disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Pas encore de compte ?{" "}
          <Link href="/register" prefetch={false} className="text-emerald-400 hover:text-emerald-300 font-medium">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
