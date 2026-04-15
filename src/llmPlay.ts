/**
 * llmPlay.ts — LLM-powered bot using Claude Haiku via Bedrock.
 *
 * Instead of Mamba scoring, feeds game state as plain English to an LLM
 * and asks it to pick the best action with reasoning.
 *
 * Usage:
 *   npx tsx src/llmPlay.ts
 *
 * Requires:
 *   - Polytopia running on external-bot-controller branch, cl_controlport 5060
 *   - AWS credentials configured (uses Bedrock us-east-1)
 */

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { getBotTurn, sendCommand } from "./gameApi.js";
import { buildPrompt } from "./llmFormatter.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const PASSTHROUGH_PLAYER = 255;
const MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

const client = new AnthropicBedrock({ awsRegion: "us-east-1" });

async function askLLM(prompt: string, numActions: number): Promise<number> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (msg.content[0] as any).text ?? "";
  // Extract JSON from response
  const match = text.match(/\{[^}]+\}/);
  if (!match) {
    console.log(`  [llm] bad response: ${text.slice(0, 100)}`);
    return 0; // fallback to first action
  }
  try {
    const parsed = JSON.parse(match[0]);
    const choice = parseInt(parsed.choice ?? "1") - 1; // convert 1-indexed to 0-indexed
    const reason = parsed.reason ?? "";
    console.log(`  [llm] → action ${choice + 1}: ${reason}`);
    return Math.max(0, Math.min(choice, numActions - 1));
  } catch {
    return 0;
  }
}

async function main() {
  console.log(`LLM bot using ${MODEL}\nWaiting for bot turn...\n`);

  let turnCount = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(0);
    } catch (e: any) {
      if (e.message?.startsWith("Bad JSON")) {
        await sleep(1000);
        continue;
      }
      throw e;
    }

    if (turn.SuggestedCommand?.CommandType === "EndMatch") {
      console.log("Game over.");
      break;
    }

    // Trigger event — no Commands list
    if (!turn.Commands || turn.Commands.length === 0) {
      const sc = turn.SuggestedCommand;
      const triggerType = turn.Trigger?.type ?? "unknown";
      const detail = sc?.CommandType === "UpgradeCity" || sc?.CommandType === "CityReward"
        ? ` city(${sc.CityX ?? sc.Coordinates?.X},${sc.CityY ?? sc.Coordinates?.Y}) reward=${sc.Reward ?? sc.Type}`
        : sc ? ` → ${sc.CommandType}` : "";
      console.log(`  [trigger] type=${triggerType}${detail}`);
      try { await sendCommand(sc); } catch {}
      await sleep(500);
      continue;
    }

    const botPlayerId: number = turn.Commands[0]?.PlayerId ?? turn.SuggestedCommand?.PlayerId;

    if (botPlayerId === PASSTHROUGH_PLAYER) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
      await sleep(300);
      continue;
    }

    turnCount++;
    const optionTypes = turn.Commands.map((c: any) => c.CommandType).join(", ");
    console.log(`\n[${turnCount}] Player ${botPlayerId} — ${turn.Commands.length} options: ${optionTypes}`);

    // Build prompt and ask LLM
    const prompt = buildPrompt(turn, botPlayerId);
    let chosenIdx = 0;
    try {
      chosenIdx = await askLLM(prompt, turn.Commands.length);
    } catch (e: any) {
      console.log(`  [llm error] ${e.message} — falling back to suggested`);
      try { await sendCommand(turn.SuggestedCommand); } catch {}
      await sleep(500);
      continue;
    }

    const chosen = turn.Commands[chosenIdx];
    console.log(`  → ${chosen.CommandType} (index ${chosenIdx})`);

    try {
      const result = await sendCommand(chosen);
      if (result?.Status !== "ok") {
        console.log(`  [rejected] falling back to suggested`);
        try { await sendCommand(turn.SuggestedCommand); } catch {}
      }
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("No pending turn")) {
        await sleep(2000);
      } else {
        console.log(`  [rejected] ${msg.slice(0, 60)}`);
        await sleep(500);
      }
    }

    await sleep(300);
  }

  console.log(`\nDone. ${turnCount} actions played.`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
