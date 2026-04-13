import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListingFormState } from "@/lib/listing-form";

export function StepBasic({
  data,
  onChange,
  categories,
  districts,
  onNext,
}: {
  data: ListingFormState;
  onChange: (next: ListingFormState) => void;
  categories: Array<{ value: string; label: string }>;
  districts: string[];
  onNext: () => void;
}) {
  const canContinue =
    Boolean(data.category) &&
    data.name.trim().length > 0 &&
    data.district.trim().length > 0 &&
    data.address.trim().length > 0 &&
    data.google_maps_url.trim().length > 0;

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle>기본 정보</CardTitle>
        <CardDescription>카테고리와 위치 정보를 먼저 입력합니다.</CardDescription>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>카테고리</Label>
          <Select value={data.category} onValueChange={(value) => onChange({ ...data, category: value as ListingFormState["category"] })}>
            <SelectTrigger>
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>지역</Label>
          <Select value={data.district} onValueChange={(value) => onChange({ ...data, district: value })}>
            <SelectTrigger>
              <SelectValue placeholder="지역 선택" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((district) => (
                <SelectItem key={district} value={district}>
                  {district}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>업체명</Label>
          <Input value={data.name} onChange={(event) => onChange({ ...data, name: event.target.value })} placeholder="예: GoGi House Vincom Plaza" />
        </div>
        <div className="space-y-2">
          <Label>한국어 표기</Label>
          <Input value={data.name_ko} onChange={(event) => onChange({ ...data, name_ko: event.target.value })} placeholder="예: 고기하우스 빈컴플라자" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>주소</Label>
        <Input value={data.address} onChange={(event) => onChange({ ...data, address: event.target.value })} placeholder="상세 주소 입력" />
      </div>

      <div className="space-y-2">
        <Label>Google Maps URL</Label>
        <Input
          value={data.google_maps_url}
          onChange={(event) => onChange({ ...data, google_maps_url: event.target.value })}
          placeholder="https://maps.google.com/..."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!canContinue}>
          다음
        </Button>
      </div>
    </div>
  );
}
