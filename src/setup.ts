/**
 * setup.ts — Interactive first-run config wizard.
 *
 * Asks which AI provider to use, writes .env, then exits.
 * Run automatically by bot.ts when no .env exists.
 * Can also be run manually: npm run setup
 */

import fs from "fs";
import path from "path";
import readline from "readline";

const ENV_PATH = path.join(process.cwd(), ".env");

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function writeEnv(vars: Record<string, string>) {
  const lines = Object.entries(vars)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");
}

export async function runSetup(forceReconfigure = false) {
  if (forceReconfigure) {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = await new Promise<string>((r) => rl2.question("Reconfigure AI provider? Current .env will be overwritten. (y/N): ", r));
    rl2.close();
    if (confirm.trim().toLowerCase() !== "y") { console.log("Aborted."); return; }
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\nPolytopia Agent — first-time setup\n");
  console.log("Which AI do you want to use?\n");
  console.log("  1. LM Studio   (local model, no API key needed)");
  console.log("  2. OpenRouter  (cloud, pay-per-use, any model)");
  console.log("  3. AWS Bedrock (Claude via AWS)");
  console.log("  4. OpenAI      (GPT models)");
  console.log("  5. Skip        (world model only, no LLM)\n");

  const choice = await ask(rl, "Enter 1–5: ");

  let vars: Record<string, string> = { BOT_MODE: "hybrid", HYBRID_TOP_N: "3" };

  if (choice === "1") {
    console.log("\nLM Studio — make sure it's running and a model is loaded.");
    const url = await ask(rl, "LM Studio URL [http://localhost:1234/v1]: ");
    const model = await ask(rl, "Model name (as shown in LM Studio): ");
    vars = {
      ...vars,
      LLM_PROVIDER: "openai",
      LLM_BASE_URL: url || "http://localhost:1234/v1",
      LLM_MODEL: model,
    };

  } else if (choice === "2") {
    console.log("\nOpenRouter — get a key at https://openrouter.ai/keys");
    const key = await ask(rl, "API key (sk-or-...): ");
    console.log("\nPick a model:");
    console.log("  1. anthropic/claude-haiku-4-5-20251001  (fast, cheap)");
    console.log("  2. anthropic/claude-sonnet-4-6          (balanced)");
    console.log("  3. google/gemini-2.5-flash              (fast alternative)");
    console.log("  4. meta-llama/llama-4-scout             (open-weight)");
    console.log("  5. Enter manually");
    const mc = await ask(rl, "Enter 1–5: ");
    const models: Record<string, string> = {
      "1": "anthropic/claude-haiku-4-5-20251001",
      "2": "anthropic/claude-sonnet-4-6",
      "3": "google/gemini-2.5-flash",
      "4": "meta-llama/llama-4-scout",
    };
    const model = models[mc] ?? await ask(rl, "Model ID: ");
    vars = {
      ...vars,
      LLM_PROVIDER: "openai",
      LLM_BASE_URL: "https://openrouter.ai/api/v1",
      LLM_MODEL: model,
      LLM_API_KEY: key,
    };

  } else if (choice === "3") {
    console.log("\nAWS Bedrock — uses ~/.aws/credentials by default.");
    const region = await ask(rl, "AWS region [us-east-1]: ");
    const accessKey = await ask(rl, "AWS_ACCESS_KEY_ID (leave blank to use ~/.aws): ");
    const secretKey = accessKey ? await ask(rl, "AWS_SECRET_ACCESS_KEY: ") : "";
    vars = {
      ...vars,
      LLM_PROVIDER: "bedrock",
      AWS_REGION: region || "us-east-1",
      ...(accessKey ? { AWS_ACCESS_KEY_ID: accessKey, AWS_SECRET_ACCESS_KEY: secretKey } : {}),
    };

  } else if (choice === "4") {
    console.log("\nOpenAI — get a key at https://platform.openai.com/api-keys");
    const key = await ask(rl, "API key (sk-...): ");
    const model = await ask(rl, "Model [gpt-4o-mini]: ");
    vars = {
      ...vars,
      LLM_PROVIDER: "openai",
      LLM_BASE_URL: "https://api.openai.com/v1",
      LLM_MODEL: model || "gpt-4o-mini",
      LLM_API_KEY: key,
    };

  } else {
    vars = { BOT_MODE: "mamba" };
    console.log("\nWorld model only — no LLM, no API key needed.");
  }

  rl.close();

  writeEnv(vars);
  console.log(`\nSaved to .env. Run 'npm run bot' to start.\n`);
}

// Run directly: npm run setup
const isMain = process.argv[1]?.endsWith("setup.ts") || process.argv[1]?.endsWith("setup.js");
if (isMain) {
  const envExists = fs.existsSync(path.join(process.cwd(), ".env"));
  runSetup(envExists).catch(console.error);
}
