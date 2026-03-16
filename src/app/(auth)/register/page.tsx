"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Gem, UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const { register, loading: authLoading } = useAuth();
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", email: "", password: "", confirm_password: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.first_name || !form.last_name || !form.phone || !form.email || !form.password) {
      setError("Tous les champs sont requis");
      return;
    }
    if (form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (form.password !== form.confirm_password) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setSubmitting(true);
    const err = await register(form);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="glass-strong rounded-2xl p-6 sm:p-8 max-w-md w-full animate-slide-up">
        <div className="text-center mb-6">
          <div className="mb-3 flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/20 flex items-center justify-center">
              <Gem size={28} className="text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-400 bg-clip-text text-transparent">
            Créer un compte
          </h1>
          <p className="text-slate-500 text-xs mt-1">Rejoins Yenni pour gérer tes finances</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Prénoms</label>
              <input className="input-field text-sm" placeholder="Jean" value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 mb-1 block">Nom</label>
              <input className="input-field text-sm" placeholder="Dupont" value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Numéro de téléphone</label>
            <input className="input-field text-sm" type="tel" placeholder="+229 90 00 00 00" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Email</label>
            <input className="input-field text-sm" type="email" placeholder="jean@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Nouveau mot de passe</label>
            <div className="relative">
              <input className="input-field text-sm pr-10" type={showPwd ? "text" : "password"}
                placeholder="6 caractères minimum" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">Confirmer le mot de passe</label>
            <div className="relative">
              <input className="input-field text-sm pr-10" type={showConfirm ? "text" : "password"}
                placeholder="Retaper le mot de passe" value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="btn-primary w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {submitting ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
