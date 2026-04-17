import { KeyboardEvent, useState } from "react";

type Status = "idle" | "loading" | "ok" | "err";

export function NewsletterForm({ source = "main" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    if (status === "loading") {
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("err");
      setMessage("올바른 이메일을 입력해주세요");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (payload.ok) {
        setStatus("ok");
        setMessage("구독 완료! 이번 주 요약 메일을 보내드릴게요");
        setEmail("");
        return;
      }

      setStatus("err");
      setMessage(payload.error === "RATE_LIMIT" ? "잠시 후 다시 시도해주세요" : "구독에 실패했습니다");
    } catch {
      setStatus("err");
      setMessage("네트워크 오류");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      void submit();
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 sm:px-0">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="이메일 주소"
          className="flex-1 rounded-lg border border-white/30 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/60"
          disabled={status === "loading"}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={status === "loading"}
          className="rounded-lg bg-white px-6 py-3 font-semibold text-primary transition-colors hover:bg-white/90 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "무료 구독"}
        </button>
      </div>
      {message ? (
        <p className={`mt-2 text-sm ${status === "ok" ? "text-green-200" : "text-red-200"}`}>{message}</p>
      ) : null}
    </div>
  );
}
