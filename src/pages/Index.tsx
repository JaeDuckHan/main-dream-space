import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CityCards from "@/components/CityCards";
import CalculatorSection from "@/components/CalculatorSection";
import ServicesSection from "@/components/ServicesSection";
import WeeklyUpdates from "@/components/WeeklyUpdates";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <CityCards />
        <CalculatorSection />
        <ServicesSection />
        <WeeklyUpdates />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
