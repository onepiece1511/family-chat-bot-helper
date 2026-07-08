export interface RateLimitDecision {
  allowed: boolean;
  reason?: "duplicate_message" | "daily_limit";
  remainingToday: number;
}

export class InMemoryRateLimiter {
  private readonly maxRepliesPerDay: number;
  private readonly processedMessageIds = new Set<string>();
  private currentDay = "";
  private repliesToday = 0;

  constructor(maxRepliesPerDay = 30) {
    this.maxRepliesPerDay = maxRepliesPerDay;
  }

  tryReserveReply(messageId: string, now = new Date()): RateLimitDecision {
    this.resetIfNeeded(now);

    if (this.processedMessageIds.has(messageId)) {
      return {
        allowed: false,
        reason: "duplicate_message",
        remainingToday: Math.max(0, this.maxRepliesPerDay - this.repliesToday)
      };
    }

    if (this.repliesToday >= this.maxRepliesPerDay) {
      return {
        allowed: false,
        reason: "daily_limit",
        remainingToday: 0
      };
    }

    this.processedMessageIds.add(messageId);
    this.repliesToday += 1;

    return {
      allowed: true,
      remainingToday: Math.max(0, this.maxRepliesPerDay - this.repliesToday)
    };
  }

  snapshot(now = new Date()) {
    this.resetIfNeeded(now);
    return {
      currentDay: this.currentDay,
      repliesToday: this.repliesToday,
      maxRepliesPerDay: this.maxRepliesPerDay,
      processedMessageCount: this.processedMessageIds.size
    };
  }

  private resetIfNeeded(now: Date) {
    const day = now.toISOString().slice(0, 10);
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.repliesToday = 0;
      this.processedMessageIds.clear();
    }
  }
}

export const botRateLimiter = new InMemoryRateLimiter(30);
