import { useNavigate } from "react-router-dom";
import { CITY_LABELS, CITY_SLUGS, ROUTES, type CitySlug } from "@/lib/routes";

export function CityTabs({ active = "all" }: { active?: CitySlug | "all" }) {
  const navigate = useNavigate();
  const tabs: Array<{ key: CitySlug | "all"; label: string }> = [
    { key: "all", label: "전체" },
    ...CITY_SLUGS.map((slug) => ({ key: slug, label: CITY_LABELS[slug] })),
  ];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => navigate(tab.key === "all" ? ROUTES.compare() : ROUTES.compare({ city: tab.key }))}
          className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
            active === tab.key
              ? "border-white bg-white text-primary"
              : "border-white/25 bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
