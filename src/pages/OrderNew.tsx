// src/pages/OrderNew.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

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
  thumbnail_url: string | null;
  base_price: number;
  options: ProductOption[];
}

interface Settings {
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  bank_notice: string;
}

interface PackageBooking {
  travel_start: string;
  travel_end: string;
  num_people: string;
}

interface PickupBooking {
  date: string;
  num_people: string;
  pickup_type: "airport_to_hotel" | "hotel_to_airport";
  flight_no: string;
  flight_time: string;
  hotel_name: string;
}

export default function OrderNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const productSlug = searchParams.get("product") ?? "";
  const optionIds = (searchParams.get("options") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number);

  const [product, setProduct] = useState<Product | null>(null);
  const [settings, setSettings] = useState<Settings>({ bank_name: "", bank_account: "", bank_holder: "", bank_notice: "" });
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>(optionIds);
  const [ordererName, setOrdererName] = useState("");
  const [ordererPhone, setOrdererPhone] = useState("");
  const [ordererEmail, setOrdererEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [packageBooking, setPackageBooking] = useState<PackageBooking>({ travel_start: "", travel_end: "", num_people: "1" });
  const [pickupBooking, setPickupBooking] = useState<PickupBooking>({
    date: "", num_people: "1", pickup_type: "airport_to_hotel",
    flight_no: "", flight_time: "", hotel_name: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    setOrdererName(user.display_name ?? "");
    setOrdererEmail(user.email ?? "");
  }, [user, navigate]);

  useEffect(() => {
    if (!productSlug) { navigate("/products"); return; }
    fetch(`/api/products/${productSlug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setProduct)
      .catch(() => navigate("/products"));
  }, [productSlug, navigate]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Settings) => setSettings(d))
      .catch(() => {});
  }, []);

  const selectedOptions = product?.options.filter((o) => selectedOptionIds.includes(o.id)) ?? [];
  const totalPrice = product
    ? product.base_price + selectedOptions.reduce((s, o) => s + o.price_delta, 0)
    : 0;

  const copyAccount = async () => {
    await navigator.clipboard.writeText(settings.bank_account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = async () => {
    if (!product) return;
    if (!ordererName.trim() || !ordererPhone.trim() || !ordererEmail.trim()) {
      alert("주문자 정보를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);

    const booking_data = product.category === "package"
      ? { travel_start: packageBooking.travel_start, travel_end: packageBooking.travel_end, num_people: Number(packageBooking.num_people) }
      : { ...pickupBooking, num_people: Number(pickupBooking.num_people) };

    const res = await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        selected_option_ids: selectedOptionIds,
        orderer_name: ordererName,
        orderer_phone: ordererPhone,
        orderer_email: ordererEmail,
        booking_data,
        memo: memo || undefined,
      }),
    }).catch(() => null);

    setSubmitting(false);
    if (!res?.ok) { alert("주문 중 오류가 발생했습니다."); return; }
    navigate("/my/orders");
  };

  if (!product) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-lg py-10">
        <h1 className="text-xl font-bold text-slate-800 mb-6">주문서 작성</h1>

        {/* 상품 요약 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <p className="text-xs text-slate-400 mb-2">주문 상품</p>
          <div className="flex gap-3 items-center">
            {product.thumbnail_url ? (
              <img src={product.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-slate-200 flex items-center justify-center text-xl">
                {product.category === "pickup" ? "🚗" : "🏖️"}
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{product.title}</p>
              {selectedOptions.length > 0 && (
                <p className="text-xs text-slate-500">{selectedOptions.map((o) => o.label).join(", ")}</p>
              )}
              <p className="text-sm font-bold text-blue-600 mt-1">{totalPrice.toLocaleString("ko-KR")}원</p>
            </div>
          </div>
        </div>

        {/* 주문자 정보 */}
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">주문자 정보</h2>
          <div>
            <Label>이름</Label>
            <Input value={ordererName} onChange={(e) => setOrdererName(e.target.value)} placeholder="홍길동" />
          </div>
          <div>
            <Label>연락처</Label>
            <Input value={ordererPhone} onChange={(e) => setOrdererPhone(e.target.value)} placeholder="010-1234-5678" />
          </div>
          <div>
            <Label>이메일</Label>
            <Input value={ordererEmail} onChange={(e) => setOrdererEmail(e.target.value)} placeholder="hong@email.com" />
          </div>
        </section>

        {/* 패키지 예약 정보 */}
        {product.category === "package" && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">패키지 예약 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>여행 시작일</Label>
                <Input type="date" value={packageBooking.travel_start} onChange={(e) => setPackageBooking((b) => ({ ...b, travel_start: e.target.value }))} />
              </div>
              <div>
                <Label>여행 종료일</Label>
                <Input type="date" value={packageBooking.travel_end} onChange={(e) => setPackageBooking((b) => ({ ...b, travel_end: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>인원 수</Label>
              <Input type="number" min="1" value={packageBooking.num_people} onChange={(e) => setPackageBooking((b) => ({ ...b, num_people: e.target.value }))} />
            </div>
          </section>
        )}

        {/* 픽업 예약 정보 */}
        {product.category === "pickup" && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 border-b pb-1">픽업 예약 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>날짜</Label>
                <Input type="date" value={pickupBooking.date} onChange={(e) => setPickupBooking((b) => ({ ...b, date: e.target.value }))} />
              </div>
              <div>
                <Label>인원 수</Label>
                <Input type="number" min="1" value={pickupBooking.num_people} onChange={(e) => setPickupBooking((b) => ({ ...b, num_people: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>픽업 타입</Label>
              <div className="flex gap-4 mt-1">
                {[
                  { value: "airport_to_hotel", label: "공항 → 호텔" },
                  { value: "hotel_to_airport", label: "호텔 → 공항" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="pickup_type"
                      value={opt.value}
                      checked={pickupBooking.pickup_type === opt.value}
                      onChange={() => setPickupBooking((b) => ({ ...b, pickup_type: opt.value as PickupBooking["pickup_type"] }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>항공편 번호</Label>
                <Input value={pickupBooking.flight_no} onChange={(e) => setPickupBooking((b) => ({ ...b, flight_no: e.target.value }))} placeholder="VJ123" />
              </div>
              <div>
                <Label>도착/출발 시간</Label>
                <Input type="time" value={pickupBooking.flight_time} onChange={(e) => setPickupBooking((b) => ({ ...b, flight_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>호텔명</Label>
              <Input value={pickupBooking.hotel_name} onChange={(e) => setPickupBooking((b) => ({ ...b, hotel_name: e.target.value }))} placeholder="Hyatt Regency Da Nang" />
            </div>
          </section>
        )}

        {/* 요청사항 */}
        <section className="mb-6">
          <Label>요청사항 (선택)</Label>
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="기타 요청사항을 입력해주세요" className="mt-1" />
        </section>

        {/* 무통장 입금 안내 */}
        {(settings.bank_name || settings.bank_account || settings.bank_holder) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <p className="text-xs font-semibold text-amber-800 mb-2">무통장 입금 안내</p>
            <div className="space-y-1 text-sm text-amber-900">
              {settings.bank_name && <p>은행: <strong>{settings.bank_name}</strong></p>}
              {settings.bank_account && (
                <div className="flex items-center gap-2">
                  <p>계좌: <strong>{settings.bank_account}</strong></p>
                  <button
                    onClick={() => void copyAccount()}
                    className="text-xs border border-amber-300 rounded px-2 py-0.5 bg-white text-amber-700 hover:bg-amber-100"
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
              )}
              {settings.bank_holder && <p>예금주: <strong>{settings.bank_holder}</strong></p>}
              <p className="font-bold text-amber-800">금액: {totalPrice.toLocaleString("ko-KR")}원</p>
            </div>
            {settings.bank_notice && (
              <p className="text-xs text-amber-700 mt-2">※ {settings.bank_notice}</p>
            )}
          </div>
        )}

        <Button className="w-full" size="lg" disabled={submitting} onClick={() => void submit()}>
          {submitting ? "주문 중..." : "주문 완료"}
        </Button>
      </main>
      <Footer />
    </div>
  );
}
