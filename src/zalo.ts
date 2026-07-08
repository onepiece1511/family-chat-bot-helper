import crypto from "node:crypto";

export interface IncomingZaloMessage {
  messageId: string;
  senderId: string;
  conversationId: string;
  text: string;
  rawEventName?: string;
}

export interface ZaloSendInput {
  recipientId: string;
  conversationId?: string;
  text: string;
}

export interface ZaloSendResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
}

export function shouldTriggerBot(message: string): boolean {
  const trimmed = message.trim();
  return /(^|\s)@bot(?=\s|$|[:,.!?])/i.test(trimmed) || /^bot(?=\s|$|[:,.!?])/i.test(trimmed);
}

export function stripBotTrigger(message: string): string {
  const withoutMention = message.replace(/(^|\s)@bot(?=\s|$|[:,.!?])/i, " ");
  const withoutPrefix = withoutMention.replace(/^\s*bot(?=\s|$|[:,.!?])/i, "");
  return withoutPrefix.replace(/\s+/g, " ").trim() || message.trim();
}

export function extractIncomingMessage(payload: unknown): IncomingZaloMessage | null {
  if (!isRecord(payload)) return null;

  const message = isRecord(payload.message) ? payload.message : {};
  const sender = isRecord(payload.sender) ? payload.sender : {};
  const recipient = isRecord(payload.recipient) ? payload.recipient : {};
  const group = isRecord(payload.group) ? payload.group : {};
  const conversation = isRecord(payload.conversation) ? payload.conversation : {};

  const text = firstString(
    message.text,
    isRecord(message.content) ? message.content.text : undefined,
    message.content,
    payload.text
  );

  if (!text) return null;

  const senderId =
    firstString(sender.id, sender.user_id, payload.sender_id, payload.user_id, payload.from_id) || "unknown-sender";
  const conversationId =
    firstString(group.id, group.group_id, conversation.id, recipient.id, recipient.user_id, payload.group_id, senderId) ||
    senderId;
  const messageId =
    firstString(message.msg_id, message.message_id, message.id, payload.message_id, payload.event_id) ||
    stableFallbackMessageId(payload);

  return {
    messageId,
    senderId,
    conversationId,
    text,
    rawEventName: firstString(payload.event_name, payload.type)
  };
}

export function verifyZaloSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined, appSecret: string | undefined): boolean {
  if (!appSecret) return true;
  if (!rawBody || !signatureHeader) return false;

  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", appSecret).update(rawBody).digest("base64");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();

  return safeEqual(provided, expectedHex) || safeEqual(provided, expectedBase64);
}

export async function sendZaloTextMessage(input: ZaloSendInput): Promise<ZaloSendResult> {
  const accessToken = process.env.ZALO_ACCESS_TOKEN;
  if (!accessToken) {
    return { sent: false, skipped: true, reason: "missing_zalo_access_token" };
  }

  const response = await fetch("https://openapi.zalo.me/v3.0/oa/message/cs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: accessToken
    },
    body: JSON.stringify({
      recipient: {
        user_id: input.recipientId
      },
      message: {
        text: input.text
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Zalo send failed with status ${response.status}`);
  }

  return { sent: true, status: response.status };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableFallbackMessageId(payload: unknown): string {
  return `fallback-${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24)}`;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
