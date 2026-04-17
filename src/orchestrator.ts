/**
 * orchestrator.ts — Parallel multi-agent runner.
 *
 * Spawns one independent bot.ts process per player, all running concurrently.
 * Each agent owns exactly one tribe — no turn-blocking between players.
 *
 * Usage:
 *   npm run orchestrate          → 1v1 (P2 only, you are P1)
 *   PLAYERS="2 3" npm run orchestrate   → 2 bot players
 *   PLAYERS="2 3 4" npm run orchestrate → 3 bot players (4-player game)
 *
 * All LLM/bot env vars are inherited from .env / shell.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { startGame } from "./gameApi.js";

// ── Load .env (always override so shell stale vars don't win) ─────────────────
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const PLAYERS = (process.env.PLAYERS ?? "2").split(/\s+/).map(Number);
const MODE     = process.env.BOT_MODE ?? "hybrid";
const MODEL    = process.env.LLM_MODEL ?? "(default)";
const BOT_SCRIPT = path.join(process.cwd(), "src", "bot.ts");

// ANSI colors for each agent's log prefix
const COLORS = ["\x1b[36m", "\x1b[33m", "\x1b[35m", "\x1b[32m"]; // cyan, yellow, magenta, green
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

// Tribe names for display
const TRIBE: Record<number, string> = {
  0: "Bardur", 1: "Imperius", 2: "Oumaji", 3: "Kickoo",
  4: "Hoodrick", 5: "Luxidoor", 6: "Vengir", 7: "Zebasi",
};

// 1v1 game settings — P1 human, bot players fill the rest
// Tribes assigned round-robin starting from Bardur for bots
const BOT_TRIBES = [0, 2, 3, 4]; // Bardur, Oumaji, Kickoo, Hoodrick
const GAME_SETTINGS = {
  Players: [
    { Type: "Human", Tribe: 1 }, // P1 — you (Imperius)
    ...PLAYERS.map((_, i) => ({ Type: "Bot", Tribe: BOT_TRIBES[i] ?? i })),
  ],
  MapSize: PLAYERS.length === 1 ? "small" : "medium",
  GameMode: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function prefix(playerId: number, colorIdx: number): string {
  const color = COLORS[colorIdx % COLORS.length];
  return `${color}${BOLD}[P${playerId}]${RESET} `;
}

function banner() {
  console.log(`\n${BOLD}🎮  Polytopia Parallel Agent Orchestrator${RESET}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Mode     : ${BOLD}${MODE}${RESET}`);
  console.log(`  Model    : ${MODEL}`);
  console.log(`  Agents   : ${PLAYERS.map(p => `P${p}(${TRIBE[BOT_TRIBES[PLAYERS.indexOf(p)]] ?? "?"})`).join(" + ")}`);
  console.log(`  Map      : ${GAME_SETTINGS.MapSize}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  banner();

  // Try to start the game via API
  console.log("  Starting game...");
  try {
    const result = await startGame(GAME_SETTINGS);
    console.log(`  ✅  Game started: ${JSON.stringify(result)}\n`);
  } catch (e: any) {
    console.warn(`  ⚠️   startGame: ${e.message}`);
    console.warn(`  → Proceeding — assuming game is already running.\n`);
  }

  // Spawn one bot.ts process per player
  const procs: ReturnType<typeof spawn>[] = [];

  for (let i = 0; i < PLAYERS.length; i++) {
    const playerId = PLAYERS[i];
    const color    = COLORS[i % COLORS.length];
    const tag      = `${color}${BOLD}[P${playerId}]${RESET}`;

    const env = {
      ...process.env,
      BOT_MODE:   MODE,
      PLAYER_ID:  String(playerId),
    };

    const proc = spawn("npx", ["tsx", BOT_SCRIPT], { env, cwd: process.cwd() });
    procs.push(proc);

    proc.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) process.stdout.write(`${tag} ${line}\n`);
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) process.stderr.write(`${tag} ${DIM}${line}${RESET}\n`);
      }
    });

    proc.on("exit", (code) => {
      console.log(`\n${tag} Agent exited (code ${code})`);
      // If all agents done, exit orchestrator
      if (procs.every(p => p.exitCode !== null || p.killed)) {
        console.log(`\n${BOLD}🏁  All agents finished. Game over.${RESET}\n`);
        process.exit(0);
      }
    });

    console.log(`  ${tag} Agent spawned (pid ${proc.pid})`);
    // Small stagger so Mamba server is ready before second agent hits it
    await new Promise(r => setTimeout(r, 600));
  }

  console.log(`\n${BOLD}⚡  All ${PLAYERS.length} agent(s) running in parallel. Ctrl+C to stop.${RESET}\n`);

  // Forward Ctrl+C to all children
  process.on("SIGINT", () => {
    console.log("\n  Stopping all agents...");
    procs.forEach(p => { try { p.kill("SIGINT"); } catch {} });
    setTimeout(() => process.exit(0), 500);
  });

  process.on("SIGTERM", () => {
    procs.forEach(p => { try { p.kill("SIGTERM"); } catch {} });
    process.exit(0);
  });
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
