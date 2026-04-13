import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RequireAuth } from "@/components/RequireAuth";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepBasic } from "@/components/business/StepBasic";
import { StepDetails } from "@/components/business/StepDetails";
import { StepReview } from "@/components/business/StepReview";
import { CATEGORY_OPTIONS, DISTRICT_OPTIONS, initialListingFormState } from "@/lib/listing-form";

export default function BusinessRegister() {
  return (
    <RequireAuth>
      <BusinessRegisterPage />
    </RequireAuth>
  );
}

function BusinessRegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(initialListingFormState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch("/api/listings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "등록 실패");
      }

      navigate(`/business/dashboard?registered=${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl py-10">
        <h1 className="text-3xl font-bold">업체 등록</h1>
        <p className="mt-2 text-muted-foreground">등록 후 관리자 검수를 거쳐 디렉토리에 공개됩니다.</p>
        <Progress value={step * 33.33} className="mt-6 mb-6" />

        <Card className="p-6">
          {step === 1 ? (
            <StepBasic
              data={formData}
              onChange={setFormData}
              categories={CATEGORY_OPTIONS}
              districts={DISTRICT_OPTIONS}
              onNext={() => setStep(2)}
            />
          ) : null}

          {step === 2 ? (
            <StepDetails data={formData} onChange={setFormData} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : null}

          {step === 3 ? (
            <StepReview
              data={formData}
              submitting={submitting}
              error={error}
              onBack={() => setStep(2)}
              onSubmit={() => void handleSubmit()}
            />
          ) : null}
        </Card>
      </main>
      <Footer />
    </div>
  );
}
