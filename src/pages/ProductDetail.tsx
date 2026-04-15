import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductOption {
  id: number;
  label: string;
  price_delta: number;
}

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: number;
  options: ProductOption[];
}

interface PickupForm {
  date: string;
  num_people: string;
  pickup_type: "airport_to_hotel" | "hotel_to_airport";
  flight_no: string;
  flight_time: string;
  hotel_name: string;
  memo: string;
}

const emptyPickup: PickupForm = {
  date: "",
  num_people: "1",
  pickup_type: "airport_to_hotel",
  flight_no: "",
  flight_time: "",
  hotel_name: "",
  memo: "",
};

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [pickupForm, setPickupForm] = useState<PickupForm>(emptyPickup);
  const [loginDialog, setLoginDialog] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/products/${slug}`)
      .then((r) => {
        if (!r.ok) { navigate("/products"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setProduct(d); })
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const toggleOption = (optionId: number) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) { next.delete(optionId); } else { next.add(optionId); }
      return next;
    });
  };

  const totalPrice = product
    ? product.base_price +
      product.options
        .filter((o) => selectedOptions.has(o.id))
        .reduce((sum, o) => sum + o.price_delta, 0)
    : 0;

  const handleOrder = () => {
    if (!user) { setLoginDialog(true); return; }
    const optionsParam = [...selectedOptions].join(",");
    const url = `/orders/new?product=${product!.slug}${optionsParam ? `&options=${optionsParam}` : ""}`;
    navigate(url);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-2xl py-12">
        {/* 썸네일 */}
        <div className="h-64 w-full overflow-hidden rounded-xl bg-muted">
          {product.thumbnail_url ? (
            <img src={product.thumbnail_url} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl">
              {product.category === "pickup" ? "🚗" : "🏖️"}
            </div>
          )}
        </div>

        {/* 상품 정보 */}
        <h1 className="mt-6 text-2xl font-bold">{product.title}</h1>
        {product.description && (
          <p className="mt-3 text-muted-foreground leading-relaxed">{product.description}</p>
        )}

        {/* 옵션 선택 */}
        {product.options.length > 0 && (
          <div className="mt-8">
            <h2 className="font-semibold">옵션 선택</h2>
            <div className="mt-3 space-y-3">
              {product.options.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Checkbox
                    id={`option-${o.id}`}
                    checked={selectedOptions.has(o.id)}
                    onCheckedChange={() => toggleOption(o.id)}
                  />
                  <Label htmlFor={`option-${o.id}`} className="flex-1 cursor-pointer">
                    {o.label}
                  </Label>
                  <span className="text-sm font-medium text-primary">
                    +{o.price_delta.toLocaleString("ko-KR")}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 픽업 전용 추가 입력 폼 */}
        {product.category === "pickup" && (
          <div className="mt-8 rounded-xl border border-border p-5 space-y-4">
            <h2 className="font-semibold">픽업 예약 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>날짜</Label>
                <Input type="date" value={pickupForm.date} onChange={(e) => setPickupForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>인원 수</Label>
                <Input type="number" min="1" value={pickupForm.num_people} onChange={(e) => setPickupForm((f) => ({ ...f, num_people: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>픽업 타입</Label>
              <div className="mt-2 flex gap-4">
                {[
                  { value: "airport_to_hotel", label: "공항 → 호텔" },
                  { value: "hotel_to_airport", label: "호텔 → 공항" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pickup_type"
                      value={opt.value}
                      checked={pickupForm.pickup_type === opt.value}
                      onChange={() => setPickupForm((f) => ({ ...f, pickup_type: opt.value as PickupForm["pickup_type"] }))}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>항공편 번호</Label>
                <Input value={pickupForm.flight_no} onChange={(e) => setPickupForm((f) => ({ ...f, flight_no: e.target.value }))} placeholder="VJ123" />
              </div>
              <div>
                <Label>도착/출발 시간</Label>
                <Input type="time" value={pickupForm.flight_time} onChange={(e) => setPickupForm((f) => ({ ...f, flight_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>호텔명</Label>
              <Input value={pickupForm.hotel_name} onChange={(e) => setPickupForm((f) => ({ ...f, hotel_name: e.target.value }))} placeholder="Hyatt Regency Da Nang" />
            </div>
            <div>
              <Label>요청사항</Label>
              <Textarea value={pickupForm.memo} onChange={(e) => setPickupForm((f) => ({ ...f, memo: e.target.value }))} rows={2} placeholder="유아 좌석 필요 등" />
            </div>
          </div>
        )}

        {/* 총 금액 + 주문 버튼 */}
        <div className="mt-8 rounded-xl border border-border bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">총 금액</span>
            <span className="text-2xl font-bold text-primary">{totalPrice.toLocaleString("ko-KR")}원</span>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={handleOrder}>
            주문하기
          </Button>
        </div>
      </main>
      <Footer />

      {/* 로그인 유도 다이얼로그 */}
      <Dialog open={loginDialog} onOpenChange={setLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>주문하려면 먼저 로그인해주세요.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginDialog(false)}>취소</Button>
            <Button onClick={() => { setLoginDialog(false); navigate("/login"); }}>로그인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
