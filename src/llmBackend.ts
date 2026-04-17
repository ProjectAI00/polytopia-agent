/**
 * llmBackend.ts — Pluggable LLM interface.
 *
 * All config via env vars — no hardcoded credentials or defaults anywhere.
 *
 *   LLM_PROVIDER=bedrock          → AWS Bedrock (default)
 *   LLM_PROVIDER=openai           → Any OpenAI-compatible API
 *                                   (OpenRouter, LM Studio, OpenAI, Anthropic, etc.)
 *
 *   LLM_MODEL=...                 → Model ID
 *   LLM_API_KEY=...               → API key (openai provider)
 *   LLM_BASE_URL=...              → Base URL (openai provider)
 *                                   e.g. https://openrouter.ai/api/v1
 *                                        http://localhost:1234/v1  (LM Studio)
 *                                        https://api.openai.com/v1
 *
 *   AWS_REGION=...                → Bedrock region (default: us-east-1)
 *   AWS_ACCESS_KEY_ID=...         → AWS credentials (or use ~/.aws/credentials / IAM role)
 *   AWS_SECRET_ACCESS_KEY=...
 *   AWS_SESSION_TOKEN=...         → Only needed for temporary credentials
 *
 * Defaults:
 *   Bedrock:      us.anthropic.claude-haiku-4-5-20251001-v1:0
 *   OpenAI-compat: gpt-5.4-mini
 *
 * Good OpenRouter models (as of 2026):
 *   anthropic/claude-haiku-4-5-20251001  — fast, cheap
 *   anthropic/claude-sonnet-4-6          — balanced
 *   google/gemini-2.5-flash              — fast alternative
 *   meta-llama/llama-4-scout             — open-weight option
 *   openai/gpt-5.4-mini                  — OpenAI budget
 */

// All config read lazily at call time so .env loaders always win
function provider() { return process.env.LLM_PROVIDER ?? "bedrock"; }
function model() {
  return process.env.LLM_MODEL ?? (
    provider() === "bedrock"
      ? "us.anthropic.claude-haiku-4-5-20251001-v1:0"
      : "blackboxai/openai/gpt-5.4-mini"
  );
}

export function getLLMInfo(): string {
  if (provider() === "bedrock") return `bedrock/${model()}`;
  const base = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  return `${model()} @ ${base}`;
}

async function callBedrock(prompt: string, maxTokens: number): Promise<string> {
  const { default: AnthropicBedrock } = await import("@anthropic-ai/bedrock-sdk");
  const client = new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "us-east-1" });
  const msg = await client.messages.create({
    model: model(),
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return (msg.content[0] as any).text ?? "";
}

async function callOpenAICompat(prompt: string, maxTokens: number): Promise<string> {
  const base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.LLM_API_KEY ?? "";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function askLLM(prompt: string, maxTokens = 256): Promise<string> {
  if (provider() === "bedrock") return callBedrock(prompt, maxTokens);
  return callOpenAICompat(prompt, maxTokens);
}
