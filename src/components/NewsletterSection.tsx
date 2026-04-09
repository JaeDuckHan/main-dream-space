import { Mail } from "lucide-react";

const NewsletterSection = () => {
  return (
    <section className="py-20 bg-primary">
      <div className="container text-center">
        <Mail className="mx-auto mb-4 text-primary-foreground/80" size={28} />
        <h2 className="text-xl md:text-2xl font-bold text-primary-foreground">
          이번 주 다낭, 뭐가 바뀌었나
        </h2>
        <p className="mt-2 text-sm text-primary-foreground/80">
          비자·월세·생활 변경사항만 추려서 매주 월요일 보내드립니다
        </p>
        <div className="mt-6 max-w-md mx-auto flex items-center bg-primary-foreground/10 backdrop-blur-sm rounded-xl overflow-hidden border border-primary-foreground/20">
          <input
            type="email"
            placeholder="이메일 주소"
            className="flex-1 px-4 py-3 text-sm bg-transparent text-primary-foreground placeholder:text-primary-foreground/50 outline-none"
          />
          <button className="px-5 py-3 text-sm font-semibold bg-primary-foreground text-primary rounded-r-xl hover:bg-primary-foreground/90 transition-colors">
            무료 구독
          </button>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
