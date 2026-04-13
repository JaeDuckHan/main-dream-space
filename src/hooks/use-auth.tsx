import { createContext, useContext, useEffect, useState } from "react";

export interface User {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  connected_providers: Array<"kakao" | "google" | "naver">;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = await response.json();
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/";
  };

  return <AuthContext.Provider value={{ user, loading, refetch, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
