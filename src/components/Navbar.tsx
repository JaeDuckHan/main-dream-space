import { createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ClipboardList, LogOut, Menu, Settings, User as UserIcon, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { User, useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "luckydanang_planner";
export const GlobalNavbarContext = createContext(false);

const navItems = [
  { label: "한달살기", href: "/compare?intent=monthly" },
  { label: "은퇴·장기체류", href: "/compare?intent=retire" },
  { label: "도시비교", href: "/compare" },
  { label: "업체찾기", href: "/directory" },
  { label: "커뮤니티", href: "/community" },
];

const getDisplayName = (user: User) => user.display_name || user.email.split("@")[0] || "사용자";

const getInitials = (user: User) => getDisplayName(user).trim().slice(0, 2).toUpperCase();

const Navbar = ({ forceRender = false }: { forceRender?: boolean }) => {
  const isGlobalNavbarEnabled = useContext(GlobalNavbarContext);
  const [open, setOpen] = useState(false);
  const [hasPlanner, setHasPlanner] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const loginHref = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const businessRegisterHref = user ? "/business/register" : `/login?redirect=${encodeURIComponent("/business/register")}`;

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  if (isGlobalNavbarEnabled && !forceRender) {
    return null;
  }

  const renderProfileMenu = () => {
    if (!user) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            aria-label="프로필 메뉴"
          >
            <Avatar className="h-8 w-8 border border-border">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={getDisplayName(user)} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary">{getInitials(user)}</AvatarFallback>
            </Avatar>
            <span className="max-w-28 truncate">{getDisplayName(user)}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="space-y-0.5">
            <div className="truncate font-semibold">{getDisplayName(user)}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/business/dashboard" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              내 업체
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/business/register" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              업체 등록
            </Link>
          </DropdownMenuItem>
          {user.role === "admin" ? (
            <DropdownMenuItem asChild>
              <Link to="/admin/listings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                관리자
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logout()} className="cursor-pointer text-muted-foreground focus:text-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-bold tracking-tight text-primary">
          럭키다낭
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="px-3 py-2 text-[16px] font-bold text-foreground hover:text-primary transition-colors rounded-md hover:bg-muted"
            >
              {item.label}
            </Link>
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
          <Link
            to={businessRegisterHref}
            className="inline-flex items-center px-4 py-2 text-[16px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            업체 등록
          </Link>
          {user ? (
            renderProfileMenu()
          ) : (
            <Link
              to={loginHref}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              로그인
            </Link>
          )}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          {user ? (
            renderProfileMenu()
          ) : (
            <Link
              to={loginHref}
              className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              로그인
            </Link>
          )}
          <button
            className="p-2 text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="메뉴"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-card px-4 pb-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.href}
              className="block py-3 text-[16px] font-bold text-foreground border-b border-border last:border-0"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/planner"
            className="block py-3 text-[16px] font-bold border-b border-border"
            style={{ color: hasPlanner ? "#0052CC" : "#999" }}
          >
            📋 한달살기 플래너
          </Link>
          <Link
            to={businessRegisterHref}
            className="mt-3 block text-center px-4 py-2.5 text-[16px] font-bold bg-primary text-primary-foreground rounded-lg"
          >
            업체 등록
          </Link>
          {user ? (
            <>
              <Link to="/business/dashboard" className="block py-3 text-[16px] font-bold border-b border-border">
                내 업체
              </Link>
              {user.role === "admin" ? (
                <Link to="/admin/listings" className="block py-3 text-[16px] font-bold border-b border-border">
                  관리자
                </Link>
              ) : null}
              <button onClick={() => void logout()} className="mt-3 block text-left text-[16px] font-bold text-muted-foreground">
                로그아웃
              </button>
            </>
          ) : (
            <Link to={loginHref} className="mt-3 block text-[16px] font-bold">
              로그인
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
