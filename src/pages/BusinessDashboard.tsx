import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import type { Listing, ListingStatus } from "@/hooks/use-listings";
import { getCategoryLabel, getListingTitle } from "@/lib/listing-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_BADGE: Record<ListingStatus, { label: string; className: string }> = {
  draft: { label: "임시저장", className: "bg-slate-100 text-slate-700" },
  pending: { label: "검수 중", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "공개됨", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "반려됨", className: "bg-red-100 text-red-800" },
  archived: { label: "보관됨", className: "bg-slate-100 text-slate-500" },
};

export default function BusinessDashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/listings/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => setListings(payload.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">내 업체 관리</h1>
            <p className="text-muted-foreground">{user?.display_name || user?.email} 계정으로 등록한 업체입니다.</p>
          </div>
          <Link to="/business/register">
            <Button>+ 새 업체 등록</Button>
          </Link>
        </div>

        {loading ? <div className="text-muted-foreground">로딩 중...</div> : null}

        {!loading && listings.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            아직 등록한 업체가 없습니다.
            <br />
            <Link to="/business/register" className="mt-4 inline-block text-primary underline">
              첫 업체 등록하기
            </Link>
          </Card>
        ) : null}

        <div className="grid gap-4">
          {listings.map((listing) => {
            const badge = STATUS_BADGE[listing.status];
            return (
              <Card key={listing.id} className="p-4">
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="h-28 w-full overflow-hidden rounded-lg bg-muted md:w-40">
                    {listing.thumbnail_url ? (
                      <img src={listing.thumbnail_url} alt={getListingTitle(listing)} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{getListingTitle(listing)}</h2>
                        <p className="text-sm text-muted-foreground">
                          {getCategoryLabel(listing.category)} · {listing.district}
                        </p>
                      </div>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    {listing.rejection_reason ? (
                      <p className="mt-3 text-sm text-red-600">반려 사유: {listing.rejection_reason}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={listing.google_maps_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                          구글맵 보기
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
