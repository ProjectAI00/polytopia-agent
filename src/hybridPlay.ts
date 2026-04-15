/**
 * hybridPlay.ts — Mamba world model + Claude Haiku hybrid bot.
 *
 * Pipeline per turn:
 *   1. Mamba ranks ALL available actions by log-probability (learned pattern matching)
 *   2. Top-N candidates (by Mamba score) are passed to Claude Haiku
 *   3. Haiku picks the best one with strategic reasoning
 *
 * This gives Mamba's trained pattern recognition + LLM's strategic reasoning.
 * Falls back to pure Mamba if LLM errors.
 *
 * Requires:
 *   - Polytopia running on external-bot-controller branch, cl_controlport 5060
 *   - Mamba server: cd polytopia-bench && python3 world_model/server.py --checkpoint checkpoints/best_v2.pt --port 7331
 *   - AWS credentials configured (uses Bedrock us-east-1)
 */

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { getBotTurn, sendCommand } from "./gameApi.js";
import { prepareRankInput } from "./adapter.js";
import { rankActions, checkMamba } from "./mambaClient.js";
import { buildPrompt } from "./llmFormatter.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const PASSTHROUGH_PLAYER = 255;
const MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const TOP_N = 3; // how many Mamba top candidates to show the LLM

const client = new AnthropicBedrock({ awsRegion: "us-east-1" });

/**
 * Ask LLM to pick the best action from a pre-filtered candidate list.
 * The prompt tells LLM these are already Mamba's top picks so it focuses
 * on strategic reasoning between them, not from scratch.
 */
async function askLLM(
  turn: any,
  botPlayerId: number,
  candidates: Array<{ idx: number; label: string; score: number }>,
): Promise<number> {
  const basePrompt = buildPrompt(turn, botPlayerId);

  // Build a focused candidate-only action list
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.label}] (Mamba score: ${c.score.toFixed(2)})`)
    .join("\n");

  const hybridPrompt = `${basePrompt}

The world model has pre-selected these top ${candidates.length} candidates (ranked by learned pattern):
${candidateList}

Choose the best of these ${candidates.length} options. Respond ONLY with JSON: {"choice": <1-${candidates.length}>, "reason": "<one sentence>"}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: "user", content: hybridPrompt }],
  });

  const text = (msg.content[0] as any).text ?? "";
  const match = text.match(/\{[^}]+\}/);
  if (!match) {
    console.log(`  [llm] bad response — using Mamba top-1`);
    return candidates[0].idx;
  }
  try {
    const parsed = JSON.parse(match[0]);
    const pick = Math.max(0, Math.min(parseInt(parsed.choice ?? "1") - 1, candidates.length - 1));
    const reason = parsed.reason ?? "";
    console.log(`  [llm] → ${candidates[pick].label}: ${reason}`);
    return candidates[pick].idx;
  } catch {
    return candidates[0].idx;
  }
}

async function main() {
  const mambaOk = await checkMamba();
  if (!mambaOk) {
    console.error("Mamba server not running on :7331. Start it first:\n  cd polytopia-bench && python3 world_model/server.py --checkpoint checkpoints/best_v2.pt --port 7331");
    process.exit(1);
  }
  console.log(`Hybrid bot (Mamba top-${TOP_N} → Claude Haiku). Waiting...\n`);

  let turnCount = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(0);
    } catch (e: any) {
      if (e.message?.startsWith("Bad JSON")) { await sleep(1000); continue; }
      throw e;
    }

    if (turn.SuggestedCommand?.CommandType === "EndMatch") {
      console.log("Game over.");
      break;
    }

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

    // Step 1: Mamba ranks all actions
    const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
    let ranked: any[];
    try {
      ranked = await rankActions(stateTokens, actions);
    } catch (e: any) {
      console.log(`  [mamba error] ${e.message} — using suggested`);
      try { await sendCommand(turn.SuggestedCommand); } catch {}
      await sleep(500);
      continue;
    }

    const allScores = ranked.map((r: any) => `${r.label}:${r.score.toFixed(2)}`).join("  ");
    console.log(`  [mamba] ${allScores}`);

    // Step 2: Take top-N, pass to LLM for strategic pick
    const topN = ranked.slice(0, Math.min(TOP_N, ranked.length));

    // If only 1 candidate or all same score, skip LLM
    let chosenIdx: number;
    if (topN.length === 1) {
      chosenIdx = topN[0].idx;
      console.log(`  → ${topN[0].label} (only option)`);
    } else {
      try {
        chosenIdx = await askLLM(turn, botPlayerId, topN);
      } catch (e: any) {
        console.log(`  [llm error] ${e.message} — using Mamba top-1`);
        chosenIdx = topN[0].idx;
      }
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
