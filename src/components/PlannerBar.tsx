import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const STORAGE_KEY = "luckydanang_planner";

const PlannerBar = () => {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setData(raw ? JSON.parse(raw) : null);
      } catch { setData(null); }
    };
    load();
    window.addEventListener("planner-updated", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("planner-updated", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  if (!data || hidden) return null;

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const dDay = differenceInDays(start, new Date());

  // Calculate progress — city-specific checklist count
  const cityChecklistCounts: Record<string, number> = { 다낭: 16, 호치민: 15, 하노이: 15, 나트랑: 15, 푸꾸옥: 15 };
  const baseCount = cityChecklistCounts[data.city] || 13;
  const customCount = (data.customItems || []).length;
  const total = baseCount + customCount;
  const done = Object.keys(data.checklist || {}).filter(k => !k.endsWith("_date") && data.checklist[k]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-[#E3F2FD] h-[44px] flex items-center justify-center px-4 text-[14px]">
      <div className="max-w-[1100px] w-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground min-w-0">
          <span>🏖️</span>
          <span className="font-semibold shrink-0">{data.city} 한달살기</span>
          <span className="text-[#AAA] hidden sm:inline">·</span>
          <span className="hidden sm:inline">{format(start, "M/d")}–{format(end, "M/d")}</span>
          <span className="text-[#AAA]">·</span>
          <span className="font-bold shrink-0">D{dDay > 0 ? `-${dDay}` : dDay === 0 ? "-Day" : `+${Math.abs(dDay)}`}</span>
          <span className="text-[#AAA]">·</span>
          <span className="shrink-0">준비 {pct}%</span>
          <span className="text-[#AAA]">·</span>
          <button
            onClick={() => navigate("/planner")}
            className="text-[hsl(214,100%,40%)] font-semibold hover:underline shrink-0"
          >
            보기 →
          </button>
        </div>
        <button onClick={() => setHidden(true)} className="text-[#AAA] hover:text-foreground ml-4 p-2 -mr-2 shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PlannerBar;
