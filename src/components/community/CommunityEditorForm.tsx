import { useEffect, useMemo, useRef, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { marked } from "marked";

marked.use({ gfm: true, breaks: true });
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORY_LABELS, communityFetch, type CategoryEn } from "@/lib/community";
import { toast } from "sonner";

const categoryOptions: CategoryEn[] = ["question", "review", "info", "notice"];

interface CommunityEditorFormProps {
  mode: "create" | "edit";
  initialCategory?: CategoryEn;
  initialTitle?: string;
  initialContent?: string;
  postId?: number;
  onSuccess: (id: number) => void;
}

export default function CommunityEditorForm({
  mode,
  initialCategory = "question",
  initialTitle = "",
  initialContent = "",
  postId,
  onSuccess,
}: CommunityEditorFormProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState<CategoryEn>(initialCategory);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewMode, setPreviewMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    setCategory(initialCategory);
    setTitle(initialTitle);
    setContent(initialContent);
  }, [initialCategory, initialTitle, initialContent]);

  const visibleCategories = useMemo(
    () => categoryOptions.filter((item) => item !== "notice" || user?.role === "admin"),
    [user?.role],
  );

  const insertImageMarkdown = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const uploaded = await communityFetch<{ url: string }>("/api/community/upload", {
        method: "POST",
        body: formData,
      });
      setContent((prev) => `${prev}${prev.trim().length > 0 ? "\n\n" : ""}![image](${uploaded.url})`);
      toast.success("이미지를 본문에 추가했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await insertImageMarkdown(file);
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("제목은 3자 이상 입력하세요.");
      return;
    }
    if (content.trim().length < 10) {
      toast.error("본문은 10자 이상 입력하세요.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await communityFetch<{ id: number }>(mode === "create" ? "/api/community/posts" : `/api/community/posts/${postId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify({
          category,
          title,
          content,
        }),
      });
      toast.success(mode === "create" ? "게시글을 등록했습니다." : "게시글을 수정했습니다.");
      onSuccess(response.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "게시글 저장에 실패했습니다.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        <label className="text-sm font-semibold text-foreground">
          카테고리
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryEn)}
            className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {visibleCategories.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-foreground">
          제목
          <Input className="mt-2 h-11" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">본문</div>
            <div className="text-xs text-muted-foreground">마크다운으로 작성하고 이미지는 로컬 업로드 후 본문에 삽입됩니다.</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => setPreviewMode("edit")}
                className={`rounded px-3 py-1.5 text-sm ${previewMode === "edit" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("preview")}
                className={`rounded px-3 py-1.5 text-sm ${previewMode === "preview" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                미리보기
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              이미지 업로드
            </Button>
          </div>
        </div>

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(value) => setContent(value || "")}
            preview={previewMode}
            height={520}
            renderHTML={(text) => marked.parse(text) as string}
            previewOptions={{ className: "prose prose-slate max-w-none prose-img:rounded-xl !px-4" }}
          />
        </div>
      </div>

      <label className="block text-sm font-semibold text-foreground">
        작성 메모
        <Textarea
          value={`${content.length} / 50000`}
          readOnly
          className="mt-2 min-h-0 resize-none border-dashed bg-muted/40 text-xs text-muted-foreground"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          취소
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || uploading}>
          {submitting ? "저장 중..." : mode === "create" ? "등록" : "수정 저장"}
        </Button>
      </div>
    </div>
  );
}
