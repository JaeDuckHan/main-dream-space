import { Mail } from "lucide-react";
import { NewsletterForm } from "@/components/home/NewsletterForm";

const NewsletterSection = () => {
  return (
    <section className="py-20 bg-primary">
      <div className="container text-center">
        <Mail className="mx-auto mb-4 text-primary-foreground/80" size={28} />
        <h2 className="text-[24px] md:text-[28px] font-bold text-primary-foreground">
          이번 주 다낭, 뭐가 바뀌었나
        </h2>
        <p className="mt-2 text-[16px] text-primary-foreground/80">
          비자·월세·생활 변경사항만 추려서 매주 월요일 보내드립니다
        </p>
        <div className="mt-6">
          <NewsletterForm source="main" />
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
