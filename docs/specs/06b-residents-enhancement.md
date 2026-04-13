# 06b. 체류자 시스템 보강 (메모/사진/상세/페이지)

## Context
- 06 스펙의 residents 기능이 **등록만 하고 볼 수 없는** 구조적 버그
- 사이드바에 닉네임/연령대만 노출, bio/사진 표시 안 함
- 체류자 등록의 본질적 목적 (연결/소통)을 위한 최소 기능 보강
- 선행: 06 커뮤니티 시스템

## 주요 결정 (확정)
- **레벨 b**: 상세 모달 + 전용 페이지 (/residents)
- **공개 수준 c**: `is_public` 본인 토글
- **사진 c**: 하이브리드 (OAuth 기본 / 커스텀 업로드 옵션)

## 핵심 추가 기능
1. 사이드바 카드 개선: 아바타 + bio_summary 1줄
2. 체류자 상세 모달: 풀 프로필 + 작성 글 링크 + 커피챗 참여 이력
3. `/residents` 전용 페이지: 필터 + 그리드
4. 커스텀 아바타 업로드 (선택)
5. `is_public` 토글 UI (본인 관리 페이지)

---

## DB 마이그레이션 (006_residents_patch.sql)

```sql
-- 1. residents 테이블 컬럼 추가
ALTER TABLE residents 
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),           -- 커스텀 아바타 URL
  ADD COLUMN IF NOT EXISTS use_custom_avatar BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bio_summary VARCHAR(80),           -- 사이드바용 1줄 요약
  ADD COLUMN IF NOT EXISTS contact_method VARCHAR(20),        -- 'coffee_chat' | 'post_only' | 'none'
  ADD COLUMN IF NOT EXISTS interests JSONB;                   -- ["카페","서핑","개발"]

COMMENT ON COLUMN residents.avatar_url IS '커스텀 업로드 아바타. use_custom_avatar=TRUE일 때 사용';
COMMENT ON COLUMN residents.bio_summary IS '사이드바 노출용 짧은 자기소개 (80자)';
COMMENT ON COLUMN residents.contact_method IS '다른 사용자가 연락 가능한 방법';

-- 2. 체류자 통합 뷰 (users JOIN, 최신 아바타 자동 반영)
CREATE OR REPLACE VIEW residents_public AS
SELECT 
  r.id,
  r.user_id,
  r.nickname,
  r.age_group,
  r.stay_type,
  r.area,
  r.stay_from,
  r.stay_to,
  r.bio,
  r.bio_summary,
  r.interests,
  r.contact_method,
  CASE 
    WHEN r.use_custom_avatar AND r.avatar_url IS NOT NULL THEN r.avatar_url
    ELSE u.avatar_url 
  END AS display_avatar,
  u.display_name AS oauth_name,
  r.created_at,
  r.updated_at,
  -- 활성 여부 (현재 체류 중)
  (r.stay_from <= CURRENT_DATE AND (r.stay_to IS NULL OR r.stay_to >= CURRENT_DATE)) AS is_active
FROM residents r
JOIN users u ON r.user_id = u.id
WHERE r.is_public = TRUE;

-- 3. 인덱스 추가 (목록 성능)
CREATE INDEX IF NOT EXISTS idx_residents_stay_type ON residents(stay_type) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_residents_area ON residents(area) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_residents_active_range 
  ON residents(stay_from, stay_to) WHERE is_public = TRUE;

-- 4. 체류자 방문 이력 (선택, 선택 사용자에게만 표시)
CREATE TABLE IF NOT EXISTS resident_profile_views (
  id BIGSERIAL PRIMARY KEY,
  resident_id INT NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  viewer_user_id INT REFERENCES users(id) ON DELETE SET NULL,  -- NULL = 비로그인
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profile_views_resident ON resident_profile_views(resident_id, viewed_at DESC);
```

**검증**:
```bash
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='residents' ORDER BY ordinal_position;"
psql $DATABASE_URL -c "SELECT * FROM residents_public LIMIT 3;"
```

---

## API 변경/추가

### 1. 목록 API 강화
```
GET /api/residents
  ?stay_type=monthly_stay
  &area=my-khe
  &age_group=30대
  &active=true
  &limit=20
  &offset=0
```

**Response**:
```typescript
{
  total: number;
  active_count: number;          // 현재 체류 중 N명 (사이드바용)
  residents: Array<{
    id: number;
    nickname: string;
    age_group: string;
    stay_type: string;
    area: string;
    stay_from: string;
    stay_to: string | null;
    bio_summary: string | null;
    interests: string[];
    display_avatar: string | null;
    is_active: boolean;
    // bio 전체는 상세에서만
  }>
}
```

### 2. 상세 API (신규)
```
GET /api/residents/:id
```

**Response**:
```typescript
{
  resident: {
    id: number;
    nickname: string;
    age_group: string;
    stay_type: string;
    area: string;
    stay_from: string;
    stay_to: string | null;
    bio: string;                 // 전체
    bio_summary: string | null;
    interests: string[];
    contact_method: 'coffee_chat' | 'post_only' | 'none';
    display_avatar: string | null;
    is_active: boolean;
    created_at: string;
  };
  stats: {
    post_count: number;          // 작성한 게시글 수
    comment_count: number;
    coffee_chats_organized: number;
    coffee_chats_joined: number;
  };
  recent_posts: Array<{
    id: number;
    category: string;
    title: string;
    created_at: string;
  }>;  // 최근 5개
  recent_coffee_chats: Array<{
    id: number;
    title: string;
    meetup_at: string;
    status: string;
  }>;  // 최근 3개
}
```

### 3. 본인 조회/수정 (확장)
```
GET /api/residents/me
```

**Response**:
```typescript
{
  resident: {
    // 위 모든 필드 + is_public
    is_public: boolean;
    use_custom_avatar: boolean;
    avatar_url: string | null;   // 커스텀 아바타 URL
  } | null;  // 아직 등록 안 했으면 null
}
```

```
PATCH /api/residents/me
Body: {
  nickname?: string;
  age_group?: string;
  stay_type?: string;
  area?: string;
  stay_from?: string;
  stay_to?: string | null;
  bio?: string;
  bio_summary?: string;
  interests?: string[];
  contact_method?: string;
  is_public?: boolean;
  use_custom_avatar?: boolean;
}
```

### 4. 커스텀 아바타 업로드 (신규)
```
POST /api/residents/me/avatar
Body: multipart/form-data, field 'file'
```

**처리**:
1. 기존 이미지 업로드 로직 재사용 (스펙 06의 saveImage)
2. 카테고리: `residents` (폴더: `/var/www/luckydanang-uploads/residents/2026-04/`)
3. sharp로 **정사각형 크롭** + 512x512 리사이즈 (프로필 사진 표준)
4. `residents.avatar_url`에 public URL 저장
5. `use_custom_avatar = TRUE`로 자동 설정
6. 기존 커스텀 아바타가 있으면 파일 삭제 (용량 절약)

**Response**:
```typescript
{
  avatar_url: string;
  use_custom_avatar: true;
}
```

### 5. 아바타 초기화 (OAuth로 되돌리기)
```
DELETE /api/residents/me/avatar
```
- `use_custom_avatar = FALSE`
- 기존 커스텀 파일 삭제
- `avatar_url = NULL`

### 6. 활성 체류자 카운트 (사이드바 캐싱용, 선택)
```
GET /api/residents/active-count
```
**Response**: `{ count: 23 }`

5분 캐시 권장 (메모리 또는 간단한 TTL).

---

## 업로드 서비스 확장

```typescript
// server/src/services/upload.ts에 추가

export async function saveAvatar(
  buffer: Buffer,
  userId: number
): Promise<SaveImageResult> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDir = path.join(UPLOAD_ROOT, 'residents', yearMonth);
  
  await fs.mkdir(monthDir, { recursive: true });
  
  const uuid = crypto.randomBytes(16).toString('hex');
  const filename = `${uuid}.webp`;
  const absolutePath = path.join(monthDir, filename);
  const relativePath = `residents/${yearMonth}/${filename}`;
  const publicUrl = `${PUBLIC_BASE}/${relativePath}`;
  
  // 아바타는 정사각형 크롭 + 512x512 (프로필 표준)
  const processed = await sharp(buffer)
    .rotate()
    .resize({
      width: 512,
      height: 512,
      fit: 'cover',           // 정사각형 크롭
      position: 'attention',  // 얼굴/주요 객체 중심
    })
    .webp({ quality: 90 })
    .withMetadata({ orientation: undefined })
    .toBuffer({ resolveWithObject: true });
  
  await fs.writeFile(absolutePath, processed.data);
  
  return {
    url: publicUrl,
    relative_path: relativePath,
    absolute_path: absolutePath,
    width: processed.info.width,
    height: processed.info.height,
    size_bytes: processed.data.length,
  };
}
```

---

## 프론트엔드 변경

### 1. Community.tsx 사이드바 카드 개선

```diff
  {residents.slice(0, 5).map(r => (
-   <div key={r.id} className="text-sm">
-     <span className="font-medium">{r.nickname}</span>
-     <span className="text-muted-foreground"> · {r.age_group} · {r.stay_type}</span>
-   </div>
+   <div 
+     key={r.id} 
+     className="flex gap-2 cursor-pointer hover:bg-accent/30 p-2 -mx-2 rounded"
+     onClick={() => setSelectedResidentId(r.id)}
+   >
+     <img 
+       src={r.display_avatar || '/default-avatar.png'} 
+       alt={r.nickname}
+       className="w-10 h-10 rounded-full object-cover flex-shrink-0"
+       onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png'; }}
+     />
+     <div className="flex-1 min-w-0">
+       <div className="font-medium text-sm truncate">{r.nickname}</div>
+       <div className="text-xs text-muted-foreground">
+         {r.age_group} · {STAY_TYPE_LABELS[r.stay_type]}
+       </div>
+       {r.bio_summary && (
+         <div className="text-xs text-muted-foreground truncate mt-0.5">
+           {r.bio_summary}
+         </div>
+       )}
+     </div>
+   </div>
  ))}
  
+ {/* 더 보기 링크 */}
+ <Link to="/residents" className="block text-sm text-primary mt-3 text-center">
+   전체 체류자 보기 →
+ </Link>

+ {/* 상세 모달 */}
+ {selectedResidentId && (
+   <ResidentDetailModal 
+     residentId={selectedResidentId} 
+     onClose={() => setSelectedResidentId(null)}
+   />
+ )}
```

### 2. 체류자 상세 모달 (신규)

```typescript
// src/components/community/ResidentDetailModal.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { STAY_TYPE_LABELS, CATEGORY_LABELS } from '@/lib/community';

interface Props {
  residentId: number;
  onClose: () => void;
}

export function ResidentDetailModal({ residentId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`/api/residents/${residentId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [residentId]);
  
  if (loading || !data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="h-40 flex items-center justify-center">로딩 중...</div>
        </DialogContent>
      </Dialog>
    );
  }
  
  const { resident, stats, recent_posts, recent_coffee_chats } = data;
  
  const stayPeriod = resident.stay_to 
    ? `${formatDate(resident.stay_from)} ~ ${formatDate(resident.stay_to)}`
    : `${formatDate(resident.stay_from)} ~ 무기한`;
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{resident.nickname} 프로필</DialogTitle>
        </DialogHeader>
        
        {/* 헤더: 아바타 + 기본 정보 */}
        <div className="flex gap-4">
          <img 
            src={resident.display_avatar || '/default-avatar.png'}
            alt={resident.nickname}
            className="w-24 h-24 rounded-full object-cover flex-shrink-0 border-2 border-border"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{resident.nickname}</h2>
              {resident.is_active && (
                <Badge className="bg-green-100 text-green-800">
                  🟢 체류 중
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="outline">{resident.age_group}</Badge>
              <Badge variant="outline">{STAY_TYPE_LABELS[resident.stay_type]}</Badge>
              <Badge variant="outline">{resident.area}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">📅 {stayPeriod}</p>
          </div>
        </div>
        
        {/* 관심사 태그 */}
        {resident.interests?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {resident.interests.map((tag: string) => (
              <Badge key={tag} variant="secondary">#{tag}</Badge>
            ))}
          </div>
        )}
        
        {/* 자기소개 */}
        {resident.bio && (
          <div className="mt-4 p-4 bg-accent/30 rounded-lg">
            <h3 className="font-medium mb-2">자기소개</h3>
            <p className="text-sm whitespace-pre-wrap">{resident.bio}</p>
          </div>
        )}
        
        {/* 통계 */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-center">
          <StatCard label="작성 글" value={stats.post_count} />
          <StatCard label="댓글" value={stats.comment_count} />
          <StatCard label="커피챗 주최" value={stats.coffee_chats_organized} />
          <StatCard label="커피챗 참여" value={stats.coffee_chats_joined} />
        </div>
        
        {/* 최근 게시글 */}
        {recent_posts.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">최근 작성 글</h3>
            <ul className="space-y-1">
              {recent_posts.map((p: any) => (
                <li key={p.id} className="text-sm">
                  <Link 
                    to={`/community/${p.id}`}
                    className="hover:underline"
                    onClick={onClose}
                  >
                    <span className="text-muted-foreground mr-2">
                      [{CATEGORY_LABELS[p.category]}]
                    </span>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 최근 커피챗 */}
        {recent_coffee_chats.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">최근 커피챗</h3>
            <ul className="space-y-1">
              {recent_coffee_chats.map((c: any) => (
                <li key={c.id} className="text-sm">
                  <Link 
                    to={`/coffee-chats/${c.id}`}
                    className="hover:underline"
                    onClick={onClose}
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* 액션 버튼 */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            닫기
          </Button>
          {resident.contact_method === 'coffee_chat' && (
            <Button className="flex-1">
              ☕ 커피챗 제안하기
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 bg-accent/30 rounded">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'numeric', day: 'numeric' 
  });
}
```

### 3. `/residents` 전용 페이지 (신규)

```typescript
// src/pages/Residents.tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResidentDetailModal } from '@/components/community/ResidentDetailModal';
import { STAY_TYPE_LABELS } from '@/lib/community';

const AREAS = ['전체', '미케비치', '한강', '안투엉', '손짜', '호이안'];
const AGE_GROUPS = ['전체', '20대', '30대', '40대', '50대', '60대+'];
const STAY_TYPES = [
  { value: 'all', label: '전체' },
  { value: 'monthly_stay', label: '한달살기' },
  { value: 'long_term', label: '장기체류' },
  { value: 'retirement', label: '은퇴' },
  { value: 'workation', label: '워케이션' },
];

export default function Residents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [residents, setResidents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const stayType = searchParams.get('stay_type') || 'all';
  const area = searchParams.get('area') || '전체';
  const ageGroup = searchParams.get('age_group') || '전체';
  
  useEffect(() => {
    const params = new URLSearchParams();
    if (stayType !== 'all') params.set('stay_type', stayType);
    if (area !== '전체') params.set('area', area);
    if (ageGroup !== '전체') params.set('age_group', ageGroup);
    params.set('active', 'true');
    params.set('limit', '50');
    
    setLoading(true);
    fetch(`/api/residents?${params}`)
      .then(r => r.json())
      .then(d => {
        setResidents(d.residents);
        setTotal(d.total);
        setActiveCount(d.active_count);
        setLoading(false);
      });
  }, [stayType, area, ageGroup]);
  
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === '전체' || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">다낭 체류자</h1>
          <p className="text-muted-foreground mt-1">
            🟢 현재 {activeCount}명 체류 중 · 전체 {total}명
          </p>
        </div>
        
        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Select value={stayType} onValueChange={v => updateFilter('stay_type', v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="체류 타입" />
            </SelectTrigger>
            <SelectContent>
              {STAY_TYPES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={area} onValueChange={v => updateFilter('area', v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="지역" />
            </SelectTrigger>
            <SelectContent>
              {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Select value={ageGroup} onValueChange={v => updateFilter('age_group', v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="연령대" />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        {/* 그리드 */}
        {loading && <div>로딩 중...</div>}
        {!loading && residents.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            조건에 맞는 체류자가 없습니다.
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {residents.map(r => (
            <Card 
              key={r.id} 
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedId(r.id)}
            >
              <div className="flex flex-col items-center text-center">
                <img 
                  src={r.display_avatar || '/default-avatar.png'}
                  alt={r.nickname}
                  className="w-20 h-20 rounded-full object-cover mb-3"
                />
                <h3 className="font-medium">{r.nickname}</h3>
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  <Badge variant="outline" className="text-xs">{r.age_group}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {STAY_TYPE_LABELS[r.stay_type]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{r.area}</p>
                {r.bio_summary && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {r.bio_summary}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
        
        {selectedId && (
          <ResidentDetailModal 
            residentId={selectedId} 
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      
      <Footer />
    </div>
  );
}
```

### 4. ResidentMe.tsx 수정 (본인 관리 페이지 확장)

```typescript
// src/pages/ResidentMe.tsx (기존 + 아바타 업로드 + is_public 토글)
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ResidentMe() {
  return (
    <RequireAuth>
      <ResidentForm />
    </RequireAuth>
  );
}

function ResidentForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [data, setData] = useState({
    nickname: '',
    age_group: '30대',
    stay_type: 'monthly_stay',
    area: '',
    stay_from: '',
    stay_to: '',
    bio: '',
    bio_summary: '',
    interests: [] as string[],
    contact_method: 'post_only',
    is_public: true,
    use_custom_avatar: false,
    avatar_url: null as string | null,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // 기존 데이터 로드
  useEffect(() => {
    fetch('/api/residents/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.resident) setData(d.resident);
        setLoading(false);
      });
  }, []);
  
  const displayAvatar = data.use_custom_avatar && data.avatar_url
    ? data.avatar_url
    : user?.avatar_url || '/default-avatar.png';
  
  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다');
      return;
    }
    
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/residents/me/avatar', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error('업로드 실패');
      const result = await res.json();
      setData(d => ({ 
        ...d, 
        avatar_url: result.avatar_url, 
        use_custom_avatar: true 
      }));
      toast.success('사진이 변경되었습니다');
    } catch (err) {
      toast.error('사진 업로드 실패');
    } finally {
      setUploading(false);
    }
  };
  
  const handleResetAvatar = async () => {
    const res = await fetch('/api/residents/me/avatar', {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setData(d => ({ ...d, avatar_url: null, use_custom_avatar: false }));
      toast.success('프로필 사진을 OAuth 기본으로 되돌렸습니다');
    }
  };
  
  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/residents/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('저장 실패');
      toast.success('저장되었습니다');
      navigate('/community');
    } catch (err) {
      toast.error('저장 실패');
    }
  };
  
  if (loading) return <div>로딩 중...</div>;
  
  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">체류자 프로필</h1>
      
      {/* 아바타 */}
      <div className="mb-6 flex items-start gap-4">
        <img 
          src={displayAvatar} 
          alt="프로필"
          className="w-24 h-24 rounded-full object-cover border-2"
        />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">
            {data.use_custom_avatar 
              ? '커스텀 사진 사용 중' 
              : `${user?.connected_providers?.[0] || 'OAuth'} 프로필 사진 사용 중`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '업로드 중...' : '사진 변경'}
            </Button>
            {data.use_custom_avatar && (
              <Button variant="outline" size="sm" onClick={handleResetAvatar}>
                기본으로 되돌리기
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleAvatarUpload(file);
            }}
          />
        </div>
      </div>
      
      {/* 공개 여부 */}
      <div className="mb-6 flex items-center justify-between p-4 border rounded-lg">
        <div>
          <Label className="font-medium">프로필 공개</Label>
          <p className="text-sm text-muted-foreground mt-1">
            OFF 시 사이드바 및 전체 목록에서 숨김
          </p>
        </div>
        <Switch
          checked={data.is_public}
          onCheckedChange={v => setData({ ...data, is_public: v })}
        />
      </div>
      
      {/* 기본 정보 */}
      <div className="space-y-4">
        <div>
          <Label>닉네임 *</Label>
          <Input 
            value={data.nickname}
            onChange={e => setData({ ...data, nickname: e.target.value })}
            maxLength={50}
            placeholder="예: 다낭3년차"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>연령대 *</Label>
            <Select 
              value={data.age_group} 
              onValueChange={v => setData({ ...data, age_group: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['20대', '30대', '40대', '50대', '60대+'].map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>체류 타입 *</Label>
            <Select 
              value={data.stay_type}
              onValueChange={v => setData({ ...data, stay_type: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_stay">한달살기</SelectItem>
                <SelectItem value="long_term">장기체류</SelectItem>
                <SelectItem value="retirement">은퇴</SelectItem>
                <SelectItem value="workation">워케이션</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label>지역 *</Label>
          <Select value={data.area} onValueChange={v => setData({ ...data, area: v })}>
            <SelectTrigger><SelectValue placeholder="지역 선택" /></SelectTrigger>
            <SelectContent>
              {['미케비치', '한강', '안투엉', '손짜', '호이안'].map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>체류 시작일 *</Label>
            <Input 
              type="date" 
              value={data.stay_from}
              onChange={e => setData({ ...data, stay_from: e.target.value })}
            />
          </div>
          <div>
            <Label>체류 종료일 (선택)</Label>
            <Input 
              type="date" 
              value={data.stay_to || ''}
              onChange={e => setData({ ...data, stay_to: e.target.value })}
              placeholder="무기한이면 비워두세요"
            />
          </div>
        </div>
        
        {/* 한 줄 소개 (사이드바 노출) */}
        <div>
          <Label>한 줄 소개 (사이드바에 노출) *</Label>
          <Input 
            value={data.bio_summary}
            onChange={e => setData({ ...data, bio_summary: e.target.value })}
            maxLength={80}
            placeholder="예: 카페 투어 좋아하는 개발자"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {data.bio_summary.length}/80자
          </p>
        </div>
        
        {/* 자기소개 (상세 모달 노출) */}
        <div>
          <Label>자기소개 (상세 프로필에 노출)</Label>
          <Textarea 
            value={data.bio}
            onChange={e => setData({ ...data, bio: e.target.value })}
            rows={6}
            maxLength={2000}
            placeholder="다낭에서 뭘 하고 계신지, 어떤 분들을 만나고 싶은지 자유롭게 적어주세요"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {data.bio?.length || 0}/2000자
          </p>
        </div>
        
        {/* 관심사 */}
        <div>
          <Label>관심사 (쉼표로 구분, 최대 5개)</Label>
          <Input 
            value={data.interests.join(', ')}
            onChange={e => {
              const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5);
              setData({ ...data, interests: tags });
            }}
            placeholder="예: 카페, 서핑, 개발, 한식"
          />
        </div>
        
        {/* 연락 방법 */}
        <div>
          <Label>연락 가능 방법</Label>
          <Select 
            value={data.contact_method}
            onValueChange={v => setData({ ...data, contact_method: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="coffee_chat">커피챗으로만 (권장)</SelectItem>
              <SelectItem value="post_only">게시글/댓글로만</SelectItem>
              <SelectItem value="none">연락 받지 않음</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex gap-2 justify-end mt-6">
        <Button variant="outline" onClick={() => navigate('/community')}>
          취소
        </Button>
        <Button onClick={handleSubmit}>저장</Button>
      </div>
    </div>
  );
}
```

### 5. 라우트 등록 (App.tsx)

```diff
+ import Residents from './pages/Residents';

  <Routes>
    ...
    <Route path="/community" element={<Community />} />
+   <Route path="/residents" element={<Residents />} />
    <Route path="/residents/me" element={<ResidentMe />} />
    ...
  </Routes>
```

### 6. Navbar에 체류자 링크 추가 (선택)

```diff
  {/* 기존 메뉴 */}
+ <NavLink to="/residents">체류자</NavLink>
```

---

## 기본 아바타 이미지 (Jeff 준비)

```
public/default-avatar.png  (신규)
```

간단한 실루엣 이미지. 없으면 Codex가 SVG로 생성:

```tsx
// src/components/DefaultAvatar.tsx (fallback)
export function DefaultAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="bg-accent rounded-full">
      <circle cx="20" cy="15" r="6" fill="currentColor" opacity="0.3" />
      <path d="M8 34 Q8 24 20 24 Q32 24 32 34" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
```

---

## STAY_TYPE_LABELS 추가

```typescript
// src/lib/community.ts
export const STAY_TYPE_LABELS: Record<string, string> = {
  monthly_stay: '한달살기',
  long_term: '장기체류',
  retirement: '은퇴',
  workation: '워케이션',
};
```

---

## 보안 고려사항

### 개인정보 보호
- [ ] `is_public = FALSE`면 목록/상세 API에서 완전 차단
- [ ] `contact_method = 'none'`이면 상세에서 "커피챗 제안" 버튼 숨김
- [ ] 프로필 조회 이력 기록 (선택): 스토킹 방지 힌트
- [ ] 탈퇴 시 residents 자동 삭제 (CASCADE)

### 아바타 업로드
- [ ] 5MB 제한
- [ ] 이미지 mime 타입 검증
- [ ] sharp로 실제 이미지 여부 재검증
- [ ] EXIF 제거 (위치 정보 유출 방지)
- [ ] 512x512 정사각형 크롭
- [ ] 기존 커스텀 이미지 있으면 파일 삭제 (누적 방지)

### 악용 방지
- [ ] 가짜 체류자 등록 방지: 로그인 사용자만
- [ ] 부적절 닉네임/자기소개: 신고 기능 연동
- [ ] admin이 강제 숨김 가능 (`is_public = FALSE` 강제)

---

## DoD (16개)

### DB
- [ ] migrations/006_residents_patch.sql 무에러 실행
- [ ] residents 테이블에 5개 컬럼 추가 확인
- [ ] residents_public 뷰 생성 + SELECT 성공
- [ ] 인덱스 3개 생성

### API
- [ ] GET /api/residents 필터 (stay_type, area, age_group, active) 동작
- [ ] GET /api/residents/:id 상세 조회 (stats + recent_posts + recent_coffee_chats)
- [ ] PATCH /api/residents/me 전체 필드 업데이트
- [ ] POST /api/residents/me/avatar 업로드 + 정사각형 크롭
- [ ] DELETE /api/residents/me/avatar 초기화 + 파일 삭제
- [ ] is_public=FALSE 체류자는 목록에서 제외 확인

### 프론트엔드
- [ ] 사이드바 카드 개선 (아바타 + bio_summary) 
- [ ] ResidentDetailModal 렌더링 + 데이터 로드
- [ ] /residents 페이지 필터 + 그리드 동작
- [ ] ResidentMe 페이지 전체 필드 저장
- [ ] 아바타 업로드 + 미리보기
- [ ] is_public 토글 UI
- [ ] 기본 아바타 이미지 또는 DefaultAvatar 컴포넌트

### 검증
- [ ] 아바타 업로드 → /var/www/luckydanang-uploads/residents/YYYY-MM/ 파일 확인
- [ ] is_public 토글 OFF → 타 사용자 목록에서 숨김
- [ ] bio_summary 작성 → 사이드바 반영
- [ ] 상세 모달에서 전체 bio 노출
- [ ] 작성 게시글 링크 클릭 → 해당 글로 이동

---

## 마이그레이션 가이드

기존 데이터가 있는 경우:
```sql
-- 기존 users.avatar_url을 residents에 복사 (초기 1회만)
UPDATE residents r
SET avatar_url = u.avatar_url,
    use_custom_avatar = FALSE
FROM users u
WHERE r.user_id = u.id AND r.avatar_url IS NULL;
```
