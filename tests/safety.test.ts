import { describe, expect, it } from "vitest";
import { RISK_ESCALATION_MESSAGE } from "../src/prompts.js";
import { buildRiskyTopicReply, detectRiskyTopic, redactSensitiveContent } from "../src/safety.js";

describe("sensitive data redaction", () => {
  it("redacts OTPs, passwords, cards, passports, and bank details", () => {
    const result = redactSensitiveContent(
      "OTP 123456, password hunter2, thẻ 4111 1111 1111 1111, hộ chiếu B1234567, STK 12345678901"
    );

    expect(result.text).toContain("[REDACTED_OTP]");
    expect(result.text).toContain("[REDACTED_PASSWORD]");
    expect(result.text).toContain("[REDACTED_CARD]");
    expect(result.text).toContain("[REDACTED_PASSPORT]");
    expect(result.text).toContain("[REDACTED_BANK_ACCOUNT]");
    expect(result.text).not.toContain("hunter2");
    expect(result.text).not.toContain("4111 1111 1111 1111");
  });
});

describe("risky topic detection", () => {
  it("flags topics that should be escalated to Henry", () => {
    const risk = detectRiskyTopic("Có nên chuyển khoản ngân hàng và gửi OTP cho người này không?");

    expect(risk.isRisky).toBe(true);
    expect(risk.categories).toContain("banking");
    expect(buildRiskyTopicReply()).toBe(RISK_ESCALATION_MESSAGE);
  });
});
