import { useState, useRef } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── types ── */
type StayType = "한달살기" | "장기체류" | "은퇴" | "워케이션";
interface Member {
  emoji: string;
  nickname: string;
  age: string;
  type: StayType;
  area: string;
  dateRange: string;
  intro: string;
  interests: string[];
  daysAgo: string;
}

/* ── sample data ── */
const sampleMembers: Member[] = [
  { emoji: "🏖️", nickname: "바다좋아", age: "30대", type: "한달살기", area: "미케비치", dateRange: "4/1 ~ 4/30", intro: "카페에서 같이 작업할 분 찾아요", interests: ["카페", "코워킹"], daysAgo: "3일 전" },
  { emoji: "⛳", nickname: "다낭골퍼", age: "50대", type: "장기체류", area: "한강 근처", dateRange: "3/15 ~ 6/15", intro: "주말 골프 같이 치실 분?", interests: ["골프", "맛집"], daysAgo: "5일 전" },
  { emoji: "👨‍👩‍👧", nickname: "행복한가족", age: "40대", type: "한달살기", area: "안투엉", dateRange: "4/5 ~ 5/5", intro: "7살 아이랑 왔어요", interests: ["아이동반", "맛집"], daysAgo: "1일 전" },
  { emoji: "💻", nickname: "워케이션러", age: "30대", type: "워케이션", area: "미케비치", dateRange: "4/10 ~ 5/10", intro: "개발자인데 코워킹 추천받아요", interests: ["코워킹", "카페"], daysAgo: "2일 전" },
  { emoji: "🌅", nickname: "은퇴다낭", age: "60대", type: "은퇴", area: "한강 근처", dateRange: "1/1 ~ 12/31", intro: "아침 산책 같이 하실 분", interests: ["운동", "맛집"], daysAgo: "7일 전" },
];

const filterOptions: ("전체" | StayType)[] = ["전체", "한달살기", "장기체류", "은퇴", "워케이션"];
const ageOptions = ["20대", "30대", "40대", "50대", "60대+"];
const typeOptions: StayType[] = ["한달살기", "장기체류", "은퇴", "워케이션"];
const areaOptions = ["미케비치", "한강 근처", "안투엉", "해안다리 근처", "기타"];
const interestOptions = ["카페", "골프", "맛집", "서핑", "아이동반", "운동", "코워킹"];

const kakaoRooms = [
  { emoji: "🏠", name: "다낭 한달살기방", desc: "준비 중인 사람 + 현재 체류 중" },
  { emoji: "🌴", name: "다낭 장기체류방", desc: "은퇴/6개월+ 체류" },
  { emoji: "📋", name: "다낭 비자·행정방", desc: "비자, 계약, 은행 등 실무 질문" },
];

const Community = () => {
  const [filter, setFilter] = useState<"전체" | StayType>("전체");
  const [members, setMembers] = useState<Member[]>(sampleMembers);
  const formRef = useRef<HTMLDivElement>(null);

  // form state
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [stayType, setStayType] = useState<StayType | "">("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [area, setArea] = useState("");
  const [intro, setIntro] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  // coffee chat form
  const [chatNickname, setChatNickname] = useState("");
  const [chatKakao, setChatKakao] = useState("");

  const filtered = filter === "전체" ? members : members.filter((m) => m.type === filter);

  const toggleInterest = (i: string) => {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const handleRegister = () => {
    if (!nickname || !age || !stayType || !startDate || !endDate || !area) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (nickname.length > 10) {
      toast.error("닉네임은 최대 10자입니다.");
      return;
    }
    const newMember: Member = {
      emoji: "😊",
      nickname,
      age,
      type: stayType as StayType,
      area,
      dateRange: `${format(startDate, "M/d")} ~ ${format(endDate, "M/d")}`,
      intro: intro || "",
      interests,
      daysAgo: "방금",
    };
    setMembers((prev) => [newMember, ...prev]);
    // save to localStorage
    try {
      const stored = JSON.parse(localStorage.getItem("community_members") || "[]");
      stored.unshift(newMember);
      localStorage.setItem("community_members", JSON.stringify(stored));
    } catch { /* ignore */ }
    // reset
    setNickname(""); setAge(""); setStayType(""); setStartDate(undefined); setEndDate(undefined); setArea(""); setIntro(""); setInterests([]);
    toast.success("등록 완료! 다낭에서 좋은 시간 보내세요.");
  };

  const handleCoffeeChatJoin = () => {
    if (!chatNickname || !chatKakao) {
      toast.error("닉네임과 카카오톡 ID를 입력해주세요.");
      return;
    }
    toast.success("커피챗 참가 신청 완료! 개별 안내 드리겠습니다.");
    setChatNickname(""); setChatKakao("");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Header */}
        <section className="py-12 md:py-16 bg-background">
          <div className="mx-auto max-w-[800px] px-4">
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">다낭 커뮤니티</h1>
            <p className="mt-3 text-[15px] text-muted-foreground">지금 다낭에 있는 한국인을 확인하고, 모임에 참여하세요</p>
          </div>
        </section>

        {/* Section 1: Who's in Danang */}
        <section className="py-16 md:py-20 bg-background">
          <div className="mx-auto max-w-[800px] px-4">
            <h2 className="text-2xl font-bold text-foreground mb-6">지금 다낭에 누가 있나</h2>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFilter(opt)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                    filter === opt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground mb-4">현재 등록: {filtered.length}명</p>

            {/* Member cards */}
            <div className="space-y-3">
              {filtered.map((m, i) => (
                <div
                  key={`${m.nickname}-${i}`}
                  className="border border-[hsl(30,8%,94%)] rounded-md p-4 md:p-5 bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="font-semibold text-foreground">{m.nickname}</span>
                        <span className="text-sm text-muted-foreground">· {m.age}</span>
                        <span className="text-sm text-muted-foreground">· {m.type}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{m.area} · {m.dateRange}</p>
                      {m.intro && <p className="mt-2 text-[15px] text-foreground">"{m.intro}"</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.interests.map((int) => (
                          <span key={int} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                            {int}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">{m.daysAgo}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button
                onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                나도 등록하기
              </Button>
            </div>
          </div>
        </section>

        {/* Section 2: Registration Form */}
        <section ref={formRef} className="py-16 md:py-20 bg-muted/30">
          <div className="mx-auto max-w-[800px] px-4">
            <div className="bg-card rounded-lg border border-border p-6 md:p-10">
              <h2 className="text-2xl font-bold text-foreground mb-8">나도 등록하기</h2>

              <div className="space-y-6">
                {/* Nickname */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">닉네임 <span className="text-destructive">*</span></label>
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 10))} placeholder="최대 10자" />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">연령대 <span className="text-destructive">*</span></label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {ageOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stay type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">유형 <span className="text-destructive">*</span></label>
                  <div className="flex flex-wrap gap-2">
                    {typeOptions.map((t) => (
                      <button
                        key={t}
                        onClick={() => setStayType(t)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                          stayType === t
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">체류 시작일 <span className="text-destructive">*</span></label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "yyyy.MM.dd") : "날짜 선택"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">체류 종료일 <span className="text-destructive">*</span></label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "yyyy.MM.dd") : "날짜 선택"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Area */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">지역 <span className="text-destructive">*</span></label>
                  <Select value={area} onValueChange={setArea}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {areaOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Intro */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">한 줄 소개</label>
                  <Input value={intro} onChange={(e) => setIntro(e.target.value.slice(0, 50))} placeholder="카페 추천 받아요!" />
                  <p className="text-xs text-muted-foreground mt-1">{intro.length}/50</p>
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">관심사</label>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((int) => (
                      <button
                        key={int}
                        onClick={() => toggleInterest(int)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                          interests.includes(int)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {int}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleRegister} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-[15px] font-semibold">
                  등록하기
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Coffee Chat */}
        <section className="py-16 md:py-20 bg-background">
          <div className="mx-auto max-w-[800px] px-4">
            <h2 className="text-2xl font-bold text-foreground mb-2">다낭 커피챗</h2>
            <p className="text-[15px] text-muted-foreground mb-8">매월 소규모로 만나는 한국인 모임</p>

            <div className="border border-border rounded-lg p-6 bg-card mb-8">
              <h3 className="font-semibold text-foreground mb-4">다음 일정</h3>
              <div className="space-y-2 text-[15px]">
                <p><span className="text-muted-foreground">날짜:</span> <span className="text-foreground font-medium">2026.05.03 (토) 14:00</span></p>
                <p><span className="text-muted-foreground">장소:</span> <span className="text-foreground">(추후 공지)</span></p>
                <p><span className="text-muted-foreground">인원:</span> <span className="text-foreground">최대 10명</span></p>
                <p><span className="text-muted-foreground">참가비:</span> <span className="text-foreground">없음 (각자 음료 주문)</span></p>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="font-medium text-foreground mb-3">참가 신청</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input value={chatNickname} onChange={(e) => setChatNickname(e.target.value)} placeholder="닉네임" className="sm:flex-1" />
                  <Input value={chatKakao} onChange={(e) => setChatKakao(e.target.value)} placeholder="카카오톡 ID" className="sm:flex-1" />
                  <Button onClick={handleCoffeeChatJoin} className="bg-primary text-primary-foreground hover:bg-primary/90">참가 신청</Button>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="font-semibold text-foreground mb-2">이전 모임</h3>
              <p className="text-sm text-muted-foreground">준비 중입니다. 첫 모임 후 후기가 올라갑니다.</p>
            </div>
          </div>
        </section>

        {/* Section 4: KakaoTalk Rooms */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="mx-auto max-w-[800px] px-4">
            <h2 className="text-2xl font-bold text-foreground mb-2">다낭 한달살기 카톡방</h2>
            <p className="text-[15px] text-muted-foreground mb-8">현재 체류자 + 준비 중인 사람들의 실시간 소통방</p>

            <div className="space-y-3">
              {kakaoRooms.map((room) => (
                <div key={room.name} className="flex items-center justify-between border border-border rounded-lg p-4 md:p-5 bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{room.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{room.name}</p>
                      <p className="text-sm text-muted-foreground">{room.desc}</p>
                    </div>
                  </div>
                  <a
                    href="#"
                    className="shrink-0 ml-4 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ backgroundColor: "#FEE500", color: "#191919" }}
                  >
                    참여하기
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom link */}
        <section className="py-12 bg-background">
          <div className="mx-auto max-w-[800px] px-4 text-center">
            <a href="/" className="text-primary hover:underline font-medium text-[15px]">메인으로 돌아가기 →</a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Community;
