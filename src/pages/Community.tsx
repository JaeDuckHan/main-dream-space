import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── types ── */
type StayType = "한달살기" | "장기체류" | "은퇴" | "워케이션";

interface Resident {
  nickname: string;
  age: string;
  type: StayType;
  area: string;
  period: string;
}

interface PastResident {
  name: string;
  age: string;
  label: string;
  note: string;
}

interface QAItem {
  question: string;
  answers: number;
  time: string;
  author: string;
}

/* ── data ── */
const operatorNotes = [
  "미케비치 한국 분식집 '엄마손' 어제 오픈. 김밥 25,000동.",
  "이번 주부터 우기 시작. 우산 챙기세요.",
  "환율 18.8동 → 환전 유리한 시점.",
];

const qaItems: QAItem[] = [
  { question: "미케비치 한국 미용실 추천?", answers: 3, time: "2시간 전", author: "다낭골퍼" },
  { question: "공항 환전 vs 시내 환전?", answers: 7, time: "어제", author: "바다좋아" },
  { question: "7살 아이 영어유치원?", answers: 2, time: "3일 전", author: "행복한가족" },
  { question: "오토바이 렌트 안전한가요?", answers: 5, time: "4일 전", author: "워케이션러" },
  { question: "베트남 운전면허 발급?", answers: 1, time: "1주 전", author: "은퇴다낭" },
];

const residents: Resident[] = [
  { nickname: "바다좋아", age: "30대", type: "한달살기", area: "미케비치 권역", period: "4월" },
  { nickname: "다낭골퍼", age: "50대", type: "장기체류", area: "한강 권역", period: "3-6월" },
  { nickname: "행복한가족", age: "40대", type: "한달살기", area: "안투엉 권역", period: "4-5월" },
  { nickname: "워케이션러", age: "30대", type: "워케이션", area: "미케비치 권역", period: "4-5월" },
  { nickname: "은퇴다낭", age: "60대", type: "은퇴", area: "한강 권역", period: "연중" },
];

const pastResidents: PastResident[] = [
  { name: "김OO", age: "30대", label: "3월 한달살기", note: "안투엉이 미케비치보다 조용했음" },
  { name: "이OO", age: "50대", label: "2월 장기체류", note: "골프 비용 한국 1/3" },
  { name: "박OO", age: "40대", label: "3월 가족", note: "그랩 키즈시트 없음 주의" },
];

const typeOptions: StayType[] = ["한달살기", "장기체류", "은퇴", "워케이션"];
const ageOptions = ["20대", "30대", "40대", "50대", "60대+"];
const areaOptions = ["미케비치 권역", "한강 권역", "안투엉 권역", "해안다리 권역", "기타"];
const monthOptions = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const Community = () => {
  const [showRegister, setShowRegister] = useState(false);
  const [showCoffeeChat, setShowCoffeeChat] = useState(false);
  const [memberList, setMemberList] = useState<Resident[]>(residents);

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

  const handleRegister = () => {
    if (!rNickname || !rAge || !rType || !rStartMonth || !rEndMonth || !rArea) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }
    const period = rStartMonth === rEndMonth
      ? rStartMonth.replace("월", "") + "월"
      : `${rStartMonth.replace("월", "")}-${rEndMonth.replace("월", "")}월`;
    const newMember: Resident = {
      nickname: rNickname.slice(0, 10),
      age: rAge,
      type: rType as StayType,
      area: rArea,
      period,
    };
    setMemberList((prev) => [newMember, ...prev]);
    setShowRegister(false);
    setRNickname(""); setRAge(""); setRType(""); setRStartMonth(""); setREndMonth(""); setRArea("");
    toast.success("등록 완료.");
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Header */}
        <div className="mx-auto max-w-[900px] px-4 pt-10 pb-6">
          <h1 className="text-lg font-bold text-foreground">다낭 커뮤니티</h1>
        </div>

        {/* Section 1: Live bar */}
        <div className="bg-muted/50">
          <div className="mx-auto max-w-[900px] px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span>☀️ 28°C</span>
              <span className="text-border">·</span>
              <span>💱 ₩1 = 18.4동</span>
              <span className="text-border">·</span>
              <span>📍 {memberList.length}명 체류 중</span>
              <span className="text-border">·</span>
              <span>이번 주 +5</span>
            </div>
          </div>
        </div>

        {/* Section 2: 오늘의 다낭 */}
        <section className="mx-auto max-w-[900px] px-4 py-10">
          <p className="text-xs text-muted-foreground mb-3">운영자 노트 · 2시간 전</p>
          <div className="space-y-2">
            {operatorNotes.map((note, i) => (
              <div key={i} className="text-[15px] text-foreground leading-relaxed border-l-2 border-border pl-3">
                {note}
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Q&A */}
        <section className="mx-auto max-w-[900px] px-4 py-10 border-t border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">질문</h2>
            <Button variant="outline" size="sm" className="text-sm h-8">질문하기</Button>
          </div>
          <div className="space-y-0">
            {qaItems.map((item, i) => (
              <div key={i} className="py-3 border-b border-border last:border-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[15px] text-foreground">{item.question}</span>
                  <span className="text-xs text-muted-foreground">· 답변 {item.answers}</span>
                  <span className="text-xs text-muted-foreground">· {item.time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 pl-0.5">{item.author}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: 체류 중 */}
        <section className="mx-auto max-w-[900px] px-4 py-10 border-t border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">다낭에 있는 사람</h2>
            <Button variant="outline" size="sm" className="text-sm h-8" onClick={() => setShowRegister(true)}>등록하기</Button>
          </div>
          <div className="space-y-0">
            {memberList.map((m, i) => (
              <div key={`${m.nickname}-${i}`} className="py-3 border-b border-border last:border-0">
                <div className="flex items-baseline gap-1.5 flex-wrap text-[15px]">
                  <span className="font-medium text-foreground">{m.nickname}</span>
                  <span className="text-muted-foreground">· {m.age}</span>
                  <span className="text-muted-foreground">· {m.type}</span>
                  <span className="text-muted-foreground">· {m.area}</span>
                  <span className="text-muted-foreground">· {m.period}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5: 다녀간 사람 */}
        <section className="mx-auto max-w-[900px] px-4 py-10 border-t border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">다녀간 사람</h2>
          <div className="space-y-0">
            {pastResidents.map((p, i) => (
              <div key={i} className="py-3 border-b border-border last:border-0">
                <div className="flex items-baseline gap-1.5 flex-wrap text-[15px]">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">· {p.age}</span>
                  <span className="text-muted-foreground">· {p.label}</span>
                  <span className="text-muted-foreground">· "{p.note}"</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 6: 커피챗 */}
        <section className="mx-auto max-w-[900px] px-4 py-10 border-t border-border">
          <div className="flex items-center justify-between py-3 px-4 rounded-md border border-border bg-card">
            <div className="flex items-center gap-2 text-[15px] text-foreground flex-wrap">
              <span>☕</span>
              <span className="font-medium">다낭 커피챗</span>
              <span className="text-muted-foreground">· 다음 모임: 5월 3일(토)</span>
              <span className="text-muted-foreground">· 최대 10명</span>
            </div>
            <Button variant="outline" size="sm" className="text-sm h-8 shrink-0" onClick={() => setShowCoffeeChat(true)}>신청</Button>
          </div>
        </section>
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
              <Input value={rNickname} onChange={(e) => setRNickname(e.target.value.slice(0, 10))} placeholder="최대 10자" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">연령대</label>
              <Select value={rAge} onValueChange={setRAge}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {ageOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">유형</label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((t) => (
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
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">종료 월</label>
                <Select value={rEndMonth} onValueChange={setREndMonth}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">권역</label>
              <Select value={rArea} onValueChange={setRArea}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {areaOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
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
              <Input value={ccNickname} onChange={(e) => setCcNickname(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">카카오톡 ID</label>
              <Input value={ccKakao} onChange={(e) => setCcKakao(e.target.value)} />
            </div>
            <Button onClick={handleCoffeeChat} className="w-full">신청</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Community;
