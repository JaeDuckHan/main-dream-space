import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ListingFormState } from "@/lib/listing-form";

export function StepDetails({
  data,
  onChange,
  onBack,
  onNext,
}: {
  data: ListingFormState;
  onChange: (next: ListingFormState) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const primaryImage = data.image_urls[0]?.url ?? "";

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle>상세 정보</CardTitle>
        <CardDescription>등록 검수에 필요한 연락처와 설명을 입력합니다.</CardDescription>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>전화번호</Label>
          <Input value={data.phone} onChange={(event) => onChange({ ...data, phone: event.target.value })} placeholder="+84 ..." />
        </div>
        <div className="space-y-2">
          <Label>대표 이미지 URL</Label>
          <Input
            value={primaryImage}
            onChange={(event) =>
              onChange({
                ...data,
                image_urls: event.target.value
                  ? [{ url: event.target.value, source: "owner_provided" }]
                  : [],
              })
            }
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>설명</Label>
        <Textarea
          value={data.description}
          onChange={(event) => onChange({ ...data, description: event.target.value })}
          placeholder="업체 특징, 추천 포인트, 한국어 안내 여부 등을 적어주세요."
          className="min-h-36"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Google Place ID</Label>
          <Input
            value={data.google_maps_place_id}
            onChange={(event) => onChange({ ...data, google_maps_place_id: event.target.value })}
            placeholder="선택 입력. Places API 미설정 시 필요할 수 있습니다."
          />
        </div>
        <div className="space-y-2">
          <Label>카테고리 부가정보(JSON)</Label>
          <Textarea
            value={JSON.stringify(data.category_data, null, 2)}
            onChange={(event) => {
              try {
                onChange({ ...data, category_data: JSON.parse(event.target.value || "{}") });
              } catch {
                onChange({ ...data });
              }
            }}
            className="min-h-36 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button onClick={onNext}>검토</Button>
      </div>
    </div>
  );
}
