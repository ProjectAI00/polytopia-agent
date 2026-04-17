# Multi-Agent

Run multiple bot agents at once — one per player, all in parallel.

---

## Quick start

```bash
npm run play
```

Starts 3 bot agents for players 2, 3, and 4. You play as player 1.

---

## Custom player set

```bash
PLAYERS="2" npm run play          # 1v1 — just P2 is a bot
PLAYERS="2 3" npm run play        # you vs two bots
PLAYERS="2 3 4" npm run play      # you vs three bots
```

---

## How it works

Each agent runs as an independent process. They all poll the game API concurrently — no waiting for each other between turns. Output is color-coded by player in your terminal:

```
[P2] [mamba] Move:1.23  Attack:0.87  EndTurn:0.41
[P3] [mamba] Spawn:2.11  Move:0.94
[P2] → Move (index 2)
[P3] → Spawn (index 0)
```

---

## Orchestrator (advanced)

The `npm run play` command uses `play.sh`. There's also a TypeScript orchestrator with richer output:

```bash
npm run orchestrate            # P2 only (1v1)
npm run orchestrate:1v1        # same
npm run orchestrate:3p         # P2 + P3
```

The orchestrator also calls the game API to start the match automatically — you don't need to set up the game manually in the UI.

---

## Notes

- All agents share the same `.env` config (same mode, same LLM)
- The world model server starts once and is shared across agents
- Sessions are saved separately per agent in `sessions/`
