const footerLinks = {
  "바로가기": [
    { label: "도시비교", href: "/compare" },
    { label: "업체찾기", href: "/directory" },
    { label: "커뮤니티", href: "/community" },
  ],
  "도시": ["호치민", "하노이", "다낭", "나트랑", "푸꾸옥"],
  "서비스": [
    { label: "업체 찾기", href: "/directory" },
    { label: "업체 등록", href: "/business/register" },
    { label: "한달살기 플래너", href: "/planner" },
    { label: "광고 문의", href: "#" },
    { label: "이용약관", href: "#" },
    { label: "개인정보처리방침", href: "#" },
    { label: "데이터 산출 기준", href: "#" },
  ],
};

const Footer = () => {
  return (
    <footer className="bg-foreground text-background/80">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-lg font-bold text-primary">
              럭키다낭
            </a>
            <p className="mt-3 text-[14px] text-background/60 leading-relaxed">
              다낭 한달살기·장기체류 가이드.
              <br />
              베트남 5개 도시 생활비 비교.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[14px] font-semibold text-background mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => {
                  const isObj = typeof link === "object";
                  const label = isObj ? link.label : link;
                  const href = isObj ? link.href : "#";
                  return (
                    <li key={label}>
                      <a href={href} className="text-[14px] text-background/60 hover:text-background transition-colors">
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-background/10 text-[13px] text-background/40">
          © 2026 럭키다낭 (Lucky Danang). All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
