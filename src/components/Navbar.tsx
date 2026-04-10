import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, ClipboardList } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "luckydanang_planner";

const navItems = [
  { label: "한달살기", href: "/living" },
  { label: "은퇴·장기체류", href: "/retire" },
  { label: "도시비교", href: "#" },
  { label: "업체찾기", href: "#" },
  { label: "뉴스", href: "#" },
  { label: "커뮤니티", href: "/community" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hasPlanner, setHasPlanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => setHasPlanner(!!localStorage.getItem(STORAGE_KEY));
    check();
    window.addEventListener("planner-updated", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("planner-updated", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-16">
        <a href="/" className="text-xl font-bold tracking-tight text-primary">
          럭키다낭
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-3 py-2 text-[16px] font-bold text-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/planner")}
                className="relative p-2 transition-all duration-300 hover:scale-110"
              >
                <ClipboardList
                  size={22}
                  style={{
                    stroke: hasPlanner ? "url(#planner-gradient)" : "#999",
                    filter: hasPlanner ? "drop-shadow(0 1px 3px rgba(0,82,204,0.35))" : "none",
                  }}
                />
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id="planner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF6B35" />
                      <stop offset="50%" stopColor="#0052CC" />
                      <stop offset="100%" stopColor="#7B2FF7" />
                    </linearGradient>
                  </defs>
                </svg>
                {hasPlanner && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{
                      background: "radial-gradient(circle at 30% 30%, #FF6B35, #0052CC 60%, #7B2FF7)",
                      boxShadow: "0 0 6px 2px rgba(0,82,204,0.45), 0 0 12px 4px rgba(123,47,247,0.2)",
                    }}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>한달살기 플래너</TooltipContent>
          </Tooltip>
          <a
            href="#"
            className="inline-flex items-center px-4 py-2 text-[16px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            업체 등록
          </a>
        </div>

        {/* Mobile */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setOpen(!open)}
          aria-label="메뉴"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card px-4 pb-4">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="block py-3 text-[16px] font-bold text-foreground border-b border-border last:border-0"
            >
              {item.label}
            </a>
          ))}
          <a
            href="/planner"
            className="block py-3 text-[16px] font-bold border-b border-border"
            style={{ color: hasPlanner ? "#0052CC" : "#999" }}
          >
            📋 한달살기 플래너
          </a>
          <a
            href="#"
            className="mt-3 block text-center px-4 py-2.5 text-[16px] font-bold bg-primary text-primary-foreground rounded-lg"
          >
            업체 등록
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
