import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { communityFetch, STAY_TYPE_LABELS, type CommunityResident, type StayType } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DEFAULT_AVATAR = "/default-avatar.svg";
const ageGroups = ["20대", "30대", "40대", "50대", "60대+"];
const stayTypes = Object.entries(STAY_TYPE_LABELS) as Array<[StayType, string]>;
const contactMethods = [
  { value: "coffee_chat", label: "커피챗으로만" },
  { value: "post_only", label: "게시글/댓글로만" },
  { value: "none", label: "연락 받지 않음" },
] as const;

type ResidentFormState = {
  nickname: string;
  age_group: string;
  stay_type: StayType;
  area: string;
  stay_from: string;
  stay_to: string;
  bio: string;
  bio_summary: string;
  interests: string[];
  contact_method: "coffee_chat" | "post_only" | "none";
  is_public: boolean;
  use_custom_avatar: boolean;
  avatar_url: string | null;
};

const initialState: ResidentFormState = {
  nickname: "",
  age_group: "",
  stay_type: "monthly_stay",
  area: "",
  stay_from: "",
  stay_to: "",
  bio: "",
  bio_summary: "",
  interests: [],
  contact_method: "post_only",
  is_public: true,
  use_custom_avatar: false,
  avatar_url: null,
};

export default function ResidentMe() {
  return (
    <RequireAuth>
      <ResidentMeContent />
    </RequireAuth>
  );
}

function ResidentMeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [resident, setResident] = useState<CommunityResident | null>(null);
  const [form, setForm] = useState<ResidentFormState>(initialState);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    communityFetch<{ resident: CommunityResident | null }>("/api/residents/me")
      .then((response) => {
        if (response.resident) {
          setResident(response.resident);
          setForm(mapResidentToForm(response.resident));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const displayAvatar = useMemo(() => {
    if (form.use_custom_avatar && form.avatar_url) return form.avatar_url;
    return user?.avatar_url || DEFAULT_AVATAR;
  }, [form.avatar_url, form.use_custom_avatar, user?.avatar_url]);

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB 이하여야 합니다.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await communityFetch<{ avatar_url: string; use_custom_avatar: true }>("/api/residents/me/avatar", {
        method: "POST",
        body,
      });
      setForm((current) => ({ ...current, avatar_url: result.avatar_url, use_custom_avatar: true }));
      toast.success("프로필 사진을 업데이트했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "사진 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleAvatarReset = async () => {
    try {
      await communityFetch("/api/residents/me/avatar", { method: "DELETE" });
      setForm((current) => ({ ...current, avatar_url: null, use_custom_avatar: false }));
      toast.success("OAuth 기본 프로필 사진으로 되돌렸습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "기본 사진 복원에 실패했습니다.");
    }
  };

  const handleSubmit = async () => {
    if (!form.nickname.trim() || !form.stay_from) {
      toast.error("닉네임과 체류 시작일은 필수입니다.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await communityFetch<{ resident: CommunityResident }>(resident ? "/api/residents/me" : "/api/residents", {
        method: resident ? "PATCH" : "POST",
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          age_group: form.age_group || null,
          stay_type: form.stay_type,
          area: form.area.trim() || null,
          stay_from: form.stay_from,
          stay_to: form.stay_to || null,
          bio: form.bio.trim() || null,
          bio_summary: form.bio_summary.trim() || null,
          interests: form.interests,
          contact_method: form.contact_method,
          is_public: form.is_public,
          use_custom_avatar: form.use_custom_avatar,
        }),
      });
      setResident(response.resident);
      setForm(mapResidentToForm(response.resident));
      toast.success("체류자 프로필을 저장했습니다.");
      navigate("/community");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHide = async () => {
    try {
      await communityFetch("/api/residents/me", { method: "DELETE" });
      setForm((current) => ({ ...current, is_public: false }));
      toast.success("프로필 공개를 중단했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "숨김 처리에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-10">
        <h1 className="text-2xl font-bold text-foreground">체류자 프로필</h1>
        <p className="mt-2 text-sm text-muted-foreground">커뮤니티 사이드바와 체류자 목록에 노출되는 공개 프로필입니다.</p>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">내 체류자 정보를 불러오는 중입니다.</div>
        ) : (
          <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
              <img
                src={displayAvatar}
                alt="프로필"
                className="h-24 w-24 rounded-full border border-border object-cover"
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {form.use_custom_avatar ? "커스텀 사진 사용 중" : "OAuth 기본 사진 사용 중"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                    {uploading ? "업로드 중..." : "사진 변경"}
                  </Button>
                  {form.use_custom_avatar ? (
                    <Button variant="outline" onClick={() => void handleAvatarReset()}>
                      기본으로 되돌리기
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleAvatarUpload(file);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <Label className="font-medium text-foreground">프로필 공개</Label>
                <p className="mt-1 text-sm text-muted-foreground">끄면 목록, 상세, 커뮤니티 사이드바에서 숨겨집니다.</p>
              </div>
              <Switch checked={form.is_public} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_public: checked }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="닉네임">
                <Input value={form.nickname} onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))} maxLength={50} />
              </Field>
              <Field label="연령대">
                <select
                  value={form.age_group}
                  onChange={(event) => setForm((current) => ({ ...current, age_group: event.target.value }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">선택 안 함</option>
                  {ageGroups.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="체류 타입">
                <select
                  value={form.stay_type}
                  onChange={(event) => setForm((current) => ({ ...current, stay_type: event.target.value as StayType }))}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {stayTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="지역">
                <Input value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} maxLength={100} />
              </Field>
              <Field label="체류 시작일">
                <Input type="date" value={form.stay_from} onChange={(event) => setForm((current) => ({ ...current, stay_from: event.target.value }))} />
              </Field>
              <Field label="체류 종료일">
                <Input type="date" value={form.stay_to} onChange={(event) => setForm((current) => ({ ...current, stay_to: event.target.value }))} />
              </Field>
            </div>

            <Field label="한 줄 소개">
              <Input
                value={form.bio_summary}
                onChange={(event) => setForm((current) => ({ ...current, bio_summary: event.target.value.slice(0, 80) }))}
                maxLength={80}
                placeholder="사이드바에 짧게 노출됩니다."
              />
              <p className="mt-1 text-xs text-muted-foreground">{form.bio_summary.length}/80</p>
            </Field>

            <Field label="자기소개">
              <Textarea
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                rows={6}
                maxLength={2000}
                placeholder="다낭에서의 생활과 관심사를 자유롭게 적어주세요."
              />
            </Field>

            <Field label="관심사">
              <Input
                value={form.interests.join(", ")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    interests: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean)
                      .slice(0, 5),
                  }))
                }
                placeholder="예: 카페, 개발, 수영"
              />
            </Field>

            <Field label="연락 방법">
              <select
                value={form.contact_method}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contact_method: event.target.value as ResidentFormState["contact_method"],
                  }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {contactMethods.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => void handleHide()}>
                공개 중단
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => navigate("/community")}>
                  취소
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-foreground">{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function mapResidentToForm(resident: CommunityResident): ResidentFormState {
  return {
    nickname: resident.nickname,
    age_group: resident.age_group || "",
    stay_type: resident.stay_type,
    area: resident.area || "",
    stay_from: resident.stay_from?.slice(0, 10) || "",
    stay_to: resident.stay_to?.slice(0, 10) || "",
    bio: resident.bio || "",
    bio_summary: resident.bio_summary || "",
    interests: resident.interests || [],
    contact_method: resident.contact_method || "post_only",
    is_public: resident.is_public ?? true,
    use_custom_avatar: resident.use_custom_avatar ?? false,
    avatar_url: resident.avatar_url || null,
  };
}
