/**
 * dumpState.ts
 *
 * Connects to the running Polytopia game and dumps the first bot turn state to a file.
 * Run this BEFORE writing the adapter — you need the real state shape first.
 *
 * Usage:
 *   npm run dump-state
 *
 * Prerequisites:
 *   1. Polytopia running on Steam beta branch "external-bot-controller"
 *   2. cl_controlport 5060 added to user_config.txt
 *   3. A single-player game in progress, human turn ended
 */

import { writeFileSync } from "fs";

const GAME_API = "http://localhost:8765";
const OUT_FILE = "state_dump.json";

async function main() {
  console.log("Waiting for bot turn from game API...");
  console.log("(Make sure Polytopia is running and you've ended your turn)\n");

  const res = await fetch(`${GAME_API}/api/current-bot-turn`);
  if (!res.ok) throw new Error(`Game API error: ${res.status}`);

  const data = await res.json();

  writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));
  console.log(`State dumped to ${OUT_FILE}`);
  console.log(`Commands available: ${data.Commands?.length ?? 0}`);
  console.log(`Suggested command:`, data.SuggestedCommand);
  console.log(`\nTop-level state keys:`, Object.keys(data.State ?? {}));
}

main().catch(console.error);
