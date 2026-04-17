import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ResidentDetailModal } from "@/components/community/ResidentDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  STAY_TYPE_LABELS,
  communityFetch,
  formatRelativeTime,
  type CategoryEn,
  type CoffeeChat,
  type CommunityPostListItem,
  type CommunityResident,
  type ResidentListResponse,
} from "@/lib/community";

const tabs: Array<{ key: "all" | CategoryEn; label: string }> = [
  { key: "all", label: "전체" },
  { key: "notice", label: "공지" },
  { key: "question", label: "질문" },
  { key: "review", label: "후기" },
  { key: "info", label: "정보" },
];

export default function Community() {
  const defaultAvatar = "/default-avatar.svg";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<CommunityPostListItem[]>([]);
  const [residents, setResidents] = useState<CommunityResident[]>([]);
  const [residentActiveCount, setResidentActiveCount] = useState(0);
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [activeChat, setActiveChat] = useState<CoffeeChat | null>(null);
  const [loading, setLoading] = useState(true);

  const currentCategory = (searchParams.get("category") || "all") as "all" | CategoryEn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ limit: "30" });
    if (currentCategory !== "all") {
      params.set("category", currentCategory);
    }

    Promise.all([
      communityFetch<{ posts: CommunityPostListItem[] }>(`/api/community/posts?${params.toString()}`),
      communityFetch<ResidentListResponse>("/api/residents?active=true&limit=5"),
      communityFetch<{ chats: CoffeeChat[] }>("/api/coffee-chats?status=open&limit=1"),
    ])
      .then(([postResponse, residentResponse, coffeeResponse]) => {
        if (cancelled) return;
        setPosts(postResponse.posts);
        setResidents(residentResponse.residents);
        setResidentActiveCount(residentResponse.active_count);
        setActiveChat(coffeeResponse.chats[0] || null);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setResidents([]);
        setResidentActiveCount(0);
        setActiveChat(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentCategory]);

  const handleWriteClick = () => {
    if (!user) {
      navigate("/login?redirect=/community/write");
      return;
    }
    navigate("/community/write");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div style={{ backgroundColor: "#F8F9FA" }}>
          <div className="mx-auto max-w-[1100px] px-4 py-3">
            <div className="flex items-center gap-3 text-[15px] flex-wrap" style={{ color: "#888" }}>
              <span>📍 공개 체류자 {residentActiveCount}명</span>
              <span style={{ color: "#DDD" }}>·</span>
              <span>📝 게시글 {posts.length}개</span>
              <span style={{ color: "#DDD" }}>·</span>
              <span>☕ 오픈 커피챗 {activeChat ? 1 : 0}건</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1100px] px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold text-foreground">다낭 커뮤니티</h1>
            <Button size="sm" className="text-[15px] h-9 font-bold text-white" style={{ backgroundColor: "#FF6B35" }} onClick={handleWriteClick}>
              글쓰기
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[1100px] px-4 pb-16">
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-3 border-b" style={{ borderColor: "#EEE" }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (tab.key === "all") setSearchParams({});
                      else setSearchParams({ category: tab.key });
                    }}
                    className={cn(
                      "px-3 py-2.5 text-[15px] transition-colors",
                      currentCategory === tab.key
                        ? "font-extrabold border-b-2 border-foreground text-foreground"
                        : "font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">게시글을 불러오는 중입니다.</div>
              ) : posts.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">아직 게시글이 없습니다.</div>
              ) : (
                <div>
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="py-[11px] cursor-pointer hover:bg-muted/30 transition-colors flex items-center gap-3"
                      style={{ borderBottom: "1px solid #EEE" }}
                      onClick={() => navigate(`/community/${post.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className={cn("text-[14px] font-extrabold shrink-0", CATEGORY_COLORS[post.category])}>
                              [{CATEGORY_LABELS[post.category]}]
                            </span>
                            <span className="text-[16px] text-foreground truncate">{post.title}</span>
                            {post.comment_count > 0 && (
                              <span className={cn("text-[14px] font-bold shrink-0", post.comment_count >= 5 ? "text-red-500" : "text-muted-foreground")}>
                                [{post.comment_count}]
                              </span>
                            )}
                          </div>
                          <span className="text-[13px] shrink-0" style={{ color: "#AAA" }}>
                            {formatRelativeTime(post.created_at)}
                          </span>
                        </div>
                        <div className="mt-1 pl-0.5">
                          <span className="text-[13px]" style={{ color: "#888" }}>
                            {post.author.display_name}
                            {post.is_pinned ? " · 상단 고정" : ""}
                          </span>
                        </div>
                      </div>
                      {post.thumbnail_url && (
                        <img
                          src={post.thumbnail_url}
                          alt=""
                          className="w-[90px] h-[72px] sm:w-[160px] sm:h-[130px] rounded-lg object-cover shrink-0"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden lg:block w-[240px] shrink-0">
              <div className="rounded" style={{ border: "1px solid #EEE" }}>
                <div className="px-3 py-3 text-[15px] font-extrabold text-foreground" style={{ borderBottom: "1px solid #EEE" }}>
                  🟢 지금 다낭에 {residentActiveCount}명
                </div>
                <div className="px-3 py-2">
                  {residents.map((resident) => (
                    <button
                      key={resident.id}
                      type="button"
                      className="flex w-full items-start gap-2 rounded px-1 py-2 text-left transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedResidentId(resident.id)}
                    >
                      <img
                        src={resident.display_avatar || defaultAvatar}
                        alt={resident.nickname}
                        className="h-10 w-10 rounded-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = defaultAvatar;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{resident.nickname}</div>
                        <div className="text-xs text-muted-foreground">
                          {resident.age_group || "연령 비공개"} · {STAY_TYPE_LABELS[resident.stay_type]}
                        </div>
                        {resident.bio_summary ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{resident.bio_summary}</div> : null}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => navigate("/residents")}
                    className="mt-2 w-full text-[13px] py-1.5 rounded text-center font-semibold text-primary hover:underline"
                  >
                    전체 체류자 보기
                  </button>
                  <button
                    onClick={() => navigate(user ? "/residents/me" : "/login?redirect=/residents/me")}
                    className="mt-2 w-full text-[13px] py-1.5 rounded text-center font-semibold text-primary hover:underline"
                  >
                    등록하기
                  </button>
                </div>
              </div>

              {activeChat ? (
                <div className="mt-4 rounded" style={{ border: "1px solid #EEE" }}>
                  <div className="px-3 py-3 text-[15px] font-extrabold text-foreground" style={{ borderBottom: "1px solid #EEE" }}>
                    ☕ 다낭 커피챗
                  </div>
                  <div className="px-3 py-2 text-[13px]" style={{ color: "#666" }}>
                    <p>{new Date(activeChat.meetup_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="mt-0.5">{activeChat.location_name || "장소 추후 공지"} · 최대 {activeChat.max_participants}명</p>
                    <button
                      onClick={() => navigate("/coffee-chats")}
                      className="mt-2 w-full text-[13px] py-1.5 rounded text-center font-semibold border border-border hover:bg-muted/50 text-foreground"
                    >
                      신청 ({activeChat.current_participants}/{activeChat.max_participants})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded p-3 text-sm text-muted-foreground" style={{ border: "1px solid #EEE" }}>
                  예정된 커피챗이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      {selectedResidentId ? <ResidentDetailModal residentId={selectedResidentId} onClose={() => setSelectedResidentId(null)} /> : null}
    </div>
  );
}
