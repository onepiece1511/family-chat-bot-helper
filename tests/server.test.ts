import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryEventLog } from "../src/logs.js";
import { InMemoryRateLimiter } from "../src/rateLimit.js";
import { processZaloWebhook } from "../src/server.js";

describe("POST /webhook/zalo", () => {
  beforeEach(() => {
    delete process.env.ZALO_APP_SECRET;
    delete process.env.ZALO_ACCESS_TOKEN;
  });

  it("ignores non-trigger messages and does not call OpenAI", async () => {
    const generateReply = vi.fn(async () => "should not happen");
    const response = await processZaloWebhook(
      {
        event_name: "user_send_text",
        sender: { id: "parent-1" },
        recipient: { id: "family-chat" },
        message: { msg_id: "msg-1", text: "Cả nhà ăn cơm chưa?" }
      },
      {
        log: new InMemoryEventLog(),
        zaloSender: vi.fn(async () => ({ sent: true })),
        generateReply,
        rateLimiter: new InMemoryRateLimiter()
      }
    );

    expect(response.body).toMatchObject({ ok: true, ignored: true, reason: "not_triggered" });
    expect(generateReply).not.toHaveBeenCalled();
  });
});
