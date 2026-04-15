import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductOption {
  id: number;
  label: string;
  price_delta: number;
  sort_order: number;
}

interface Product {
  id: number;
  slug: string;
  category: "package" | "pickup";
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  base_price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  options: ProductOption[];
}

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  package: { label: "패키지", className: "bg-blue-100 text-blue-700" },
  pickup: { label: "픽업", className: "bg-green-100 text-green-700" },
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

const emptyForm = {
  slug: "",
  category: "package" as const,
  title: "",
  description: "",
  thumbnail_url: "",
  base_price: 0,
  sort_order: 0,
  is_active: true,
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newOption, setNewOption] = useState({ label: "", price_delta: 0 });
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const fetchProducts = () => {
    fetch("/api/admin/products", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProducts(d.items ?? []));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      slug: p.slug,
      category: p.category,
      title: p.title,
      description: p.description ?? "",
      thumbnail_url: p.thumbnail_url ?? "",
      base_price: p.base_price,
      sort_order: p.sort_order,
      is_active: p.is_active,
    });
    setSheetOpen(true);
  };

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: editing ? f.slug : slugify(title) }));
  };

  const saveProduct = async () => {
    const url = editing ? `/api/admin/products/${editing.id}` : "/api/admin/products";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, base_price: Number(form.base_price), sort_order: Number(form.sort_order) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "저장에 실패했습니다.");
      return;
    }
    setSheetOpen(false);
    fetchProducts();
  };

  const toggleActive = async (p: Product) => {
    await fetch(`/api/admin/products/${p.id}/toggle`, { method: "PATCH", credentials: "include" });
    fetchProducts();
  };

  const deleteProduct = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/admin/products/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleteTarget(null);
    fetchProducts();
  };

  const addOption = async () => {
    if (!editing || !newOption.label.trim()) return;
    await fetch(`/api/admin/products/${editing.id}/options`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newOption.label, price_delta: Number(newOption.price_delta) }),
    });
    setNewOption({ label: "", price_delta: 0 });
    const res = await fetch("/api/admin/products", { credentials: "include" });
    const d = await res.json();
    setProducts(d.items ?? []);
    const updated = (d.items ?? []).find((p: Product) => p.id === editing.id);
    if (updated) setEditing(updated);
  };

  const removeOption = async (optionId: number) => {
    await fetch(`/api/admin/products/options/${optionId}`, { method: "DELETE", credentials: "include" });
    const res = await fetch("/api/admin/products", { credentials: "include" });
    const d = await res.json();
    setProducts(d.items ?? []);
    if (editing) {
      const updated = (d.items ?? []).find((p: Product) => p.id === editing.id);
      if (updated) setEditing(updated);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">기획/픽업 상품 관리</h1>
          <p className="mt-1 text-sm text-slate-500">전체 {products.length}개</p>
        </div>
        <Button onClick={openCreate}>+ 상품 등록</Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">상품</th>
              <th className="px-4 py-3 text-left font-medium">카테고리</th>
              <th className="px-4 py-3 text-left font-medium">기본가</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const cat = CATEGORY_BADGE[p.category];
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-slate-400">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cat.className}>{cat.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.base_price.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.is_active ? "text-emerald-600" : "text-slate-400"}>
                      ● {p.is_active ? "공개" : "숨김"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>수정</Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(p)}>
                        {p.is_active ? "숨김" : "공개"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(p)}>삭제</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 등록/수정 Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "상품 수정" : "상품 등록"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>상품명</Label>
              <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="다낭 3박4일 패키지" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="danang-3nights" />
            </div>
            <div>
              <Label>카테고리</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as "package" | "pickup" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="package">패키지</SelectItem>
                  <SelectItem value="pickup">픽업</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>설명</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>썸네일 URL</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>기본가 (원)</Label>
              <Input type="number" value={form.base_price} onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>정렬 순서</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>공개</Label>
            </div>

            {editing && (
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">옵션 관리</p>
                <div className="space-y-2">
                  {editing.options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                      <span>{o.label} (+{o.price_delta.toLocaleString("ko-KR")}원)</span>
                      <button className="text-red-500 hover:text-red-700" onClick={() => void removeOption(o.id)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="옵션명"
                    value={newOption.label}
                    onChange={(e) => setNewOption((n) => ({ ...n, label: e.target.value }))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="추가금액"
                    value={newOption.price_delta}
                    onChange={(e) => setNewOption((n) => ({ ...n, price_delta: Number(e.target.value) }))}
                    className="w-28"
                  />
                  <Button size="sm" onClick={() => void addOption()}>추가</Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>취소</Button>
              <Button onClick={() => void saveProduct()}>저장</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 삭제 확인 Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상품 삭제</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.title}" 상품을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={() => void deleteProduct()}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
