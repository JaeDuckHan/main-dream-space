import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const KakaoLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path
      fill="currentColor"
      d="M12 4.5C7.03 4.5 3 7.64 3 11.5c0 2.49 1.68 4.67 4.2 5.91l-.84 3.09c-.08.28.24.51.49.36l3.72-2.39c.47.06.95.1 1.43.1 4.97 0 9-3.14 9-7.01S16.97 4.5 12 4.5Z"
    />
  </svg>
);

const NaverLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path fill="currentColor" d="M16.7 4H20v16h-3.47L7.3 8.52V20H4V4h3.5l9.2 11.45V4Z" />
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path
      fill="#4285F4"
      d="M21.6 12.23c0-.68-.06-1.33-.17-1.95H12v3.69h5.39a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.89-1.74 2.98-4.31 2.98-7.26Z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.22-2.5c-.9.6-2.04.96-3.4.96-2.61 0-4.83-1.76-5.63-4.12H3.04v2.58A9.99 9.99 0 0 0 12 22Z"
    />
    <path
      fill="#FBBC05"
      d="M6.37 13.91A5.98 5.98 0 0 1 6.05 12c0-.66.11-1.3.32-1.91V7.5H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.5l3.33-2.59Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.97c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 2.98 14.7 2 12 2a9.99 9.99 0 0 0-8.96 5.5l3.33 2.59c.8-2.37 3.02-4.12 5.63-4.12Z"
    />
  </svg>
);

const providers = [
  {
    key: "kakao",
    label: "카카오로 시작하기",
    className: "bg-[#FEE500] text-[#191600] shadow-[0_10px_30px_rgba(254,229,0,0.28)] hover:bg-[#f8de00]",
    iconWrapClassName: "bg-white/85 text-current",
    icon: KakaoLogo,
  },
  {
    key: "naver",
    label: "네이버로 시작하기",
    className: "bg-[#03C75A] text-white shadow-[0_10px_30px_rgba(3,199,90,0.22)] hover:bg-[#02b350]",
    iconWrapClassName: "bg-transparent text-white shadow-none",
    icon: NaverLogo,
  },
  {
    key: "google",
    label: "Google로 시작하기",
    className: "border border-border bg-white text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:border-primary/25 hover:bg-[#fafafa]",
    iconWrapClassName: "bg-white text-foreground",
    icon: GoogleLogo,
  },
] as const;

export default function Login() {
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";

  const startOAuth = (provider: (typeof providers)[number]["key"]) => {
    window.location.href = `/api/oauth/${provider}/login?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container flex min-h-[70vh] items-center justify-center py-16">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">로그인 / 회원가입</h1>
            <p className="text-sm text-muted-foreground">업체 등록과 관리 기능은 로그인 후 사용할 수 있습니다.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {providers.map((provider) => (
              (() => {
                const Icon = provider.icon;

                return (
                  <button
                    key={provider.key}
                    onClick={() => startOAuth(provider.key)}
                    className={`group flex h-14 w-full items-center rounded-2xl px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${provider.className}`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/5 ${provider.iconWrapClassName}`}>
                      <Icon />
                    </span>
                    <span className="flex-1 text-center tracking-[-0.01em]">{provider.label}</span>
                    <span className="w-9" aria-hidden="true" />
                  </button>
                );
              })()
            ))}
            <p className="pt-3 text-center text-xs leading-relaxed text-muted-foreground">
              원하는 계정으로 간편하게 로그인하고 업체 등록 및 관리 기능을 바로 이용하세요.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
