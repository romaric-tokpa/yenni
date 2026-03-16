"use client";
import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Lock, Eye, EyeOff, User, Trash2, Check, X } from "lucide-react";

export default function ProfileSection({ showToast }: { showToast: (m: string, t?: string) => void }) {
  const { user, changePassword, uploadAvatar, removeAvatar } = useAuth();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [showPwd, setShowPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  if (!user) return null;

  const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const err = await uploadAvatar(file);
    setUploading(false);
    if (err) {
      showToast(err, "error");
    } else {
      showToast("Photo de profil mise à jour");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    const err = await removeAvatar();
    setUploading(false);
    if (err) showToast(err, "error");
    else showToast("Photo supprimée");
  };

  const handlePasswordSubmit = async () => {
    if (!pwdForm.current) { showToast("Mot de passe actuel requis", "error"); return; }
    if (pwdForm.newPwd.length < 6) { showToast("Min. 6 caractères", "error"); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { showToast("Les mots de passe ne correspondent pas", "error"); return; }

    setPwdLoading(true);
    const err = await changePassword(pwdForm.current, pwdForm.newPwd);
    setPwdLoading(false);

    if (err) {
      showToast(err, "error");
    } else {
      showToast("Mot de passe modifié avec succès");
      setPwdForm({ current: "", newPwd: "", confirm: "" });
      setShowPwd(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-4 lg:p-6 mb-4 lg:mb-5">
      <h3 className="text-xs lg:text-sm font-semibold mb-4 flex items-center gap-2">
        <User size={16} className="text-indigo-400" /> Mon Profil
      </h3>

      {/* Avatar + Infos */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative group">
          {user.avatar_path ? (
            <img
              src={user.avatar_path}
              alt="Avatar"
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full object-cover ring-2 ring-indigo-500/40"
            />
          ) : (
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg lg:text-xl ring-2 ring-indigo-500/40">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors shadow-lg"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm lg:text-base font-semibold truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-[11px] lg:text-xs text-slate-400 truncate">{user.email}</p>
          <p className="text-[11px] lg:text-xs text-slate-500 truncate">{user.phone}</p>
        </div>
      </div>

      {/* Actions avatar */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <Camera size={13} />
          {uploading ? "Envoi..." : user.avatar_path ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {user.avatar_path && (
          <button
            onClick={handleRemoveAvatar}
            disabled={uploading}
            className="py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={13} /> Supprimer
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-white/5 my-4" />

      {/* Changement de mot de passe */}
      {!showPwd ? (
        <button
          onClick={() => setShowPwd(true)}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
        >
          <Lock size={14} /> Modifier le mot de passe
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-300 flex items-center gap-2">
            <Lock size={13} className="text-amber-400" /> Modifier le mot de passe
          </p>

          <div className="relative">
            <input
              type={showCur ? "text" : "password"}
              placeholder="Mot de passe actuel"
              value={pwdForm.current}
              onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
              className="input-field text-xs pr-9"
            />
            <button
              type="button"
              onClick={() => setShowCur(!showCur)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              placeholder="Nouveau mot de passe (min. 6 car.)"
              value={pwdForm.newPwd}
              onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
              className="input-field text-xs pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <input
            type={showNew ? "text" : "password"}
            placeholder="Confirmer le nouveau mot de passe"
            value={pwdForm.confirm}
            onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
            className="input-field text-xs"
          />

          <div className="flex gap-2">
            <button
              onClick={() => { setShowPwd(false); setPwdForm({ current: "", newPwd: "", confirm: "" }); }}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs flex items-center justify-center gap-1"
            >
              <X size={13} /> Annuler
            </button>
            <button
              onClick={handlePasswordSubmit}
              disabled={pwdLoading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Check size={13} /> {pwdLoading ? "En cours..." : "Confirmer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
