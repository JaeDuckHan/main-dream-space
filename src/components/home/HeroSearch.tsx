import { FormEvent, KeyboardEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

export function HeroSearch() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (event?: FormEvent) => {
    event?.preventDefault();

    const trimmed = q.trim();
    if (!trimmed) {
      navigate(ROUTES.compare());
      return;
    }

    navigate(ROUTES.compare({ q: trimmed }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      submit();
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form className="flex gap-2 rounded-full bg-white p-2 shadow-lg" onSubmit={submit}>
        <input
          type="text"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="도시 또는 키워드 — 예: 다낭 월세, 나트랑 생활비"
          className="flex-1 rounded-full px-4 py-2 text-foreground outline-none"
          aria-label="도시 검색"
        />
        <button
          type="submit"
          className="rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          검색
        </button>
      </form>
      <p className="mt-3 text-center text-sm text-white/80">다낭 현지 운영 · 검증 업체 등록 중</p>
    </div>
  );
}
