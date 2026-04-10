import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, differenceInDays, differenceInWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";

const STORAGE_KEY = "luckydanang_planner";

/* ── types ── */
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  completedAt?: string;
  link?: { text: string; href: string };
  group: string;
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

const defaultChecklist: Omit<ChecklistItem, "checked" | "completedAt">[] = [
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
  { id: "c14", label: "장기 숙소 탐색", group: "도착 1주", link: { text: "숙소 에이전트", href: "/directory" } },
  { id: "c15", label: "병원·약국 위치 확인", group: "도착 1주", link: { text: "병원 보기", href: "/directory" } },
  { id: "c16", label: "ATM 출금 테스트", group: "도착 1주" },
];

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

  const handleSubmit = () => {
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
        disabled={!startDate || !endDate}
        className="w-full h-11 text-[15px] font-bold bg-[hsl(214,100%,40%)] hover:bg-[hsl(214,100%,35%)] text-white rounded"
      >
        계획 시작하기
      </Button>
    </div>
  );
};

/* ── Dashboard ── */
const Dashboard = ({ initialData }: { initialData: PlannerData }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlannerData>(initialData);
  const [tab, setTab] = useState<"summary" | "checklist" | "housing" | "notes">("summary");
  const [resetOpen, setResetOpen] = useState(false);

  const persist = useCallback((updated: PlannerData) => {
    setData(updated);
    saveData(updated);
  }, []);

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const dDay = differenceInDays(start, new Date());
  const weeks = Math.max(1, Math.ceil(differenceInDays(end, start) / 7));
  const dateStr = `${format(start, "yyyy.MM.dd")} → ${format(end, "MM.dd")}`;

  // Checklist with custom items
  const allChecklistItems: ChecklistItem[] = useMemo(() => {
    const base = defaultChecklist.map(item => ({
      ...item,
      checked: data.checklist[item.id] || false,
      completedAt: data.checklist[item.id] ? (data.checklist[`${item.id}_date`] as unknown as string || "") : undefined,
    }));
    const custom = (data.customItems || []).map(ci => ({
      id: ci.id,
      label: ci.label,
      group: ci.group,
      checked: data.checklist[ci.id] || false,
      completedAt: data.checklist[ci.id] ? (data.checklist[`${ci.id}_date`] as unknown as string || "") : undefined,
    }));
    return [...base, ...custom];
  }, [data.checklist, data.customItems]);

  const checklistGroups = useMemo(() => {
    const groups: Record<string, ChecklistItem[]> = {};
    allChecklistItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [allChecklistItems]);

  const totalChecklist = allChecklistItems.length;
  const doneChecklist = allChecklistItems.filter(i => i.checked).length;
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

  const tabs = [
    { key: "summary" as const, label: "요약" },
    { key: "checklist" as const, label: "체크리스트" },
    { key: "housing" as const, label: "숙소" },
    { key: "notes" as const, label: "메모" },
  ];

  const weekLabels = ["정착", "루틴", "", "마무리"];

  return (
    <div className="max-w-[900px] mx-auto py-6 px-4">
      {/* Summary bar */}
      <div className="bg-[#F8F9FA] rounded px-4 py-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
        <span className="font-semibold text-foreground">{data.city}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-muted-foreground">{dateStr}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-[24px] font-bold text-foreground leading-none">D{dDay > 0 ? `-${dDay}` : dDay === 0 ? "-Day" : `+${Math.abs(dDay)}`}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-muted-foreground">{data.party}</span>
        <span className="text-[#AAA]">·</span>
        <span className="text-muted-foreground">{data.budget}만원/월</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#EEE] mb-6">
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
      </div>

      {/* Tab: Summary */}
      {tab === "summary" && (
        <div>
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
        </div>
      )}

      {/* Tab: Checklist */}
      {tab === "checklist" && (
        <div>
          {Object.entries(checklistGroups).map(([group, items]) => (
            <div key={group} className="mb-6">
              <h3 className="text-[14px] font-bold text-foreground mb-3 px-1">{group}</h3>
              <div className="space-y-0">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2.5 px-1 border-b border-[#EEE]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={() => toggleCheck(item.id)}
                        className="rounded-sm"
                      />
                      <span className={cn("text-[14px]", item.checked ? "line-through text-[#AAA]" : "text-foreground")}>
                        {item.label}
                      </span>
                      {item.checked && item.completedAt && (
                        <span className="text-[12px] text-[#AAA]">{item.completedAt}</span>
                      )}
                    </div>
                    {item.link && (
                      <a
                        href={item.link.href}
                        className="text-[13px] text-[hsl(214,100%,40%)] hover:underline whitespace-nowrap ml-2"
                      >
                        {item.link.text}
                      </a>
                    )}
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
                {["출발 2주 전", "출발 전", "도착 첫날", "도착 1주"].map(g => (
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

          <div className="mt-6 pt-4 border-t border-[#EEE]">
            <a href="/directory" className="text-[14px] text-[hsl(214,100%,40%)] hover:underline">
              숙소 에이전트한테 물어보기 →
            </a>
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
