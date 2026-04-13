import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/listing-form";
import type { ListingFormState } from "@/lib/listing-form";

export function StepReview({
  data,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  data: ListingFormState;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle>최종 검토</CardTitle>
        <CardDescription>제출 후 관리자 검수를 거쳐 공개됩니다.</CardDescription>
      </CardHeader>

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <dl className="grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">카테고리</dt>
            <dd className="font-medium">{getCategoryLabel(data.category)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">지역</dt>
            <dd className="font-medium">{data.district}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">업체명</dt>
            <dd className="font-medium">{data.name_ko || data.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">전화번호</dt>
            <dd className="font-medium">{data.phone || "-"}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-muted-foreground">주소</dt>
            <dd className="font-medium">{data.address}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-muted-foreground">설명</dt>
            <dd className="font-medium whitespace-pre-line">{data.description || "-"}</dd>
          </div>
        </dl>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          이전
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? "등록 중..." : "등록하기"}
        </Button>
      </div>
    </div>
  );
}
