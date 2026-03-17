"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0e1a] text-white p-4">
      <h1 className="text-2xl font-bold mb-2">Hors ligne</h1>
      <p className="text-gray-400 text-center">
        Vous n&apos;êtes pas connecté. Vérifiez votre connexion et réessayez.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 px-6 py-2 rounded-lg bg-[#10b981] text-white font-medium hover:bg-[#0d9668] transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
