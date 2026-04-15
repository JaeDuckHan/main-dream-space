import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
  badge?: number;
}

function AdminSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPendingCount(d.pending_listings ?? 0))
      .catch(() => {});
  }, []);

  const navItems: NavItem[] = [
    { href: "/admin", label: "대시보드", icon: "📊" },
    { href: "/admin/users", label: "회원 관리", icon: "👥" },
    { href: "/admin/listings", label: "업체 검수", icon: "🏢", badge: pendingCount },
    { href: "/admin/products", label: "기획/픽업 상품", icon: "🎁" },
    { href: "/admin/orders", label: "주문 관리", icon: "📦" },
    { href: "/admin/settings", label: "설정", icon: "⚙️" },
  ];

  return (
    <aside className="flex h-screen w-40 flex-shrink-0 flex-col bg-slate-900 text-slate-400">
      <div className="p-4">
        <div className="text-sm font-bold text-slate-100">🛠 관리자</div>
        <div className="mt-1 truncate text-xs text-slate-500">{user?.email}</div>
      </div>

      <nav className="flex-1 px-2">
        {navItems.map((item) => {
          const isActive = item.href === "/admin"
            ? location.pathname === "/admin"
            : location.pathname.startsWith(item.href);

          return (
            <div key={item.href}>
              {item.disabled ? (
                <div className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-600">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ) : (
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-slate-800 hover:text-slate-100",
                    isActive && "bg-blue-800 text-white",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        >
          ← 사이트로 돌아가기
        </Link>
      </div>
    </aside>
  );
}

function AdminLayoutContent() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <RequireAuth requireAdmin>
      <AdminLayoutContent />
    </RequireAuth>
  );
}
