# 03b. 디렉토리 프론트엔드 페이지 상세

## Context
- 03 스펙의 프론트엔드 부분 분리 문서
- 4개 페이지: `/login`, `/business/register`, `/business/dashboard`, `/admin/listings`
- Codex가 사이트 톤(shadcn/ui + Tailwind)에 맞춰 자체 제작
- Lovable 통보 불필요

## 공통 훅: useAuth (src/hooks/use-auth.ts)

```typescript
import { useEffect, useState, createContext, useContext } from 'react';

export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string;
  role: 'user' | 'admin';
  connected_providers: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const refetch = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => { refetch(); }, []);
  
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = '/';
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

`src/App.tsx`에 `<AuthProvider>` 래핑 추가 (기존 라우터 안쪽).

## 보호 라우트 컴포넌트

```typescript
// src/components/RequireAuth.tsx
import { useAuth } from '@/hooks/use-auth';
import { Navigate, useLocation } from 'react-router-dom';

export function RequireAuth({ 
  children, 
  requireAdmin = false 
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) return <div>로딩 중...</div>;
  
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}
```

## 1. /login 페이지

```typescript
// src/pages/Login.tsx
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  
  const startOAuth = (provider: 'kakao' | 'google' | 'naver') => {
    window.location.href = `/api/auth/${provider}/login?redirect=${encodeURIComponent(redirect)}`;
  };
  
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <h1 className="text-2xl font-bold">로그인 / 회원가입</h1>
          <p className="text-sm text-muted-foreground mt-2">
            업체 등록을 위해 로그인이 필요합니다
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            onClick={() => startOAuth('kakao')}
            className="w-full h-12 bg-[#FEE500] text-black rounded-md font-medium flex items-center justify-center gap-2 hover:opacity-90"
          >
            <KakaoIcon /> 카카오로 시작하기
          </button>
          <button
            onClick={() => startOAuth('naver')}
            className="w-full h-12 bg-[#03C75A] text-white rounded-md font-medium flex items-center justify-center gap-2 hover:opacity-90"
          >
            <NaverIcon /> 네이버로 시작하기
          </button>
          <button
            onClick={() => startOAuth('google')}
            className="w-full h-12 bg-white border border-gray-300 text-gray-700 rounded-md font-medium flex items-center justify-center gap-2 hover:bg-gray-50"
          >
            <GoogleIcon /> Google로 시작하기
          </button>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            로그인 시 <a href="/terms" className="underline">이용약관</a> 및{' '}
            <a href="/privacy" className="underline">개인정보 처리방침</a>에 동의하게 됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

⚠️ 아이콘 SVG는 각 provider의 공식 가이드라인 따를 것 (브랜드 가이드 위반 주의).

## 2. /business/register (3-step Wizard)

```typescript
// src/pages/BusinessRegister.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StepBasic } from '@/components/business/StepBasic';
import { StepDetails } from '@/components/business/StepDetails';
import { StepReview } from '@/components/business/StepReview';

const CATEGORIES = [
  { value: 'accommodation', label: '숙소' },
  { value: 'restaurant', label: '식당' },
  { value: 'massage', label: '마사지' },
  { value: 'real_estate', label: '부동산' },
  { value: 'tour', label: '투어' },
];

export default function BusinessRegister() {
  return (
    <RequireAuth>
      <RegisterWizard />
    </RequireAuth>
  );
}

function RegisterWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: '',
    name: '',
    name_ko: '',
    district: '',
    address: '',
    google_maps_url: '',
    phone: '',
    description: '',
    image_urls: [] as Array<{url:string, source:string}>,
    category_data: {} as Record<string, any>,
  });
  
  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) throw new Error('등록 실패');
      
      const data = await res.json();
      navigate(`/business/dashboard?registered=${data.id}`);
    } catch (err) {
      alert('등록 중 오류가 발생했습니다.');
    }
  };
  
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-bold mb-2">업체 등록</h1>
      <p className="text-muted-foreground mb-6">
        등록 후 관리자 검수를 거쳐 사이트에 공개됩니다.
      </p>
      
      <Progress value={step * 33.33} className="mb-6" />
      
      <Card className="p-6">
        {step === 1 && (
          <StepBasic 
            data={formData} 
            onChange={setFormData} 
            categories={CATEGORIES}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepDetails 
            data={formData} 
            onChange={setFormData}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepReview 
            data={formData}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </Card>
    </div>
  );
}
```

### Step 1: 기본 정보 (StepBasic.tsx)
- 카테고리 선택 (드롭다운 또는 카드 5개)
- 이름 (필수)
- 한국어 표기 (선택)
- 지역 드롭다운
- 주소
- **구글맵 URL 입력 후 "검증" 버튼**
  - 클릭 시 `/api/utils/verify-place?url=...` 호출
  - 서버가 place_id 추출 + Places API 검증 + lat/lng 자동 채움
  - 성공 시 초록 체크 표시
  - 실패 시 에러 메시지 ("구글맵에서 찾을 수 없습니다")

### Step 2: 카테고리별 상세 (StepDetails.tsx)
- formData.category에 따라 다른 폼 렌더링
- 각 카테고리별 컴포넌트:
  - `AccommodationFields.tsx` (가격/베드/편의시설)
  - `RestaurantFields.tsx` (음식종류/가격/영업시간/메뉴)
  - `MassageFields.tsx` (마사지종류/가격/예약여부)
  - `RealEstateFields.tsx` (월세/계약기간/공과금)
  - `TourFields.tsx` (서브타입/소요시간/가격/픽업)
- 이미지 업로드 (Cloudflare R2 또는 S3 직업로드)
  - Jeff의 기존 img.kowinsblue.com 인프라 재활용 검토

### Step 3: 검토 + 제출 (StepReview.tsx)
- 1, 2 단계 데이터 요약 표시
- "수정" 버튼으로 각 단계 돌아가기
- "등록하기" 버튼 클릭 → POST /api/listings
- 제출 후 로딩 → 성공 페이지로 이동

## 3. /business/dashboard

```typescript
// src/pages/BusinessDashboard.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_BADGE = {
  pending: { label: '검수 중', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '공개됨', color: 'bg-green-100 text-green-800' },
  rejected: { label: '반려됨', color: 'bg-red-100 text-red-800' },
  draft: { label: '임시저장', color: 'bg-gray-100 text-gray-800' },
  archived: { label: '보관됨', color: 'bg-gray-100 text-gray-500' },
};

export default function BusinessDashboard() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/listings/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setListings(d.items); setLoading(false); });
  }, []);
  
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">내 업체 관리</h1>
          <p className="text-muted-foreground">{user?.display_name}님의 등록 매물</p>
        </div>
        <Link to="/business/register">
          <Button>+ 새 업체 등록</Button>
        </Link>
      </div>
      
      {loading && <div>로딩 중...</div>}
      
      {!loading && listings.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          아직 등록한 업체가 없습니다.
          <br />
          <Link to="/business/register" className="text-primary underline mt-4 inline-block">
            첫 업체 등록하기
          </Link>
        </Card>
      )}
      
      <div className="grid gap-4">
        {listings.map(listing => {
          const badge = STATUS_BADGE[listing.status as keyof typeof STATUS_BADGE];
          return (
            <Card key={listing.id} className="p-4 flex gap-4">
              <img src={listing.thumbnail_url} className="w-32 h-24 object-cover rounded" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold">{listing.name_ko || listing.name}</h3>
                    <p className="text-sm text-muted-foreground">{listing.district}</p>
                  </div>
                  <Badge className={badge.color}>{badge.label}</Badge>
                </div>
                {listing.status === 'rejected' && listing.rejection_reason && (
                  <p className="text-sm text-red-600 mt-2">
                    반려 사유: {listing.rejection_reason}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Link to={`/business/edit/${listing.id}`}>
                    <Button size="sm" variant="outline">수정</Button>
                  </Link>
                  {listing.status === 'approved' && (
                    <Link to={`/listings/${listing.slug}`}>
                      <Button size="sm" variant="outline">사이트에서 보기</Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

## 4. /admin/listings

```typescript
// src/pages/AdminListings.tsx
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function AdminListings() {
  return (
    <RequireAuth requireAdmin>
      <AdminPanel />
    </RequireAuth>
  );
}

function AdminPanel() {
  const [listings, setListings] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [selected, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const fetchListings = () => {
    fetch(`/api/admin/listings/all?status=${filter}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setListings(d.items));
  };
  
  useEffect(() => { fetchListings(); }, [filter]);
  
  const handleApprove = async (id: number) => {
    await fetch(`/api/admin/listings/${id}/approve`, {
      method: 'PATCH', credentials: 'include',
    });
    fetchListings();
    setSelected(null);
  };
  
  const handleReject = async (id: number) => {
    if (!rejectReason.trim()) return alert('반려 사유를 입력하세요');
    await fetch(`/api/admin/listings/${id}/reject`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    fetchListings();
    setSelected(null);
    setRejectReason('');
  };
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">업체 관리 (관리자)</h1>
      
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">검수 대기</TabsTrigger>
          <TabsTrigger value="approved">공개됨</TabsTrigger>
          <TabsTrigger value="rejected">반려됨</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="grid gap-3 mt-6">
        {listings.map(l => (
          <Card key={l.id} className="p-4 flex gap-4 cursor-pointer hover:shadow"
                onClick={() => setSelected(l)}>
            <img src={l.thumbnail_url} className="w-24 h-20 object-cover rounded" />
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-bold">{l.name_ko || l.name}</h3>
                <span className="text-xs text-muted-foreground">{l.category}</span>
              </div>
              <p className="text-sm text-muted-foreground">{l.district} · {l.address}</p>
              <div className="text-xs text-muted-foreground mt-1">
                등록자: {l.owner_email || '미카'} · {new Date(l.created_at).toLocaleDateString()}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <h2 className="text-2xl font-bold">{selected.name_ko || selected.name}</h2>
              </DialogHeader>
              <div className="space-y-3">
                <a href={selected.google_maps_url} target="_blank" rel="noopener" 
                   className="text-blue-600 underline text-sm">
                  📍 구글맵에서 확인 →
                </a>
                <p>{selected.description}</p>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                  {JSON.stringify(selected.category_data, null, 2)}
                </pre>
                <div className="grid grid-cols-3 gap-2">
                  {selected.image_urls?.map((img: any, i: number) => (
                    <img key={i} src={img.url} className="w-full h-24 object-cover rounded" />
                  ))}
                </div>
                
                {filter === 'pending' && (
                  <div className="border-t pt-4 space-y-2">
                    <Button onClick={() => handleApprove(selected.id)} className="w-full bg-green-600">
                      ✅ 승인
                    </Button>
                    <Textarea 
                      placeholder="반려 사유 입력..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <Button onClick={() => handleReject(selected.id)} variant="destructive" className="w-full">
                      ❌ 반려
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

## 라우트 등록 (src/App.tsx)

```diff
+ import Login from './pages/Login';
+ import BusinessRegister from './pages/BusinessRegister';
+ import BusinessDashboard from './pages/BusinessDashboard';
+ import AdminListings from './pages/AdminListings';
+ import { AuthProvider } from './hooks/use-auth';

  function App() {
    return (
+     <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* 기존 라우트 */}
+           <Route path="/login" element={<Login />} />
+           <Route path="/business/register" element={<BusinessRegister />} />
+           <Route path="/business/dashboard" element={<BusinessDashboard />} />
+           <Route path="/admin/listings" element={<AdminListings />} />
          </Routes>
        </BrowserRouter>
+     </AuthProvider>
    );
  }
```

## Navbar 통합 (src/components/Navbar.tsx)

기존 Navbar에 로그인/사용자 상태 표시 추가:
```diff
+ import { useAuth } from '@/hooks/use-auth';
  
  export function Navbar() {
+   const { user, logout } = useAuth();
    return (
      <nav>
        {/* 기존 메뉴 */}
+       {user ? (
+         <DropdownMenu>
+           <DropdownMenuTrigger>
+             <img src={user.avatar_url} className="w-8 h-8 rounded-full" />
+           </DropdownMenuTrigger>
+           <DropdownMenuContent>
+             <DropdownMenuItem><Link to="/business/dashboard">내 업체</Link></DropdownMenuItem>
+             {user.role === 'admin' && (
+               <DropdownMenuItem><Link to="/admin/listings">관리자</Link></DropdownMenuItem>
+             )}
+             <DropdownMenuItem onClick={logout}>로그아웃</DropdownMenuItem>
+           </DropdownMenuContent>
+         </DropdownMenu>
+       ) : (
+         <Link to="/login"><Button>로그인</Button></Link>
+       )}
      </nav>
    );
  }
```

## DoD
- [ ] AuthProvider + useAuth 동작
- [ ] /login에서 3개 OAuth 버튼 → 로그인 → 리다이렉트 성공
- [ ] /business/register 3-step wizard 동작
- [ ] Step 1에서 구글맵 URL 검증 → place_id 자동 추출
- [ ] Step 2에서 카테고리별 폼 렌더링 (5개 다)
- [ ] /business/dashboard 본인 매물 목록 + status 배지
- [ ] /admin/listings 검수 워크플로우 (승인/반려 + 사유)
- [ ] Navbar에 로그인 상태 반영
- [ ] requireAdmin 라우트 보호 동작
- [ ] 사이트 톤 일관성 유지 (shadcn/ui)
