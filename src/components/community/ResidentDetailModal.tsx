import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  STAY_TYPE_LABELS,
  communityFetch,
  type ResidentDetailResponse,
} from "@/lib/community";

const DEFAULT_AVATAR = "/default-avatar.svg";

interface ResidentDetailModalProps {
  residentId: number;
  onClose: () => void;
}

export function ResidentDetailModal({ residentId, onClose }: ResidentDetailModalProps) {
  const [data, setData] = useState<ResidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    communityFetch<ResidentDetailResponse>(`/api/residents/${residentId}`)
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [residentId]);

  const resident = data?.resident;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resident ? `${resident.nickname} 프로필` : "체류자 프로필"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">프로필을 불러오는 중입니다.</div>
        ) : !resident || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">프로필을 불러오지 못했습니다.</div>
        ) : (
          <div className="space-y-5">
            <div className="flex gap-4">
              <img
                src={resident.display_avatar || DEFAULT_AVATAR}
                alt={resident.nickname}
                className="h-20 w-20 rounded-full border border-border object-cover"
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{resident.nickname}</h2>
                  {resident.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">체류 중</Badge> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {resident.age_group ? <Badge variant="outline">{resident.age_group}</Badge> : null}
                  <Badge variant="outline">{STAY_TYPE_LABELS[resident.stay_type]}</Badge>
                  {resident.area ? <Badge variant="outline">{resident.area}</Badge> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatStayPeriod(resident.stay_from, resident.stay_to)}
                </p>
                {resident.bio_summary ? <p className="mt-2 text-sm text-foreground">{resident.bio_summary}</p> : null}
              </div>
            </div>

            {resident.interests?.length ? (
              <div className="flex flex-wrap gap-2">
                {resident.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    #{interest}
                  </Badge>
                ))}
              </div>
            ) : null}

            {resident.bio ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">자기소개</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{resident.bio}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="작성 글" value={data.stats.post_count} />
              <StatCard label="댓글" value={data.stats.comment_count} />
              <StatCard label="커피챗 주최" value={data.stats.coffee_chats_organized} />
              <StatCard label="커피챗 참여" value={data.stats.coffee_chats_joined} />
            </div>

            {data.recent_posts.length ? (
              <section>
                <h3 className="text-sm font-semibold text-foreground">최근 작성 글</h3>
                <div className="mt-2 space-y-2">
                  {data.recent_posts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/community/${post.id}`}
                      className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                      onClick={onClose}
                    >
                      <span className="mr-2 text-muted-foreground">[{CATEGORY_LABELS[post.category]}]</span>
                      <span className="text-foreground">{post.title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {data.recent_coffee_chats.length ? (
              <section>
                <h3 className="text-sm font-semibold text-foreground">최근 커피챗</h3>
                <div className="mt-2 space-y-2">
                  {data.recent_coffee_chats.map((chat) => (
                    <div key={chat.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="font-medium text-foreground">{chat.title}</div>
                      <div className="mt-1 text-muted-foreground">
                        {new Date(chat.meetup_at).toLocaleString("ko-KR")} · {chat.status}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatStayPeriod(stayFrom: string, stayTo: string | null) {
  const start = new Date(stayFrom).toLocaleDateString("ko-KR");
  const end = stayTo ? new Date(stayTo).toLocaleDateString("ko-KR") : "무기한";
  return `${start} ~ ${end}`;
}
