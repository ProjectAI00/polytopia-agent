# polytopia-agent

AI bot for [The Battle of Polytopia](https://store.steampowered.com/app/874390/The_Battle_of_Polytopia/) using a Mamba 130M world model trained on 41K games. Plug in an LLM on top for hybrid mode.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/ProjectAI00/polytopia-agent
cd polytopia-agent
npm install
```

### 2. Set up the world model

Requires Python with `torch` and `transformers`:

```bash
pip install torch transformers
```

The model checkpoint (`best_v2.pt`) lives in the `polytopia-bench` repo. Place it at:
```
../polytopia-bench/checkpoints/best_v2.pt
```

### 3. Launch Polytopia

Open Polytopia on Steam with the external bot controller enabled:
```
cl_controlport 5060
```

Start or join a game where your bot is a player.

### 4. Start the model server

```bash
cd ../polytopia-bench
python3 world_model/server.py --checkpoint checkpoints/best_v2.pt --port 7331
```

### 5. Run the bot

```bash
cd polytopia-agent
npm run bot
```

That's it. The bot takes over and plays automatically.

---

## Modes

| Mode | Command | What it does |
|------|---------|-------------|
| `mamba` | `npm run bot` | World model only — default, no API key needed |
| `hybrid` | `npm run bot:hybrid` | World model picks top 3 → LLM chooses the best |
| `llm` | `npm run bot:llm` | Pure LLM, no world model |

---

## LLM setup (hybrid / llm modes)

Set these env vars before running. Every LLM provider works — OpenRouter, OpenAI, Bedrock, LM Studio, anything with an OpenAI-compatible API.

```bash
# OpenRouter (recommended)
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://openrouter.ai/api/v1
export LLM_MODEL=anthropic/claude-haiku-4-5-20251001
export LLM_API_KEY=sk-or-...

npm run bot:hybrid
```

```bash
# AWS Bedrock (default if no provider set)
npm run bot:hybrid
```

```bash
# Local model via LM Studio
export LLM_PROVIDER=openai
export LLM_BASE_URL=http://localhost:1234/v1
export LLM_MODEL=your-model-name

npm run bot:hybrid
```

### All env vars

| Variable | Default | Notes |
|----------|---------|-------|
| `LLM_PROVIDER` | `bedrock` | `bedrock` or `openai` |
| `LLM_MODEL` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` / `gpt-5.4-mini` | Model ID |
| `LLM_API_KEY` | — | API key |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `HYBRID_TOP_N` | `3` | Candidates passed to LLM in hybrid mode |
| `AWS_REGION` | `us-east-1` | Bedrock region |

### Models (OpenRouter)

| Model | Notes |
|-------|-------|
| `anthropic/claude-haiku-4-5-20251001` | Fast, good for hybrid |
| `anthropic/claude-sonnet-4-6` | Stronger reasoning |
| `google/gemini-2.5-flash` | Fast alternative |
| `meta-llama/llama-4-scout` | Open-weight |
| `openai/gpt-5.4-mini` | OpenAI budget |

---

## Sessions

Every run saves a full game log to `sessions/` as JSONL — turn by turn, with Mamba scores, chosen actions, and LLM reasoning. Files are gitignored and stay local.

---

## How it works

The Mamba 130M model was trained on 41K synthetic Polytopia games via behavioral cloning. Each turn it scores every available action by `mean log P(action | state)` — higher score means the pattern matched more winning games. In hybrid mode, the LLM picks strategically between the world model's top candidates instead of choosing from scratch.
