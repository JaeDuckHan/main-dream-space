import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { communityFetch, type CoffeeChat } from "@/lib/community";
import { toast } from "sonner";

export default function CoffeeChats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState<CoffeeChat[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetupAt, setMeetupAt] = useState("");
  const [locationName, setLocationName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("10");

  const loadChats = async () => {
    try {
      const response = await communityFetch<{ chats: CoffeeChat[] }>("/api/coffee-chats?limit=20");
      setChats(response.chats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "커피챗을 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    void loadChats();
  }, []);

  const handleJoin = async (chatId: number, joined: boolean | undefined) => {
    if (!user) {
      navigate("/login?redirect=/coffee-chats");
      return;
    }

    try {
      await communityFetch(`/api/coffee-chats/${chatId}/join`, {
        method: joined ? "DELETE" : "POST",
      });
      await loadChats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "참가 처리에 실패했습니다.");
    }
  };

  const handleCreate = async () => {
    if (!user) {
      navigate("/login?redirect=/coffee-chats");
      return;
    }

    try {
      await communityFetch("/api/coffee-chats", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          meetup_at: new Date(meetupAt).toISOString(),
          location_name: locationName,
          max_participants: Number(maxParticipants),
        }),
      });
      setTitle("");
      setDescription("");
      setMeetupAt("");
      setLocationName("");
      setMaxParticipants("10");
      setCreating(false);
      await loadChats();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "커피챗 생성에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-5xl py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">다낭 커피챗</h1>
            <p className="text-sm text-muted-foreground">예정된 오프라인 모임을 확인하고 바로 참가할 수 있습니다.</p>
          </div>
          <Button onClick={() => setCreating((current) => !current)}>{creating ? "폼 닫기" : "커피챗 만들기"}</Button>
        </div>

        {creating ? (
          <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="모임 제목" />
              <Input type="datetime-local" value={meetupAt} onChange={(event) => setMeetupAt(event.target.value)} />
              <Input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="장소명" />
              <Input value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} placeholder="최대 인원" />
            </div>
            <Textarea className="mt-4" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="모임 소개" />
            <div className="mt-4 flex justify-end">
              <Button onClick={() => void handleCreate()}>생성</Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {chats.map((chat) => (
            <div key={chat.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{chat.title}</h2>
                  <div className="mt-1 text-sm text-muted-foreground">{new Date(chat.meetup_at).toLocaleString("ko-KR")}</div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{chat.status}</span>
              </div>
              <p className="mt-3 text-sm text-foreground">{chat.description || "소개가 아직 없습니다."}</p>
              <div className="mt-4 text-sm text-muted-foreground">
                <div>장소: {chat.location_name || "추후 공지"}</div>
                <div>참가: {chat.current_participants} / {chat.max_participants}</div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant={chat.joined_by_me ? "outline" : "default"} onClick={() => void handleJoin(chat.id, chat.joined_by_me)}>
                  {chat.joined_by_me ? "참가 취소" : "참가 신청"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
