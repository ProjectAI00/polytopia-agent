/**
 * diagnose.ts — Play a full game at max speed, collect every unique command
 * structure seen, and print a complete command format map at the end.
 *
 * Does NOT use Mamba — just follows SuggestedCommand for everything.
 * Goal: discover all command field names in one fast run.
 *
 * Usage:
 *   npx tsx src/diagnose.ts
 *
 * Start a fresh game first. Run ends when game is over.
 */

import { getBotTurn, sendCommand } from "./gameApi.js";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Track one example per CommandType
const seen = new Map<string, any>();

function record(cmd: any) {
  if (!cmd?.CommandType) return;
  if (!seen.has(cmd.CommandType)) {
    seen.set(cmd.CommandType, cmd);
    console.log(`  [NEW] ${cmd.CommandType}: ${JSON.stringify(cmd)}`);
  }
}

async function main() {
  console.log("Diagnose mode — playing full game via SuggestedCommand.\n");
  let turns = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(10_000);
    } catch (e: any) {
      if (e.message?.includes("timeout") || e.message?.startsWith("Bad JSON")) {
        try { await sendCommand({ CommandType: "EndTurn" }); } catch {}
        await sleep(200);
        continue;
      }
      throw e;
    }

    // Game over
    if (turn.SuggestedCommand?.CommandType === "EndMatch") {
      record(turn.SuggestedCommand);
      console.log("\nGame over.");
      break;
    }

    // Trigger (city reward, peace, etc.) — no Commands list
    if (!turn.Commands || turn.Commands.length === 0) {
      record(turn.SuggestedCommand);
      await sendCommand(turn.SuggestedCommand);
      await sleep(100);
      continue;
    }

    turns++;
    // Record every command in the available list
    for (const cmd of turn.Commands) record(cmd);

    // Just follow the suggestion — no ranking
    const chosen = turn.SuggestedCommand ?? turn.Commands[0];
    record(chosen);
    await sendCommand(chosen);
    await sleep(100);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Saw ${seen.size} distinct command types over ${turns} turns:\n`);
  for (const [type, example] of [...seen.entries()].sort()) {
    const fields = Object.keys(example).filter(k => k !== "CommandType");
    console.log(`${type}:`);
    console.log(`  fields: ${fields.join(", ")}`);
    console.log(`  example: ${JSON.stringify(example)}`);
    console.log();
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
