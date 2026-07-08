import { describe, expect, it } from "vitest";
import { shouldTriggerBot, stripBotTrigger } from "../src/zalo.js";

describe("trigger detection", () => {
  it("responds to @Bot mentions and bot prefixes", () => {
    expect(shouldTriggerBot("@Bot dịch giúp bố câu này")).toBe(true);
    expect(shouldTriggerBot("Mẹ ơi @bot xem giúp")).toBe(true);
    expect(shouldTriggerBot("bot chỉ mẹ cách mở Zalo")).toBe(true);
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
