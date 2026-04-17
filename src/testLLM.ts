/**
 * testLLM.ts — Smoke test for the configured LLM backend.
 *
 * Sends a minimal prompt and prints the raw response.
 * Use this to verify your API key + endpoint before running the bot.
 *
 * Usage:
 *   npm run test:llm
 */

import fs from "fs";
import path from "path";

// Load .env manually (no dotenv dep needed)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    process.env[key] = val;
  }
}

import { askLLM, getLLMInfo } from "./llmBackend.js";

async function main() {
  const info = getLLMInfo();
  console.log(`\n🔌 Testing LLM connection...`);
  console.log(`   Provider : ${process.env.LLM_PROVIDER ?? "bedrock"}`);
  console.log(`   Endpoint : ${process.env.LLM_BASE_URL ?? "(bedrock default)"}`);
  console.log(`   Model    : ${process.env.LLM_MODEL ?? "(default)"}`);
  console.log(`   Full     : ${info}\n`);

  const apiKey = process.env.LLM_API_KEY ?? "";
  if (apiKey === "your-blackbox-api-key-here" || apiKey === "") {
    console.error("❌  LLM_API_KEY is not set. Edit .env and add your real Blackbox API key.");
    process.exit(1);
  }

  console.log(`Sending test prompt...`);
  const start = Date.now();

  let response: string;
  try {
    response = await askLLM("Reply with exactly one word: READY", 16);
  } catch (e: any) {
    console.error(`\n❌  LLM call failed: ${e.message}`);
    console.error(`\nThings to check:`);
    console.error(`  1. LLM_API_KEY in .env is valid`);
    console.error(`  2. LLM_BASE_URL is correct — Blackbox should be: https://api.blackbox.ai/v1`);
    console.error(`  3. LLM_MODEL is a model Blackbox supports (e.g. gpt-4o, blackboxai/gpt-4o)`);
    process.exit(1);
  }

  const ms = Date.now() - start;
  console.log(`\n✅  Response (${ms}ms): "${response.trim()}"`);
  console.log(`\nBlackbox is connected. You're good to run the bot.\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
