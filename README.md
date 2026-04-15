# polytopia-agent

External bot controller for [The Battle of Polytopia](https://store.steampowered.com/app/874390/The_Battle_of_Polytopia/), wiring a **Mamba 130M world model** to the game's official external-bot-controller API.

Three modes:

| Mode | How it works |
|------|-------------|
| `mamba` | Pure world model — Mamba ranks all available actions by learned log-probability. Default, ships standard, no LLM required. |
| `hybrid` | Mamba scores everything → top-N candidates → LLM picks with strategic reasoning. Best of both worlds. |
| `llm` | Pure LLM — game state rendered as English, LLM picks any action. Plug in any model. |

---

## Requirements

- **Polytopia** running on the `external-bot-controller` branch with `cl_controlport 5060`
- **Node.js 18+** with `tsx`
- **Mamba server** (mamba / hybrid modes):
  ```
  cd polytopia-bench
  python3 world_model/server.py --checkpoint checkpoints/best_v2.pt --port 7331
  ```
- **LLM credentials** (hybrid / llm modes): AWS Bedrock (default) or any OpenAI-compatible API

---

## Setup

```bash
npm install
```

---

## Running

### Mamba (world model only)
```bash
npm run bot
# or explicitly:
npm run bot:mamba
```

### Hybrid (Mamba + LLM)
```bash
# AWS Bedrock (default)
npm run bot:hybrid

# OpenRouter
BOT_MODE=hybrid \
  LLM_PROVIDER=openai \
  LLM_BASE_URL=https://openrouter.ai/api/v1 \
  LLM_MODEL=anthropic/claude-haiku-4-5-20251001 \
  LLM_API_KEY=sk-or-... \
  npm run bot

# LM Studio (local)
BOT_MODE=hybrid \
  LLM_PROVIDER=openai \
  LLM_BASE_URL=http://localhost:1234/v1 \
  LLM_MODEL=your-local-model \
  npm run bot
```

### LLM only
```bash
# AWS Bedrock
npm run bot:llm

# OpenRouter
BOT_MODE=llm \
  LLM_PROVIDER=openai \
  LLM_BASE_URL=https://openrouter.ai/api/v1 \
  LLM_MODEL=google/gemini-2.5-flash \
  LLM_API_KEY=sk-or-... \
  npm run bot
```

---

## LLM configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `bedrock` | `bedrock` or `openai` (any OpenAI-compatible API) |
| `LLM_MODEL` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` (bedrock) / `gpt-4.1-mini` (openai) | Model ID |
| `LLM_API_KEY` | — | API key for openai provider |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL for openai provider |
| `HYBRID_TOP_N` | `3` | How many Mamba top candidates to pass to the LLM in hybrid mode |

### Tested models (OpenRouter, April 2026)

| Model ID | Speed | Notes |
|----------|-------|-------|
| `anthropic/claude-haiku-4-5-20251001` | Fast | Good default for hybrid |
| `anthropic/claude-sonnet-4-6` | Medium | Better strategic reasoning |
| `google/gemini-2.5-flash` | Fast | Cheap alternative |
| `meta-llama/llama-4-scout` | Fast | Open-weight option |
| `openai/gpt-4.1-mini` | Fast | OpenAI budget option |

---

## Sessions

Every run creates a persistent session log in `sessions/`:

```
sessions/20260416-143022-hybrid.jsonl
```

Each line is one JSON object:
- `_meta` — mode, LLM model, start time
- turn entries — game turn, available commands, Mamba scores, chosen action, LLM reason, accepted/rejected
- `_end` — total turns played, game result

Sessions are gitignored (your gameplay data stays local).

---

## Architecture

```
src/
  bot.ts          — unified entry point (BOT_MODE=mamba|hybrid|llm)
  session.ts      — persistent JSONL session logging
  llmBackend.ts   — pluggable LLM (Bedrock or any OpenAI-compatible API)
  llmFormatter.ts — game state → English prompt for LLM
  adapter.ts      — Magnus API game state → Mamba token sequences
  mambaClient.ts  — HTTP client for Mamba world model server (:7331)
  gameApi.ts      — HTTP client for Polytopia game API (:5060)
```

---

## How the world model works

Mamba 130M trained on 41K synthetic Polytopia games via behavioral cloning. Given the current game state encoded as a token sequence, it scores each candidate action by `mean log P(action_tokens | state_tokens)`. Actions with higher log-probability are patterns the model saw win more often.

In hybrid mode, the LLM doesn't score from scratch — it reasons strategically between the world model's top picks, combining pattern recognition with planning.
