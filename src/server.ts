import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import { eventLog, InMemoryEventLog } from "./logs.js";
import { generateBotReply, type GenerateReplyInput } from "./openai.js";
import { botRateLimiter, InMemoryRateLimiter } from "./rateLimit.js";
import { buildRiskyTopicReply, detectRiskyTopic } from "./safety.js";
import {
  extractIncomingMessage,
  sendZaloTextMessage,
  shouldTriggerBot,
  stripBotTrigger,
  verifyZaloSignature,
  type ZaloSendInput,
  type ZaloSendResult
} from "./zalo.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

export interface AppDependencies {
  log?: InMemoryEventLog;
  rateLimiter?: InMemoryRateLimiter;
  generateReply?: (input: GenerateReplyInput) => Promise<string>;
  zaloSender?: (input: ZaloSendInput) => Promise<ZaloSendResult>;
}

interface WebhookDependencies {
  log: InMemoryEventLog;
  rateLimiter: InMemoryRateLimiter;
  generateReply: (input: GenerateReplyInput) => Promise<string>;
  zaloSender: (input: ZaloSendInput) => Promise<ZaloSendResult>;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const log = dependencies.log || eventLog;
  const rateLimiter = dependencies.rateLimiter || botRateLimiter;
  const generateReply = dependencies.generateReply || generateBotReply;
  const zaloSender = dependencies.zaloSender || sendZaloTextMessage;

  app.use(
    express.json({
      limit: "1mb",
      verify: (req: Request, _res, buffer) => {
        req.rawBody = Buffer.from(buffer);
      }
    })
  );

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "family-life-admin-chatbot",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/admin/logs", (_req: Request, res: Response) => {
    res.json({
      count: log.recent().length,
      events: log.recent()
    });
  });

  app.post("/webhook/zalo", async (req: Request, res: Response) => {
    const signature = req.get("x-zalo-signature") || req.get("x-zalo-app-signature") || req.get("x-hub-signature-256");
    const signatureOk = verifyZaloSignature(req.rawBody, signature, process.env.ZALO_APP_SECRET);

    if (!signatureOk) {
      log.add({ type: "error", reason: "invalid_zalo_signature" });
      return res.status(401).json({ ok: false, error: "invalid_signature" });
    }

    const result = await processZaloWebhook(req.body, {
      log,
      rateLimiter,
      generateReply,
      zaloSender
    });

    return res.status(result.status).json(result.body);
  });

  return app;
}

export async function processZaloWebhook(payload: unknown, dependencies: WebhookDependencies): Promise<WebhookResult> {
  const { log, rateLimiter, generateReply, zaloSender } = dependencies;
  const incoming = extractIncomingMessage(payload);

  if (!incoming) {
    log.add({ type: "ignored", reason: "no_text_message" });
    return { status: 200, body: { ok: true, ignored: true, reason: "no_text_message" } };
  }

  log.add({
    type: "incoming",
    messageId: incoming.messageId,
    conversationId: incoming.conversationId,
    senderId: incoming.senderId,
    text: incoming.text
  });

  if (!shouldTriggerBot(incoming.text)) {
    log.add({
      type: "ignored",
      messageId: incoming.messageId,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      text: incoming.text,
      reason: "not_triggered"
    });
    return { status: 200, body: { ok: true, ignored: true, reason: "not_triggered" } };
  }

  const rateDecision = rateLimiter.tryReserveReply(incoming.messageId);
  if (!rateDecision.allowed) {
    log.add({
      type: "rate_limited",
      messageId: incoming.messageId,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      text: incoming.text,
      reason: rateDecision.reason
    });
    return { status: 200, body: { ok: true, ignored: true, reason: rateDecision.reason } };
  }

  const userMessage = stripBotTrigger(incoming.text);
  const risk = detectRiskyTopic(userMessage);

  try {
    const reply = risk.isRisky
      ? buildRiskyTopicReply()
      : await generateReply({
          message: userMessage,
          isRisky: risk.isRisky,
          riskCategories: risk.categories
        });

    const sendResult = await zaloSender({
      recipientId: incoming.senderId,
      conversationId: incoming.conversationId,
      text: reply
    });

    log.add({
      type: "replied",
      messageId: incoming.messageId,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      text: reply,
      riskCategories: risk.categories
    });
    log.add({
      type: sendResult.sent ? "zalo_sent" : "zalo_skipped",
      messageId: incoming.messageId,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      reason: sendResult.reason
    });

    return {
      status: 200,
      body: {
        ok: true,
        replied: true,
        reply,
        sendResult,
        risk: risk.isRisky ? risk.categories : []
      }
    };
  } catch (error) {
    log.add({
      type: "error",
      messageId: incoming.messageId,
      conversationId: incoming.conversationId,
      senderId: incoming.senderId,
      reason: error instanceof Error ? error.message : "unknown_error"
    });
    return { status: 500, body: { ok: false, error: "reply_failed" } };
  }
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => {
    console.log(`Family life-admin chatbot listening on port ${port}`);
  });
}
