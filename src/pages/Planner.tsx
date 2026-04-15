import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePlannerChecklist } from "@/hooks/use-planner-checklist";
import { getSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";
import { format, differenceInDays, differenceInWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, ExternalLink } from "lucide-react";

const STORAGE_KEY = "luckydanang_planner";

/* ── types ── */
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  completedAt?: string;
  link?: { text: string; href: string };
  group: string;
  description?: string | null;
  actionType?: "external" | "internal" | "none";
  actionUrl?: string | null;
  actionLabel?: string | null;
  affiliatePartner?: "agoda" | "booking" | "tripcom" | "skyscanner" | "none";
  isRemote?: boolean;
  remoteId?: number;
}

interface Housing {
  id: string;
  name: string;
  rent: string;
  location: string;
  pros: string;
  cons: string;
  link: string;
  primary: boolean;
}

interface BudgetRow {
  key: string;
  label: string;
  budget: number;
  actual: string;
}

interface PlannerData {
  city: string;
  startDate: string;
  endDate: string;
  party: string;
  budget: number;
  budgetActuals: Record<string, string>;
  checklist: Record<string, boolean>;
  customItems: { id: string; label: string; group: string }[];
  housing: Housing[];
  notes: Record<string, string>;
}

const cities = ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥"];
const parties = ["혼자", "커플", "가족", "친구"];

/* ── Recommendation Data ── */
interface Recommendation {
  neighborhood: string;
  neighborhoodDesc: string;
  budget: { 숙소: number; 식비: number; 이동: number; 기타: number };
  accommodation: string;
  tips: string[];
  luckyComment: string;
}

const recommendations: Record<string, Record<string, Recommendation>> = {
  다낭: {
    혼자: {
      neighborhood: "미케비치",
      neighborhoodDesc: "카페와 한인 업체가 집중돼 있어요",
      budget: { 숙소: 55, 식비: 40, 이동: 12, 기타: 13 },
      accommodation: "미케비치 서비스 아파트 (월 50~70만원, 가구 완비)",
      tips: [
        "2~5월이 최적 시기예요. 9~12월은 우기 주의",
        "그랩 앱 미리 설치하면 공항부터 바로 사용 가능해요",
        "한인 오픈채팅방 먼저 가입하면 정착이 훨씬 빨라져요",
      ],
      luckyComment: "혼자 첫 한달살기라면 다낭이 정답이에요. 한인이 많아서 전혀 외롭지 않거든요 ☀️",
    },
    가족: {
      neighborhood: "미케비치",
      neighborhoodDesc: "아이들 해변 놀기 좋고, 한식당도 가까워요",
      budget: { 숙소: 80, 식비: 60, 이동: 15, 기타: 25 },
      accommodation: "2베드룸 서비스 아파트 (월 80~120만원)",
      tips: [
        "니콜라스 국제학교 등 영어캠프 병행 가능해요",
        "그랩 카 (택시형) 이용하면 유모차도 OK",
        "한인 가족 모임이 주간으로 있어요",
      ],
      luckyComment: "가족 첫 해외살기로 다낭이 제일 안전해요. 한인 엄마들 네트워크가 탄탄하거든요 🏖️",
    },
    커플: {
      neighborhood: "미케비치",
      neighborhoodDesc: "저녁 산책, 카페, 레스토랑 모두 걸어서 가능해요",
      budget: { 숙소: 70, 식비: 55, 이동: 14, 기타: 20 },
      accommodation: "오션뷰 서비스 아파트 (월 70~100만원)",
      tips: [
        "주말 한강 불꽃쇼 꼭 보세요",
        "호이안 당일치기 필수 (그랩 40분)",
        "2인 외식 예산 하루 3~5만원이면 충분해요",
      ],
      luckyComment: "커플 한달살기로 다낭만한 곳 없어요. 낭만+실속 둘 다 잡을 수 있거든요 🌙",
    },
    친구: {
      neighborhood: "미케비치",
      neighborhoodDesc: "바, 클럽, 해변이 모두 가까워요",
      budget: { 숙소: 60, 식비: 50, 이동: 13, 기타: 17 },
      accommodation: "2인실 에어비앤비 (1인당 월 30~50만원)",
      tips: [
        "안트엉 지역 바 거리에서 밤문화 즐기기 좋아요",
        "바나힐 당일치기 추천 (2인 이상이면 가성비 좋아요)",
        "같이 요리하면 식비 절약 가능해요",
      ],
      luckyComment: "친구랑 다낭 한달살기? 매일이 여행이에요. 해변에서 맥주 한 잔이면 끝 🍻",
    },
  },
  호치민: {
    혼자: {
      neighborhood: "빈탄 / 3군",
      neighborhoodDesc: "카페, 루프탑바, 한인 업체 집중",
      budget: { 숙소: 70, 식비: 55, 이동: 15, 기타: 22 },
      accommodation: "빈탄구 원룸 (월 60~90만원)",
      tips: [
        "오토바이 교통이 복잡해요. 그랩 필수",
        "한인타운(7군)까지 그랩 20분",
        "한인 노마드 커뮤니티 활발해요",
      ],
      luckyComment: "인프라는 베트남 최고예요. 다만 처음엔 교통에 적응 시간이 좀 필요해요 🏙️",
    },
    가족: {
      neighborhood: "7군 / 푸미흥",
      neighborhoodDesc: "한인타운, 한국 학교, 한식당 밀집",
      budget: { 숙소: 100, 식비: 70, 이동: 18, 기타: 30 },
      accommodation: "2베드룸 아파트 (월 100~150만원)",
      tips: [
        "7군 한인학교에서 단기 수업 가능 문의",
        "한인 병원 접근성이 가장 좋아요",
        "대형 마트(롯데마트, 이마트) 이용 편리해요",
      ],
      luckyComment: "한인 인프라 최고! 아이 교육까지 고려한다면 호치민이 답이에요 🏫",
    },
    커플: {
      neighborhood: "빈탄 / 1군",
      neighborhoodDesc: "루프탑바, 레스토랑, 문화생활 풍부",
      budget: { 숙소: 85, 식비: 60, 이동: 16, 기타: 25 },
      accommodation: "시티뷰 아파트 (월 80~120만원)",
      tips: [
        "1군 중심가에서 다양한 레스토랑 즐기기",
        "무이네, 달랏 주말 여행 추천",
        "쿠치터널 등 역사 탐방도 좋아요",
      ],
      luckyComment: "도시의 활기와 맛집 탐방을 좋아하는 커플에게 딱이에요 🌃",
    },
    친구: {
      neighborhood: "빈탄 / 1군",
      neighborhoodDesc: "나이트라이프와 맛집이 풍부해요",
      budget: { 숙소: 65, 식비: 55, 이동: 15, 기타: 22 },
      accommodation: "2인실 게스트하우스 (1인당 월 30~50만원)",
      tips: [
        "부이비엔 거리 나이트라이프 최고",
        "로컬 맛집 투어 강추",
        "그랩바이크 이용하면 교통비 절약 가능",
      ],
      luckyComment: "친구랑 호치민이면 먹고 마시고 놀기 최적이에요 🍜",
    },
  },
  하노이: {
    혼자: {
      neighborhood: "호안끼엠 / 떠이호",
      neighborhoodDesc: "구시가지 감성, 카페 문화 발달",
      budget: { 숙소: 60, 식비: 45, 이동: 13, 기타: 18 },
      accommodation: "떠이호 근처 원룸 (월 50~80만원)",
      tips: [
        "10~3월은 꽤 쌀쌀해요. 외투 챙기세요",
        "구시가지 카페에서 에그커피 꼭 드세요",
        "하노이 한인 모임이 정기적으로 있어요",
      ],
      luckyComment: "하노이의 레트로 감성은 진짜 독보적이에요. 카페 노마드에게 추천 ☕",
    },
    가족: {
      neighborhood: "떠이호",
      neighborhoodDesc: "외국인 가족 많고, 국제학교 접근 좋아요",
      budget: { 숙소: 90, 식비: 60, 이동: 15, 기타: 25 },
      accommodation: "2베드룸 서비스 아파트 (월 90~130만원)",
      tips: [
        "떠이호 주변 국제학교 단기 등록 가능",
        "하노이 한인 가족 모임 활발해요",
        "겨울(11~2월) 난방 확인 필수",
      ],
      luckyComment: "문화 체험과 교육을 중시하는 가족에게 하노이 추천해요 🏛️",
    },
    커플: {
      neighborhood: "호안끼엠",
      neighborhoodDesc: "구시가지 데이트 코스가 풍부해요",
      budget: { 숙소: 70, 식비: 50, 이동: 14, 기타: 20 },
      accommodation: "구시가지 인근 아파트 (월 60~90만원)",
      tips: [
        "주말 호안끼엠 호수 보행자 거리 산책 필수",
        "하롱베이 1박2일 추천",
        "분짜, 쌀국수 맛집 투어 즐기세요",
      ],
      luckyComment: "낭만적인 구시가지에서 커플 한달살기, 영화 같은 시간이 될 거예요 🎬",
    },
    친구: {
      neighborhood: "호안끼엠 / 구시가지",
      neighborhoodDesc: "맥주 거리, 로컬 맛집 밀집",
      budget: { 숙소: 55, 식비: 45, 이동: 13, 기타: 17 },
      accommodation: "게스트하우스 (1인당 월 25~40만원)",
      tips: [
        "타히엔 맥주거리에서 bia hoi 0.3만원!",
        "니빈, 사파 주말여행 추천",
        "로컬 길거리 음식이 가성비 최고",
      ],
      luckyComment: "하노이 맥주거리에서 친구랑 0.3만원짜리 맥주? 이게 진짜 한달살기죠 🍺",
    },
  },
  나트랑: {
    혼자: {
      neighborhood: "쩐푸 / 해변가",
      neighborhoodDesc: "조용한 해변, 저렴한 물가",
      budget: { 숙소: 45, 식비: 35, 이동: 10, 기타: 12 },
      accommodation: "해변가 원룸 (월 40~60만원)",
      tips: [
        "물가가 가장 저렴한 도시 중 하나예요",
        "러시아인 관광객이 많은 독특한 분위기",
        "빈펄랜드 케이블카 꼭 타보세요",
      ],
      luckyComment: "조용히 바다 보며 쉬고 싶다면 나트랑이에요. 물가도 착해요 🌊",
    },
    가족: {
      neighborhood: "쩐푸",
      neighborhoodDesc: "해변 리조트, 빈펄랜드 가까워요",
      budget: { 숙소: 65, 식비: 50, 이동: 12, 기타: 20 },
      accommodation: "가족형 리조트 (월 60~100만원)",
      tips: [
        "빈펄랜드 워터파크 아이들 최고",
        "해산물이 저렴하고 신선해요",
        "한인은 적지만 조용한 환경이 장점",
      ],
      luckyComment: "리조트 느낌으로 가족 휴식을 원한다면 나트랑 추천해요 🏝️",
    },
    커플: {
      neighborhood: "쩐푸 해변가",
      neighborhoodDesc: "로맨틱한 해변과 해산물 맛집",
      budget: { 숙소: 55, 식비: 42, 이동: 11, 기타: 15 },
      accommodation: "오션뷰 아파트 (월 50~80만원)",
      tips: [
        "해변 선셋이 정말 아름다워요",
        "근처 섬 투어(혼문 등) 강추",
        "머드바스 스파 데이트 추천",
      ],
      luckyComment: "해변 석양 아래 커플 한달살기, 나트랑이면 완벽해요 🌅",
    },
    친구: {
      neighborhood: "쩐푸",
      neighborhoodDesc: "해변 파티, 저렴한 해산물",
      budget: { 숙소: 40, 식비: 35, 이동: 10, 기타: 13 },
      accommodation: "게스트하우스 (1인당 월 20~35만원)",
      tips: [
        "세일링클럽 비치파티 유명해요",
        "해산물 BBQ가 정말 저렴해요",
        "스쿠버다이빙 자격증 따기 좋은 곳",
      ],
      luckyComment: "친구랑 바다+파티+해산물, 나트랑에서 전부 가능해요 🦐",
    },
  },
  푸꾸옥: {
    혼자: {
      neighborhood: "즈엉동 해변",
      neighborhoodDesc: "리조트 분위기의 섬, 힐링 최적",
      budget: { 숙소: 55, 식비: 40, 이동: 12, 기타: 15 },
      accommodation: "해변 게스트하우스 (월 50~70만원)",
      tips: [
        "오토바이 렌트가 이동에 편해요",
        "야시장 해산물이 유명해요",
        "한인은 적지만 힐링하기 좋아요",
      ],
      luckyComment: "도시에서 벗어나 섬에서 힐링하고 싶다면 푸꾸옥이에요 🏝️",
    },
    가족: {
      neighborhood: "즈엉동",
      neighborhoodDesc: "빈원더스, 사파리 등 가족 놀거리 풍부",
      budget: { 숙소: 80, 식비: 55, 이동: 14, 기타: 22 },
      accommodation: "가족형 리조트 빌라 (월 80~130만원)",
      tips: [
        "빈원더스 테마파크 아이들 최고",
        "빈펄 사파리도 가까워요",
        "리조트 내 키즈 프로그램 활용하세요",
      ],
      luckyComment: "가족 리조트 한달살기로 푸꾸옥은 꿈같은 곳이에요 🌴",
    },
    커플: {
      neighborhood: "즈엉동 해변",
      neighborhoodDesc: "로맨틱한 섬 분위기, 선셋 포인트 다수",
      budget: { 숙소: 70, 식비: 48, 이동: 13, 기타: 18 },
      accommodation: "해변 리조트 (월 70~110만원)",
      tips: [
        "선셋타운에서 키스 오브 더 시 꼭 보세요",
        "남섬 스노클링 투어 추천",
        "야시장 데이트 필수",
      ],
      luckyComment: "섬에서 커플 한달살기? 매일이 허니문이에요 💕",
    },
    친구: {
      neighborhood: "즈엉동",
      neighborhoodDesc: "해변 바, 스노클링, 야시장",
      budget: { 숙소: 50, 식비: 42, 이동: 12, 기타: 15 },
      accommodation: "게스트하우스 (1인당 월 25~40만원)",
      tips: [
        "오토바이로 섬 일주 강추",
        "후추 농장 방문 독특한 경험",
        "야시장 해산물 BBQ 가성비 최고",
      ],
      luckyComment: "친구랑 섬 탐험! 푸꾸옥은 모험 가득한 한달살기예요 🛵",
    },
  },
};

function getRecommendation(city: string, party: string): Recommendation {
  return recommendations[city]?.[party] || recommendations["다낭"]["혼자"];
}

/* ── City-specific Checklists ── */
const commonChecklist: Omit<ChecklistItem, "checked" | "completedAt">[] = [
  { id: "c1", label: "여권 유효기간 확인", group: "출발 2주 전" },
  { id: "c2", label: "e-visa 신청", group: "출발 2주 전", link: { text: "비자 대행 보기", href: "/directory" } },
  { id: "c3", label: "항공권 예약", group: "출발 2주 전" },
  { id: "c4", label: "첫 주 숙소 예약", group: "출발 2주 전", link: { text: "숙소 에이전트 보기", href: "/directory" } },
  { id: "c5", label: "여행자보험 가입", group: "출발 2주 전", link: { text: "보험 비교 보기", href: "/directory" } },
  { id: "c6", label: "환전 계획", group: "출발 2주 전" },
  { id: "c7", label: "그랩 앱 설치", group: "출발 전" },
  { id: "c8", label: "유심/eSIM 준비", group: "출발 전" },
  { id: "c9", label: "짐 싸기", group: "출발 전" },
  { id: "c10", label: "유심 구매", group: "도착 첫날" },
  { id: "c11", label: "숙소 이동", group: "도착 첫날" },
  { id: "c12", label: "주변 마트 확인", group: "도착 첫날" },
  { id: "c13", label: "커뮤니티 등록", group: "도착 첫날", link: { text: "등록하기", href: "/community" } },
];

const citySpecificChecklist: Record<string, Omit<ChecklistItem, "checked" | "completedAt">[]> = {
  다낭: [
    { id: "dn1", label: "한인 오픈채팅방 가입", group: "도착 첫날", link: { text: "링크", href: "/community" } },
    { id: "dn2", label: "미케비치 산책 루트 파악", group: "첫 주" },
    { id: "dn3", label: "가까운 한국 마트 위치 확인", group: "첫 주" },
  ],
  호치민: [
    { id: "hcm1", label: "그랩 카 vs 바이크 차이 파악", group: "출발 전" },
    { id: "hcm2", label: "7군 한인타운 위치 저장", group: "도착 첫날" },
  ],
  하노이: [
    { id: "hn1", label: "방한 의류 챙기기 (10~3월 방문 시)", group: "출발 전" },
    { id: "hn2", label: "호안끼엠 호수 주변 동선 파악", group: "첫 주" },
  ],
  나트랑: [
    { id: "nt1", label: "빈펄랜드 티켓 사전 구매 검토", group: "출발 전" },
    { id: "nt2", label: "쩐푸 해변가 숙소 동선 파악", group: "첫 주" },
  ],
  푸꾸옥: [
    { id: "pq1", label: "오토바이 렌트 업체 알아보기", group: "출발 전" },
    { id: "pq2", label: "즈엉동 야시장 위치 확인", group: "도착 첫날" },
  ],
};

function getChecklist(city: string): Omit<ChecklistItem, "checked" | "completedAt">[] {
  const cityItems = citySpecificChecklist[city] || [];
  return [...commonChecklist, ...cityItems];
}

/* ── City-specific Housing Recommendations ── */
interface HousingRecommendation {
  name: string;
  location: string;
  description: string;
  price: string;
  mapUrl?: string;
}

const cityHousingRecs: Record<string, HousingRecommendation[]> = {
  다낭: [
    { name: "Altara Suites by Ri-Yaz", location: "미케비치", description: "장기체류 추천", price: "약 6~12만원/박", mapUrl: "https://www.google.com/maps/search/?api=1&query=Altara%20Suites%20Da%20Nang" },
    { name: "Monarque Hotel Danang", location: "미케비치", description: "해변 접근성 좋음", price: "약 5~10만원/박", mapUrl: "https://www.google.com/maps/search/?api=1&query=Monarque%20Hotel%20Danang" },
    { name: "Sanouva Danang Hotel", location: "하이쩌우", description: "저렴한 선택", price: "약 4~9만원/박", mapUrl: "https://www.google.com/maps/search/?api=1&query=Sanouva%20Danang%20Hotel" },
  ],
  호치민: [
    { name: "빈탄구 서비스 아파트", location: "빈탄", description: "노마드 인기 지역", price: "월 60~90만원" },
    { name: "7군 푸미흥 아파트", location: "7군", description: "한인타운, 가족 추천", price: "월 80~120만원" },
    { name: "1군 시티뷰 아파트", location: "1군", description: "도심 접근성 최고", price: "월 80~130만원" },
  ],
  하노이: [
    { name: "떠이호 레이크뷰 아파트", location: "떠이호", description: "외국인 선호 지역", price: "월 50~80만원" },
    { name: "호안끼엠 구시가지 원룸", location: "호안끼엠", description: "감성 카페 밀집", price: "월 45~70만원" },
    { name: "롱비엔 신도시 아파트", location: "롱비엔", description: "넓고 저렴한 선택", price: "월 40~65만원" },
  ],
  나트랑: [
    { name: "쩐푸 해변가 아파트", location: "쩐푸", description: "오션뷰 가성비", price: "월 40~60만원" },
    { name: "나트랑센터 원룸", location: "시내 중심", description: "생활 편의시설 근접", price: "월 35~55만원" },
    { name: "빈펄 근처 게스트하우스", location: "혼째 방면", description: "리조트 분위기", price: "월 45~70만원" },
  ],
  푸꾸옥: [
    { name: "즈엉동 해변 게스트하우스", location: "즈엉동", description: "메인 비치 접근", price: "월 50~70만원" },
    { name: "안터이 지역 빌라", location: "안터이", description: "조용한 힐링 지역", price: "월 60~90만원" },
    { name: "즈엉동 타운 아파트", location: "즈엉동", description: "야시장, 마트 가까움", price: "월 45~65만원" },
  ],
};

const defaultBudgetRows: BudgetRow[] = [
  { key: "housing", label: "숙소", budget: 50, actual: "" },
  { key: "flight", label: "항공", budget: 25, actual: "" },
  { key: "food", label: "식비", budget: 35, actual: "" },
  { key: "transport", label: "교통", budget: 11, actual: "" },
  { key: "leisure", label: "여가", budget: 21, actual: "" },
  { key: "insurance", label: "보험", budget: 8, actual: "" },
];

function loadData(): PlannerData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveData(data: PlannerData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("planner-updated"));
}

/* ── Creation Form ── */
const CreationForm = ({ onCreated }: { onCreated: (d: PlannerData) => void }) => {
  const [city, setCity] = useState("다낭");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [party, setParty] = useState("혼자");
  const [budget, setBudget] = useState("150");
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);

  const rec = getRecommendation(city, party);
  const budgetTotal = Object.values(rec.budget).reduce((a, b) => a + b, 0);
  const budgetItems = [
    { label: "숙소", amount: rec.budget.숙소, color: "hsl(214,100%,40%)" },
    { label: "식비", amount: rec.budget.식비, color: "hsl(214,80%,55%)" },
    { label: "이동", amount: rec.budget.이동, color: "hsl(214,60%,70%)" },
    { label: "기타", amount: rec.budget.기타, color: "hsl(214,40%,80%)" },
  ];

  const resultRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSubmit = () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowResult(true);
    }, 2000);
  };

  const handleSavePlan = () => {
    if (!startDate || !endDate) return;
    const data: PlannerData = {
      city,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      party,
      budget: parseInt(budget) || 150,
      budgetActuals: {},
      checklist: {},
      customItems: [],
      housing: [],
      notes: {},
    };
    saveData(data);
    onCreated(data);
  };

  const handleCopy = () => {
    const text = `🌴 내 ${city} 플랜\n도시: ${city} | 동행: ${party} | 예산: ${budget}만원\n\n추천 동네: ${rec.neighborhood}\n${rec.neighborhoodDesc}\n\n월 예산 분석:\n${budgetItems.map(i => `${i.label} ${i.amount}만원`).join(" / ")} = 총 ${budgetTotal}만원\n\n꼭 알아야 할 것:\n${rec.tips.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n💬 ${rec.luckyComment}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRetry = () => {
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-[600px] mx-auto py-12 px-4">
      <h1 className="text-[18px] font-bold text-foreground mb-8">한달살기 계획 만들기</h1>

      {/* City */}
      <div className="mb-6">
        <label className="block text-[14px] font-semibold text-foreground mb-2">도시</label>
        <div className="flex flex-wrap gap-2">
          {cities.map(c => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={cn(
                "px-4 py-2 text-[14px] rounded border transition-colors",
                city === c
                  ? "bg-[hsl(214,100%,40%)] text-white border-[hsl(214,100%,40%)]"
                  : "bg-white text-foreground border-[#EEE] hover:border-[#CCC]"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[14px] font-semibold text-foreground mb-2">시작일</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-[14px]", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "yyyy.MM.dd") : "날짜 선택"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="p-3 pointer-events-auto" locale={ko} />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="block text-[14px] font-semibold text-foreground mb-2">종료일</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-[14px]", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "yyyy.MM.dd") : "날짜 선택"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="p-3 pointer-events-auto" locale={ko} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Party */}
      <div className="mb-6">
        <label className="block text-[14px] font-semibold text-foreground mb-2">동행</label>
        <div className="flex flex-wrap gap-2">
          {parties.map(p => (
            <button
              key={p}
              onClick={() => setParty(p)}
              className={cn(
                "px-4 py-2 text-[14px] rounded border transition-colors",
                party === p
                  ? "bg-[hsl(214,100%,40%)] text-white border-[hsl(214,100%,40%)]"
                  : "bg-white text-foreground border-[#EEE] hover:border-[#CCC]"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="mb-8">
        <label className="block text-[14px] font-semibold text-foreground mb-2">월 예산 (만원)</label>
        <Input
          type="number"
          value={budget}
          onChange={e => setBudget(e.target.value)}
          className="w-[200px] text-[14px]"
          placeholder="150"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!startDate || !endDate || loading}
        className="w-full h-11 text-[15px] font-bold bg-[hsl(214,100%,40%)] hover:bg-[hsl(214,100%,35%)] text-white rounded"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            럭키가 플랜 짜는 중... 🌴
          </span>
        ) : (
          "계획 시작하기"
        )}
      </Button>

      {/* Result Card */}
      {showResult && (
        <div
          ref={resultRef}
          className="mt-8 bg-white rounded-[16px] shadow-lg p-6 animate-in slide-in-from-bottom-4 duration-500"
        >
          <h2 className="text-[20px] font-bold text-foreground mb-3">🌴 내 {city} 플랜</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-3 py-1 text-[13px] rounded-full bg-[hsl(0,0%,95%)] text-muted-foreground">{city}</span>
            <span className="px-3 py-1 text-[13px] rounded-full bg-[hsl(0,0%,95%)] text-muted-foreground">{party}</span>
            <span className="px-3 py-1 text-[13px] rounded-full bg-[hsl(0,0%,95%)] text-muted-foreground">{budget}만원</span>
          </div>

          {/* 추천 동네 */}
          <div className="mb-6">
            <span className="text-[12px] text-muted-foreground font-medium mb-1 block">추천 동네</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-[13px] rounded-full bg-[hsl(214,100%,95%)] text-[hsl(214,100%,40%)] font-semibold">{rec.neighborhood}</span>
              <span className="text-[14px] text-foreground">{rec.neighborhoodDesc}</span>
            </div>
          </div>

          {/* 월 예산 분석 */}
          <div className="mb-6">
            <span className="text-[12px] text-muted-foreground font-medium mb-3 block">월 예산 분석</span>
            <div className="space-y-2">
              {budgetItems.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[13px] text-foreground w-[40px]">{item.label}</span>
                  <div className="flex-1 h-6 bg-[hsl(0,0%,95%)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${(item.amount / budgetTotal) * 100}%`,
                        backgroundColor: item.color,
                        minWidth: "40px",
                      }}
                    >
                      <span className="text-[11px] text-white font-medium">{item.amount}만</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right text-[13px] font-semibold text-foreground mt-2">총 {budgetTotal}만원</div>
          </div>

          {/* 꼭 알아야 할 것 */}
          <div className="mb-6">
            <span className="text-[12px] text-muted-foreground font-medium mb-2 block">꼭 알아야 할 것</span>
            <ol className="list-decimal list-inside space-y-1.5 text-[14px] text-foreground">
              {rec.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ol>
          </div>

          {/* 럭키 한마디 */}
          <div className="bg-[hsl(0,0%,96%)] rounded-[12px] p-4 mb-6">
            <p className="text-[14px] text-muted-foreground italic">
              "{rec.luckyComment}"
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRetry} className="flex-1 h-10 text-[14px] rounded-[8px]">
              다시 계획하기
            </Button>
            <Button
              onClick={handleCopy}
              className="flex-1 h-10 text-[14px] rounded-[8px] bg-[hsl(214,100%,40%)] hover:bg-[hsl(214,100%,35%)] text-white"
            >
              {copied ? "복사됐어요! ✓" : "결과 복사하기"}
            </Button>
          </div>

          <button
            onClick={handleSavePlan}
            className="w-full mt-3 text-[13px] text-[hsl(214,100%,40%)] hover:underline"
          >
            이 플랜으로 대시보드 시작하기 →
          </button>
        </div>
      )}
    </div>
  );
};

/* ── Lucky Recommendation Card (Dashboard) ── */
const LuckyRecommendationCard = ({ city, party }: { city: string; party: string }) => {
  const rec = getRecommendation(city, party);
  const budgetTotal = Object.values(rec.budget).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-[#EFF6FF] rounded-xl p-5 mb-6">
      <h3 className="text-[16px] font-bold text-foreground mb-4">🌴 럭키의 맞춤 추천</h3>

      <div className="space-y-3">
        <div>
          <span className="text-[13px] font-semibold text-muted-foreground">추천 동네</span>
          <p className="text-[14px] text-foreground">{rec.neighborhood} — {rec.neighborhoodDesc}</p>
        </div>

        <div>
          <span className="text-[13px] font-semibold text-muted-foreground">월 예산 분석</span>
          <p className="text-[14px] text-foreground">
            숙소 {rec.budget.숙소}만 + 식비 {rec.budget.식비}만 + 이동 {rec.budget.이동}만 + 기타 {rec.budget.기타}만 = 총 {budgetTotal}만원
          </p>
        </div>

        <div>
          <span className="text-[13px] font-semibold text-muted-foreground">추천 숙소</span>
          <p className="text-[14px] text-foreground">{rec.accommodation}</p>
        </div>

        <div>
          <span className="text-[13px] font-semibold text-muted-foreground">꼭 알아야 할 것</span>
          <ol className="list-decimal list-inside space-y-1 text-[14px] text-foreground mt-1">
            {rec.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ol>
        </div>

        <div className="bg-white/60 rounded-lg p-3 mt-2">
          <p className="text-[14px] text-muted-foreground italic">
            💬 럭키 한마디: "{rec.luckyComment}"
          </p>
        </div>
      </div>
    </div>
  );
};

/* ── Dashboard ── */
const Dashboard = ({ initialData }: { initialData: PlannerData }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlannerData>(initialData);
  const [tab, setTab] = useState<"summary" | "checklist" | "housing" | "notes">("summary");

  // Feature E: 예산 시뮬레이터
  const [budgetRatios, setBudgetRatios] = useState<{ 숙소: number; 식비: number; 이동: number; 기타: number }>(() => {
    const rec = getRecommendation(initialData.city, initialData.party);
    const total = Object.values(rec.budget).reduce((a, b) => a + b, 0) || 1;
    return {
      숙소: Math.round((rec.budget.숙소 / total) * 100),
      식비: Math.round((rec.budget.식비 / total) * 100),
      이동: Math.round((rec.budget.이동 / total) * 100),
      기타: 100 - Math.round((rec.budget.숙소 / total) * 100) - Math.round((rec.budget.식비 / total) * 100) - Math.round((rec.budget.이동 / total) * 100),
    };
  });

  const updateBudgetRatio = (key: keyof typeof budgetRatios, newVal: number) => {
    setBudgetRatios(prev => {
      const diff = newVal - prev[key];
      const others = (Object.keys(prev) as (keyof typeof prev)[]).filter(k => k !== key);
      const totalOther = others.reduce((s, k) => s + prev[k], 0);
      const updated = { ...prev, [key]: newVal };
      if (totalOther > 0) {
        others.forEach(k => {
          updated[k] = Math.max(0, Math.round(prev[k] - (prev[k] / totalOther) * diff));
        });
      }
      // 합계가 100이 되도록 마지막 항목 보정
      const sum = Object.values(updated).reduce((a, b) => a + b, 0);
      updated[others[others.length - 1]] = Math.max(0, updated[others[others.length - 1]] + (100 - sum));
      return updated;
    });
  };

  const resetBudgetRatios = () => {
    const rec = getRecommendation(data.city, data.party);
    const total = Object.values(rec.budget).reduce((a, b) => a + b, 0) || 1;
    setBudgetRatios({
      숙소: Math.round((rec.budget.숙소 / total) * 100),
      식비: Math.round((rec.budget.식비 / total) * 100),
      이동: Math.round((rec.budget.이동 / total) * 100),
      기타: 100 - Math.round((rec.budget.숙소 / total) * 100) - Math.round((rec.budget.식비 / total) * 100) - Math.round((rec.budget.이동 / total) * 100),
    });
  };

  const [resetOpen, setResetOpen] = useState(false);
  const [sessionId] = useState(() => getSessionId());

  // Feature A: 공유 링크
  const [sharing, setSharing] = useState(false);
  const [sharedId, setSharedId] = useState<string | null>(null);

  // Feature D-Email: 리마인더
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderPlanId, setReminderPlanId] = useState<string | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);

  // Feature C: 숙소 추천
  const [listingRecs, setListingRecs] = useState<ListingRecommendation[]>([]);

  useEffect(() => {
    if (!data.city) return;
    const controller = new AbortController();
    const budgetKrw = (data.budget || 150) * 10000;
    fetch(`/api/listings?category=accommodation&city=${encodeURIComponent(data.city)}&limit=20`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((rows: ListingRecommendation[]) => {
        const filtered = rows.filter((r) => {
          const priceKrw = getMonthlyPriceKrw(r.category_data, 9999);
          return priceKrw <= budgetKrw * 0.6;
        });
        setListingRecs(filtered.slice(0, 3));
      })
      .catch(() => null);
    return () => controller.abort();
  }, [data.city, data.budget]);

  const persist = useCallback((updated: PlannerData) => {
    setData(updated);
    saveData(updated);
  }, []);

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const weeks = Math.max(1, Math.ceil(differenceInDays(end, start) / 7));
  const dateStr = `${format(start, "yyyy.MM.dd")} → ${format(end, "MM.dd")}`;
  const useRemoteChecklist = data.city === "다낭";
  const {
    items: remoteChecklistItems,
    setItems: setRemoteChecklistItems,
    loading: remoteChecklistLoading,
  } = usePlannerChecklist("danang-basic", useRemoteChecklist ? sessionId : null);

  const localChecklistItems: ChecklistItem[] = useMemo(() => {
    const cityChecklist = getChecklist(data.city);
    const base = cityChecklist.map((item) => ({
      ...item,
      checked: data.checklist[item.id] || false,
      completedAt: data.checklist[item.id] ? (data.checklist[`${item.id}_date`] as unknown as string || "") : undefined,
    }));
    const custom = (data.customItems || []).map((ci) => ({
      id: ci.id,
      label: ci.label,
      group: ci.group,
      checked: data.checklist[ci.id] || false,
      completedAt: data.checklist[ci.id] ? (data.checklist[`${ci.id}_date`] as unknown as string || "") : undefined,
    }));
    return [...base, ...custom];
  }, [data.checklist, data.city, data.customItems]);

  const checklistGroups = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    const combinedItems = useRemoteChecklist
      ? [
          ...remoteChecklistItems.map<ChecklistItem>((item) => ({
            id: `remote-${item.id}`,
            remoteId: item.id,
            label: item.title,
            description: item.description,
            checked: item.checked,
            group: "다낭 여행 준비",
            actionType: item.action_type,
            actionUrl: item.action_url,
            actionLabel: item.action_label,
            affiliatePartner: item.affiliate_partner,
            isRemote: true,
          })),
          ...(data.customItems || []).map((ci) => ({
            id: ci.id,
            label: ci.label,
            group: "직접 추가한 항목",
            checked: data.checklist[ci.id] || false,
            completedAt: data.checklist[ci.id] ? (data.checklist[`${ci.id}_date`] as unknown as string || "") : undefined,
          })),
        ]
      : localChecklistItems;

    combinedItems.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [data.checklist, data.customItems, localChecklistItems, remoteChecklistItems, useRemoteChecklist]);

  const allChecklistItems = Object.values(checklistGroups).flat();
  const totalChecklist = allChecklistItems.length;
  const doneChecklist = allChecklistItems.filter((item) => item.checked).length;
  const progressPct = totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0;

  // Budget
  const budgetRows = defaultBudgetRows.map(r => ({
    ...r,
    actual: data.budgetActuals[r.key] || "",
  }));
  const totalBudget = data.budget;
  const totalActual = budgetRows.reduce((s, r) => s + (parseInt(r.actual) || 0), 0);

  const toggleCheck = (id: string) => {
    const newChecklist = { ...data.checklist };
    if (newChecklist[id]) {
      delete newChecklist[id];
      delete newChecklist[`${id}_date`];
    } else {
      newChecklist[id] = true;
      (newChecklist as any)[`${id}_date`] = format(new Date(), "MM/dd");
    }
    persist({ ...data, checklist: newChecklist });
  };

  const toggleRemoteCheck = async (itemId: number, checked: boolean) => {
    setRemoteChecklistItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, checked } : item)),
    );

    try {
      await fetch("/api/planner/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          item_id: itemId,
          checked,
        }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const logAffiliateClick = async (partner: "agoda" | "booking" | "tripcom" | "skyscanner", targetId: number) => {
    try {
      await fetch("/api/affiliate/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          partner,
          target_type: "checklist_item",
          target_id: targetId,
        }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleChecklistAction = async (item: ChecklistItem) => {
    if (!item.actionType || item.actionType === "none" || !item.actionUrl) {
      return;
    }

    if (item.actionType === "internal") {
      navigate(item.actionUrl);
      return;
    }

    if (item.affiliatePartner && item.affiliatePartner !== "none" && item.remoteId) {
      await logAffiliateClick(item.affiliatePartner, item.remoteId);
    }

    window.open(item.actionUrl, "_blank", "noopener,noreferrer");
  };

  const updateBudgetActual = (key: string, value: string) => {
    persist({ ...data, budgetActuals: { ...data.budgetActuals, [key]: value } });
  };

  // Housing
  const addHousing = () => {
    if ((data.housing || []).length >= 5) return;
    const h: Housing = { id: `h${Date.now()}`, name: "", rent: "", location: "", pros: "", cons: "", link: "", primary: false };
    persist({ ...data, housing: [...(data.housing || []), h] });
  };

  const updateHousing = (id: string, field: keyof Housing, value: string | boolean) => {
    const housing = (data.housing || []).map(h => {
      if (h.id === id) return { ...h, [field]: value };
      if (field === "primary" && value === true) return { ...h, primary: false };
      return h;
    });
    persist({ ...data, housing });
  };

  const removeHousing = (id: string) => {
    persist({ ...data, housing: (data.housing || []).filter(h => h.id !== id) });
  };

  // Notes
  const updateNote = (weekKey: string, value: string) => {
    persist({ ...data, notes: { ...data.notes, [weekKey]: value } });
  };

  // Add custom checklist item
  const [addItemGroup, setAddItemGroup] = useState("");
  const [addItemLabel, setAddItemLabel] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);

  const handleAddItem = () => {
    if (!addItemLabel.trim() || !addItemGroup) return;
    const newItem = { id: `custom_${Date.now()}`, label: addItemLabel.trim(), group: addItemGroup };
    persist({ ...data, customItems: [...(data.customItems || []), newItem] });
    setAddItemLabel("");
    setAddItemOpen(false);
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("planner-updated"));
    window.location.reload();
  };

  const handleShare = async () => {
    if (sharedId) {
      // Already shared — just re-copy the URL
      const url = `${window.location.origin}/planner/share/${sharedId}`;
      await navigator.clipboard.writeText(url).catch(() => null);
      toast.success("링크가 복사됐어요!");
      return;
    }
    setSharing(true);
    try {
      const res = await fetch("/api/planner/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: getSessionId(),
          title: `${data.city} ${data.party} 한달살기 플랜`,
          data,
          is_public: true,
        }),
      });
      if (!res.ok) throw new Error("Share failed");
      const json = await res.json() as { id: string };
      const url = `${window.location.origin}/planner/share/${json.id}`;
      setSharedId(json.id);
      setReminderPlanId(json.id);
      if (data.startDate) setShowReminderModal(true);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("링크가 복사됐어요!");
      } catch {
        toast.info("링크가 생성됐어요. 위에서 확인하세요.");
      }
    } catch {
      toast.error("공유에 실패했습니다.");
    } finally {
      setSharing(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!reminderPlanId || !reminderEmail) return;
    setSavingReminder(true);
    try {
      const res = await fetch(`/api/planner/plans/${reminderPlanId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: reminderEmail }),
      });
      if (!res.ok) throw new Error("Reminder save failed");
      toast.success("리마인더가 등록됐어요!");
      setShowReminderModal(false);
    } catch {
      toast.error("등록에 실패했습니다.");
    } finally {
      setSavingReminder(false);
    }
  };

  // Feature D: D-day
  const dDay = useMemo(() => {
    if (!data.startDate) return null;
    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = differenceInDays(start, today);
    return diff;
  }, [data.startDate]);

  const tabs = [
    { key: "summary" as const, label: "요약" },
    { key: "checklist" as const, label: "체크리스트" },
    { key: "housing" as const, label: "숙소" },
    { key: "notes" as const, label: "메모" },
  ];

  const weekLabels = ["정착", "루틴", "", "마무리"];

  // Housing recommendations for current city
  const housingRecs = cityHousingRecs[data.city] || [];

  return (
    <div className="max-w-[900px] mx-auto py-6 px-4">
      {/* Feature D-Email: 리마인더 모달 */}
      <Dialog open={showReminderModal} onOpenChange={setShowReminderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>출발 전 알림 받기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            출발 D-30, D-14, D-7에 미완료 체크리스트를 이메일로 알려드려요.
          </p>
          <Input
            type="email"
            placeholder="이메일 주소"
            value={reminderEmail}
            onChange={e => setReminderEmail(e.target.value)}
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminderModal(false)}>나중에</Button>
            <Button onClick={() => void handleSaveReminder()} disabled={savingReminder || !reminderEmail}>
              {savingReminder ? "등록 중..." : "알림 등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Summary bar with progress */}
      <div
        className="bg-[#F8F9FA] rounded px-4 py-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] cursor-pointer hover:bg-[#F0F1F3] transition-colors"
        onClick={() => navigate("/planner")}
      >
        <span className="font-semibold text-foreground">{data.city}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-muted-foreground">{dateStr}</span>
        <span className="text-[#AAA]">·</span>
        {dDay !== null && (
          <>
            <span className="text-[24px] font-bold text-foreground leading-none">D{dDay > 0 ? `-${dDay}` : dDay === 0 ? "-Day" : `+${Math.abs(dDay)}`}</span>
            <span className="text-[#AAA]">·</span>
          </>
        )}
        <span className="text-muted-foreground">{data.party}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-muted-foreground">{data.budget}만원/월</span>
        <span className="text-[#AAA]">·</span>
        <span className="font-semibold text-[hsl(214,100%,40%)]">준비 {progressPct}%</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#EEE] mb-6 items-center">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-[15px] font-semibold border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-[hsl(214,100%,40%)] text-[hsl(214,100%,40%)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          {dDay !== null && (
            <span className={cn(
              "text-[12px] font-semibold px-2.5 py-1 rounded-full",
              dDay > 14 ? "bg-blue-100 text-blue-700" :
              dDay > 0 ? "bg-orange-100 text-orange-700" :
              dDay === 0 ? "bg-green-100 text-green-700" :
              "bg-slate-100 text-slate-500"
            )}>
              {dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day!" : `D+${Math.abs(dDay)}`}
            </span>
          )}
          {sharedId && (
            <a
              href={`/planner/share/${sharedId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-primary hover:underline"
            >
              공유 페이지 보기
            </a>
          )}
          <Link
            to="/planner/explore"
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            다른 플랜 보기
          </Link>
          <button
            onClick={() => void handleShare()}
            disabled={sharing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg border border-border hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
          >
            {sharing ? "저장 중..." : "🔗 공유하기"}
          </button>
        </div>
      </div>

      {/* Tab: Summary */}
      {tab === "summary" && (
        <div>
          {/* Lucky Recommendation Card */}
          <LuckyRecommendationCard city={data.city} party={data.party} />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] font-semibold text-foreground">준비 진행률</span>
              <span className="text-[14px] font-bold text-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2.5 bg-[#EEE] [&>div]:bg-[hsl(214,100%,40%)]" />
          </div>

          <table className="w-full text-[14px] mb-6">
            <thead>
              <tr className="border-b border-[#EEE]">
                <th className="text-left py-2 font-semibold text-foreground">항목</th>
                <th className="text-right py-2 font-semibold text-foreground w-[80px]">예산</th>
                <th className="text-right py-2 font-semibold text-foreground w-[100px]">확정</th>
                <th className="text-right py-2 font-semibold text-foreground w-[80px]">남은</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.map(r => {
                const remaining = r.budget - (parseInt(r.actual) || 0);
                return (
                  <tr key={r.key} className="border-b border-[#EEE]">
                    <td className="py-2.5 text-foreground">{r.label}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{r.budget}만</td>
                    <td className="py-2.5 text-right">
                      <input
                        type="number"
                        value={r.actual}
                        onChange={e => updateBudgetActual(r.key, e.target.value)}
                        placeholder="–"
                        className="w-[70px] text-right text-[14px] border border-[#EEE] rounded px-2 py-1 outline-none focus:border-[hsl(214,100%,40%)] bg-transparent"
                      />
                    </td>
                    <td className={cn("py-2.5 text-right", r.actual ? (remaining >= 0 ? "text-foreground" : "text-[hsl(0,68%,47%)]") : "text-[#AAA]")}>
                      {r.actual ? `${remaining}만` : "–"}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-bold">
                <td className="py-2.5 text-foreground">합계</td>
                <td className="py-2.5 text-right text-foreground">{totalBudget}만</td>
                <td className="py-2.5 text-right text-foreground">{totalActual > 0 ? `${totalActual}만` : "–"}</td>
                <td className={cn("py-2.5 text-right", totalActual > 0 ? (totalBudget - totalActual >= 0 ? "text-foreground" : "text-[hsl(0,68%,47%)]") : "text-[#AAA]")}>
                  {totalActual > 0 ? `${totalBudget - totalActual}만` : "–"}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="text-[13px] text-[#AAA]">
            환율 ₩1 = 18.4동 · 예산 현지화 약 {(data.budget * 10000 * 18.4 / 10000).toLocaleString()}만동
          </div>

          {/* Feature E: 예산 시뮬레이터 */}
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-foreground">예산 배분 조정</span>
              <button
                onClick={resetBudgetRatios}
                className="text-[11px] text-primary hover:underline"
              >
                {data.city} 평균으로 초기화
              </button>
            </div>
            {(Object.keys(budgetRatios) as (keyof typeof budgetRatios)[]).map(key => {
              const amount = Math.round(data.budget * budgetRatios[key] / 100);
              return (
                <div key={key} className="mb-4">
                  <div className="flex justify-between text-[12px] text-muted-foreground mb-1">
                    <span>{key}</span>
                    <span className="font-medium text-foreground">{budgetRatios[key]}% · 약 {amount}만원</span>
                  </div>
                  <Slider
                    value={[budgetRatios[key]]}
                    onValueChange={([v]) => updateBudgetRatio(key, v)}
                    min={0}
                    max={70}
                    step={1}
                    className="w-full"
                  />
                </div>
              );
            })}
            <div className="text-right text-[12px] text-muted-foreground mt-1">
              총 예산 {data.budget}만원 기준
            </div>
          </div>
        </div>
      )}

      {/* Tab: Checklist */}
      {tab === "checklist" && (
        <div>
          {useRemoteChecklist && remoteChecklistLoading && (
            <div className="text-[13px] text-muted-foreground mb-4">체크리스트를 불러오는 중입니다.</div>
          )}
          {Object.entries(checklistGroups).map(([group, items]) => (
            <div key={group} className="mb-6">
              <h3 className="text-[14px] font-bold text-foreground mb-3 px-1">{group}</h3>
              <div className="space-y-0">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 px-1 border-b border-[#EEE]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(checked) => {
                          if (item.isRemote && item.remoteId) {
                            toggleRemoteCheck(item.remoteId, checked === true);
                            return;
                          }
                          toggleCheck(item.id);
                        }}
                        className="rounded-sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[14px]", item.checked ? "line-through text-[#AAA]" : "text-foreground")}>
                            {item.label}
                          </span>
                          {item.affiliatePartner && item.affiliatePartner !== "none" && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#EFF6FF] text-[hsl(214,100%,40%)]">
                              제휴
                            </span>
                          )}
                          {item.checked && item.completedAt && (
                            <span className="text-[12px] text-[#AAA]">{item.completedAt}</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[12px] text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                    {item.isRemote && item.actionType && item.actionType !== "none" && item.actionLabel ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleChecklistAction(item)}
                        className="h-8 text-[12px] whitespace-nowrap"
                      >
                        {item.actionLabel}
                        {item.actionType === "external" && <ExternalLink size={12} className="ml-1" />}
                      </Button>
                    ) : item.link ? (
                      <a
                        href={item.link.href}
                        className="text-[13px] text-[hsl(214,100%,40%)] hover:underline whitespace-nowrap ml-2"
                      >
                        {item.link.text}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {addItemOpen ? (
            <div className="flex items-center gap-2 mt-4">
              <select
                value={addItemGroup}
                onChange={e => setAddItemGroup(e.target.value)}
                className="text-[13px] border border-[#EEE] rounded px-2 py-1.5"
              >
                <option value="">그룹 선택</option>
                {["출발 2주 전", "출발 전", "도착 첫날", "첫 주"].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <Input
                value={addItemLabel}
                onChange={e => setAddItemLabel(e.target.value)}
                placeholder="항목 입력"
                className="flex-1 text-[13px] h-8"
                onKeyDown={e => e.key === "Enter" && handleAddItem()}
              />
              <Button onClick={handleAddItem} size="sm" className="text-[13px] h-8 bg-[hsl(214,100%,40%)]">추가</Button>
              <Button onClick={() => setAddItemOpen(false)} size="sm" variant="ghost" className="text-[13px] h-8">취소</Button>
            </div>
          ) : (
            <button
              onClick={() => setAddItemOpen(true)}
              className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mt-4"
            >
              <Plus size={14} /> 항목 추가
            </button>
          )}
        </div>
      )}

      {/* Tab: Housing */}
      {tab === "housing" && (
        <div>
          {/* Feature C: DB 숙소 추천 */}
          {listingRecs.length > 0 && (
            <div className="mb-6">
              <h4 className="text-[13px] font-semibold text-foreground mb-3">
                예산 맞춤 추천 숙소
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">(예산 {data.budget}만원 기준)</span>
              </h4>
              <div className="space-y-2">
                {listingRecs.map(listing => {
                  const priceKrw = Math.round(getMonthlyPriceKrw(listing.category_data) / 10000);
                  return (
                    <div key={listing.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{listing.name}</p>
                        {listing.address && <p className="text-[11px] text-muted-foreground mt-0.5">{listing.address}</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {priceKrw > 0 && (
                          <span className="text-[12px] text-primary font-medium">월 {priceKrw}만원~</span>
                        )}
                        {listing.affiliate_url && (
                          <a
                            href={listing.affiliate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                            onClick={() => {
                              fetch("/api/affiliate/click", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ listing_id: listing.id, partner: "agoda" }),
                              }).catch(() => null);
                            }}
                          >
                            예약
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* City-specific housing recommendations */}
          <div className="mb-6">
            <h3 className="text-[15px] font-bold text-foreground mb-3">🏠 {data.city} 추천 숙소</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              {housingRecs.map((rec, i) => (
                <div key={i} className="border border-[#EEE] rounded-xl p-4 hover:shadow-md transition-shadow">
                  <h4 className="text-[14px] font-bold text-foreground mb-1">{rec.name}</h4>
                  <p className="text-[13px] text-muted-foreground mb-1">📍 {rec.location}</p>
                  <p className="text-[13px] text-muted-foreground mb-2">{rec.description}</p>
                  <p className="text-[14px] font-semibold text-foreground mb-2">{rec.price}</p>
                  {rec.mapUrl && (
                    <a
                      href={rec.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] text-[hsl(214,100%,40%)] hover:underline"
                    >
                      <ExternalLink size={12} /> 구글맵 보기
                    </a>
                  )}
                </div>
              ))}
            </div>
            <a
              href="/directory"
              className="text-[14px] text-[hsl(214,100%,40%)] hover:underline"
            >
              더 많은 숙소 보기 →
            </a>
          </div>

          <div className="border-t border-[#EEE] pt-6">
            <h3 className="text-[15px] font-bold text-foreground mb-3">내 숙소 비교</h3>
            {(data.housing || []).map((h, idx) => (
              <div key={h.id} className="border border-[#EEE] rounded p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <RadioGroup value={data.housing.find(x => x.primary)?.id || ""} onValueChange={val => updateHousing(val, "primary", true)}>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value={h.id} id={`primary-${h.id}`} />
                        <label htmlFor={`primary-${h.id}`} className="text-[13px] text-muted-foreground">1순위</label>
                      </div>
                    </RadioGroup>
                    <span className="text-[14px] font-semibold text-foreground">숙소 {idx + 1}</span>
                  </div>
                  <button onClick={() => removeHousing(h.id)} className="text-[#AAA] hover:text-[hsl(0,68%,47%)]">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[14px]">
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">이름</label>
                    <Input value={h.name} onChange={e => updateHousing(h.id, "name", e.target.value)} className="text-[14px] h-9" />
                  </div>
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">월세 (만원)</label>
                    <Input type="number" value={h.rent} onChange={e => updateHousing(h.id, "rent", e.target.value)} className="text-[14px] h-9" />
                  </div>
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">위치</label>
                    <Input value={h.location} onChange={e => updateHousing(h.id, "location", e.target.value)} className="text-[14px] h-9" />
                  </div>
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">링크</label>
                    <Input value={h.link} onChange={e => updateHousing(h.id, "link", e.target.value)} className="text-[14px] h-9" placeholder="URL" />
                  </div>
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">장점</label>
                    <Input value={h.pros} onChange={e => updateHousing(h.id, "pros", e.target.value)} className="text-[14px] h-9" />
                  </div>
                  <div>
                    <label className="text-[13px] text-muted-foreground mb-1 block">단점</label>
                    <Input value={h.cons} onChange={e => updateHousing(h.id, "cons", e.target.value)} className="text-[14px] h-9" />
                  </div>
                </div>
              </div>
            ))}

            {(data.housing || []).length < 5 && (
              <button
                onClick={addHousing}
                className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <Plus size={14} /> 숙소 추가
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab: Notes */}
      {tab === "notes" && (
        <div className="space-y-4">
          {Array.from({ length: weeks }, (_, i) => {
            const weekKey = `week_${i + 1}`;
            const suffix = weekLabels[i] || (i === weeks - 1 ? "마무리" : "");
            return (
              <div key={weekKey}>
                <label className="block text-[14px] font-semibold text-foreground mb-2">
                  Week {i + 1}{suffix ? ` — ${suffix}` : ""}
                </label>
                <Textarea
                  value={data.notes[weekKey] || ""}
                  onChange={e => updateNote(weekKey, e.target.value)}
                  className="text-[14px] min-h-[80px] border-[#EEE] resize-y"
                  placeholder="메모 입력"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Reset */}
      <div className="mt-10 pt-6 border-t border-[#EEE]">
        <button
          onClick={() => setResetOpen(true)}
          className="text-[13px] text-[#AAA] hover:text-[hsl(0,68%,47%)]"
        >
          계획 초기화
        </button>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">계획을 초기화하시겠습니까?</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-muted-foreground">모든 데이터가 삭제됩니다. 복구 불가.</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)} className="text-[14px]">취소</Button>
            <Button onClick={handleReset} className="text-[14px] bg-[hsl(0,68%,47%)] hover:bg-[hsl(0,68%,42%)] text-white">초기화</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Feature C: 숙소 추천 ── */
interface ListingRecommendation {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  affiliate_url: string | null;
  category_data: {
    price_min_usd?: number;
    price_monthly_usd?: number;
  };
}

const USD_TO_KRW = 1350;

const getMonthlyPriceKrw = (cd: ListingRecommendation['category_data'], fallback = 0) =>
  ((cd?.price_monthly_usd ?? cd?.price_min_usd ?? fallback) * USD_TO_KRW);

/* ── Main Page ── */
const Planner = () => {
  const [data, setData] = useState<PlannerData | null>(loadData());

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {data ? (
          <Dashboard initialData={data} />
        ) : (
          <CreationForm onCreated={setData} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Planner;
