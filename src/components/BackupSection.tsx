"use client";

import { useState, useEffect } from "react";
import { Database, Download, Upload, RefreshCw, AlertTriangle } from "lucide-react";

interface BackupSectionProps {
  showToast: (msg: string, type?: string) => void;
}

export default function BackupSection({ showToast }: BackupSectionProps) {
  const [backups, setBackups] = useState<Array<{ date: string; filename: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<File | null>(null);

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/backup/auto");
      if (res.ok) {
        const json = await res.json();
        setBackups(json.backups || []);
      }
    } catch {
      showToast("Impossible de charger les sauvegardes", "error");
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || `monbudget-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Sauvegarde exportée !");
    } catch {
      showToast("Erreur lors de l'export", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Restauration échouée");
      }
      showToast("Données restaurées ! Recharge la page.");
      setRestoreConfirm(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de la restauration", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadAuto = async (date: string) => {
    try {
      const res = await fetch(`/api/backup/auto/${date}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monbudget-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Sauvegarde téléchargée !");
    } catch {
      showToast("Erreur lors du téléchargement", "error");
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-4 lg:p-6">
      <h3 className="text-xs lg:text-sm font-semibold mb-3 lg:mb-4 flex items-center gap-2">
        <Database size={16} className="text-emerald-400" /> Sauvegarde &amp; Restauration
      </h3>
      <p className="text-[10px] lg:text-xs text-slate-500 mb-4">
        Exporte ou restaure toutes tes données (dépenses, revenus, prêts, projets, etc.). Les sauvegardes automatiques sont créées chaque jour.
      </p>

      <div className="flex flex-wrap gap-2 lg:gap-3 mb-4">
        <button
          onClick={handleExport}
          disabled={loading}
          className="btn-primary py-2.5 px-4 text-xs lg:text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={16} /> Exporter en JSON
        </button>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 text-xs lg:text-sm font-medium transition-colors">
            <Upload size={16} /> Importer / Restaurer
          </span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setRestoreConfirm(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {restoreConfirm && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-200">Restaurer depuis {restoreConfirm.name} ?</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Toutes les données actuelles seront remplacées.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setRestoreConfirm(null)}
              className="py-1.5 px-3 rounded-lg border border-white/10 text-slate-400 text-xs"
            >
              Annuler
            </button>
            <button
              onClick={() => handleImport(restoreConfirm)}
              disabled={importing}
              className="py-1.5 px-3 rounded-lg bg-amber-500/30 text-amber-200 text-xs font-medium disabled:opacity-50"
            >
              {importing ? "..." : "Restaurer"}
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] lg:text-xs text-slate-400">Sauvegardes automatiques</span>
          <button
            onClick={fetchBackups}
            className="text-emerald-400/80 hover:text-emerald-400 text-[10px] flex items-center gap-1"
          >
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
        {backups.length === 0 ? (
          <p className="text-[10px] text-slate-500 py-2">Aucune sauvegarde automatique pour le moment.</p>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.date}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05]"
              >
                <span className="text-xs font-mono text-slate-400">{b.date}</span>
                <button
                  onClick={() => handleDownloadAuto(b.date)}
                  className="text-emerald-400 text-[10px] font-medium flex items-center gap-1 hover:text-emerald-300"
                >
                  <Download size={12} /> Télécharger
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
