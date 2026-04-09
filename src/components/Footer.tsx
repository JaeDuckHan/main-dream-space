const footerLinks = {
  "살아보기": ["한달살기", "은퇴·장기체류", "도시비교"],
  "도시": ["호치민", "하노이", "다낭", "나트랑", "푸꾸옥"],
  "서비스": ["업체 찾기", "업체 등록", "광고 문의", "이용약관", "개인정보처리방침", "데이터 산출 기준"],
};

const Footer = () => {
  return (
    <footer className="bg-foreground text-background/80">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Logo column */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-lg font-bold">
              <span className="text-primary">KBiz</span>
              <span className="text-background">Link</span>
            </a>
            <p className="mt-3 text-sm text-background/60 leading-relaxed">
              다낭 한달살기·장기체류 가이드.
              <br />
              베트남 5개 도시 생활비 비교.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-background mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-background/60 hover:text-background transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-background/10 text-xs text-background/40">
          © 2026 KBizLink. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
