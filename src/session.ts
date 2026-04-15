/**
 * session.ts — Persistent game session logging.
 *
 * Each bot run creates sessions/<timestamp>-<mode>.jsonl
 * Every action is appended as one JSON line.
 * On game over, a _end summary line is appended.
 *
 * Format:
 *   Line 1:   { _meta: { id, startTime, mode, llmInfo } }
 *   Lines 2+: { timestamp, botTurn, gameTurn, playerId, mode, commands,
 *               mambaScores?, chosenIdx, chosenLabel, reason?, accepted }
 *   Last:     { _end: { totalTurns, reason, timestamp } }
 */

import fs from "fs";
import path from "path";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

export interface TurnEntry {
  timestamp: number;
  botTurn: number;       // sequential action number this run
  gameTurn: number;      // game's internal turn counter
  playerId: number;
  mode: string;
  commands: string[];    // CommandType labels for all available commands
  mambaScores?: Record<string, number>; // label → log-prob score (mamba/hybrid only)
  chosenIdx: number;
  chosenLabel: string;
  reason?: string;       // LLM reasoning string (hybrid/llm only)
  accepted: boolean;     // whether the game accepted the command
}

export class Session {
  private filePath: string;

  constructor(mode: string, llmInfo?: string) {
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("") + "-" + [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");

    const id = `${ts}-${mode}`;
    this.filePath = path.join(SESSIONS_DIR, `${id}.jsonl`);

    const meta = { id, startTime: Date.now(), mode, ...(llmInfo ? { llmInfo } : {}) };
    fs.appendFileSync(this.filePath, JSON.stringify({ _meta: meta }) + "\n");
    console.log(`Session: ${this.filePath}`);
  }

  log(entry: TurnEntry): void {
    fs.appendFileSync(this.filePath, JSON.stringify(entry) + "\n");
  }

  close(totalTurns: number, reason: string): void {
    fs.appendFileSync(
      this.filePath,
      JSON.stringify({ _end: { totalTurns, reason, timestamp: Date.now() } }) + "\n",
    );
    console.log(`Session closed (${totalTurns} turns).`);
  }
}
