# 07. 대시보드 바 (날씨 + 환율 + 체류자)

## Context
- 기존 Community.tsx 상단에 하드코딩으로 있던 정보 (☀️28°C, ₩1=18.4동, 23명 체류)를 **전 페이지 글로벌 위젯**으로 승격
- 실제 API 연동 + 서버 캐시
- Navbar 아래 전역 배치 (모든 페이지 공통)
- 단일 통합 엔드포인트 `/api/dashboard`

## 핵심 결정
- **위치**: Navbar 바로 아래, 전역 (App.tsx에 배치)
- **갱신**: 프론트 5분 주기 재조회, 서버 캐시 독립 TTL
- **장애 대응**: 외부 API 실패 시 stale cache 유지 (절대 빈 값 표시 금지)
- **모바일**: `flex-wrap`으로 줄바꿈, 보조 정보는 `hidden sm:inline`

## API 통합

### GET /api/dashboard
단일 엔드포인트로 3개 정보 통합. 페이지마다 호출 횟수 최소화.

**Response**:
```typescript
{
  weather: {
    temp_c: number;              // 정수 반올림
    icon: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'snowy';
    description: string;          // "맑음", "구름 많음"
    updated_at: string;           // ISO
  } | null,
  
  exchange: {
    krw_to_vnd: number;           // 1 KRW = N VND (예: 18.4)
    vnd_to_krw: number;           // 역수
    usd_to_krw: number;           // 보너스
    updated_at: string;
  } | null,
  
  residents: {
    active_count: number;         // 현재 체류 중
    new_this_week: number;        // 7일 내 신규
    updated_at: string;
  } | null
}
```

**null 의미**: 해당 항목 수집 실패 (첫 호출이고 캐시도 없음). 프론트는 null이면 해당 항목 숨김.

---

## 서버 구현

### .env 추가
```bash
# OpenWeatherMap (무료 플랜, 일 1000호출)
OPENWEATHER_API_KEY=                      # Jeff가 직접 입력

# 다낭 좌표 (Da Nang, Vietnam)
WEATHER_LAT=16.0678
WEATHER_LON=108.2208

# 환율 API는 키 불필요 (open.er-api.com)
```

⚠️ `.gitignore`에 `.env` 확인 필수. 키는 절대 커밋 금지.

### 폴더 구조
```
server/src/
├── routes/
│   └── dashboard.ts              # GET /api/dashboard
├── services/
│   ├── weather-service.ts        # OpenWeatherMap
│   ├── exchange-service.ts       # open.er-api.com
│   └── residents-count-service.ts # 자체 DB
└── utils/
    └── memory-cache.ts           # 간단한 TTL 캐시 유틸
```

### 메모리 캐시 유틸

```typescript
// server/src/utils/memory-cache.ts
interface CacheEntry<T> {
  data: T;
  expires_at: number;
  fetched_at: number;
}

export class MemoryCache<T> {
  private entry: CacheEntry<T> | null = null;
  
  constructor(
    private ttl_ms: number,
    private fetcher: () => Promise<T>,
    private label: string
  ) {}
  
  async get(): Promise<T | null> {
    const now = Date.now();
    
    // 캐시 유효하면 그대로 반환
    if (this.entry && now < this.entry.expires_at) {
      return this.entry.data;
    }
    
    // 만료됐으면 재조회 시도
    try {
      const data = await this.fetcher();
      this.entry = {
        data,
        expires_at: now + this.ttl_ms,
        fetched_at: now,
      };
      return data;
    } catch (err) {
      console.error(`[cache:${this.label}] fetch failed:`, err);
      
      // 실패했지만 stale 캐시가 있으면 그대로 반환
      if (this.entry) {
        console.warn(`[cache:${this.label}] using stale cache from ${new Date(this.entry.fetched_at).toISOString()}`);
        return this.entry.data;
      }
      
      // stale도 없으면 null
      return null;
    }
  }
  
  // 강제 리프레시 (admin용, 선택)
  async refresh(): Promise<T | null> {
    this.entry = null;
    return this.get();
  }
}
```

### 날씨 서비스

```typescript
// server/src/services/weather-service.ts
import { MemoryCache } from '../utils/memory-cache';

interface WeatherData {
  temp_c: number;
  icon: string;
  description: string;
  updated_at: string;
}

const LAT = process.env.WEATHER_LAT || '16.0678';
const LON = process.env.WEATHER_LON || '108.2208';
const API_KEY = process.env.OPENWEATHER_API_KEY;

async function fetchWeather(): Promise<WeatherData> {
  if (!API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not set');
  }
  
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric&lang=kr`;
  
  // 5초 타임아웃
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`OpenWeatherMap returned ${res.status}`);
    }
    
    const data = await res.json();
    
    return {
      temp_c: Math.round(data.main.temp),
      icon: mapWeatherIcon(data.weather[0]?.main || 'Clear'),
      description: data.weather[0]?.description || '',
      updated_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mapWeatherIcon(main: string): string {
  const map: Record<string, string> = {
    Clear: 'sunny',
    Clouds: 'cloudy',
    Rain: 'rainy',
    Drizzle: 'rainy',
    Thunderstorm: 'stormy',
    Mist: 'foggy',
    Fog: 'foggy',
    Haze: 'foggy',
    Snow: 'snowy',
  };
  return map[main] || 'cloudy';
}

// 1시간 TTL
export const weatherCache = new MemoryCache<WeatherData>(
  60 * 60 * 1000,
  fetchWeather,
  'weather'
);
```

### 환율 서비스

```typescript
// server/src/services/exchange-service.ts
import { MemoryCache } from '../utils/memory-cache';

interface ExchangeData {
  krw_to_vnd: number;
  vnd_to_krw: number;
  usd_to_krw: number;
  updated_at: string;
}

async function fetchExchange(): Promise<ExchangeData> {
  // open.er-api.com 무료 (키 불필요)
  // base = KRW → 1 KRW 기준 다른 통화
  const url = 'https://open.er-api.com/v6/latest/KRW';
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`Exchange API returned ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.result !== 'success') {
      throw new Error('Exchange API result not success');
    }
    
    const vnd = data.rates?.VND;
    const usd = data.rates?.USD;
    
    if (!vnd || !usd) {
      throw new Error('Missing VND or USD rate');
    }
    
    return {
      krw_to_vnd: vnd,
      vnd_to_krw: 1 / vnd,
      usd_to_krw: 1 / usd,
      updated_at: data.time_last_update_utc 
        ? new Date(data.time_last_update_utc).toISOString()
        : new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// 24시간 TTL (환율은 일 1회 갱신)
export const exchangeCache = new MemoryCache<ExchangeData>(
  24 * 60 * 60 * 1000,
  fetchExchange,
  'exchange'
);
```

### 체류자 카운트 서비스

```typescript
// server/src/services/residents-count-service.ts
import { query } from '../db';
import { MemoryCache } from '../utils/memory-cache';

interface ResidentsCount {
  active_count: number;
  new_this_week: number;
  updated_at: string;
}

async function fetchResidentsCount(): Promise<ResidentsCount> {
  const [row] = await query<{ active_count: string; new_this_week: string }>(`
    SELECT 
      COUNT(*) FILTER (
        WHERE is_public = TRUE 
        AND stay_from <= CURRENT_DATE 
        AND (stay_to IS NULL OR stay_to >= CURRENT_DATE)
      ) AS active_count,
      COUNT(*) FILTER (
        WHERE is_public = TRUE 
        AND created_at >= NOW() - INTERVAL '7 days'
      ) AS new_this_week
    FROM residents
  `);
  
  return {
    active_count: Number(row.active_count),
    new_this_week: Number(row.new_this_week),
    updated_at: new Date().toISOString(),
  };
}

// 5분 TTL (거의 실시간)
export const residentsCountCache = new MemoryCache<ResidentsCount>(
  5 * 60 * 1000,
  fetchResidentsCount,
  'residents-count'
);
```

### 통합 라우트

```typescript
// server/src/routes/dashboard.ts
import { Router } from 'express';
import { weatherCache } from '../services/weather-service';
import { exchangeCache } from '../services/exchange-service';
import { residentsCountCache } from '../services/residents-count-service';

const router = Router();

router.get('/dashboard', async (req, res) => {
  // 3개 서비스 병렬 조회 (독립적)
  const [weather, exchange, residents] = await Promise.all([
    weatherCache.get().catch(() => null),
    exchangeCache.get().catch(() => null),
    residentsCountCache.get().catch(() => null),
  ]);
  
  res.json({
    weather,
    exchange,
    residents,
  });
});

// Admin: 강제 리프레시 (선택)
router.post('/dashboard/refresh', async (req, res) => {
  // requireAdmin 미들웨어
  const [weather, exchange, residents] = await Promise.all([
    weatherCache.refresh(),
    exchangeCache.refresh(),
    residentsCountCache.refresh(),
  ]);
  res.json({ weather, exchange, residents });
});

export default router;
```

### index.ts에 라우트 등록
```diff
  import dashboardRouter from './routes/dashboard';
+ app.use('/api', dashboardRouter);
```

### 서버 시작 시 warmup (선택, 권장)

```typescript
// server/src/index.ts 끝부분
// 서버 시작 직후 캐시 미리 채우기 (첫 사용자의 콜드 스타트 회피)
setTimeout(async () => {
  console.log('[warmup] preloading dashboard cache...');
  try {
    await Promise.all([
      weatherCache.get(),
      exchangeCache.get(),
      residentsCountCache.get(),
    ]);
    console.log('[warmup] done');
  } catch (err) {
    console.error('[warmup] failed:', err);
  }
}, 2000);
```

---

## 프론트엔드 구현

### 컴포넌트

```typescript
// src/components/DashboardBar.tsx
import { useEffect, useState } from 'react';

interface Weather {
  temp_c: number;
  icon: string;
  description: string;
}

interface Exchange {
  krw_to_vnd: number;
}

interface Residents {
  active_count: number;
  new_this_week: number;
}

interface Dashboard {
  weather: Weather | null;
  exchange: Exchange | null;
  residents: Residents | null;
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  stormy: '⛈️',
  foggy: '🌫️',
  snowy: '❄️',
};

export function DashboardBar() {
  const [data, setData] = useState<Dashboard>({
    weather: null,
    exchange: null,
    residents: null,
  });
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoaded(true);
        }
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
      }
    };
    
    load();
    
    // 5분마다 재조회
    const interval = setInterval(load, 5 * 60 * 1000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  
  // 모든 정보 없으면 아예 안 그림 (레이아웃 점프 방지)
  const hasAny = data.weather || data.exchange || data.residents;
  if (!loaded || !hasAny) {
    return <div className="h-0" />;  // 초기 렌더 시 자리만 확보 안 함
  }
  
  return (
    <div className="border-b bg-accent/20">
      <div className="container mx-auto py-2 px-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {/* 날씨 */}
          {data.weather && (
            <span className="flex items-center gap-1">
              {WEATHER_EMOJI[data.weather.icon] || '🌤️'}
              <span className="font-medium text-foreground/80">
                {data.weather.temp_c}°C
              </span>
              <span className="hidden md:inline">
                · {data.weather.description}
              </span>
            </span>
          )}
          
          {/* 환율 */}
          {data.exchange && (
            <span className="flex items-center gap-1">
              💱
              <span className="font-medium text-foreground/80">
                ₩1 = {data.exchange.krw_to_vnd.toFixed(1)}동
              </span>
            </span>
          )}
          
          {/* 체류자 */}
          {data.residents && (
            <span className="flex items-center gap-1">
              📍
              <span className="font-medium text-foreground/80">
                {data.residents.active_count}명 체류 중
              </span>
              {data.residents.new_this_week > 0 && (
                <span className="hidden sm:inline text-muted-foreground/70">
                  · 이번 주 +{data.residents.new_this_week}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

### App.tsx 전역 배치

```diff
  import { BrowserRouter, Routes, Route } from 'react-router-dom';
+ import { DashboardBar } from './components/DashboardBar';
  import Navbar from './components/Navbar';
  import Footer from './components/Footer';
  import { AuthProvider } from './hooks/use-auth';

  function App() {
    return (
      <AuthProvider>
        <BrowserRouter>
+         <Navbar />
+         <DashboardBar />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/community" element={<Community />} />
            {/* ... 기타 라우트 */}
          </Routes>
+         <Footer />
        </BrowserRouter>
      </AuthProvider>
    );
  }
```

⚠️ **중요**: 기존 페이지 각각에 `<Navbar />`, `<Footer />`, `<DashboardBar />` (만약 있다면)가 **중복 배치**되지 않도록 Codex가 일괄 제거해야 함:

```bash
# Codex 작업: 기존 페이지에서 <Navbar />, <Footer /> 제거
# 대상 파일:
src/pages/Index.tsx
src/pages/Community.tsx
src/pages/Compare.tsx
src/pages/Planner.tsx
src/pages/Directory.tsx
src/pages/Insight.tsx
src/pages/Living.tsx
src/pages/Retire.tsx
src/pages/Login.tsx (있으면)
src/pages/BusinessRegister.tsx (있으면)
src/pages/BusinessDashboard.tsx (있으면)
src/pages/AdminListings.tsx (있으면)
src/pages/CommunityPostDetail.tsx (있으면)
src/pages/CommunityWrite.tsx (있으면)
src/pages/CoffeeChats.tsx (있으면)
src/pages/Residents.tsx (있으면)
src/pages/ResidentMe.tsx (있으면)
src/pages/NotFound.tsx
```

각 파일에서:
```diff
- import Navbar from '@/components/Navbar';
- import Footer from '@/components/Footer';

  export default function PageName() {
    return (
-     <div className="min-h-screen">
-       <Navbar />
        <main>{/* 페이지 내용 */}</main>
-       <Footer />
-     </div>
+     <main>{/* 페이지 내용 */}</main>
    );
  }
```

---

## 기존 하드코딩 제거

Community.tsx 상단에 하드코딩된 정보바가 있다면 제거:

```diff
  <div className="container py-3 text-sm text-muted-foreground flex gap-4">
-   <span>☀️ 28°C</span>
-   <span>₩1 = 18.4동</span>
-   <span>📍 {residents.length}명 체류 중</span>
  </div>
```

→ DashboardBar가 전역에서 처리.

---

## 테스트

### API 테스트
```bash
# 기본 조회
curl https://luckydanang.com/api/dashboard | jq

# 기대 응답:
# {
#   "weather": { "temp_c": 28, "icon": "sunny", ... },
#   "exchange": { "krw_to_vnd": 18.4, ... },
#   "residents": { "active_count": 23, "new_this_week": 5, ... }
# }

# 캐시 동작 확인 (여러 번 호출, 응답 시간 <50ms이면 캐시 히트)
time curl https://luckydanang.com/api/dashboard > /dev/null
time curl https://luckydanang.com/api/dashboard > /dev/null
```

### 브라우저 테스트
```
[ ] https://luckydanang.com 접속 → Navbar 아래 정보바 노출
[ ] /community, /compare, /planner 등 어느 페이지에서도 동일하게 노출
[ ] 온도가 하드코딩 28°C가 아닌 실제 다낭 현재 기온 (OpenWeatherMap 확인)
[ ] 환율이 실제 현재 환율과 일치 (네이버 환율 비교)
[ ] 체류자 수가 DB와 일치
[ ] 모바일 뷰에서 줄바꿈 정상
[ ] 5분 후 자동 재조회 (Network 탭 확인)
[ ] 서버 재시작 후 첫 호출도 정상 (warmup 확인)
```

### 장애 시나리오 테스트
```
[ ] .env에서 OPENWEATHER_API_KEY 삭제 → PM2 restart
    → weather: null, 다른 항목 정상 표시
[ ] 의도적으로 open.er-api.com을 /etc/hosts로 차단
    → exchange: null (또는 stale 캐시), 다른 항목 정상
[ ] DB residents 테이블 비어있음
    → residents: { active_count: 0, new_this_week: 0 }
```

---

## 모니터링 (권장)

로그에서 캐시 miss/stale 빈도 확인:
```bash
pm2 logs dreamspace-api | grep -E "cache:(weather|exchange|residents)"

# 정상:
# [warmup] preloading dashboard cache...
# [warmup] done

# 비정상 (자주 발생하면 조사 필요):
# [cache:weather] fetch failed: ...
# [cache:weather] using stale cache from ...
```

API 키 quota 확인 (OpenWeatherMap):
- https://home.openweathermap.org/statistics/onecall
- 일당 1000회 제한이므로 1시간 캐시 = 하루 최대 24회만 사용
- 500회 초과하면 뭔가 잘못된 것 (캐시 안 먹고 있음)

---

## 선택적 확장 (Phase 2)

나중에 추가 고려할 것:

- [ ] **오늘의 환율 변동** (+0.2 ↑ 표시)
- [ ] **주간 날씨 예보** (hover 시 툴팁)
- [ ] **체류자 신규 알림** ("방금 전 새 체류자 등록")
- [ ] **오프라인 감지** (navigator.onLine 체크)
- [ ] **사용자 설정 숨기기** (localStorage로 본인만 숨김)
- [ ] **관리자 공지** (특정 날짜에 이벤트 배너 추가)

---

## DoD (12개)

### Backend
- [ ] `server/src/utils/memory-cache.ts` TTL 캐시 유틸 구현
- [ ] OpenWeatherMap 연동 (1시간 TTL) + 5초 타임아웃
- [ ] open.er-api.com 연동 (24시간 TTL) + 5초 타임아웃
- [ ] residents count 쿼리 (5분 TTL)
- [ ] `GET /api/dashboard` 통합 엔드포인트 200 응답
- [ ] 캐시 miss 시 fetch 실패 → stale 반환 또는 null
- [ ] `.env`에 OPENWEATHER_API_KEY 설정 (실제 키)
- [ ] 서버 시작 시 warmup 로직 동작

### Frontend
- [ ] DashboardBar 컴포넌트 구현
- [ ] App.tsx에 전역 배치 (Navbar 아래)
- [ ] 기존 페이지들의 `<Navbar />`, `<Footer />` 중복 제거
- [ ] Community.tsx 상단 하드코딩 정보바 제거
- [ ] 5분 주기 재조회

### 검증
- [ ] 실제 다낭 현재 기온 표시 (네이버/구글과 비교)
- [ ] 실제 KRW → VND 환율 표시
- [ ] DB residents 개수와 일치
- [ ] 모바일/데스크탑 양쪽 레이아웃 OK
- [ ] Community 외 다른 페이지에서도 동일 노출
- [ ] API 키 없어도 (환율+체류자만) 사이트 정상 동작

---

## 🔒 보안 체크리스트

- [ ] OPENWEATHER_API_KEY는 **서버 .env에만** (프론트 절대 노출 금지)
- [ ] `.env`는 `.gitignore`에 등록되어 있는지 확인
- [ ] 커밋 히스토리에 키 노출 없는지 `git log -p -- server/.env` 확인
- [ ] rate limit: `/api/dashboard` 도 IP당 분당 60회 (도배 방지)
- [ ] 에러 메시지에 API 키 포함되지 않는지 확인
