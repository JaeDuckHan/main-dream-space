import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface ProductOption {
  id: number;
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

type CategoryFilter = "all" | "package" | "pickup";

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: "전체",
  package: "패키지",
  pickup: "픽업",
};

const CATEGORY_ICONS: Record<string, string> = {
  package: "🏖️",
  pickup: "🚗",
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = filter === "all" ? "/api/products" : `/api/products?category=${filter}`;
    setLoading(true);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setProducts(d.items ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const minPrice = (p: Product) => {
    if (p.options.length === 0) return p.base_price;
    const lowestDelta = Math.min(...p.options.map((o) => o.price_delta));
    return p.base_price + Math.min(lowestDelta, 0);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold text-slate-800">기획상품</h1>
        <p className="mb-8 text-slate-500">럭키다낭이 준비한 특별한 패키지와 픽업 서비스</p>

        {/* 카테고리 필터 */}
        <div className="mb-8 flex gap-2">
          {(["all", "package", "pickup"] as CategoryFilter[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === cat
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* 상품 그리드 */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">불러오는 중...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-slate-400">준비 중인 상품입니다.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-slate-50 text-4xl">
                    {CATEGORY_ICONS[p.category] ?? "📦"}
                  </div>
                )}
                <div className="p-4">
                  <div className="mb-1 text-xs font-medium text-slate-400">
                    {p.category === "package" ? "패키지" : "픽업"}
                  </div>
                  <h3 className="mb-1 font-semibold text-slate-800">{p.title}</h3>
                  <p className="mb-3 text-sm font-medium text-blue-600">
                    {minPrice(p).toLocaleString("ko-KR")}원~
                  </p>
                  <Link
                    to={`/products/${p.slug}`}
                    className="block rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    자세히 보기
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
