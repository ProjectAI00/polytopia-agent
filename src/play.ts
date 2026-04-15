/**
 * play.ts — Bot loop.
 *
 * Start:
 *   npx tsx src/play.ts
 *
 * Requires:
 *   - Polytopia running on external-bot-controller branch, cl_controlport 5060
 *   - Mamba server: cd polytopia-bench && /Users/aimar/.imi/venv/bin/python3 world_model/server.py --checkpoint checkpoints/best_v2.pt --port 7331
 */

import { getBotTurn, sendCommand } from "./gameApi.js";
import { prepareRankInput } from "./adapter.js";
import { rankActions, checkMamba } from "./mambaClient.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Player 255 = Barbarians/Wanderers — game handles them, we just pass EndTurn
const PASSTHROUGH_PLAYER = 255;

async function main() {
  const mambaOk = await checkMamba();
  if (!mambaOk) {
    console.error("Mamba server not running on :7331. Start it first.");
    process.exit(1);
  }
  console.log("Mamba ready. Waiting for bot turn...\n");

  let turnCount = 0;
  let lastErrorTime = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(0);
    } catch (e: any) {
      if (e.message?.startsWith("Bad JSON")) {
        // Empty body = game signalling end of commands, wait for next turn
        await sleep(1000);
        continue;
      }
      throw e;
    }

    // Game over
    if (turn.SuggestedCommand?.CommandType === "EndMatch") {
      console.log("Game over.");
      break;
    }

    // Trigger event (city level-up, peace request) — no Commands list
    if (!turn.Commands || turn.Commands.length === 0) {
      console.log(`  [trigger] ${turn.Trigger?.type ?? "unknown"} — following suggestion`);
      try { await sendCommand(turn.SuggestedCommand); } catch {}
      await sleep(500);
      continue;
    }

    const botPlayerId: number = turn.Commands[0]?.PlayerId ?? turn.SuggestedCommand?.PlayerId;

    // Pass through Barbarians/Wanderers — just send their suggested command
    if (botPlayerId === PASSTHROUGH_PLAYER) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
      await sleep(300);
      continue;
    }

    turnCount++;
    const optionTypes = turn.Commands.map((c: any) => c.CommandType).join(", ");
    console.log(`[${turnCount}] Player ${botPlayerId} — ${turn.Commands.length} options: ${optionTypes}`);

    // Rank via Mamba and pick best
    const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
    const ranked = await rankActions(stateTokens, actions);
    const best = ranked[0];

    const allScores = ranked.map(r => `${r.label}:${r.score.toFixed(2)}`).join("  ");
    console.log(`  scores: ${allScores}`);
    console.log(`  → ${best.label} (score ${best.score.toFixed(3)})`);

    // Send command
    try {
      const result = await sendCommand(turn.Commands[best.idx]);
      if (result?.Status !== "ok") {
        console.log(`  [rejected] falling back to suggested: ${turn.SuggestedCommand?.CommandType}`);
        try { await sendCommand(turn.SuggestedCommand); } catch {}
      }
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("No pending turn")) {
        // Game already moved on — back off and wait for next real turn
        await sleep(2000);
      } else {
        console.log(`  [rejected] ${msg.slice(0, 60)}`);
        await sleep(500);
      }
    }

    await sleep(200);
  }

  console.log(`\nDone. ${turnCount} actions played.`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
