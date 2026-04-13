import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ResidentDetailModal } from "@/components/community/ResidentDetailModal";
import { STAY_TYPE_LABELS, communityFetch, type CommunityResident, type ResidentListResponse, type StayType } from "@/lib/community";

const DEFAULT_AVATAR = "/default-avatar.svg";
const ageGroups = ["전체", "20대", "30대", "40대", "50대", "60대+"];
const stayTypeOptions: Array<{ value: "all" | StayType; label: string }> = [
  { value: "all", label: "전체" },
  { value: "monthly_stay", label: STAY_TYPE_LABELS.monthly_stay },
  { value: "long_term", label: STAY_TYPE_LABELS.long_term },
  { value: "retirement", label: STAY_TYPE_LABELS.retirement },
  { value: "workation", label: STAY_TYPE_LABELS.workation },
];

export default function Residents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [residents, setResidents] = useState<CommunityResident[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const stayType = (searchParams.get("stay_type") as "all" | StayType | null) || "all";
  const area = searchParams.get("area") || "";
  const ageGroup = searchParams.get("age_group") || "";

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("active", "true");
    params.set("limit", "50");
    if (stayType !== "all") params.set("stay_type", stayType);
    if (area) params.set("area", area);
    if (ageGroup) params.set("age_group", ageGroup);

    setLoading(true);
    communityFetch<ResidentListResponse>(`/api/residents?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        setResidents(response.residents);
        setTotal(response.total);
        setActiveCount(response.active_count);
      })
      .catch(() => {
        if (cancelled) return;
        setResidents([]);
        setTotal(0);
        setActiveCount(0);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ageGroup, area, stayType]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-6xl py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">다낭 체류자</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            현재 {activeCount}명 체류 중 · 조건에 맞는 공개 프로필 {total}명
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={stayType}
            onChange={(event) => updateFilter("stay_type", event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {stayTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={area}
            onChange={(event) => updateFilter("area", event.target.value)}
            placeholder="지역"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={ageGroup}
            onChange={(event) => updateFilter("age_group", event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">전체 연령대</option>
            {ageGroups.slice(1).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {loading ? <div className="py-16 text-center text-sm text-muted-foreground">체류자 목록을 불러오는 중입니다.</div> : null}
        {!loading && residents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            조건에 맞는 체류자가 없습니다.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {residents.map((resident) => (
            <Card
              key={resident.id}
              className="cursor-pointer border-border p-4 transition-shadow hover:shadow-md"
              onClick={() => setSelectedResidentId(resident.id)}
            >
              <div className="flex flex-col items-center text-center">
                <img
                  src={resident.display_avatar || DEFAULT_AVATAR}
                  alt={resident.nickname}
                  className="h-20 w-20 rounded-full border border-border object-cover"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <h2 className="mt-3 text-base font-semibold text-foreground">{resident.nickname}</h2>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {resident.age_group ? <Badge variant="outline">{resident.age_group}</Badge> : null}
                  <Badge variant="outline">{STAY_TYPE_LABELS[resident.stay_type]}</Badge>
                </div>
                {resident.area ? <p className="mt-2 text-xs text-muted-foreground">{resident.area}</p> : null}
                {resident.bio_summary ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{resident.bio_summary}</p> : null}
              </div>
            </Card>
          ))}
        </div>
      </main>
      <Footer />

      {selectedResidentId ? <ResidentDetailModal residentId={selectedResidentId} onClose={() => setSelectedResidentId(null)} /> : null}
    </div>
  );
}
