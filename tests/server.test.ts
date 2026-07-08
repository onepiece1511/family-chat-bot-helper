import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryEventLog } from "../src/logs.js";
import { InMemoryRateLimiter } from "../src/rateLimit.js";
import { processWhatsAppWebhook } from "../src/server.js";

describe("POST /webhook/whatsapp", () => {
  beforeEach(() => {
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("ignores non-trigger messages and does not call OpenAI", async () => {
    const generateReply = vi.fn(async () => "should not happen");
    const response = await processWhatsAppWebhook(
      {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "phone-id" },
                  messages: [
                    {
                      from: "447700900123",
                      id: "wamid.1",
                      type: "text",
                      text: { body: "Cả nhà ăn cơm chưa?" }
                    }
                  ]
                }
              }
            ]
          }
        ]
      },
      {
        log: new InMemoryEventLog(),
        whatsappSender: vi.fn(async () => ({ sent: true })),
        generateReply,
        rateLimiter: new InMemoryRateLimiter()
      }
    );

    expect(response.body).toMatchObject({
      ok: true,
      results: [expect.objectContaining({ ignored: true, reason: "not_triggered" })]
    });
    expect(generateReply).not.toHaveBeenCalled();
  });
});
