# 04. OAuth 인증 시스템 (카카오 + 구글 + 네이버)

## Context
- 목표: 업체 등록 페이지(03)의 선행 인증 시스템
- Provider: **카카오, 구글, 네이버** 3종 (모두 1차 포함)
- 통합 키: **이메일** (한 사용자 = 한 이메일 = 여러 provider 연결 가능)
- 세션: HTTP-only 쿠키 + DB 세션 테이블
- 비밀번호 없음 (OAuth만)
- 선행: `00-infrastructure.md` 완료 (server/, PG, .env)

## DB 스키마 (migrations/003_oauth.sql)

```sql
-- 1. 사용자 (provider 통합)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,         -- 통합 키
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),
  primary_provider VARCHAR(20),                -- 'kakao' | 'google' | 'naver'
  role VARCHAR(20) NOT NULL DEFAULT 'user',    -- 'user' | 'admin'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users(email);

-- 2. OAuth provider 연결 (한 사용자가 여러 provider 가능)
CREATE TABLE user_oauth_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,               -- 'kakao' | 'google' | 'naver'
  provider_user_id VARCHAR(255) NOT NULL,      -- 카카오 ID, 구글 sub, 네이버 id
  access_token TEXT,                           -- AES 암호화 권장
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  raw_profile JSONB,                           -- provider 원본 응답 (디버깅용)
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_oauth_user ON user_oauth_accounts(user_id);

-- 3. 세션 (cookie 기반)
CREATE TABLE user_sessions (
  id VARCHAR(64) PRIMARY KEY,                  -- crypto.randomBytes(32).toString('hex')
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent VARCHAR(500),
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- 4. CSRF state 토큰 (OAuth 콜백 검증용, 단기 저장)
CREATE TABLE oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,
  redirect_after VARCHAR(500),                 -- 로그인 후 돌아갈 URL
  expires_at TIMESTAMPTZ NOT NULL,             -- 10분
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);
```

## .env 추가 항목

```bash
# === OAuth ===
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=https://work.luckydanang.com/api/auth/kakao/callback

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://work.luckydanang.com/api/auth/google/callback

NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URI=https://work.luckydanang.com/api/auth/naver/callback

# === 세션 ===
SESSION_SECRET=                               # openssl rand -hex 32
SESSION_COOKIE_NAME=ds_session
SESSION_LIFETIME_DAYS=30

# === 보안 ===
COOKIE_DOMAIN=.luckydanang.com                # 서브도메인 공유
FRONTEND_URL=https://work.luckydanang.com
```

⚠️ **Jeff 사전 확인**:
- 카카오 비즈 앱: 이메일 동의 항목 "필수 동의" 설정
- 구글 OAuth: scope에 `email`, `profile` 포함
- 네이버: 이메일 항목 "필수 동의" 설정 (선택 동의면 사용자가 거부 가능 → 통합 깨짐)
- 3개 provider 모두 redirect URI 화이트리스트 등록

## API 엔드포인트

### 1. 로그인 시작
```
GET /api/auth/:provider/login?redirect=/business/register
```
- `:provider` = `kakao` | `google` | `naver`
- CSRF state 생성 → DB 저장 (10분 TTL)
- provider 인증 페이지로 302 redirect

**Response**: 302 redirect to provider authorization URL

### 2. 콜백
```
GET /api/auth/:provider/callback?code=xxx&state=yyy
```
**처리 순서**:
1. `state` 검증 (oauth_states 테이블 조회 + 만료 확인 + 1회용 삭제)
2. `code` → access_token 교환 (provider별 token endpoint)
3. access_token → 프로필 조회 (이메일 필수)
4. **이메일 기반 통합 로직**:
   - 이메일이 `users` 테이블에 있으면 → 기존 user_id 사용
     - `user_oauth_accounts`에 (provider, provider_user_id) 없으면 INSERT (계정 연결)
   - 이메일이 없으면 → `users` INSERT + `user_oauth_accounts` INSERT
5. `users.last_login_at` 업데이트
6. `user_sessions` INSERT (세션 ID 생성)
7. Set-Cookie + redirect (`state.redirect_after` 또는 기본 `/`)

**Response**: 302 redirect

### 3. 현재 사용자
```
GET /api/auth/me
```
**Headers**: Cookie 자동
**Response**:
```typescript
{
  user: {
    id: number;
    email: string;
    display_name: string;
    avatar_url: string;
    role: 'user' | 'admin';
    connected_providers: ('kakao' | 'google' | 'naver')[];
  } | null;
}
```
세션 없으면 `{ user: null }`, 401 아님 (프론트가 분기).

### 4. 로그아웃
```
POST /api/auth/logout
```
- 세션 DELETE
- Set-Cookie 만료
- Response: `{ ok: true }`

### 5. 다른 provider 추가 연결 (이미 로그인된 상태)
```
GET /api/auth/link/:provider?redirect=/business/dashboard
```
로그인 시작과 비슷하지만, 콜백에서 신규 user 생성 안 하고 **현재 user_id에 provider만 추가**.
이메일 다르면? → 에러 ("이미 다른 이메일로 가입된 계정")

### 6. 세션 갱신 (선택)
```
POST /api/auth/refresh
```
세션 만료 7일 전 자동 갱신. 단기 구현 생략 가능.

## OAuth 플로우 (Provider별 상세)

### 카카오
```
1. GET https://kauth.kakao.com/oauth/authorize
   ?client_id={KAKAO_CLIENT_ID}
   &redirect_uri={KAKAO_REDIRECT_URI}
   &response_type=code
   &state={csrf_state}

2. POST https://kauth.kakao.com/oauth/token
   Body: grant_type=authorization_code
         &client_id={KAKAO_CLIENT_ID}
         &client_secret={KAKAO_CLIENT_SECRET}
         &code={code}
         &redirect_uri={KAKAO_REDIRECT_URI}
   Response: { access_token, refresh_token, expires_in }

3. GET https://kapi.kakao.com/v2/user/me
   Headers: Authorization: Bearer {access_token}
   Response: {
     id: 123456789,
     kakao_account: {
       email: "user@example.com",
       profile: { nickname, profile_image_url }
     }
   }
```
- `provider_user_id` = `id`
- `email` = `kakao_account.email`
- `display_name` = `kakao_account.profile.nickname`
- `avatar_url` = `kakao_account.profile.profile_image_url`

### 구글
```
1. GET https://accounts.google.com/o/oauth2/v2/auth
   ?client_id={GOOGLE_CLIENT_ID}
   &redirect_uri={GOOGLE_REDIRECT_URI}
   &response_type=code
   &scope=openid email profile
   &state={csrf_state}

2. POST https://oauth2.googleapis.com/token
   Body: code, client_id, client_secret, redirect_uri, grant_type=authorization_code
   Response: { access_token, id_token, refresh_token }

3. GET https://www.googleapis.com/oauth2/v3/userinfo
   Headers: Authorization: Bearer {access_token}
   Response: { sub, email, name, picture }
```
- `provider_user_id` = `sub`
- `email` = `email`
- `display_name` = `name`
- `avatar_url` = `picture`

### 네이버
```
1. GET https://nid.naver.com/oauth2.0/authorize
   ?client_id={NAVER_CLIENT_ID}
   &redirect_uri={NAVER_REDIRECT_URI}
   &response_type=code
   &state={csrf_state}

2. GET https://nid.naver.com/oauth2.0/token  ← GET 방식임 (주의)
   ?grant_type=authorization_code
   &client_id={NAVER_CLIENT_ID}
   &client_secret={NAVER_CLIENT_SECRET}
   &code={code}
   &state={state}

3. GET https://openapi.naver.com/v1/nid/me
   Headers: Authorization: Bearer {access_token}
   Response: {
     resultcode: "00",
     response: { id, email, name, profile_image }
   }
```
- `provider_user_id` = `response.id`
- `email` = `response.email`
- `display_name` = `response.name`
- `avatar_url` = `response.profile_image`

⚠️ 네이버 차이점:
- token 교환이 **GET** 방식 (카카오/구글은 POST)
- 응답이 `response` 객체 안에 중첩

## 보안 고려사항

### 1. CSRF state 토큰
- 모든 로그인 시작 시 `crypto.randomBytes(32).toString('hex')` 생성
- DB에 10분 TTL로 저장
- 콜백에서 검증 + 즉시 삭제 (1회용)
- 만료된 state는 cron으로 정리 (`DELETE FROM oauth_states WHERE expires_at < NOW()`)

### 2. redirect_uri 화이트리스트
- 콜백의 `redirect` 쿼리 파라미터는 **반드시 화이트리스트 검증**
- 허용 패턴: `/business/...`, `/admin/...`, `/login`, `/`
- 외부 URL 차단 (open redirect 방지)
```typescript
const ALLOWED_REDIRECTS = /^\/(business|admin|login)?(\/[^\s]*)?$/;
```

### 3. 세션 쿠키 설정
```typescript
res.cookie('ds_session', sessionId, {
  httpOnly: true,
  secure: true,           // HTTPS only
  sameSite: 'lax',        // OAuth callback에서 cookie 전달되어야 함
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30일
  domain: '.luckydanang.com',          // 서브도메인 공유
  path: '/',
});
```

### 4. access_token 저장
- DB의 `access_token` 컬럼은 AES-256-GCM 암호화 권장
- 단기 구현은 평문도 가능하나, 프로덕션 전 암호화 필수
- 키는 `.env`의 `SESSION_SECRET` 재사용 가능

### 5. Rate Limiting
- 같은 IP에서 1분 내 OAuth 시작 5회 이상 → 차단
- `oauth_states` 카운트로 간단 구현 가능

### 6. 이메일 통합의 함정
- 카카오와 구글 둘 다 같은 이메일 `user@gmail.com` 사용 시 → 같은 user_id로 통합
- **위험**: 한 provider가 해킹당하면 다른 provider 계정도 노출
- **완화**: provider 추가 연결 시 "이미 다른 provider로 가입된 계정과 통합하시겠습니까?" 확인 UI

## 서버 구현 구조 (참고)

```
server/src/
├── routes/
│   └── auth.ts                  # 6개 엔드포인트
├── auth/
│   ├── providers/
│   │   ├── kakao.ts            # OAuth flow 캡슐화
│   │   ├── google.ts
│   │   └── naver.ts
│   ├── session.ts              # 세션 CRUD
│   ├── csrf.ts                 # state 토큰
│   └── middleware.ts           # requireAuth, requireAdmin
└── utils/
    └── crypto.ts                # AES 암호화
```

### requireAuth 미들웨어 사용 예시
```typescript
// server/src/routes/business.ts
import { requireAuth } from '../auth/middleware';

router.post('/listings', requireAuth, async (req, res) => {
  const userId = req.user!.id;  // 미들웨어가 주입
  // ...
});
```

## 프론트엔드 (src/pages/Login.tsx)

사이트 톤에 맞춰 Codex가 자체 제작. 핵심 요소:

```tsx
// src/pages/Login.tsx (개념)
export default function Login() {
  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || '/';
  
  return (
    <div className="..."> {/* 사이트 톤 */}
      <h1>로그인 / 회원가입</h1>
      <a href={`/api/auth/kakao/login?redirect=${encodeURIComponent(redirect)}`}>
        <KakaoButton />
      </a>
      <a href={`/api/auth/google/login?redirect=${encodeURIComponent(redirect)}`}>
        <GoogleButton />
      </a>
      <a href={`/api/auth/naver/login?redirect=${encodeURIComponent(redirect)}`}>
        <NaverButton />
      </a>
    </div>
  );
}
```

### useAuth 훅 (전역 사용)
```typescript
// src/hooks/use-auth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setUser(d.user))
      .finally(() => setLoading(false));
  }, []);
  
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = '/';
  };
  
  return { user, loading, logout };
}
```

⚠️ 모든 fetch에 `credentials: 'include'` 필수 (쿠키 전송).

## 시드: 관리자 계정

```sql
-- Jeff 본인 계정을 admin으로 (수동 INSERT)
-- 실제 OAuth 1회 로그인 후 아래 실행
UPDATE users SET role = 'admin' WHERE email = 'jeff@example.com';
```

또는 `.env.SUPER_ADMIN_EMAIL` 환경변수로 관리:
```typescript
// 콜백 시 자동 처리
if (email === process.env.SUPER_ADMIN_EMAIL) {
  await query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
}
```

## 테스트

```typescript
// server/test/auth.test.ts
describe('OAuth', () => {
  it('GET /api/auth/kakao/login redirects to kakao with state', async () => {
    const res = await fetch('/api/auth/kakao/login', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kauth.kakao.com');
    expect(res.headers.get('location')).toContain('state=');
  });
  
  it('Callback rejects invalid state', async () => {
    const res = await fetch('/api/auth/kakao/callback?code=test&state=invalid');
    expect(res.status).toBe(400);
  });
  
  it('GET /api/auth/me without cookie returns user:null', async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    expect(data.user).toBeNull();
  });
});
```

## DoD
- [ ] migrations/003_oauth.sql 무에러 실행 (4개 테이블 생성)
- [ ] 카카오 로그인 → 콜백 → 세션 생성 → /api/auth/me 200
- [ ] 구글 로그인 동일 플로우 통과
- [ ] 네이버 로그인 동일 플로우 통과
- [ ] 같은 이메일로 카카오/구글 둘 다 로그인 시 같은 user_id 사용 확인
- [ ] 로그아웃 시 세션 DELETE + 쿠키 만료
- [ ] CSRF state 토큰 검증 (잘못된 state 거부)
- [ ] redirect 파라미터 화이트리스트 검증 (외부 URL 차단)
- [ ] requireAuth 미들웨어로 보호된 라우트 401 응답 확인
- [ ] Login 페이지 (3개 provider 버튼) 동작 확인
- [ ] 사이트 톤에 맞는 디자인 (별도 디자인 의뢰 없이 Codex 자체 제작)

## 📋 Jeff 사전 준비 체크리스트
```
[ ] 카카오 비즈 앱 redirect URI 등록
    → https://work.luckydanang.com/api/auth/kakao/callback
[ ] 카카오 동의항목: 이메일 "필수 동의" 설정
[ ] 구글 OAuth 클라이언트 redirect URI 등록
    → https://work.luckydanang.com/api/auth/google/callback
[ ] 네이버 앱 등록 + Callback URL 설정
[ ] 네이버 동의항목: 이메일 "필수 동의" 설정
[ ] server/.env에 9개 환경변수 추가 (3 provider × 3개씩)
[ ] SESSION_SECRET 생성 → openssl rand -hex 32
[ ] DNS: work.luckydanang.com → VPS IP (이미 완료)
```
