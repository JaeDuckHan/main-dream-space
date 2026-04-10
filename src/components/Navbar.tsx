import { useState } from "react";
import { Menu, X } from "lucide-react";

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
              className="px-3 py-2 text-[15px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a
            href="#"
            className="inline-flex items-center px-4 py-2 text-[15px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
              className="block py-3 text-[15px] font-medium text-muted-foreground border-b border-border last:border-0"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#"
            className="mt-3 block text-center px-4 py-2.5 text-[15px] font-semibold bg-primary text-primary-foreground rounded-lg"
          >
            업체 등록
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
