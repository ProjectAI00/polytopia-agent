/**
 * hybridPlay.ts — Legacy hybrid bot. Use bot.ts (BOT_MODE=hybrid) instead.
 * LLM config via env vars — see llmBackend.ts.
 */

import { getBotTurn, sendCommand } from "./gameApi.js";
import { prepareRankInput } from "./adapter.js";
import { rankActions, checkMamba } from "./mambaClient.js";
import { buildPrompt } from "./llmFormatter.js";
import { askLLM, getLLMInfo } from "./llmBackend.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const PASSTHROUGH_PLAYER = 255;
const TOP_N = 3;

async function pickWithLLM(
  turn: any,
  botPlayerId: number,
  candidates: Array<{ idx: number; label: string; score: number }>,
): Promise<number> {
  const basePrompt = buildPrompt(turn, botPlayerId);
  const candidateList = candidates
    .map((c, i) => `${i + 1}. [${c.label}] (Mamba score: ${c.score.toFixed(2)})`)
    .join("\n");
  const hybridPrompt = `${basePrompt}

The world model has pre-selected these top ${candidates.length} candidates (ranked by learned pattern):
${candidateList}

Choose the best of these ${candidates.length} options. Respond ONLY with JSON: {"choice": <1-${candidates.length}>, "reason": "<one sentence>"}`;

  const text = await askLLM(hybridPrompt, 200);
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
    console.error("Mamba server not running on :7331. Start it first:\n  cd polytopia-bench && python3 world_model/server.py --checkpoint checkpoints/polytopia-world-model.pt --port 7331");
    process.exit(1);
  }
  console.log(`Hybrid bot (Mamba top-${TOP_N} → ${getLLMInfo()}). Waiting...\n`);

  let turnCount = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(0);
    } catch (e: any) {
      if (e.message?.startsWith("Bad JSON")) { await sleep(200); continue; }
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
      continue;
    }

    const botPlayerId: number = turn.Commands[0]?.PlayerId ?? turn.SuggestedCommand?.PlayerId;

    if (botPlayerId === PASSTHROUGH_PLAYER) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
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
        chosenIdx = await pickWithLLM(turn, botPlayerId, topN);
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
        await sleep(300);
      } else {
        console.log(`  [rejected] ${msg.slice(0, 60)}`);
        await sleep(100);
      }
    }
  }

  console.log(`\nDone. ${turnCount} actions played.`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
