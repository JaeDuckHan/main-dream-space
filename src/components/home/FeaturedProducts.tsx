import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  thumbnail_url: string | null;
  base_price: number;
}

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products?limit=4")
      .then((r) => r.json())
      .then((d) => setProducts(d.items ?? []))
      .catch(() => {});
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 bg-slate-50">
      <div className="container">
        <div className="flex items-center justify-between">
          <h2 className="text-[22px] font-bold">럭키다낭 기획 상품</h2>
          <Link to="/products" className="text-sm text-primary hover:underline">
            전체 보기 →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/products/${p.slug}`}
              className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="h-36 w-full bg-muted">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">
                    {p.category === "pickup" ? "🚗" : "🏖️"}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm leading-snug">{p.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.base_price.toLocaleString("ko-KR")}원~
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
