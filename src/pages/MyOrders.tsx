// src/pages/MyOrders.tsx
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

type OrderStatus = "pending_payment" | "payment_checking" | "confirmed" | "cancelled";

interface Order {
  id: number;
  status: OrderStatus;
  total_price: number;
  orderer_name: string;
  memo: string | null;
  admin_memo: string | null;
  created_at: string;
  product_title: string;
  product_slug: string;
  product_thumbnail: string | null;
  options: { label: string; price_delta: number }[];
}

interface Settings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: "결제 대기", className: "bg-yellow-100 text-yellow-800" },
  payment_checking: { label: "입금 확인 중", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "확정", className: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-600" },
};

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>({ bank_name: "", bank_account: "", bank_holder: "", bank_notice: "" });
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetch("/api/orders/my", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(d.items ?? []))
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Settings) => setSettings(d))
      .catch(() => {});
  }, [user, navigate]);

  const copyAccount = async (orderId: number) => {
    await navigator.clipboard.writeText(settings.bank_account);
    setCopied(orderId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-2xl py-10">
        <h1 className="text-xl font-bold text-slate-800 mb-6">내 주문 내역</h1>

        {orders.length === 0 ? (
          <p className="text-center text-slate-400 py-16">주문 내역이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => {
              const badge = STATUS_BADGE[o.status];
              return (
                <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-800">{o.product_title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        #{o.id} · {new Date(o.created_at).toLocaleDateString("ko-KR")} · {o.total_price.toLocaleString("ko-KR")}원
                      </p>
                      {o.options.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">{o.options.map((opt) => opt.label).join(", ")}</p>
                      )}
                    </div>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </div>

                  {/* 결제 대기 시 계좌 안내 */}
                  {o.status === "pending_payment" && (settings.bank_name || settings.bank_account) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3 text-sm text-amber-900">
                      <p className="text-xs font-semibold text-amber-800 mb-1">무통장 입금 안내</p>
                      {settings.bank_name && <p>은행: <strong>{settings.bank_name}</strong></p>}
                      {settings.bank_account && (
                        <div className="flex items-center gap-2">
                          <p>계좌: <strong>{settings.bank_account}</strong></p>
                          <button
                            onClick={() => void copyAccount(o.id)}
                            className="text-xs border border-amber-300 rounded px-2 py-0.5 bg-white hover:bg-amber-100"
                          >
                            {copied === o.id ? "복사됨" : "복사"}
                          </button>
                        </div>
                      )}
                      {settings.bank_holder && <p>예금주: <strong>{settings.bank_holder}</strong></p>}
                      <p className="font-bold mt-1">{o.total_price.toLocaleString("ko-KR")}원</p>
                      {settings.bank_notice && <p className="text-xs text-amber-700 mt-1">※ {settings.bank_notice}</p>}
                    </div>
                  )}

                  {/* 사용자 메모 */}
                  {o.memo && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400">내 요청사항</p>
                      <p className="text-sm text-slate-600">{o.memo}</p>
                    </div>
                  )}

                  {/* 관리자 메모 */}
                  {o.admin_memo && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-400 mb-1">관리자 메모</p>
                      <p className="text-sm text-slate-600">{o.admin_memo}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
