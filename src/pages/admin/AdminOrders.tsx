// src/pages/admin/AdminOrders.tsx
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrderStatus = "pending_payment" | "payment_checking" | "confirmed" | "cancelled";

interface Order {
  id: number;
  status: OrderStatus;
  total_price: number;
  orderer_name: string;
  orderer_phone: string;
  orderer_email: string;
  booking_data: Record<string, unknown>;
  memo: string | null;
  admin_memo: string | null;
  created_at: string;
  product_title: string;
  product_category: string;
  options: { label: string; price_delta: number }[];
}

const STATUS_BADGE: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: { label: "결제 대기", className: "bg-yellow-100 text-yellow-800" },
  payment_checking: { label: "확인 중", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "확정", className: "bg-green-100 text-green-700" },
  cancelled: { label: "취소", className: "bg-red-100 text-red-600" },
};

const BOOKING_LABELS: Record<string, string> = {
  travel_start: "여행 시작일", travel_end: "여행 종료일",
  num_people: "인원 수", date: "날짜",
  pickup_type: "픽업 타입", flight_no: "항공편 번호",
  flight_time: "도착/출발 시간", hotel_name: "호텔명",
};

const PICKUP_TYPE_LABEL: Record<string, string> = {
  airport_to_hotel: "공항 → 호텔",
  hotel_to_airport: "호텔 → 공항",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adminMemo, setAdminMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  const fetchOrders = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/admin/orders?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(d.items ?? []))
      .catch((err) => console.error("Failed to fetch orders:", err));
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const openDetail = (o: Order) => {
    setSelected(o);
    setAdminMemo(o.admin_memo ?? "");
    setSheetOpen(true);
  };

  const changeStatus = async (id: number, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSheetOpen(false);
      fetchOrders();
    } catch (err) {
      console.error("Status change failed:", err);
      alert("상태 변경에 실패했습니다.");
    }
  };

  const saveMemo = async (orderId: number, memo: string) => {
    setSavingMemo(true);
    try {
      await fetch(`/api/admin/orders/${orderId}/memo`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_memo: memo }),
      });
    } catch (err) {
      console.error("Failed to save memo:", err);
    } finally {
      setSavingMemo(false);
    }
    fetchOrders();
  };

  const nextActions = (status: OrderStatus): { label: string; next: OrderStatus; variant: "default" | "destructive" | "outline" }[] => {
    if (status === "pending_payment") return [
      { label: "확인 시작", next: "payment_checking", variant: "default" },
      { label: "취소", next: "cancelled", variant: "destructive" },
    ];
    if (status === "payment_checking") return [
      { label: "확정", next: "confirmed", variant: "default" },
      { label: "취소", next: "cancelled", variant: "destructive" },
    ];
    return [];
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">주문 관리</h1>
          <p className="mt-1 text-sm text-slate-500">전체 {orders.length}건</p>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="pending_payment">결제 대기</TabsTrigger>
          <TabsTrigger value="payment_checking">확인 중</TabsTrigger>
          <TabsTrigger value="confirmed">확정</TabsTrigger>
          <TabsTrigger value="cancelled">취소</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">상품</th>
              <th className="px-4 py-3 text-left font-medium">주문자</th>
              <th className="px-4 py-3 text-left font-medium">금액</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">주문일</th>
              <th className="px-4 py-3 text-left font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const badge = STATUS_BADGE[o.status];
              return (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-400 text-xs">#{o.id}</td>
                  <td className="px-4 py-3 font-medium">{o.product_title}</td>
                  <td className="px-4 py-3">
                    <div>{o.orderer_name}</div>
                    <div className="text-xs text-slate-400">{o.orderer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.total_price.toLocaleString("ko-KR")}원</td>
                  <td className="px-4 py-3">
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => openDetail(o)}>상세</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>주문 #{selected.id}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                {/* 주문자 정보 */}
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">주문자</p>
                  <p className="font-medium">{selected.orderer_name}</p>
                  <p className="text-slate-500">{selected.orderer_phone}</p>
                  <p className="text-slate-500">{selected.orderer_email}</p>
                </div>

                {/* 금액 + 옵션 */}
                <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                  <p className="text-xs text-slate-400">상품 / 금액</p>
                  <p className="font-medium">{selected.product_title}</p>
                  {selected.options.map((o) => (
                    <p key={`${o.label}-${o.price_delta}`} className="text-xs text-slate-500">+ {o.label} ({o.price_delta.toLocaleString("ko-KR")}원)</p>
                  ))}
                  <p className="font-bold text-blue-600 pt-1">{selected.total_price.toLocaleString("ko-KR")}원</p>
                </div>

                {/* 예약 데이터 */}
                {Object.keys(selected.booking_data).length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                    <p className="text-xs text-slate-400">예약 정보</p>
                    {Object.entries(selected.booking_data).map(([k, v]) => (
                      <p key={k} className="text-xs">
                        <span className="text-slate-500">{BOOKING_LABELS[k] ?? k}:</span>{" "}
                        <span>{k === "pickup_type" ? PICKUP_TYPE_LABEL[v as string] ?? String(v) : String(v)}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* 사용자 메모 */}
                {selected.memo && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">사용자 요청사항</p>
                    <p className="text-slate-600">{selected.memo}</p>
                  </div>
                )}

                {/* 관리자 메모 */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">관리자 메모</p>
                  <Textarea
                    rows={3}
                    value={adminMemo}
                    onChange={(e) => setAdminMemo(e.target.value)}
                    placeholder="내부 메모 (사용자에게 표시됨)"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={savingMemo}
                    onClick={() => void saveMemo(selected.id, adminMemo)}
                  >
                    {savingMemo ? "저장 중..." : "메모 저장"}
                  </Button>
                </div>

                {/* 상태 변경 버튼 */}
                {nextActions(selected.status).length > 0 && (
                  <div className="border-t pt-4 flex gap-2">
                    {nextActions(selected.status).map((a) => (
                      <Button
                        key={a.next}
                        variant={a.variant}
                        size="sm"
                        onClick={() => void changeStatus(selected.id, a.next)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
