import { describe, expect, it, vi } from "vitest";
import { buildOpenAIRequest, generateBotReply } from "../src/openai.js";

describe("OpenAI response formatting", () => {
  it("builds a Responses API request with Vietnamese family-admin instructions", async () => {
    const request = buildOpenAIRequest({ message: "Giải thích giấy này giúp mẹ" }, "test-model");

    expect(request.model).toBe("test-model");
    expect(request.instructions).toContain("Ngôn ngữ mặc định: Tiếng Việt");
    expect(request.instructions).toContain("1. Nội dung chính");
    expect(request.instructions).toContain("Có cần hỏi Henry không?");
    expect(request.input).toContain("Giải thích giấy này giúp mẹ");

    const create = vi.fn(async () => ({ output_text: "  Dạ, con xem giúp mình từng bước nhé.  " }));
    const reply = await generateBotReply({ message: "bot giúp mẹ" }, { responses: { create } });

    expect(reply).toBe("Dạ, con xem giúp mình từng bước nhé.");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ instructions: request.instructions }));
  });
});
