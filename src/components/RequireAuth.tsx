import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="container py-16 text-center text-muted-foreground">로딩 중...</div>;
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
