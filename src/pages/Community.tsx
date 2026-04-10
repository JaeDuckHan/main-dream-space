import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── types ── */
type Category = "공지" | "질문" | "후기" | "정보";
type StayType = "한달살기" | "장기체류" | "은퇴" | "워케이션";

interface Post {
  id: number;
  category: Category;
  title: string;
  replies: number;
  time: string;
  author: string;
  authorMeta?: string;
}

interface Resident {
  nickname: string;
  age: string;
  type: StayType;
  area: string;
  period: string;
}

/* ── data ── */
const posts: Post[] = [
  { id: 1, category: "공지", title: "미케비치 분식집 '엄마손' 오픈, 김밥 25,000동", replies: 0, time: "2시간 전", author: "운영자" },
  { id: 2, category: "공지", title: "이번 주부터 우기 시작, 우산 필수", replies: 2, time: "3시간 전", author: "운영자" },
  { id: 3, category: "질문", title: "공항 환전 vs 시내 어디가 나아요?", replies: 7, time: "어제", author: "김수현" },
  { id: 4, category: "질문", title: "미케비치 한국 미용실 추천", replies: 3, time: "2시간 전", author: "다낭3년차" },
  { id: 5, category: "질문", title: "7살 아이 영어유치원 괜찮은 데 있나요?", replies: 2, time: "3일 전", author: "워킹맘" },
  { id: 6, category: "질문", title: "오토바이 렌트 안전한가요?", replies: 5, time: "4일 전", author: "개발자김" },
  { id: 7, category: "질문", title: "베트남 운전면허 발급 절차", replies: 1, time: "1주 전", author: "박은퇴" },
  { id: 8, category: "후기", title: "안투엉이 미케비치보다 조용했음", replies: 3, time: "03/14", author: "김OO", authorMeta: "30대 · 3월 한달살기" },
  { id: 9, category: "후기", title: "골프 비용 한국의 1/3 수준", replies: 8, time: "03/10", author: "이OO", authorMeta: "50대 · 2월 장기체류" },
  { id: 10, category: "후기", title: "그랩 키즈시트 없음 주의", replies: 4, time: "03/08", author: "박OO", authorMeta: "40대 · 3월 가족" },
  { id: 11, category: "정보", title: "환율 18.8동, 환전 유리한 시점", replies: 1, time: "5시간 전", author: "운영자" },
  { id: 12, category: "질문", title: "한강 근처 월세 50만원대 가능?", replies: 12, time: "어제", author: "이정호" },
  { id: 13, category: "질문", title: "다낭 국제학교 학비 얼마인가요", replies: 4, time: "2일 전", author: "교육맘" },
  { id: 14, category: "정보", title: "비자런 나짱 vs 방콕 비교", replies: 6, time: "3일 전", author: "비자전문" },
  { id: 15, category: "질문", title: "한국 택배 받을 수 있는 주소?", replies: 0, time: "5시간 전", author: "택배고민" },
  { id: 16, category: "질문", title: "다낭 치과 스케일링 가격", replies: 3, time: "6시간 전", author: "최민수" },
  { id: 17, category: "정보", title: "4월 다낭 축제 일정 정리", replies: 2, time: "1일 전", author: "다낭3년차" },
  { id: 18, category: "질문", title: "코워킹 스페이스 와이파이 속도 어떤가요", replies: 1, time: "1일 전", author: "개발자김" },
  { id: 19, category: "후기", title: "미케비치 헬스장 3곳 비교", replies: 11, time: "02/28", author: "헬스매니아", authorMeta: "30대 · 2월 워케이션" },
  { id: 20, category: "질문", title: "반려동물 데려올 수 있나요?", replies: 0, time: "8시간 전", author: "댕댕이맘" },
  { id: 21, category: "정보", title: "다낭 → 호이안 그랩 요금 정리", replies: 5, time: "2일 전", author: "교통정보" },
  { id: 22, category: "질문", title: "장기체류 보험 추천", replies: 9, time: "4일 전", author: "보험고민" },
  { id: 23, category: "질문", title: "빨래방 vs 세탁기 달린 숙소", replies: 2, time: "5일 전", author: "깔끔좋아" },
  { id: 24, category: "후기", title: "한강 근처 카페 5곳 정리", replies: 15, time: "02/20", author: "카페탐방", authorMeta: "30대 · 1월 한달살기" },
  { id: 25, category: "질문", title: "다낭에서 한국 넷플릭스 되나요?", replies: 3, time: "1주 전", author: "박지영" },
  { id: 26, category: "정보", title: "베트남 eSIM 통신사별 비교", replies: 7, time: "1주 전", author: "IT아저씨" },
  { id: 27, category: "질문", title: "아이 예방접종 다낭에서 가능?", replies: 1, time: "2주 전", author: "워킹맘" },
  { id: 28, category: "질문", title: "한달살기 짐 뭐 챙겨가나요", replies: 4, time: "2주 전", author: "준비중" },
  { id: 29, category: "후기", title: "3개월 체류 생활비 정산 공유", replies: 13, time: "01/15", author: "가계부왕", authorMeta: "40대 · 장기체류" },
  { id: 30, category: "질문", title: "우기에 서핑 가능한가요?", replies: 0, time: "3개월 전", author: "서핑초보" },
];

const residents: Resident[] = [
  { nickname: "김수현", age: "30대", type: "한달살기", area: "미케비치", period: "4월" },
  { nickname: "다낭3년차", age: "50대", type: "장기체류", area: "한강", period: "3-6월" },
  { nickname: "워킹맘", age: "40대", type: "한달살기", area: "안투엉", period: "4-5월" },
  { nickname: "개발자김", age: "30대", type: "워케이션", area: "미케비치", period: "4-5월" },
  { nickname: "박은퇴", age: "60대", type: "은퇴", area: "한강", period: "연중" },
];

const categoryColor: Record<Category, string> = {
  "공지": "text-red-600",
  "질문": "text-blue-600",
  "후기": "text-green-600",
  "정보": "text-gray-500",
};

const typeOptions: StayType[] = ["한달살기", "장기체류", "은퇴", "워케이션"];
const ageOptions = ["20대", "30대", "40대", "50대", "60대+"];
const areaOptions = ["미케비치 권역", "한강 권역", "안투엉 권역", "해안다리 권역", "기타"];
const monthOptions = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const Community = () => {
  const [showRegister, setShowRegister] = useState(false);
  const [showCoffeeChat, setShowCoffeeChat] = useState(false);
  const [filterCat, setFilterCat] = useState<Category | "전체">("전체");

  // register form
  const [rNickname, setRNickname] = useState("");
  const [rAge, setRAge] = useState("");
  const [rType, setRType] = useState<StayType | "">("");
  const [rStartMonth, setRStartMonth] = useState("");
  const [rEndMonth, setREndMonth] = useState("");
  const [rArea, setRArea] = useState("");

  // coffee chat
  const [ccNickname, setCcNickname] = useState("");
  const [ccKakao, setCcKakao] = useState("");

  const filtered = filterCat === "전체" ? posts : posts.filter(p => p.category === filterCat);

  const handleRegister = () => {
    if (!rNickname || !rAge || !rType || !rStartMonth || !rEndMonth || !rArea) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }
    toast.success("등록 완료.");
    setShowRegister(false);
    setRNickname(""); setRAge(""); setRType(""); setRStartMonth(""); setREndMonth(""); setRArea("");
  };

  const handleCoffeeChat = () => {
    if (!ccNickname || !ccKakao) {
      toast.error("닉네임과 카카오톡 ID를 입력해주세요.");
      return;
    }
    toast.success("신청 완료.");
    setCcNickname(""); setCcKakao("");
    setShowCoffeeChat(false);
  };

  const categories: (Category | "전체")[] = ["전체", "공지", "질문", "후기", "정보"];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Live bar */}
        <div style={{ backgroundColor: "#F8F9FA" }}>
          <div className="mx-auto max-w-[1100px] px-4 py-3">
            <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: "#888" }}>
              <span>☀️ 28°C</span>
              <span style={{ color: "#DDD" }}>·</span>
              <span>💱 ₩1 = 18.4동</span>
              <span style={{ color: "#DDD" }}>·</span>
              <span>📍 23명 체류 중</span>
              <span style={{ color: "#DDD" }}>·</span>
              <span>이번 주 +5</span>
            </div>
          </div>
        </div>

        {/* Header + Write button */}
        <div className="mx-auto max-w-[1100px] px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground">다낭 커뮤니티</h1>
            <Button
              size="sm"
              className="text-sm h-8 font-medium text-white"
              style={{ backgroundColor: "#FF6B35" }}
            >
              글쓰기
            </Button>
          </div>
        </div>

        {/* Main layout */}
        <div className="mx-auto max-w-[1100px] px-4 pb-16">
          <div className="flex gap-6">
            {/* Left: Board */}
            <div className="flex-1 min-w-0">
              {/* Category tabs */}
              <div className="flex items-center gap-1 mb-3 border-b" style={{ borderColor: "#EEE" }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={cn(
                      "px-3 py-2 text-sm transition-colors",
                      filterCat === cat
                        ? "font-bold border-b-2 border-foreground text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Post list */}
              <div>
                {filtered.map(post => (
                  <div
                    key={post.id}
                    className="py-[10px] cursor-pointer hover:bg-muted/30 transition-colors"
                    style={{ borderBottom: "1px solid #EEE" }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className={cn("text-xs font-bold shrink-0", categoryColor[post.category])}>
                          [{post.category}]
                        </span>
                        <span className="text-sm text-foreground truncate">{post.title}</span>
                        {post.replies > 0 && (
                          <span
                            className={cn(
                              "text-xs font-bold shrink-0",
                              post.replies >= 5 ? "text-red-500" : "text-muted-foreground"
                            )}
                          >
                            [{post.replies}]
                          </span>
                        )}
                      </div>
                      <span className="text-xs shrink-0" style={{ color: "#AAA" }}>
                        {post.time}
                      </span>
                    </div>
                    <div className="mt-0.5 pl-0.5">
                      <span className="text-xs" style={{ color: "#888" }}>
                        {post.author}
                        {post.authorMeta && ` · ${post.authorMeta}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="hidden lg:block w-[240px] shrink-0">
              {/* Residents */}
              <div className="rounded" style={{ border: "1px solid #EEE" }}>
                <div className="px-3 py-2.5 text-sm font-bold text-foreground" style={{ borderBottom: "1px solid #EEE" }}>
                  🟢 지금 다낭에 23명
                </div>
                <div className="px-3 py-2">
                  {residents.map((r, i) => (
                    <div key={i} className="py-1.5 text-xs" style={{ color: "#666" }}>
                      <span className="text-foreground font-medium">{r.nickname}</span>
                      {" "}· {r.age} · {r.type}
                    </div>
                  ))}
                  <button
                    onClick={() => setShowRegister(true)}
                    className="mt-2 w-full text-xs py-1.5 rounded text-center font-medium text-primary hover:underline"
                  >
                    등록하기
                  </button>
                </div>
              </div>

              {/* Coffee chat */}
              <div className="mt-4 rounded" style={{ border: "1px solid #EEE" }}>
                <div className="px-3 py-2.5 text-sm font-bold text-foreground" style={{ borderBottom: "1px solid #EEE" }}>
                  ☕ 다낭 커피챗
                </div>
                <div className="px-3 py-2 text-xs" style={{ color: "#666" }}>
                  <p>5월 3일(토) 14:00</p>
                  <p className="mt-0.5">장소 추후 공지 · 최대 10명</p>
                  <button
                    onClick={() => setShowCoffeeChat(true)}
                    className="mt-2 w-full text-xs py-1.5 rounded text-center font-medium border border-border hover:bg-muted/50 text-foreground"
                  >
                    신청
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Register Modal */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">등록하기</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-4">등록한 정보는 다낭 커뮤니티에서 공개됩니다.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">닉네임</label>
              <Input value={rNickname} onChange={e => setRNickname(e.target.value.slice(0, 10))} placeholder="최대 10자" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">연령대</label>
              <Select value={rAge} onValueChange={setRAge}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{ageOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">유형</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(t => (
                  <button
                    key={t}
                    onClick={() => setRType(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      rType === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">시작 월</label>
                <Select value={rStartMonth} onValueChange={setRStartMonth}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">종료 월</label>
                <Select value={rEndMonth} onValueChange={setREndMonth}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{monthOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">권역</label>
              <Select value={rArea} onValueChange={setRArea}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{areaOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleRegister} className="w-full">등록하기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Coffee Chat Modal */}
      <Dialog open={showCoffeeChat} onOpenChange={setShowCoffeeChat}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">커피챗 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">닉네임</label>
              <Input value={ccNickname} onChange={e => setCcNickname(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">카카오톡 ID</label>
              <Input value={ccKakao} onChange={e => setCcKakao(e.target.value)} />
            </div>
            <Button onClick={handleCoffeeChat} className="w-full">신청</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Community;
