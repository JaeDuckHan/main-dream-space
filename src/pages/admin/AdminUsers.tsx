// src/pages/admin/AdminUsers.tsx
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

interface UserListItem {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
  providers: string[];
}

interface UserDetail extends UserListItem {
  posts: { id: number; title: string; created_at: string }[];
  listings: { id: number; name: string; name_ko: string | null; category: string; status: string; created_at: string }[];
  orders: unknown[];
}

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  kakao: { label: "카카오", className: "bg-yellow-100 text-yellow-800" },
  google: { label: "구글", className: "bg-green-100 text-green-800" },
  naver: { label: "네이버", className: "bg-emerald-50 text-emerald-700" },
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ type: "role" | "status"; value: string | boolean } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = (opts?: { s?: string; role?: string; status?: string; p?: number }) => {
    const params = new URLSearchParams();
    const s = opts?.s ?? search;
    const r = opts?.role ?? roleFilter;
    const st = opts?.status ?? statusFilter;
    const p = opts?.p ?? page;

    if (s) params.set("search", s);
    if (r !== "all") params.set("role", r);
    if (st !== "all") params.set("status", st);
    params.set("page", String(p));

    fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.items ?? []);
        setTotal(d.total ?? 0);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchUsers(); }, [roleFilter, statusFilter, page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers({ s: value, p: 1 });
    }, 300);
  };

  const openDetail = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSelected(data);
      setSheetOpen(true);
    } catch {
      // network error — silently ignore
    }
  };

  const applyRoleChange = async (newRole: "user" | "admin") => {
    if (!selected) return;
    const res = await fetch(`/api/admin/users/${selected.id}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "역할 변경에 실패했습니다.");
      return;
    }
    setConfirmDialog(null);
    setSheetOpen(false);
    fetchUsers();
  };

  const applyStatusChange = async (active: boolean) => {
    if (!selected) return;
    const res = await fetch(`/api/admin/users/${selected.id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "상태 변경에 실패했습니다.");
      return;
    }
    setConfirmDialog(null);
    setSheetOpen(false);
    fetchUsers();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800">회원 관리</h1>
      <p className="mt-1 text-sm text-slate-500">전체 {total}명</p>

      {/* 검색 + 필터 */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          className="w-64"
          placeholder="이름 또는 이메일 검색"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="역할" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 역할</SelectItem>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 테이블 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">회원</th>
              <th className="px-4 py-3 text-left font-medium">가입일</th>
              <th className="px-4 py-3 text-left font-medium">소셜</th>
              <th className="px-4 py-3 text-left font-medium">역할</th>
              <th className="px-4 py-3 text-left font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => void openDetail(u.id)}
              >
                <td className="px-4 py-3">
                  <div className={`font-medium ${!u.is_active ? "text-slate-400" : ""}`}>
                    {u.display_name ?? "—"}
                  </div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(u.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.providers.map((provider) => {
                      const badge = PROVIDER_BADGE[provider];
                      return badge ? (
                        <span key={provider} className={`rounded px-1.5 py-0.5 text-xs ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={u.role === "admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>
                    {u.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className={u.is_active ? "text-emerald-600" : "text-slate-400"}>
                    ● {u.is_active ? "활성" : "비활성"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            이전
          </Button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
            다음
          </Button>
        </div>
      )}

      {/* 회원 상세 Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-80 overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.display_name ?? selected.email}</SheetTitle>
                <p className="text-sm text-slate-500">{selected.email}</p>
              </SheetHeader>

              <div className="mt-4 flex gap-2">
                {selected.id !== me?.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={() => setConfirmDialog({ type: "role", value: selected.role === "admin" ? "user" : "admin" })}
                    >
                      {selected.role === "admin" ? "admin → user" : "user → admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      onClick={() => setConfirmDialog({ type: "status", value: !selected.is_active })}
                    >
                      {selected.is_active ? "비활성화" : "활성화"}
                    </Button>
                  </>
                )}
              </div>

              <Tabs defaultValue="orders" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="orders" className="flex-1">주문({selected.orders.length})</TabsTrigger>
                  <TabsTrigger value="posts" className="flex-1">글({selected.posts.length})</TabsTrigger>
                  <TabsTrigger value="listings" className="flex-1">업체({selected.listings.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="orders">
                  <p className="mt-4 text-center text-sm text-slate-400">서브시스템 3 연동 후 표시됩니다.</p>
                </TabsContent>
                <TabsContent value="posts">
                  <div className="mt-2 space-y-2">
                    {selected.posts.length === 0 && (
                      <p className="text-center text-sm text-slate-400">작성한 글이 없습니다.</p>
                    )}
                    {selected.posts.map((post) => (
                      <div key={post.id} className="rounded border border-slate-100 p-2 text-xs">
                        <div className="font-medium">{post.title}</div>
                        <div className="text-slate-400">{new Date(post.created_at).toLocaleDateString("ko-KR")}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="listings">
                  <div className="mt-2 space-y-2">
                    {selected.listings.length === 0 && (
                      <p className="text-center text-sm text-slate-400">등록한 업체가 없습니다.</p>
                    )}
                    {selected.listings.map((listing) => (
                      <div key={listing.id} className="rounded border border-slate-100 p-2 text-xs">
                        <div className="font-medium">{listing.name_ko ?? listing.name}</div>
                        <div className="text-slate-400">{listing.status}</div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 확인 다이얼로그 */}
      <Dialog open={Boolean(confirmDialog)} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "role" ? "역할 변경" : "계정 상태 변경"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.type === "role"
                ? `역할을 "${confirmDialog?.value}"로 변경하시겠습니까?`
                : `계정을 ${confirmDialog?.value ? "활성화" : "비활성화"}하시겠습니까?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>취소</Button>
            <Button
              onClick={() => {
                if (!confirmDialog) return;
                if (confirmDialog.type === "role") {
                  void applyRoleChange(confirmDialog.value as "user" | "admin");
                } else {
                  void applyStatusChange(confirmDialog.value as boolean);
                }
              }}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
