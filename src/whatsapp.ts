import crypto from "node:crypto";

export interface IncomingWhatsAppMessage {
  messageId: string;
  senderId: string;
  conversationId: string;
  recipientPhoneNumberId?: string;
  text: string;
  rawEventName?: string;
}

export interface WhatsAppSendInput {
  recipientPhoneNumber: string;
  text: string;
}

export interface WhatsAppSendResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
}

export interface WebhookVerificationResult {
  verified: boolean;
  challenge?: string;
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

export function verifyWhatsAppWebhookChallenge(
  query: Record<string, unknown>,
  verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
): WebhookVerificationResult {
  const mode = firstString(query["hub.mode"]);
  const token = firstString(query["hub.verify_token"]);
  const challenge = firstString(query["hub.challenge"]);

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return { verified: true, challenge };
  }

  return { verified: false };
}

export function extractIncomingMessages(payload: unknown): IncomingWhatsAppMessage[] {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) return [];

  const messages: IncomingWhatsAppMessage[] = [];
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) continue;

      const value = change.value;
      const metadata = isRecord(value.metadata) ? value.metadata : {};
      const phoneNumberId = firstString(metadata.phone_number_id);
      const displayPhoneNumber = firstString(metadata.display_phone_number);
      const conversationId = phoneNumberId || displayPhoneNumber || "whatsapp";

      if (!Array.isArray(value.messages)) continue;

      for (const message of value.messages) {
        if (!isRecord(message) || message.type !== "text") continue;
        const text = isRecord(message.text) ? firstString(message.text.body) : undefined;
        const senderId = firstString(message.from);
        if (!text || !senderId) continue;

        messages.push({
          messageId: firstString(message.id) || stableFallbackMessageId(message),
          senderId,
          conversationId,
          recipientPhoneNumberId: phoneNumberId,
          text,
          rawEventName: firstString(change.field, payload.object)
        });
      }
    }
  }

  return messages;
}

export function verifyWhatsAppSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined
): boolean {
  if (!appSecret) return true;
  if (!rawBody || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();

  return safeEqual(provided, expected);
}

export async function sendWhatsAppTextMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken) {
    return { sent: false, skipped: true, reason: "missing_whatsapp_access_token" };
  }

  if (!phoneNumberId) {
    return { sent: false, skipped: true, reason: "missing_whatsapp_phone_number_id" };
  }

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.recipientPhoneNumber,
      type: "text",
      text: {
        preview_url: false,
        body: input.text
      }
    })
  });

  if (!response.ok) {
    throw new Error(`WhatsApp send failed with status ${response.status}`);
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
