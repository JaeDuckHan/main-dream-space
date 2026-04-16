import { Suspense, lazy } from "react";
import Footer from "@/components/Footer";
import { CityCostCards } from "@/components/home/CityCostCards";
import { CityTabs } from "@/components/home/CityTabs";
import { HeroSearch } from "@/components/home/HeroSearch";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { TopHotels } from "@/components/home/TopHotels";
import { TrustIndicators } from "@/components/home/TrustIndicators";
import CalculatorSection from "@/components/CalculatorSection";
import ServicesSection from "@/components/ServicesSection";
import WeeklyUpdates from "@/components/WeeklyUpdates";

const HeroScene = lazy(() => import("@/components/HeroScene"));

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <section className="relative bg-gradient-to-b from-hero-from to-hero-to overflow-hidden pb-16 pt-[100px] text-white">
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
          <div className="container relative text-center" style={{ zIndex: 2 }}>
            <h1 className="text-[32px] md:text-[48px] font-[800] leading-tight">
              다낭 한달살기 비용·월세·비자,
              <br />
              5개 도시와 비교하세요.
            </h1>
            <p className="mt-4 text-[16px] md:text-[18px] text-white/80 max-w-xl mx-auto leading-relaxed">
              1인 월 생활비 기준 — 다낭 130만원 · 나트랑 112만원 · 푸꾸옥 133만원
            </p>
            <div className="mt-8">
              <CityTabs />
            </div>
            <div className="mt-6">
              <HeroSearch />
            </div>
            <div className="mt-8">
              <TrustIndicators />
            </div>
          </div>
        </section>
        <TopHotels />
        <CityCostCards />
        <CalculatorSection />
        <ServicesSection />
        <WeeklyUpdates />
        <section className="py-20 bg-primary">
          <div className="container text-center">
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
      </main>
      <Footer />
    </div>
  );
};

export default Index;
