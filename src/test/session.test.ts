import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionId } from "@/lib/session";

describe("getSessionId", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reuses an existing session id", () => {
    window.localStorage.setItem("ds_session", "existing-session");

    expect(getSessionId()).toBe("existing-session");
  });

  it("creates and stores a session id when missing", () => {
    const randomUUID = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("new-session");

    expect(getSessionId()).toBe("new-session");
    expect(window.localStorage.getItem("ds_session")).toBe("new-session");

    randomUUID.mockRestore();
  });
});
