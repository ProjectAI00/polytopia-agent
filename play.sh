#!/usr/bin/env bash
# play.sh — start all bot agents for a multi-player game.
#
# Usage:
#   ./play.sh            → 3 agents (players 2, 3, 4) in hybrid mode
#   ./play.sh 2          → single agent for player 2
#   PLAYERS="2 3" ./play.sh  → custom player set
#
# Each agent runs in its own terminal pane and owns one tribe.
# BOT_MODE and LLM env vars are inherited from the shell.

BOT_MODE="${BOT_MODE:-hybrid}"
PLAYERS="${PLAYERS:-2 3 4}"

echo "Starting polytopia-agent [${BOT_MODE}] for players: ${PLAYERS}"

pids=()
for pid in $PLAYERS; do
  BOT_MODE="$BOT_MODE" PLAYER_ID="$pid" npx tsx src/bot.ts 2>&1 | \
    sed "s/^/[P${pid}] /" &
  pids+=($!)
  echo "  Agent P${pid} started (pid $!)"
  sleep 0.5
done

echo ""
echo "All agents running. Press Ctrl+C to stop."

# Forward Ctrl+C to all child processes
trap 'echo "Stopping..."; kill "${pids[@]}" 2>/dev/null' INT TERM
wait "${pids[@]}"
