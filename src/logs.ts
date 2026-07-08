import { redactSensitiveContent } from "./safety.js";

export type BotEventType =
  | "incoming"
  | "ignored"
  | "replied"
  | "rate_limited"
  | "zalo_sent"
  | "zalo_skipped"
  | "error";

export interface BotLogEvent {
  id: string;
  timestamp: string;
  type: BotEventType;
  messageId?: string;
  conversationId?: string;
  senderId?: string;
  text?: string;
  redactions?: string[];
  riskCategories?: string[];
  reason?: string;
}

export interface AddBotLogEvent {
  type: BotEventType;
  messageId?: string;
  conversationId?: string;
  senderId?: string;
  text?: string;
  riskCategories?: string[];
  reason?: string;
}

export class InMemoryEventLog {
  private readonly maxEvents: number;
  private readonly events: BotLogEvent[] = [];

  constructor(maxEvents = 100) {
    this.maxEvents = maxEvents;
  }

  add(event: AddBotLogEvent): BotLogEvent {
    const redacted = event.text ? redactSensitiveContent(event.text) : undefined;
    const stored: BotLogEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: event.type,
      messageId: event.messageId,
      conversationId: event.conversationId,
      senderId: event.senderId,
      text: redacted?.text,
      redactions: redacted?.redactions,
      riskCategories: event.riskCategories,
      reason: event.reason
    };

    this.events.unshift(stored);
    if (this.events.length > this.maxEvents) {
      this.events.length = this.maxEvents;
    }

    return stored;
  }

  recent(): BotLogEvent[] {
    return [...this.events];
  }

  clear() {
    this.events.length = 0;
  }
}

export const eventLog = new InMemoryEventLog(100);
