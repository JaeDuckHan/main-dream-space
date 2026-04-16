export const CATEGORY_LABELS = {
  notice: "공지",
  question: "질문",
  review: "후기",
  info: "정보",
} as const;

export const CATEGORY_COLORS = {
  notice: "text-red-600",
  question: "text-blue-600",
  review: "text-green-600",
  info: "text-gray-500",
} as const;

export const STAY_TYPE_LABELS = {
  monthly_stay: "한달살기",
  long_term: "장기체류",
  retirement: "은퇴",
  workation: "워케이션",
} as const;

export type CategoryEn = keyof typeof CATEGORY_LABELS;
export type StayType = keyof typeof STAY_TYPE_LABELS;

export interface CommunityPostListItem {
  id: number;
  category: CategoryEn;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
  thumbnail_url?: string | null;
  author: {
    id: number;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface CommunityPostDetail extends CommunityPostListItem {
  content: string;
  content_html: string;
  updated_at: string;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  like_count: number;
  liked_by_me: boolean;
  author: {
    id: number;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface CommunityResident {
  id: number;
  nickname: string;
  age_group: string | null;
  stay_type: StayType;
  area: string | null;
  stay_from: string;
  stay_to: string | null;
  bio?: string | null;
  bio_summary?: string | null;
  interests?: string[];
  contact_method?: "coffee_chat" | "post_only" | "none";
  display_avatar?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  avatar_url?: string | null;
  use_custom_avatar?: boolean;
}

export interface ResidentListResponse {
  total: number;
  active_count: number;
  residents: CommunityResident[];
}

export interface ResidentDetailResponse {
  resident: CommunityResident & {
    created_at: string;
    updated_at: string;
  };
  stats: {
    post_count: number;
    comment_count: number;
    coffee_chats_organized: number;
    coffee_chats_joined: number;
  };
  recent_posts: Array<{
    id: number;
    category: CategoryEn;
    title: string;
    created_at: string;
  }>;
  recent_coffee_chats: Array<{
    id: number;
    title: string;
    meetup_at: string;
    status: "open" | "full" | "cancelled" | "completed";
  }>;
}

export interface CoffeeChat {
  id: number;
  title: string;
  description: string | null;
  meetup_at: string;
  duration_minutes: number;
  location_name: string | null;
  location_detail: string | null;
  location_map_url: string | null;
  max_participants: number;
  current_participants: number;
  status: "open" | "full" | "cancelled" | "completed";
  organizer_id: number;
  organizer_display_name?: string;
  joined_by_me?: boolean;
}

export async function communityFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "요청 처리에 실패했습니다.");
  }

  return data as T;
}

export function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / 3_600_000);

  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return new Date(value)
    .toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
    .replace(/\./g, "/")
    .replace(/\s/g, "");
}
