/**
 * bot.ts — Unified Polytopia bot.
 *
 * BOT_MODE=mamba   → Pure world model (default)
 * BOT_MODE=hybrid  → World model top-N → LLM picks
 * BOT_MODE=llm     → Pure LLM
 *
 * The world model server starts automatically if not already running.
 * Run `npm install` once to download the model.
 */

import { spawn } from "child_process";
import path from "path";
import { getBotTurn, sendCommand } from "./gameApi.js";
import { prepareRankInput } from "./adapter.js";
import { rankActions, checkMamba } from "./mambaClient.js";
import { buildPrompt } from "./llmFormatter.js";
import { askLLM, getLLMInfo } from "./llmBackend.js";
import { Session, TurnEntry } from "./session.js";

const MODEL_PATH = path.join(process.cwd(), "model", "polytopia-world-model.pt");
const SERVER_SCRIPT = path.join(process.cwd(), "world_model", "server.py");
// Use PYTHON_BIN env var if set, otherwise fall back to common venv location, then system python3
const PYTHON_BIN = process.env.PYTHON_BIN
  ?? (process.env.HOME ? `${process.env.HOME}/.imi/venv/bin/python3` : null)
  ?? "python3";

async function startMambaServer(): Promise<void> {
  if (await checkMamba()) return;

  console.log("Starting world model server...");
  const proc = spawn(PYTHON_BIN, [SERVER_SCRIPT, "--checkpoint", MODEL_PATH, "--port", "7331"], {
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    cwd: process.cwd(),
  });
  proc.unref();

  // Wait up to 30s for the server to be ready (model load takes a few seconds)
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await checkMamba()) {
      console.log("World model server ready.\n");
      return;
    }
  }
  throw new Error("World model server failed to start. Check that Python deps are installed: npm install");
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Mode = "mamba" | "hybrid" | "llm";
const MODE: Mode = (process.env.BOT_MODE ?? "mamba").toLowerCase() as Mode;
const HYBRID_TOP_N = parseInt(process.env.HYBRID_TOP_N ?? "3");
const PASSTHROUGH_PLAYER = 255;

// PLAYER_ID: if set, this instance only handles that specific player.
// Use for multi-agent setups where each bot instance owns one tribe.
// If unset, handles all bot players (default single-process mode).
const PLAYER_ID = process.env.PLAYER_ID ? parseInt(process.env.PLAYER_ID) : null;

interface Decision {
  chosenIdx: number;
  label: string;
  mambaScores?: Record<string, number>;
  reason?: string;
}

/** Parse {"choice": N, "reason": "..."} from LLM text. Returns 0-indexed choice. */
function parseLLMChoice(text: string, maxChoices: number): { idx: number; reason: string } {
  const match = text.match(/\{[^}]+\}/);
  if (!match) return { idx: 0, reason: "" };
  try {
    const parsed = JSON.parse(match[0]);
    const idx = Math.max(0, Math.min(parseInt(parsed.choice ?? "1") - 1, maxChoices - 1));
    return { idx, reason: parsed.reason ?? "" };
  } catch {
    return { idx: 0, reason: "" };
  }
}

async function decideMamba(turn: any, botPlayerId: number): Promise<Decision> {
  const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
  const ranked: any[] = await rankActions(stateTokens, actions);

  const scores: Record<string, number> = {};
  ranked.forEach(r => { scores[r.label] = r.score; });

  const allStr = ranked.map(r => `${r.label}:${r.score.toFixed(2)}`).join("  ");
  console.log(`  [mamba] ${allStr}`);

  return { chosenIdx: ranked[0].idx, label: ranked[0].label, mambaScores: scores };
}

async function decideHybrid(turn: any, botPlayerId: number): Promise<Decision> {
  const { stateTokens, actions } = prepareRankInput(turn.State, turn.Commands, botPlayerId);
  const ranked: any[] = await rankActions(stateTokens, actions);

  const scores: Record<string, number> = {};
  ranked.forEach(r => { scores[r.label] = r.score; });

  const allStr = ranked.map(r => `${r.label}:${r.score.toFixed(2)}`).join("  ");
  console.log(`  [mamba] ${allStr}`);

  const topN = ranked.slice(0, Math.min(HYBRID_TOP_N, ranked.length));

  // Single candidate — skip LLM call
  if (topN.length === 1) {
    console.log(`  → ${topN[0].label} (only option)`);
    return { chosenIdx: topN[0].idx, label: topN[0].label, mambaScores: scores };
  }

  // Build hybrid prompt: full state context + focused candidate list
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
  console.log(`  [llm] → ${chosen.label}: ${reason}`);

  return { chosenIdx: chosen.idx, label: chosen.label, mambaScores: scores, reason };
}

async function decideLLM(turn: any, botPlayerId: number): Promise<Decision> {
  const prompt = buildPrompt(turn, botPlayerId);
  const llmText = await askLLM(prompt, 256);
  const { idx, reason } = parseLLMChoice(llmText, turn.Commands.length);
  const label = turn.Commands[idx]?.CommandType ?? "unknown";
  console.log(`  [llm] → ${label}: ${reason}`);
  return { chosenIdx: idx, label, reason };
}

async function main() {
  if (MODE !== "mamba" && MODE !== "hybrid" && MODE !== "llm") {
    console.error(`Unknown BOT_MODE="${MODE}". Use mamba, hybrid, or llm.`);
    process.exit(1);
  }

  if (MODE === "mamba" || MODE === "hybrid") {
    await startMambaServer();
  }

  const llmInfo = MODE !== "mamba" ? getLLMInfo() : undefined;
  const modeLabel = MODE === "hybrid"
    ? `hybrid (Mamba top-${HYBRID_TOP_N} → ${llmInfo})`
    : MODE === "llm"
    ? `llm (${llmInfo})`
    : "mamba";

  const playerLabel = PLAYER_ID !== null ? ` player=${PLAYER_ID}` : "";
  console.log(`Polytopia bot [${modeLabel}${playerLabel}]. Waiting...\n`);

  const session = new Session(MODE, llmInfo);
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
      session.close(turnCount, "EndMatch");
      break;
    }

    // Trigger event (city level-up, peace deal, etc.) — no Commands list
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

    // Barbarians / Wanderers — game handles them, just relay suggestion
    if (botPlayerId === PASSTHROUGH_PLAYER) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
      await sleep(300);
      continue;
    }

    // Multi-agent mode: skip turns that belong to other player instances
    if (PLAYER_ID !== null && botPlayerId !== PLAYER_ID) {
      try { await sendCommand(turn.SuggestedCommand ?? turn.Commands[0]); } catch {}
      await sleep(300);
      continue;
    }

    turnCount++;
    const gameTurn = (turn.State?.CurrentTurn ?? 0) + 1;
    const optionTypes = turn.Commands.map((c: any) => c.CommandType).join(", ");
    console.log(`\n[${turnCount}] Player ${botPlayerId} (turn ${gameTurn}) — ${turn.Commands.length} options: ${optionTypes}`);

    // Make decision
    let decision: Decision;
    try {
      if (MODE === "mamba") decision = await decideMamba(turn, botPlayerId);
      else if (MODE === "hybrid") decision = await decideHybrid(turn, botPlayerId);
      else decision = await decideLLM(turn, botPlayerId);
    } catch (e: any) {
      console.log(`  [decide error] ${e.message} — using suggested`);
      try { await sendCommand(turn.SuggestedCommand); } catch {}
      await sleep(500);
      continue;
    }

    console.log(`  → ${decision.label} (index ${decision.chosenIdx})`);

    // Send command to game
    let accepted = false;
    try {
      const apiResult = await sendCommand(turn.Commands[decision.chosenIdx]);
      accepted = apiResult?.Status !== "rejected";
      if (!accepted) {
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

    // Persist turn to session log
    const entry: TurnEntry = {
      timestamp: Date.now(),
      botTurn: turnCount,
      gameTurn,
      playerId: botPlayerId,
      mode: MODE,
      commands: turn.Commands.map((c: any) => c.CommandType),
      ...(decision.mambaScores && Object.keys(decision.mambaScores).length > 0
        ? { mambaScores: decision.mambaScores }
        : {}),
      chosenIdx: decision.chosenIdx,
      chosenLabel: decision.label,
      ...(decision.reason ? { reason: decision.reason } : {}),
      accepted,
    };
    session.log(entry);

    await sleep(300);
  }

  console.log(`\nDone. ${turnCount} actions played.`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
