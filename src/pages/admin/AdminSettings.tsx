// src/pages/admin/AdminSettings.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BANK_KEYS = ["bank_name", "bank_account", "bank_holder", "bank_notice"] as const;
const COMPANY_KEYS = ["company_name", "company_ceo", "company_biz_no", "company_sale_no", "company_email", "company_address"] as const;

const LABELS: Record<string, string> = {
  bank_name: "은행명",
  bank_account: "계좌번호",
  bank_holder: "예금주",
  bank_notice: "입금 안내 문구",
  company_name: "회사명",
  company_ceo: "대표자",
  company_biz_no: "사업자등록번호",
  company_sale_no: "통신판매업신고번호",
  company_email: "이메일",
  company_address: "주소",
};

type SettingsMap = Record<string, string>;

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsMap) => setSettings(d))
      .catch(() => { console.error("Failed to load settings"); });
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        alert(body.error ?? "저장에 실패했습니다.");
        return;
      }
      alert("설정이 저장되었습니다.");
    } catch {
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key: string) => (
    <div key={key}>
      <Label className="text-xs text-slate-500">{LABELS[key]}</Label>
      <Input
        value={settings[key] ?? ""}
        onChange={(e) => handleChange(key, e.target.value)}
        placeholder={`미입력 시 표시 안 됨`}
        className="mt-1"
      />
    </div>
  );

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800">사이트 설정</h1>
      <p className="mt-1 text-sm text-slate-500 mb-8">입력 항목이 비어 있으면 해당 부분은 표시되지 않습니다.</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-4">무통장 입금 계좌</h2>
        <div className="space-y-4">
          {BANK_KEYS.map(renderField)}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2 mb-4">회사 정보 <span className="font-normal text-slate-400">(푸터 표시)</span></h2>
        <div className="space-y-4">
          {COMPANY_KEYS.map(renderField)}
        </div>
      </section>

      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "저장 중..." : "설정 저장"}
      </Button>
    </div>
  );
}
