import "server-only";

import type { ChatMessage } from "./prompt";

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

function config() {
  const baseUrl = process.env.OMNIROUTE_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.OMNIROUTE_API_KEY;
  const model = process.env.OMNIROUTE_MODEL;
  if (!baseUrl || !apiKey || !model)
    throw new ModelError("Assistant is not configured (OMNIROUTE_* variables)");
  return { baseUrl, apiKey, model };
}

export function assistantConfigured(): boolean {
  return Boolean(
    process.env.OMNIROUTE_BASE_URL && process.env.OMNIROUTE_API_KEY && process.env.OMNIROUTE_MODEL,
  );
}

/**
 * One chat completion against the OpenAI-compatible OmniRoute gateway in JSON mode.
 * Note: the gateway only accepts JSON mode when an input message contains the word "json".
 */
export async function completeJson(
  messages: ChatMessage[],
  timeoutMs = 45_000,
): Promise<{ content: string; model: string }> {
  const { baseUrl, apiKey, model } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new ModelError(`Model call failed (${response.status}): ${detail}`, response.status);
    }
    const body = (await response.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    if (!content) throw new ModelError("Model returned an empty message");
    return { content, model: body.model ?? model };
  } catch (error) {
    if (error instanceof ModelError) throw error;
    throw new ModelError(error instanceof Error ? error.message : "Model call failed");
  } finally {
    clearTimeout(timer);
  }
}
