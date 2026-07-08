import { describe, expect, it } from "vitest";
import { extractIncomingMessages, shouldTriggerBot, stripBotTrigger, verifyWhatsAppWebhookChallenge } from "../src/whatsapp.js";

describe("trigger detection", () => {
  it("responds to @Bot mentions and bot prefixes", () => {
    expect(shouldTriggerBot("@Bot dịch giúp bố câu này")).toBe(true);
    expect(shouldTriggerBot("Mẹ ơi @bot xem giúp")).toBe(true);
    expect(shouldTriggerBot("bot chỉ mẹ cách mở WhatsApp")).toBe(true);
  });

  it("ignores normal family messages", () => {
    expect(shouldTriggerBot("Cả nhà ăn cơm chưa?")).toBe(false);
    expect(shouldTriggerBot("robot hút bụi đang sạc")).toBe(false);
  });

  it("removes the trigger before sending text to the model", () => {
    expect(stripBotTrigger("bot dịch giúp mẹ")).toBe("dịch giúp mẹ");
    expect(stripBotTrigger("Mẹ nhờ @Bot xem giúp")).toBe("Mẹ nhờ xem giúp");
  });
});

describe("WhatsApp webhook helpers", () => {
  it("verifies webhook challenge tokens", () => {
    const result = verifyWhatsAppWebhookChallenge(
      {
        "hub.mode": "subscribe",
        "hub.verify_token": "local-token",
        "hub.challenge": "12345"
      },
      "local-token"
    );

    expect(result).toEqual({ verified: true, challenge: "12345" });
  });

  it("extracts text messages from Cloud API payloads", () => {
    const messages = extractIncomingMessages({
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
                    id: "wamid.abc",
                    type: "text",
                    text: { body: "bot xin chào" }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    expect(messages).toEqual([
      expect.objectContaining({
        messageId: "wamid.abc",
        senderId: "447700900123",
        conversationId: "phone-id",
        text: "bot xin chào"
      })
    ]);
  });
});
