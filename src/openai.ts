import OpenAI from "openai";
import { BOT_INSTRUCTIONS, buildUserPrompt } from "./prompts.js";

export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export interface GenerateReplyInput {
  message: string;
  isRisky?: boolean;
  riskCategories?: string[];
}

export interface ResponsesClient {
  responses: {
    create(request: Record<string, unknown>): Promise<unknown>;
  };
}

export function buildOpenAIRequest(input: GenerateReplyInput, model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL) {
  return {
    model,
    instructions: BOT_INSTRUCTIONS,
    input: buildUserPrompt(input),
    max_output_tokens: 700
  };
}

export async function generateBotReply(input: GenerateReplyInput, client: ResponsesClient = createOpenAIClient()): Promise<string> {
  const response = await client.responses.create(buildOpenAIRequest(input));
  const text = extractResponseText(response);

  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  return text;
}

function createOpenAIClient(): ResponsesClient {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  }) as ResponsesClient;
}

function extractResponseText(response: unknown): string {
  if (isRecord(response) && typeof response.output_text === "string") {
    return response.output_text.trim();
  }

  if (!isRecord(response) || !Array.isArray(response.output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of response.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
