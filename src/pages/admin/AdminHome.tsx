// src/pages/admin/AdminHome.tsx
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface AdminStats {
  pending_listings: number;
  total_users: number;
  monthly_orders: number;
  pending_payments: number;
}

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "전체 회원", value: stats?.total_users ?? "-", color: "text-blue-600" },
    { label: "업체 검수 대기", value: stats?.pending_listings ?? "-", color: "text-amber-500" },
    { label: "이번달 주문", value: stats?.monthly_orders ?? "-", color: "text-emerald-600" },
    { label: "입금 대기", value: stats?.pending_payments ?? "-", color: "text-red-500" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">럭키다낭 관리자 현황</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-6">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
