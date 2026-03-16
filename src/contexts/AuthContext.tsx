"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  avatar_path: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: RegisterData) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (current: string, newPwd: string) => Promise<string | null>;
  uploadAvatar: (file: File) => Promise<string | null>;
  removeAvatar: () => Promise<string | null>;
}

interface RegisterData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
  confirm_password: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setUser(data.user || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (!user && !isPublic) {
      router.replace("/login");
    }
    if (user && isPublic) {
      router.replace("/dashboard");
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) return data.error || "Erreur de connexion";
      setUser(data.user);
      router.replace("/dashboard");
      return null;
    } catch {
      return "Erreur réseau";
    }
  }, [router]);

  const register = useCallback(async (regData: RegisterData): Promise<string | null> => {
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regData),
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) return data.error || "Erreur lors de l'inscription";
      setUser(data.user);
      router.replace("/dashboard");
      return null;
    } catch {
      return "Erreur réseau";
    }
  }, [router]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    router.replace("/login");
  }, [router]);

  const changePassword = useCallback(async (current: string, newPwd: string): Promise<string | null> => {
    try {
      const r = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: newPwd }),
      });
      const data = await r.json();
      if (!r.ok) return data.error || "Erreur lors du changement";
      return null;
    } catch {
      return "Erreur réseau";
    }
  }, []);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const r = await fetch("/api/auth/avatar", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) return data.error || "Erreur lors de l'upload";
      setUser((prev) => prev ? { ...prev, avatar_path: data.avatar_path } : prev);
      return null;
    } catch {
      return "Erreur réseau";
    }
  }, []);

  const removeAvatar = useCallback(async (): Promise<string | null> => {
    try {
      const r = await fetch("/api/auth/avatar", { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) return data.error || "Erreur";
      setUser((prev) => prev ? { ...prev, avatar_path: null } : prev);
      return null;
    } catch {
      return "Erreur réseau";
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, changePassword, uploadAvatar, removeAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
