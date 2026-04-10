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
          {hasPlanner && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/planner")}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ClipboardList size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent>내 한달살기 계획</TooltipContent>
            </Tooltip>
          )}
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
          {hasPlanner && (
            <a
              href="/planner"
              className="block py-3 text-[16px] font-bold text-foreground border-b border-border"
            >
              📋 내 계획
            </a>
          )}
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
