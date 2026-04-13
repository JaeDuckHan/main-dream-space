import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import type { Listing } from "@/hooks/use-listings";
import { getCategoryLabel, getListingTitle } from "@/lib/listing-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminListings() {
  return (
    <RequireAuth requireAdmin>
      <AdminListingsContent />
    </RequireAuth>
  );
}

function AdminListingsContent() {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchListings = async (nextFilter = filter) => {
    const response = await fetch(`/api/admin/listings/all?status=${nextFilter}`, {
      credentials: "include",
    });
    const payload = await response.json();
    setListings(payload.items ?? []);
  };

  useEffect(() => {
    void fetchListings(filter);
  }, [filter]);

  const approve = async (id: number) => {
    await fetch(`/api/admin/listings/${id}/approve`, {
      method: "PATCH",
      credentials: "include",
    });
    setSelected(null);
    await fetchListings();
  };

  const reject = async (id: number) => {
    if (!rejectReason.trim()) {
      return;
    }

    await fetch(`/api/admin/listings/${id}/reject`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setRejectReason("");
    setSelected(null);
    await fetchListings();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        <h1 className="text-3xl font-bold">업체 관리</h1>
        <p className="mt-2 text-muted-foreground">등록된 디렉토리 매물을 검수하고 상태를 관리합니다.</p>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} className="mt-6">
          <TabsList>
            <TabsTrigger value="pending">검수 대기</TabsTrigger>
            <TabsTrigger value="approved">공개됨</TabsTrigger>
            <TabsTrigger value="rejected">반려됨</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-6 grid gap-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="cursor-pointer p-4 transition-shadow hover:shadow-md" onClick={() => setSelected(listing)}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="h-24 w-full overflow-hidden rounded-lg bg-muted md:w-28">
                  {listing.thumbnail_url ? (
                    <img src={listing.thumbnail_url} alt={getListingTitle(listing)} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <h2 className="font-semibold">{getListingTitle(listing)}</h2>
                    <span className="text-xs text-muted-foreground">{getCategoryLabel(listing.category)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {listing.district} · {listing.address}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    등록자: {listing.owner_email || "미카"} · {listing.created_at ? new Date(listing.created_at).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl">
            {selected ? (
              <>
                <DialogHeader>
                  <DialogTitle>{getListingTitle(selected)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <a href={selected.google_maps_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                    구글맵에서 확인
                  </a>
                  <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selected.category_data, null, 2)}</pre>
                  {filter === "pending" ? (
                    <div className="space-y-2 border-t border-border pt-4">
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => void approve(selected.id)}>
                        승인
                      </Button>
                      <Textarea
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        placeholder="반려 사유 입력"
                      />
                      <Button variant="destructive" className="w-full" onClick={() => void reject(selected.id)}>
                        반려
                      </Button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
