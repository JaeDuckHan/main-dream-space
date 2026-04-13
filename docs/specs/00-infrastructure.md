# 00. Infrastructure: API Server + PostgreSQL 부트스트랩

## Context
- 현재 레포: Vite + React + TS (순수 프론트엔드)
- 목표: 로컬 PostgreSQL 연결을 위한 Node API 서버 신설
- 담당: Codex (서버 전체), Claude (스펙), Lovable (프론트 UI 미개입)

## 폴더 구조 (신규)
```
main-dream-space/
├── src/                    # 기존 프론트 (Lovable 관할)
├── server/                 # 🆕 API 서버 (Codex 관할)
│   ├── src/
│   │   ├── index.ts
│   │   ├── db.ts           # pg Pool
│   │   ├── routes/
│   │   │   ├── planner.ts
│   │   │   └── accommodations.ts
│   │   ├── types.ts
│   │   └── middleware/error.ts
│   ├── migrations/001_init.sql
│   ├── seeds/
│   │   ├── checklist.seed.sql
│   │   └── accommodations.seed.sql
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── package.json
```

## 기술 스택 (server/)
- Node 20+ LTS, TypeScript, Express 4
- **`pg` (node-postgres) 8.x** + `@types/pg`
- `zod` (요청 검증), `cors`, `dotenv`, `tsx` (dev)

## 포트 & Proxy
- API: `http://localhost:3001`
- Vite dev: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

`vite.config.ts` 수정:
```diff
export default defineConfig({
  server: {
+   proxy: {
+     '/api': { target: 'http://localhost:3001', changeOrigin: true },
+   },
  },
});
```

## PostgreSQL 스키마 (migrations/001_init.sql)

```sql
-- DB는 미리 생성되어 있다고 가정 (CREATE DATABASE는 별도 실행)
-- psql -U postgres -c "CREATE DATABASE dreamspace;"

-- 1. ENUM 타입 정의 (PG는 별도 CREATE TYPE)
CREATE TYPE action_type_enum AS ENUM ('external', 'internal', 'none');
CREATE TYPE affiliate_partner_enum AS ENUM ('agoda', 'booking', 'tripcom', 'skyscanner', 'none');
CREATE TYPE accommodation_type_enum AS ENUM ('hotel', 'resort', 'apartment', 'villa', 'guesthouse');
CREATE TYPE accommodation_source_enum AS ENUM ('manual', 'real_estate', 'partner_api');
CREATE TYPE click_partner_enum AS ENUM ('agoda', 'booking', 'tripcom', 'skyscanner');
CREATE TYPE click_target_enum AS ENUM ('checklist_item', 'accommodation');

-- 공통: updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 체크리스트 템플릿
CREATE TABLE checklist_templates (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id SERIAL PRIMARY KEY,
  template_id INT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  action_type action_type_enum NOT NULL DEFAULT 'none',
  action_url VARCHAR(1000),
  action_label VARCHAR(100),
  affiliate_partner affiliate_partner_enum NOT NULL DEFAULT 'none',
  affiliate_tag VARCHAR(200),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_checklist_items_template_sort ON checklist_items(template_id, sort_order);

-- 3. 진행상태 (익명 세션)
CREATE TABLE checklist_progress (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  item_id INT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, item_id)
);
CREATE INDEX idx_progress_session ON checklist_progress(session_id);
CREATE TRIGGER trg_progress_updated
  BEFORE UPDATE ON checklist_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. 숙소
CREATE TABLE accommodations (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_ko VARCHAR(200),
  type accommodation_type_enum NOT NULL,
  district VARCHAR(100),
  address TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  price_min_usd INT NOT NULL,
  price_max_usd INT NOT NULL,
  price_monthly_usd INT,
  currency VARCHAR(3) DEFAULT 'USD',
  rating NUMERIC(2,1),
  review_count INT DEFAULT 0,
  bedrooms SMALLINT,
  max_guests SMALLINT,
  amenities JSONB,
  thumbnail_url VARCHAR(500),
  image_urls JSONB,
  agoda_url VARCHAR(1000),
  agoda_hotel_id VARCHAR(50),
  booking_url VARCHAR(1000),
  tripcom_url VARCHAR(1000),
  source accommodation_source_enum DEFAULT 'manual',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_acc_price ON accommodations(price_min_usd);
CREATE INDEX idx_acc_district ON accommodations(district);
CREATE INDEX idx_acc_active ON accommodations(is_active);
CREATE INDEX idx_acc_amenities ON accommodations USING GIN (amenities);
CREATE TRIGGER trg_acc_updated
  BEFORE UPDATE ON accommodations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. 어필리에이트 클릭 추적
CREATE TABLE affiliate_clicks (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(64),
  partner click_partner_enum NOT NULL,
  target_type click_target_enum NOT NULL,
  target_id INT NOT NULL,
  referrer VARCHAR(500),
  user_agent VARCHAR(500),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clicks_partner_time ON affiliate_clicks(partner, clicked_at);
CREATE INDEX idx_clicks_target ON affiliate_clicks(target_type, target_id);
```

## .env.example
```
DATABASE_URL=postgresql://dreamspace:비밀번호@localhost:5432/dreamspace
PORT=3001
NODE_ENV=development
AGODA_AFFILIATE_ID=
```

⚠️ PG는 `DATABASE_URL` 단일 URL 방식이 표준. `pg` 드라이버가 자동 파싱.

## package.json (server/)
```json
{
  "name": "dreamspace-server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "psql $DATABASE_URL -f migrations/001_init.sql",
    "seed": "psql $DATABASE_URL -f seeds/checklist.seed.sql && psql $DATABASE_URL -f seeds/accommodations.seed.sql"
  },
  "dependencies": {
    "express": "^4.19.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0"
  }
}
```

## server/src/db.ts (참고 코드)
```typescript
import { Pool } from 'pg';
import 'dotenv/config';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query<T = any>(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
```

## 🖥️ PostgreSQL 사전 설치 (Windows 개발 로컬)

### 필수 항목
| 항목 | 버전 | 비고 |
|---|---|---|
| Node.js | 20.x LTS+ | API 서버 |
| PostgreSQL | **14+ 권장 (16 최신)** | JSONB, gen_random_uuid 사용 |
| psql | PG 설치 시 포함 | CLI 마이그레이션용 |

### 1. Node.js 20 LTS
```powershell
winget install OpenJS.NodeJS.LTS
node -v
```

### 2. PostgreSQL 16
```powershell
winget install PostgreSQL.PostgreSQL.16
```
또는 https://www.postgresql.org/download/windows/ 에서 EDB 설치 프로그램 다운로드.

설치 중 입력 사항:
- **Password for postgres superuser**: 강한 비밀번호 (반드시 저장)
- **Port**: 5432 (기본값 유지)
- **Locale**: Default 또는 `Korean, Korea`

설치 확인:
```powershell
psql --version   # psql (PostgreSQL) 16.x
```

### 3. PATH 등록 (Windows에서 종종 누락됨)
설치 후 `psql` 명령어가 안 먹으면:
```
시스템 환경변수 → Path → C:\Program Files\PostgreSQL\16\bin 추가
```

### 4. DB/사용자 생성
```powershell
psql -U postgres
```
```sql
CREATE USER dreamspace WITH PASSWORD '강한비밀번호';
CREATE DATABASE dreamspace OWNER dreamspace ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE dreamspace TO dreamspace;
\q
```

접속 테스트:
```powershell
psql -U dreamspace -d dreamspace -h localhost
```

⚠️ 5432 포트는 외부 오픈 금지 (localhost only).

### 5. (선택) pgAdmin 4
PG 설치 시 함께 포함. GUI로 데이터 확인용.

### 6. (선택) Thunder Client
VSCode 확장. API 테스트용.

## 🗂️ 설치 체크리스트
```
[ ] Node.js 20 LTS 설치 → node -v
[ ] PostgreSQL 16 설치 → psql --version
[ ] postgres superuser 비밀번호 저장
[ ] dreamspace 사용자 + DB 생성
[ ] psql 접속 테스트 성공
[ ] server/.env 작성 (DATABASE_URL + AGODA_AFFILIATE_ID)
[ ] cd server && npm install
[ ] npm run migrate (001_init.sql 실행)
[ ] npm run seed
[ ] npm run dev → 3001 포트 기동
[ ] curl http://localhost:3001/api/health → {status:"ok"}
[ ] 루트에서 npm run dev → Vite 5173에서 /api/health 프록시 동작 확인
```

## DoD
- [ ] `cd server && npm run dev` 정상 기동
- [ ] `GET /api/health` → `{status:"ok"}`
- [ ] 프론트에서 `fetch('/api/health')` 성공
- [ ] migrations/001_init.sql 무에러 실행 (ENUM 타입 6개, 테이블 5개, 트리거 2개 생성)
- [ ] `.env.example` 포함, `.env`는 `.gitignore`
