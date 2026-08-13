import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEnv: vi.fn<(key: string) => string>(),
  handleTelegramUpdate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ requireEnv: mocks.requireEnv }));
vi.mock("@/lib/telegram/service", () => ({
  handleTelegramUpdate: mocks.handleTelegramUpdate,
}));

import { POST } from "@/app/api/telegram/webhook/route";

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    mocks.requireEnv.mockReset();
    mocks.handleTelegramUpdate.mockReset();
    mocks.requireEnv.mockReturnValue("test-webhook-secret");
  });

  it("rejects webhook payloads that do not carry the Telegram secret", async () => {
    const response = await POST(
      new Request("http://riftwatch.test/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ message: { text: "/start token" } }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.handleTelegramUpdate).not.toHaveBeenCalled();
  });

  it("passes only authenticated payloads to the Telegram service", async () => {
    const payload = { message: { text: "/start token" } };
    mocks.handleTelegramUpdate.mockResolvedValue({ handled: true });

    const response = await POST(
      new Request("http://riftwatch.test/api/telegram/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "test-webhook-secret",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ handled: true });
    expect(mocks.handleTelegramUpdate).toHaveBeenCalledWith(payload);
  });
});
