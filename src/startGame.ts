/**
 * startGame.ts — Start a 1v1 game and immediately run the bot for P2.
 *
 * Player 1 = Human (you)
 * Player 2 = Bot (Blackbox hybrid agent)
 *
 * Usage:
 *   npm run start:1v1
 *
 * Requires:
 *   - Polytopia running with cl_controlport 5060
 *   - .env configured with your Blackbox API key
 *   - npm install done (world model downloaded)
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// Load .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { startGame } from "./gameApi.js";
import { getBotTurn, sendCommand } from "./gameApi.js";
import { prepareRankInput } from "./adapter.js";
import { rankActions, checkMamba } from "./mambaClient.js";
import { buildPrompt } from "./llmFormatter.js";
import { askLLM, getLLMInfo } from "./llmBackend.js";
import { Session, TurnEntry } from "./session.js";
import { spawn as spawnProc } from "child_process";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const MODE = (process.env.BOT_MODE ?? "hybrid") as "mamba" | "hybrid" | "llm";
const HYBRID_TOP_N = parseInt(process.env.HYBRID_TOP_N ?? "3");
const PASSTHROUGH_PLAYER = 255;

const MODEL_PATH = path.join(process.cwd(), "model", "polytopia-world-model.pt");
const SERVER_SCRIPT = path.join(process.cwd(), "world_model", "server.py");
const PYTHON_BIN = process.env.PYTHON_BIN
  ?? (process.env.HOME ? `${process.env.HOME}/.imi/venv/bin/python3` : null)
  ?? "python3";

// ── Game settings ─────────────────────────────────────────────────────────────

// 1v1: Human (P1) vs Bot (P2, Bardur tribe=0)
// Adjust Tribe IDs: 0=Bardur, 1=Imperius, 2=Oumaji, 3=Kickoo, etc.
const GAME_SETTINGS = {
  Players: [
    { Type: "Human",  Tribe: 1 },  // P1 — you (Imperius)
    { Type: "Bot",    Tribe: 0 },  // P2 — Blackbox agent (Bardur)
  ],
  MapSize: "small",   // small | medium | large
  GameMode: 0,        // 0=domination (default)
};

// ── Mamba server ──────────────────────────────────────────────────────────────

async function startMambaServer(): Promise<void> {
  if (await checkMamba()) return;
  console.log("  Starting world model server...");
  const proc = spawnProc(PYTHON_BIN, [SERVER_SCRIPT, "--checkpoint", MODEL_PATH, "--port", "7331"], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });
  proc.unref();
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await checkMamba()) { console.log("  World model ready.\n"); return; }
  }
  throw new Error("World model server failed to start. Run: npm install");
}

// ── Decision helpers (mirrors bot.ts) ─────────────────────────────────────────

function parseLLMChoice(text: string, max: number): { idx: number; reason: string } {
  const match = text.match(/\{[^}]+\}/);
  if (!match) return { idx: 0, reason: "" };
  try {
    const p = JSON.parse(match[0]);
    return {
      idx: Math.max(0, Math.min(parseInt(p.choice ?? "1") - 1, max - 1)),
      reason: p.reason ?? "",
    };
  } catch { return { idx: 0, reason: "" }; }
}

async function decideHybrid(turn: any, botPlayerId: number) {
  const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
  const ranked: any[] = await rankActions(stateTokens, actions);

  const scores: Record<string, number> = {};
  ranked.forEach(r => { scores[r.label] = r.score; });
  console.log(`  [mamba] ${ranked.map(r => `${r.label}:${r.score.toFixed(2)}`).join("  ")}`);

  const topN = ranked.slice(0, Math.min(HYBRID_TOP_N, ranked.length));
  if (topN.length === 1) {
    console.log(`  → ${topN[0].label} (only option)`);
    return { chosenIdx: topN[0].idx, label: topN[0].label, mambaScores: scores };
  }

  const basePrompt = buildPrompt(turn, botPlayerId);
  const candidateList = topN
    .map((c, i) => `${i + 1}. [${c.label}] (world model score: ${c.score.toFixed(2)})`)
    .join("\n");
  const hybridPrompt = `${basePrompt}

The world model pre-selected these top ${topN.length} candidates (by learned pattern score):
${candidateList}

Choose the best of these ${topN.length} options. Respond ONLY with JSON: {"choice": <1-${topN.length}>, "reason": "<one sentence>"}`;

  const llmText = await askLLM(hybridPrompt, 200);
  const { idx: candidateIdx, reason } = parseLLMChoice(llmText, topN.length);
  const chosen = topN[candidateIdx];
  console.log(`  [blackbox] → ${chosen.label}: ${reason}`);
  return { chosenIdx: chosen.idx, label: chosen.label, mambaScores: scores, reason };
}

async function decideMamba(turn: any, botPlayerId: number) {
  const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
  const ranked: any[] = await rankActions(stateTokens, actions);
  const scores: Record<string, number> = {};
  ranked.forEach(r => { scores[r.label] = r.score; });
  console.log(`  [mamba] ${ranked.map(r => `${r.label}:${r.score.toFixed(2)}`).join("  ")}`);
  return { chosenIdx: ranked[0].idx, label: ranked[0].label, mambaScores: scores };
}

async function decideLLM(turn: any, botPlayerId: number) {
  const prompt = buildPrompt(turn, botPlayerId);
  const llmText = await askLLM(prompt, 256);
  const { idx, reason } = parseLLMChoice(llmText, turn.Commands.length);
  const label = turn.Commands[idx]?.CommandType ?? "unknown";
  console.log(`  [blackbox] → ${label}: ${reason}`);
  return { chosenIdx: idx, label, reason };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎮  Polytopia 1v1 Setup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Validate API key
  const apiKey = process.env.LLM_API_KEY ?? "";
  if (apiKey === "your-blackbox-api-key-here" || apiKey === "") {
    console.error("❌  LLM_API_KEY not set. Edit .env first, then run: npm run test:llm");
    process.exit(1);
  }

  console.log(`  Mode     : ${MODE}`);
  console.log(`  LLM      : ${getLLMInfo()}`);
  console.log(`  Players  : Human (P1, Imperius) vs Blackbox Bot (P2, Bardur)`);
  console.log(`  Map      : ${GAME_SETTINGS.MapSize}\n`);

  // Start Mamba if needed
  if (MODE === "mamba" || MODE === "hybrid") {
    await startMambaServer();
  }

  // Start the game
  console.log("  Starting game via API...");
  let gameStarted = false;
  try {
    const result = await startGame(GAME_SETTINGS);
    console.log(`  ✅  Game started:`, JSON.stringify(result));
    gameStarted = true;
  } catch (e: any) {
    // Some API versions return non-200 even on success, or the endpoint may differ
    console.warn(`  ⚠️   startGame response: ${e.message}`);
    console.warn(`  → Assuming game is already running. Proceeding to bot loop.\n`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🤖  Bot active — waiting for P2 turns...\n`);

  const session = new Session(MODE, getLLMInfo());
  let turnCount = 0;

  while (true) {
    let turn: any;
    try {
      turn = await getBotTurn(0);
    } catch (e: any) {
      await sleep(200); continue;
    }

    if (turn.SuggestedCommand?.CommandType === "EndMatch") {
      console.log("\n🏁  Game over.");
      session.close(turnCount, "EndMatch");
      break;
    }

    // Trigger events (city reward, etc.)
    if (!turn.Commands || turn.Commands.length === 0) {
      const sc = turn.SuggestedCommand;
      const triggerType = turn.Trigger?.type ?? "unknown";
      console.log(`  [trigger] ${triggerType} → ${sc?.CommandType ?? "?"}`);
      try { await sendCommand(sc); } catch {}
      continue;
    }

    const botPlayerId: number = turn.Commands[0]?.PlayerId ?? turn.SuggestedCommand?.PlayerId;

    // Passthrough barbarians
    if (botPlayerId === PASSTHROUGH_PLAYER) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
      continue;
    }

    turnCount++;
    const gameTurn = (turn.State?.CurrentTurn ?? 0) + 1;
    const optionTypes = turn.Commands.map((c: any) => c.CommandType).join(", ");
    console.log(`\n[${turnCount}] P${botPlayerId} turn ${gameTurn} — ${turn.Commands.length} options: ${optionTypes}`);

    let decision: any;
    try {
      if (MODE === "mamba")       decision = await decideMamba(turn, botPlayerId);
      else if (MODE === "hybrid") decision = await decideHybrid(turn, botPlayerId);
      else                        decision = await decideLLM(turn, botPlayerId);
    } catch (e: any) {
      console.log(`  [decide error] ${e.message} — using suggested`);
      try { await sendCommand(turn.SuggestedCommand); } catch {}
      continue;
    }

    console.log(`  → ${decision.label} (idx ${decision.chosenIdx})`);

    let accepted = false;
    try {
      const result = await sendCommand(turn.Commands[decision.chosenIdx]);
      accepted = result?.Status !== "rejected";
      if (!accepted) {
        console.log(`  [rejected] falling back to suggested`);
        try { await sendCommand(turn.SuggestedCommand); } catch {}
      }
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("No pending turn")) { await sleep(300); }
      else { console.log(`  [rejected] ${msg.slice(0, 60)}`); await sleep(100); }
    }

    const entry: TurnEntry = {
      timestamp: Date.now(),
      botTurn: turnCount,
      gameTurn,
      playerId: botPlayerId,
      mode: MODE,
      commands: turn.Commands.map((c: any) => c.CommandType),
      mambaScores: decision.mambaScores,
      chosenIdx: decision.chosenIdx,
      chosenLabel: decision.label,
      reason: decision.reason,
      accepted,
    };
    session.log(entry);
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
