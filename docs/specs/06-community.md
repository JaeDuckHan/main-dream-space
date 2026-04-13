# 06. 커뮤니티 시스템 (게시판 + 이미지 + 커피챗 + 체류자)

## Context
- 기존 `src/pages/Community.tsx` 358줄 = 하드코딩 더미 (UI만 있음)
- 기존 디자인 보존 + 데이터 레이어 교체 + 백엔드 신규
- 카테고리: notice / question / review / info (4개, 한글 표시)
- 에디터: 마크다운 (@uiw/react-md-editor)
- 이미지: Cloudflare R2 (img.kowinsblue.com 재활용)
- 커피챗: 별도 테이블
- 체류자 등록: Phase 1 포함
- 선행: 00, 04 (OAuth), 03 (listings 구조 참고용)

## 주요 결정
- **카테고리 DB는 영문 ENUM**, 화면은 한글 변환 (`category_labels`)
- **댓글은 2-depth** (댓글 + 대댓글만, 무한 depth 아님)
- **좋아요는 post + comment 통합 테이블** (target_type 구분)
- **이미지 24시간 orphan cleanup cron**
- **체류자 등록은 users 확장이 아닌 별도 residents 테이블** (기간 변경 추적)

## DB 스키마 (migrations/005_community.sql)

```sql
-- ENUM
CREATE TYPE community_category_enum AS ENUM (
  'notice', 'question', 'review', 'info'
);

CREATE TYPE stay_type_enum AS ENUM (
  'monthly_stay', 'long_term', 'retirement', 'workation'
);

CREATE TYPE coffee_chat_status_enum AS ENUM (
  'open', 'full', 'cancelled', 'completed'
);

-- 1. 게시글
CREATE TABLE community_posts (
  id SERIAL PRIMARY KEY,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category community_category_enum NOT NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,              -- 마크다운 원본
  content_html TEXT,                   -- 서버에서 렌더링한 HTML (캐시)
  
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  
  is_pinned BOOLEAN DEFAULT FALSE,     -- 공지 상단 고정
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_category_created ON community_posts(category, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_posts_author ON community_posts(author_id);
CREATE INDEX idx_posts_pinned ON community_posts(is_pinned DESC, created_at DESC) WHERE is_deleted = FALSE;
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. 댓글 (2-depth)
CREATE TABLE community_comments (
  id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id INT REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,               -- plain text
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CHECK (parent_id IS NULL OR parent_id != id)  -- 자기참조 방지
);
CREATE INDEX idx_comments_post ON community_comments(post_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_comments_parent ON community_comments(parent_id) WHERE is_deleted = FALSE;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. 좋아요 (post + comment 통합)
CREATE TABLE community_likes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(10) NOT NULL,    -- 'post' | 'comment'
  target_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, target_type, target_id),
  CHECK (target_type IN ('post', 'comment'))
);
CREATE INDEX idx_likes_target ON community_likes(target_type, target_id);
CREATE INDEX idx_likes_user ON community_likes(user_id);

-- 4. 북마크 (post만)
CREATE TABLE community_bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX idx_bookmarks_user ON community_bookmarks(user_id);

-- 5. 업로드 이미지
CREATE TABLE community_images (
  id SERIAL PRIMARY KEY,
  uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INT REFERENCES community_posts(id) ON DELETE SET NULL,
  url VARCHAR(1000) NOT NULL,
  r2_key VARCHAR(500) NOT NULL,
  file_size_bytes INT,
  mime_type VARCHAR(50),
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_images_post ON community_images(post_id);
CREATE INDEX idx_images_orphan ON community_images(created_at) WHERE post_id IS NULL;

-- 6. 커피챗
CREATE TABLE coffee_chats (
  id SERIAL PRIMARY KEY,
  organizer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  
  meetup_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 120,
  
  location_name VARCHAR(200),
  location_detail TEXT,                -- 참가 확정자만 공개
  location_map_url VARCHAR(500),
  
  max_participants INT NOT NULL DEFAULT 10,
  current_participants INT DEFAULT 1,
  
  status coffee_chat_status_enum DEFAULT 'open',
  
  target_groups JSONB,                 -- ["monthly_stay","workation"]
  age_range VARCHAR(20),               -- "30-50" or "any"
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chats_meetup_open ON coffee_chats(meetup_at) WHERE status = 'open';
CREATE INDEX idx_chats_organizer ON coffee_chats(organizer_id);
CREATE TRIGGER trg_chats_updated BEFORE UPDATE ON coffee_chats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. 커피챗 참가자
CREATE TABLE coffee_chat_participants (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES coffee_chats(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'confirmed',  -- 'confirmed' | 'cancelled' | 'no_show'
  note TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chat_id, user_id)
);

-- 8. 체류자 등록 (사이드바 "지금 다낭에 N명")
CREATE TABLE residents (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,       -- display_name 대신 원하는 닉네임
  age_group VARCHAR(20),               -- '20대' '30대' '40대' '50대' '60대+'
  stay_type stay_type_enum NOT NULL,
  area VARCHAR(100),                   -- '미케비치' '한강' '안투엉' 등
  stay_from DATE NOT NULL,
  stay_to DATE,                        -- NULL = 무기한/진행중
  bio TEXT,                            -- 자기소개 (선택)
  is_public BOOLEAN DEFAULT TRUE,      -- 사이드바 노출 여부
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)                     -- 1인 1체류자 (여러 기간은 UPDATE)
);
CREATE INDEX idx_residents_active ON residents(stay_from, stay_to) 
  WHERE is_public = TRUE;
CREATE TRIGGER trg_residents_updated BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. 신고 (선택)
CREATE TABLE community_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL,    -- 'post' | 'comment' | 'user'
  target_id INT NOT NULL,
  reason VARCHAR(50) NOT NULL,         -- 'spam' | 'abuse' | 'inappropriate' | 'other'
  detail TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'resolved' | 'dismissed'
  resolved_by INT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_pending ON community_reports(status, created_at DESC);
```

## 카운터 자동 갱신 (트리거 또는 수동)

```sql
-- 댓글 카운트 자동 갱신
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_deleted AND NOT OLD.is_deleted) THEN
    UPDATE community_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_count
  AFTER INSERT OR UPDATE OR DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- 좋아요 카운트 (post만, comment는 서버에서 계산)
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'post' OR OLD.target_type = 'post' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.target_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_like_count
  AFTER INSERT OR DELETE ON community_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();
```

## API 엔드포인트

### 공개 (인증 불필요)
```
GET  /api/community/posts?category=question&page=1&limit=20&sort=latest
GET  /api/community/posts/:id
GET  /api/community/posts/:id/comments
GET  /api/coffee-chats?status=open
GET  /api/coffee-chats/:id
GET  /api/residents?active=true
```

### 인증 필요 (requireAuth)
```
POST   /api/community/posts
PATCH  /api/community/posts/:id           # 본인만
DELETE /api/community/posts/:id           # 본인 or admin
POST   /api/community/posts/:id/comments
PATCH  /api/community/comments/:id        # 본인만
DELETE /api/community/comments/:id        # 본인 or admin
POST   /api/community/posts/:id/like      # 토글
POST   /api/community/comments/:id/like   # 토글
POST   /api/community/posts/:id/bookmark  # 토글
POST   /api/community/reports             # 신고

POST   /api/community/upload              # 이미지 업로드 (multipart)

POST   /api/coffee-chats                  # 생성
PATCH  /api/coffee-chats/:id              # 주최자만
POST   /api/coffee-chats/:id/join         # 참가
DELETE /api/coffee-chats/:id/join         # 참가 취소

POST   /api/residents                     # 체류자 등록 (본인 1개만)
PATCH  /api/residents/me                  # 본인 정보 수정
DELETE /api/residents/me                  # 숨기기
```

### 관리자 (requireAdmin)
```
POST   /api/admin/community/posts/:id/pin       # 공지 상단 고정
DELETE /api/admin/community/posts/:id           # 강제 삭제
GET    /api/admin/community/reports             # 신고 목록
PATCH  /api/admin/community/reports/:id/resolve # 신고 처리
```

## 요청/응답 스키마 예시

### GET /api/community/posts
```typescript
// Query: ?category=question&page=1&limit=20
// Response:
{
  posts: Array<{
    id: number;
    category: 'notice' | 'question' | 'review' | 'info';
    title: string;
    author: {
      id: number;
      display_name: string;
      avatar_url: string;
    };
    view_count: number;
    like_count: number;
    comment_count: number;
    is_pinned: boolean;
    created_at: string;  // ISO
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
```

### POST /api/community/posts
```typescript
// Request:
{
  category: 'question',
  title: '미케비치 한국 미용실 추천 좀요',
  content: '안녕하세요. 미케비치 근처에서 한국인 미용사 찾고 있습니다.\n\n![사진](https://img.kowinsblue.com/community/xxx.webp)',
}

// Server 처리:
// 1. zod 검증 (title 3~300, content 10~50000)
// 2. rate limit 체크 (분당 5개, 일당 20개)
// 3. content를 HTML로 렌더링 (marked + DOMPurify) → content_html 저장
// 4. content 안의 이미지 URL 추출 → community_images에서 해당 이미지의 post_id 업데이트
// 5. INSERT
// 6. Response: { id: 33, created_at: '...' }
```

### POST /api/community/upload
```typescript
// Request: multipart/form-data with 'file' field
// Server:
// 1. 인증 확인
// 2. 파일 검증:
//    - mime: jpeg/png/webp/gif
//    - size: max 5MB
//    - rate limit: 분당 10, 일당 50
// 3. sharp로 리사이즈 (max 1920px, WebP 변환, quality 85)
// 4. 로컬 저장: /var/www/luckydanang-uploads/community/2026-04/{uuid}.webp
// 5. community_images INSERT (post_id = NULL, uploader_id 기록)
// 6. Response: 
{
  url: 'https://img.kowinsblue.com/community/abc123.webp',
  id: 42,
  width: 1920,
  height: 1080
}
```

## 이미지 Orphan Cleanup (Cron)

```typescript
// server/src/cron/cleanup-orphan-images.ts
// 매일 04:00 KST 실행 (pm2 cron 또는 node-cron)

async function cleanupOrphanImages() {
  // 24시간 전 업로드 + post_id=NULL + 사용 안 된 이미지
  const orphans = await query(`
    SELECT id, r2_key FROM community_images 
    WHERE post_id IS NULL 
      AND created_at < NOW() - INTERVAL '24 hours'
    LIMIT 100
  `);
  
  for (const img of orphans) {
    await r2.delete(img.r2_key);
    await query('DELETE FROM community_images WHERE id = $1', [img.id]);
  }
  
  console.log(`[cleanup] Removed ${orphans.length} orphan images`);
}
```

PM2로 등록:
```bash
pm2 start cleanup-orphan-images.ts --cron "0 4 * * *" --no-autorestart
```

또는 package.json에 script로 등록 후 crontab:
```bash
# crontab -e
0 4 * * * cd /var/www/work-luckydanang/server && npm run cleanup:images
```

## 프론트엔드 구현

### 카테고리 매핑 (src/lib/community.ts)
```typescript
export const CATEGORY_LABELS = {
  notice: '공지',
  question: '질문',
  review: '후기',
  info: '정보',
} as const;

export const CATEGORY_COLORS = {
  notice: 'text-red-600',
  question: 'text-blue-600',
  review: 'text-green-600',
  info: 'text-purple-600',
} as const;

export type CategoryEn = keyof typeof CATEGORY_LABELS;
```

### Community.tsx 재작성 (기존 디자인 유지)

```typescript
// src/pages/Community.tsx (358줄 재작성)
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { CATEGORY_LABELS, CATEGORY_COLORS, type CategoryEn } from '@/lib/community';
import { cn } from '@/lib/utils';

interface Post {
  id: number;
  category: CategoryEn;
  title: string;
  author: { id: number; display_name: string; avatar_url: string };
  view_count: number;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
}

interface Resident {
  id: number;
  nickname: string;
  age_group: string;
  stay_type: string;
  area: string;
  stay_from: string;
  stay_to: string | null;
}

interface CoffeeChat {
  id: number;
  title: string;
  meetup_at: string;
  location_name: string;
  max_participants: number;
  current_participants: number;
}

export default function Community() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = (searchParams.get('category') || 'all') as 'all' | CategoryEn;
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [activeChat, setActiveChat] = useState<CoffeeChat | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 게시글 로드
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentCategory !== 'all') params.set('category', currentCategory);
    params.set('limit', '30');
    
    fetch(`/api/community/posts?${params}`)
      .then(r => r.json())
      .then(d => setPosts(d.posts))
      .finally(() => setLoading(false));
  }, [currentCategory]);
  
  // 체류자 로드
  useEffect(() => {
    fetch('/api/residents?active=true')
      .then(r => r.json())
      .then(d => setResidents(d.residents));
  }, []);
  
  // 다음 커피챗 로드
  useEffect(() => {
    fetch('/api/coffee-chats?status=open&limit=1')
      .then(r => r.json())
      .then(d => setActiveChat(d.chats[0] || null));
  }, []);
  
  const handleWriteClick = () => {
    if (!user) {
      navigate('/login?redirect=/community/write');
      return;
    }
    navigate('/community/write');
  };
  
  const handleCategoryChange = (cat: string) => {
    if (cat === 'all') setSearchParams({});
    else setSearchParams({ category: cat });
  };
  
  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return '방금 전';
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\./g, '/').replace(/\s/g, '');
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* 상단 정보 바 (기존 유지) */}
      <div className="container py-3 text-sm text-muted-foreground flex gap-4">
        <span>☀️ 28°C</span>
        <span>₩1 = 18.4동</span>
        <span>📍 {residents.length}명 체류 중</span>
      </div>
      
      <div className="container py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* 메인 게시판 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">다낭 커뮤니티</h1>
            <Button onClick={handleWriteClick} className="bg-orange-500 hover:bg-orange-600">
              글쓰기
            </Button>
          </div>
          
          {/* 카테고리 탭 */}
          <div className="flex gap-4 border-b mb-4">
            {[
              { key: 'all', label: '전체' },
              { key: 'notice', label: '공지' },
              { key: 'question', label: '질문' },
              { key: 'review', label: '후기' },
              { key: 'info', label: '정보' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => handleCategoryChange(tab.key)}
                className={cn(
                  'px-1 py-2 border-b-2 font-medium',
                  currentCategory === tab.key 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* 게시글 목록 */}
          {loading && <div>로딩 중...</div>}
          {!loading && posts.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              아직 게시글이 없습니다.
            </div>
          )}
          <div className="divide-y">
            {posts.map(post => (
              <div 
                key={post.id} 
                onClick={() => navigate(`/community/${post.id}`)}
                className="py-3 cursor-pointer hover:bg-accent/30 px-2 -mx-2 rounded"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">
                      <span className={cn('font-bold mr-2', CATEGORY_COLORS[post.category])}>
                        [{CATEGORY_LABELS[post.category]}]
                      </span>
                      {post.title}
                      {post.comment_count > 0 && (
                        <span className="text-red-500 ml-2">[{post.comment_count}]</span>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {post.author.display_name}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(post.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* 사이드바 (기존 디자인 유지) */}
        <aside className="space-y-4">
          {/* 체류자 카드 */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-bold mb-3">
              🟢 지금 다낭에 {residents.length}명
            </h3>
            <div className="space-y-2">
              {residents.slice(0, 5).map(r => (
                <div key={r.id} className="text-sm">
                  <span className="font-medium">{r.nickname}</span>
                  <span className="text-muted-foreground"> · {r.age_group} · {r.stay_type}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => user ? navigate('/residents/me') : navigate('/login?redirect=/residents/me')}
              className="text-sm text-primary mt-3"
            >
              등록하기
            </button>
          </div>
          
          {/* 커피챗 카드 */}
          {activeChat && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-bold mb-3">☕ 다낭 커피챗</h3>
              <p className="text-sm">
                {new Date(activeChat.meetup_at).toLocaleString('ko-KR', {
                  month: 'numeric', day: 'numeric', weekday: 'short',
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeChat.location_name} · 최대 {activeChat.max_participants}명
              </p>
              <Button 
                className="w-full mt-3" 
                variant="outline"
                onClick={() => navigate(`/coffee-chats/${activeChat.id}`)}
              >
                신청 ({activeChat.current_participants}/{activeChat.max_participants})
              </Button>
            </div>
          )}
        </aside>
      </div>
      
      <Footer />
    </div>
  );
}
```

### CommunityWrite.tsx (신규)

```typescript
// src/pages/CommunityWrite.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequireAuth } from '@/components/RequireAuth';
import MDEditor from '@uiw/react-md-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_LABELS } from '@/lib/community';

export default function CommunityWrite() {
  return (
    <RequireAuth>
      <WriteForm />
    </RequireAuth>
  );
}

function WriteForm() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('question');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const handleImagePaste = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/community/upload', {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    if (!res.ok) throw new Error('업로드 실패');
    const data = await res.json();
    return data.url;
  };
  
  const handleSubmit = async () => {
    if (title.length < 3) return alert('제목은 3자 이상');
    if (content.length < 10) return alert('본문은 10자 이상');
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, content }),
      });
      if (!res.ok) throw new Error('저장 실패');
      const data = await res.json();
      navigate(`/community/${data.id}`);
    } catch (err) {
      alert('글 저장 중 오류');
      setSubmitting(false);
    }
  };
  
  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">글쓰기</h1>
      
      <div className="space-y-4">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="question">질문</SelectItem>
            <SelectItem value="review">후기</SelectItem>
            <SelectItem value="info">정보</SelectItem>
            {/* notice는 admin만 (서버에서 권한 체크) */}
          </SelectContent>
        </Select>
        
        <Input
          placeholder="제목을 입력하세요"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={300}
        />
        
        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={v => setContent(v || '')}
            height={500}
            preview="edit"
            // 이미지 업로드는 별도 onPaste 핸들러 또는 커스텀 툴바
          />
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => navigate('/community')}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '저장 중...' : '등록'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### CommunityPostDetail.tsx (신규)

```typescript
// src/pages/CommunityPostDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/community';
import { cn } from '@/lib/utils';

interface PostDetail {
  id: number;
  category: string;
  title: string;
  content: string;
  author: { id: number; display_name: string; avatar_url: string };
  view_count: number;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
  created_at: string;
}

interface Comment {
  id: number;
  parent_id: number | null;
  author: { id: number; display_name: string; avatar_url: string };
  content: string;
  like_count: number;
  created_at: string;
  is_deleted: boolean;
}

export default function CommunityPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  
  useEffect(() => {
    fetch(`/api/community/posts/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(setPost);
    
    fetch(`/api/community/posts/${id}/comments`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setComments(d.comments));
  }, [id]);
  
  const handleLike = async () => {
    if (!user) return navigate('/login');
    await fetch(`/api/community/posts/${id}/like`, {
      method: 'POST', credentials: 'include',
    });
    setPost(p => p ? {
      ...p,
      liked_by_me: !p.liked_by_me,
      like_count: p.like_count + (p.liked_by_me ? -1 : 1),
    } : p);
  };
  
  const handleBookmark = async () => {
    if (!user) return navigate('/login');
    await fetch(`/api/community/posts/${id}/bookmark`, {
      method: 'POST', credentials: 'include',
    });
    setPost(p => p ? { ...p, bookmarked_by_me: !p.bookmarked_by_me } : p);
  };
  
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    if (!user) return navigate('/login');
    
    const res = await fetch(`/api/community/posts/${id}/comments`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment, parent_id: replyTo }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments([...comments, data.comment]);
      setNewComment('');
      setReplyTo(null);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch(`/api/community/posts/${id}`, {
      method: 'DELETE', credentials: 'include',
    });
    navigate('/community');
  };
  
  if (!post) return <div>로딩 중...</div>;
  
  const isAuthor = user?.id === post.author.id;
  const isAdmin = user?.role === 'admin';
  
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-4xl py-8">
        {/* 게시글 헤더 */}
        <div className="mb-6">
          <span className={cn('font-bold', CATEGORY_COLORS[post.category as keyof typeof CATEGORY_COLORS])}>
            [{CATEGORY_LABELS[post.category as keyof typeof CATEGORY_LABELS]}]
          </span>
          <h1 className="text-3xl font-bold mt-2">{post.title}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{post.author.display_name}</span>
            <span>{new Date(post.created_at).toLocaleString('ko-KR')}</span>
            <span>조회 {post.view_count}</span>
          </div>
        </div>
        
        {/* 본문 (마크다운 렌더링) */}
        <div data-color-mode="light" className="mb-8">
          <MarkdownPreview source={post.content} />
        </div>
        
        {/* 액션 버튼 */}
        <div className="flex gap-2 mb-8">
          <Button variant={post.liked_by_me ? 'default' : 'outline'} onClick={handleLike}>
            👍 {post.like_count}
          </Button>
          <Button variant={post.bookmarked_by_me ? 'default' : 'outline'} onClick={handleBookmark}>
            🔖 북마크
          </Button>
          {(isAuthor || isAdmin) && (
            <>
              {isAuthor && (
                <Button variant="outline" onClick={() => navigate(`/community/${id}/edit`)}>
                  수정
                </Button>
              )}
              <Button variant="destructive" onClick={handleDelete}>
                삭제
              </Button>
            </>
          )}
        </div>
        
        {/* 댓글 */}
        <section>
          <h2 className="text-xl font-bold mb-4">댓글 {post.comment_count}</h2>
          
          {/* 댓글 목록 (2-depth) */}
          <div className="space-y-4 mb-6">
            {comments.filter(c => !c.parent_id).map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                replies={comments.filter(r => r.parent_id === comment.id)}
                onReply={() => setReplyTo(comment.id)}
              />
            ))}
          </div>
          
          {/* 댓글 작성 */}
          {user ? (
            <div className="border rounded-lg p-4">
              {replyTo && (
                <div className="text-sm text-muted-foreground mb-2">
                  답글 작성 중 <button onClick={() => setReplyTo(null)} className="underline">취소</button>
                </div>
              )}
              <textarea
                className="w-full p-2 border rounded"
                rows={3}
                placeholder="댓글을 작성하세요"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
              />
              <Button onClick={handleCommentSubmit} className="mt-2">
                작성
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg p-4 text-center text-muted-foreground">
              <a href={`/login?redirect=/community/${id}`} className="underline">로그인</a> 후 댓글 작성 가능합니다
            </div>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}

function CommentItem({ comment, replies, onReply }: any) {
  return (
    <div className="border-l-2 pl-4">
      <div className="flex items-center gap-2">
        <strong>{comment.author.display_name}</strong>
        <span className="text-xs text-muted-foreground">
          {new Date(comment.created_at).toLocaleString('ko-KR')}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">
        {comment.is_deleted ? <em className="text-muted-foreground">삭제된 댓글입니다</em> : comment.content}
      </p>
      {!comment.is_deleted && (
        <button onClick={onReply} className="text-sm text-muted-foreground mt-1">
          답글
        </button>
      )}
      {/* 대댓글 */}
      {replies.length > 0 && (
        <div className="mt-3 ml-4 space-y-3">
          {replies.map((reply: any) => (
            <div key={reply.id} className="border-l-2 pl-4">
              <div className="flex items-center gap-2">
                <strong className="text-sm">{reply.author.display_name}</strong>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <p className="text-sm mt-1">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### CoffeeChats.tsx (신규, 간략)

```typescript
// src/pages/CoffeeChats.tsx
// - 목록: GET /api/coffee-chats?status=open
// - 카드: 제목, 일시, 장소, 참가자 수 (X/max), 주최자
// - 상세 모달 또는 별도 페이지 /coffee-chats/:id
// - 참가 버튼 → POST /api/coffee-chats/:id/join
// - 생성 버튼 → 로그인 필요, 폼: 제목/설명/일시/장소/인원
```

### Residents 관리 페이지 (신규, 간략)

```typescript
// src/pages/ResidentMe.tsx (/residents/me)
// - RequireAuth
// - GET /api/residents/me (있으면 수정, 없으면 신규)
// - 폼: 닉네임, 연령대, 체류타입, 지역, 기간(from/to), 자기소개, 공개여부
// - POST or PATCH /api/residents
```

## 시드 데이터 (scripts/seed_community.ts)

기존 358줄의 하드코딩 posts 배열 32개를 **그대로 시드로 활용**:

```typescript
// server/scripts/seed_community.ts
// Jeff 계정 (admin) 찾기 → 공지는 Jeff로, 나머지는 더미 사용자 생성 후 작성

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

async function seed() {
  // 1. Admin 찾기
  const [admin] = await query(`SELECT id FROM users WHERE email = $1`, [ADMIN_EMAIL]);
  if (!admin) throw new Error('Admin 계정 없음. 먼저 OAuth 로그인하세요.');
  
  // 2. 더미 사용자 생성 (이메일은 @seed.local)
  const dummyUsers = [
    { email: 'danang3@seed.local', display_name: '다낭3년차' },
    { email: 'kim@seed.local', display_name: '김수현' },
    { email: 'workmom@seed.local', display_name: '워킹맘' },
    { email: 'devkim@seed.local', display_name: '개발자김' },
    { email: 'retire@seed.local', display_name: '박은퇴' },
    // ... 기존 author 목록
  ];
  
  // 3. 32개 게시글 INSERT (기존 358줄의 posts 배열 그대로)
  //    - [공지] 4건 → admin_id, is_pinned=TRUE
  //    - 나머지 → 각 더미 author_id
  //    - content는 title을 확장한 더미 본문 또는 title만
  
  // 4. Residents 5건 (기존 residents 배열)
  // 5. Coffee chat 1건 (5/3 토, 14:00)
}
```

실행:
```bash
npm run seed:community
```

## 필수 npm 패키지 (server/) — 검증된 부품들

직접 개발 리스크 완화를 위해 검증된 라이브러리 조합 사용:

```json
{
  "dependencies": {
    "sharp": "^0.33.0",                    // 이미지 리사이즈 + WebP (수천만 다운로드)
    "marked": "^14.0.0",                   // 마크다운 → HTML (표준)
    "isomorphic-dompurify": "^2.0.0",      // XSS 방지 (필수)
    "multer": "^1.4.5-lts.1",              // 파일 업로드 multipart 처리
    "express-rate-limit": "^7.4.0",        // 도배/스팸 방지
    "slugify": "^1.6.6"                    // URL 슬러그 (선택)
  },
  "devDependencies": {
    "@types/multer": "^1.4.12"
  }
}
```

⚠️ **R2/S3/AWS 관련 라이브러리 사용 금지**. 이미지는 서버 로컬 저장.

## 필수 npm 패키지 (프론트)
```json
{
  "dependencies": {
    "@uiw/react-md-editor": "^4.0.0",
    "@uiw/react-markdown-preview": "^5.0.0"
  }
}
```

## .env 추가
```bash
# 업로드 저장소 (서버 로컬)
UPLOAD_ROOT=/var/www/luckydanang-uploads
UPLOAD_PUBLIC_BASE=https://luckydanang.com/uploads
UPLOAD_MAX_SIZE_MB=5
UPLOAD_ALLOWED_MIMES=image/jpeg,image/png,image/webp,image/gif
```

## 서버 사전 준비 (배포 1회)

```bash
# 1. 업로드 디렉토리 생성
sudo mkdir -p /var/www/luckydanang-uploads/community
sudo mkdir -p /var/www/luckydanang-uploads/listings
sudo chown -R www-data:www-data /var/www/luckydanang-uploads
sudo chmod 755 /var/www/luckydanang-uploads

# Node 프로세스가 쓸 수 있도록 권한 조정 (PM2 실행 사용자 확인 후)
# 예: pm2 ls 에서 사용자가 root면 root:www-data 로 설정
sudo chown -R $USER:www-data /var/www/luckydanang-uploads
sudo chmod -R 775 /var/www/luckydanang-uploads
```

## Nginx 정적 서빙 설정

`/etc/nginx/sites-available/luckydanang.com` 에 추가:

```nginx
location /uploads/ {
    alias /var/www/luckydanang-uploads/;
    
    # 캐시 (30일)
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    # 보안
    add_header X-Content-Type-Options "nosniff";
    
    # 이미지만 허용
    location ~* \.(jpg|jpeg|png|webp|gif)$ {
        try_files $uri =404;
    }
    
    # 기타 파일 접근 차단 (보안)
    location ~ \.(php|js|html|sh|exe)$ {
        deny all;
        return 403;
    }
}

# 직접 접근 차단 (폴더 리스팅 방지)
location = /uploads/ {
    return 403;
}
location = /uploads/community/ {
    return 403;
}
```

적용:
```bash
sudo nginx -t && sudo systemctl reload nginx

# 테스트
curl -I https://luckydanang.com/uploads/
# → 403 (폴더 리스팅 차단됨)
```

## 월별 폴더 자동 생성 + 업로드 로직

```typescript
// server/src/services/upload.ts
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import crypto from 'crypto';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || '/var/www/luckydanang-uploads';
const PUBLIC_BASE = process.env.UPLOAD_PUBLIC_BASE || 'https://luckydanang.com/uploads';

interface SaveImageResult {
  url: string;           // 공개 URL
  relative_path: string; // DB 저장용 (community/2026-04/abc.webp)
  absolute_path: string; // 실제 파일 경로
  width: number;
  height: number;
  size_bytes: number;
}

export async function saveImage(
  buffer: Buffer,
  category: 'community' | 'listings' | 'profiles',
  originalName?: string
): Promise<SaveImageResult> {
  // 1. 월별 폴더 (YYYY-MM)
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDir = path.join(UPLOAD_ROOT, category, yearMonth);
  
  // 2. 폴더 없으면 생성 (recursive)
  await fs.mkdir(monthDir, { recursive: true });
  
  // 3. 파일명: UUID + webp (원본 파일명 사용 안함)
  const uuid = crypto.randomBytes(16).toString('hex');
  const filename = `${uuid}.webp`;
  const absolutePath = path.join(monthDir, filename);
  const relativePath = `${category}/${yearMonth}/${filename}`;
  const publicUrl = `${PUBLIC_BASE}/${relativePath}`;
  
  // 4. sharp로 리사이즈 + WebP 변환 + EXIF 제거
  const processed = await sharp(buffer)
    .rotate()                        // EXIF 기반 자동 회전
    .resize({ 
      width: 1920, 
      height: 1920, 
      fit: 'inside', 
      withoutEnlargement: true 
    })
    .webp({ quality: 85 })
    .withMetadata({                  // EXIF 제거 (개인정보 유출 방지)
      orientation: undefined,
    })
    .toBuffer({ resolveWithObject: true });
  
  // 5. 파일 저장
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

export async function deleteImage(relativePath: string): Promise<void> {
  const absolutePath = path.join(UPLOAD_ROOT, relativePath);
  try {
    await fs.unlink(absolutePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
    // 파일이 이미 없으면 무시
  }
}
```

## DB 컬럼 수정 (community_images)

```diff
  CREATE TABLE community_images (
    id SERIAL PRIMARY KEY,
    uploader_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INT REFERENCES community_posts(id) ON DELETE SET NULL,
    url VARCHAR(1000) NOT NULL,
-   r2_key VARCHAR(500) NOT NULL,
+   relative_path VARCHAR(500) NOT NULL,  -- community/2026-04/abc.webp
    file_size_bytes INT,
    mime_type VARCHAR(50),
    width INT,
    height INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
```

## API 엔드포인트 (업로드)

```typescript
// server/src/routes/community-upload.ts
import { Router } from 'express';
import multer from 'multer';
import { saveImage } from '../services/upload';
import { requireAuth } from '../auth/middleware';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();

// multer: 메모리에 버퍼로 받고, sharp로 처리 후 저장
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다'));
  },
});

router.post('/community/upload',
  requireAuth,
  rateLimit({ windowMs: 60000, max: 10 }),     // 분당 10장
  rateLimit({ windowMs: 86400000, max: 50 }),  // 일당 50장
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    
    try {
      // 이미지 저장 + sharp 처리
      const result = await saveImage(
        req.file.buffer,
        'community',
        req.file.originalname
      );
      
      // DB INSERT
      const [row] = await query(`
        INSERT INTO community_images 
          (uploader_id, url, relative_path, file_size_bytes, mime_type, width, height)
        VALUES ($1, $2, $3, $4, 'image/webp', $5, $6)
        RETURNING id, url, width, height
      `, [req.user!.id, result.url, result.relative_path, result.size_bytes, result.width, result.height]);
      
      res.json({
        id: row.id,
        url: row.url,
        width: row.width,
        height: row.height,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ error: '업로드 실패', detail: err.message });
    }
  }
);

export default router;
```

## Orphan Cleanup 수정 (파일 경로)

```typescript
// server/src/cron/cleanup-orphan-images.ts
import { query } from '../db';
import { deleteImage } from '../services/upload';

export async function cleanupOrphanImages() {
  // 24시간 전 업로드 + post_id=NULL 이미지
  const orphans = await query<{ id: number; relative_path: string }>(`
    SELECT id, relative_path FROM community_images 
    WHERE post_id IS NULL 
      AND created_at < NOW() - INTERVAL '24 hours'
    LIMIT 200
  `);
  
  let deleted = 0;
  for (const img of orphans) {
    try {
      await deleteImage(img.relative_path);
      await query('DELETE FROM community_images WHERE id = $1', [img.id]);
      deleted++;
    } catch (err) {
      console.error(`[cleanup] Failed for id=${img.id}:`, err);
    }
  }
  
  console.log(`[cleanup] ${deleted}/${orphans.length} orphan images removed`);
  return { scanned: orphans.length, deleted };
}
```

package.json:
```json
{
  "scripts": {
    "cleanup:images": "tsx src/cron/cleanup-orphan-images.ts"
  }
}
```

Crontab 등록 (매일 새벽 4시):
```bash
crontab -e
# 추가:
0 4 * * * cd /var/www/luckydanang/server && /usr/bin/npm run cleanup:images >> /var/log/luckydanang-cleanup.log 2>&1
```

## 디스크 모니터링 (선택, 권장)

월별 용량 확인 명령어:
```bash
# 각 월별 용량
du -sh /var/www/luckydanang-uploads/community/*/

# 전체 용량
du -sh /var/www/luckydanang-uploads/

# 파일 개수
find /var/www/luckydanang-uploads/community -type f | wc -l
```

용량 경고 cron (일당 1회):
```bash
# /etc/cron.daily/check-upload-disk
#!/bin/bash
USAGE=$(du -sb /var/www/luckydanang-uploads | cut -f1)
LIMIT=$((50 * 1024 * 1024 * 1024))  # 50GB

if [ $USAGE -gt $LIMIT ]; then
    echo "WARNING: luckydanang uploads exceeded 50GB ($USAGE bytes)" |     mail -s "Disk usage alert" jeff@example.com
fi
```

## 라우트 등록 (src/App.tsx)
```diff
+ import CommunityPostDetail from './pages/CommunityPostDetail';
+ import CommunityWrite from './pages/CommunityWrite';
+ import CommunityEdit from './pages/CommunityEdit';
+ import CoffeeChats from './pages/CoffeeChats';
+ import ResidentMe from './pages/ResidentMe';

  <Routes>
    <Route path="/community" element={<Community />} />
+   <Route path="/community/write" element={<CommunityWrite />} />
+   <Route path="/community/:id" element={<CommunityPostDetail />} />
+   <Route path="/community/:id/edit" element={<CommunityEdit />} />
+   <Route path="/coffee-chats" element={<CoffeeChats />} />
+   <Route path="/residents/me" element={<ResidentMe />} />
  </Routes>
```

## Rate Limiting

```typescript
// server/src/middleware/rate-limit.ts
// - 글쓰기: 분당 5개, 일당 20개 (user_id 기준)
// - 댓글: 분당 10개, 일당 100개
// - 이미지 업로드: 분당 10개, 일당 50개
// - 좋아요: 분당 30개 (도배 방지)

// 구현: 간단한 메모리 Map 또는 Redis
// 시작은 메모리 Map으로 충분, 프로덕션 트래픽 커지면 Redis
```

## 스팸/악용 방지

1. **Cloudflare Turnstile** (글쓰기 폼에 선택적)
2. **Rate Limit** (위 참조)
3. **금칙어 필터** (선택, Phase 2)
4. **신고 기능** (community_reports 테이블)
5. **Admin 삭제 권한**

## 권한 체크

```typescript
// server/src/middleware/community.ts

// 글 수정/삭제: 본인 또는 admin
async function canModifyPost(req, res, next) {
  const post = await getPost(req.params.id);
  if (post.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.post = post;
  next();
}

// 공지 작성: admin만
function requireAdminForNotice(req, res, next) {
  if (req.body.category === 'notice' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '공지는 관리자만 작성 가능합니다' });
  }
  next();
}
```

## 🔒 보안 필수 체크리스트 (PR 리뷰 항목)

직접 개발 리스크 완화를 위해 아래 항목 모두 체크:

### XSS/Injection 방지
- [ ] 모든 SQL 쿼리 parameterized ($1, $2 방식, 문자열 조합 금지)
- [ ] 사용자 HTML 입력에 isomorphic-dompurify 적용 (content_html 저장 전)
- [ ] marked로 마크다운 렌더링 후 반드시 DOMPurify.sanitize
- [ ] DOMPurify 설정: `{ ALLOWED_TAGS: [...safe list], ALLOWED_ATTR: [...] }`
- [ ] `<script>`, `<iframe>`, `onerror=`, `javascript:` 차단 확인

### 파일 업로드 보안
- [ ] multer fileFilter로 mime 타입 검증 (jpeg/png/webp/gif만)
- [ ] sharp로 실제 이미지 여부 검증 (악성 파일이면 sharp 에러)
- [ ] 파일명은 crypto.randomBytes UUID (사용자 입력 파일명 사용 금지)
- [ ] sharp로 EXIF 메타데이터 제거 (위치/카메라 정보 유출 방지)
- [ ] multer limits.fileSize = 5MB (이중 검증)
- [ ] Nginx location에서 `.php`, `.js`, `.html`, `.sh`, `.exe` 차단
- [ ] 업로드 폴더에 실행 권한 없음 (chmod 755, 644)

### Rate Limiting
- [ ] 글쓰기: user당 분당 5, 일당 20
- [ ] 댓글: user당 분당 10, 일당 100
- [ ] 이미지 업로드: user당 분당 10, 일당 50
- [ ] 좋아요: user당 분당 30
- [ ] 로그인 시도: IP당 분당 10

### 인증/세션
- [ ] 세션 쿠키: httpOnly + secure + sameSite=lax
- [ ] 모든 쓰기 엔드포인트 requireAuth 적용
- [ ] 본인 글 수정/삭제만 가능 (author_id 검증)
- [ ] 공지 작성은 admin role만 (서버 검증)

### 월별 폴더 확인
- [ ] `/var/www/luckydanang-uploads/community/2026-04/` 형식으로 자동 생성
- [ ] 월 경계일에 새 폴더 생성되는지 테스트 (날짜 강제 변경 후)
- [ ] 과거 폴더에는 쓰기 안 되는지 확인

## DoD (12개)

### Backend
- [ ] migrations/005_community.sql 무에러 실행 (9개 테이블 + 3개 ENUM + 트리거)
- [ ] /api/community/posts CRUD 동작 (카테고리 필터 + 페이지네이션)
- [ ] /api/community/posts/:id/comments CRUD + 2-depth 대댓글
- [ ] /api/community/posts/:id/like 토글 + 카운트 자동 갱신
- [ ] /api/community/upload 로컬 저장 + sharp 리사이즈 + EXIF 제거
- [ ] 월별 폴더 자동 생성 확인 (community/YYYY-MM/)
- [ ] Nginx /uploads/ 경로 정적 서빙 동작
- [ ] /api/coffee-chats CRUD + 참가 신청
- [ ] /api/residents CRUD (본인 1개 제약)
- [ ] Admin 전용 엔드포인트 권한 체크
- [ ] Rate limit 동작
- [ ] Orphan 이미지 cleanup cron 등록

### Frontend
- [ ] Community.tsx 재작성 (기존 디자인 유지 + API 연동)
- [ ] CommunityWrite.tsx 마크다운 에디터 + 이미지 업로드
- [ ] CommunityPostDetail.tsx 본문 + 댓글 + 좋아요/북마크
- [ ] CoffeeChats.tsx 목록 + 참가
- [ ] ResidentMe.tsx 체류자 등록/수정
- [ ] Navbar에 커뮤니티 링크 유지 (기존 있음)
- [ ] 시드 데이터 32건 INSERT

### 검증
- [ ] 비로그인에서 글쓰기 클릭 → /login?redirect=... 이동
- [ ] 로그인 후 글 작성 → 상세 페이지 이동
- [ ] 이미지 붙여넣기 → R2 업로드 → 마크다운 ![] 삽입
- [ ] 댓글 작성 → comment_count 자동 증가
- [ ] 좋아요 토글 → like_count 자동 갱신
- [ ] 본인 글 수정/삭제 권한 확인 (타인 글 불가)
- [ ] admin 계정으로 공지 작성 가능
- [ ] 일반 사용자 공지 작성 차단
- [ ] 체류자 등록 후 사이드바에 "N명 체류 중" 카운트 반영
- [ ] 커피챗 생성 → 사이드바 카드 노출
