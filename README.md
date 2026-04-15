# polytopia-agent

AI bot for [The Battle of Polytopia](https://store.steampowered.com/app/874390/The_Battle_of_Polytopia/) using a Mamba 130M world model trained on 41K games.

---

## Play

### 1. Clone and install

```bash
git clone https://github.com/ProjectAI00/polytopia-agent
cd polytopia-agent
npm install
```

`npm install` automatically downloads the Polytopia World Model from HuggingFace and installs the Python dependencies (`torch`, `transformers`). This takes a minute the first time.

### 2. Launch Polytopia

Open the game with the external bot controller enabled:
```
cl_controlport 5060
```
Start or join a game where your bot is a player.

### 3. Run the bot

```bash
npm run bot
```

The world model server starts automatically in the background. The bot plays on its own from here.

---

## Modes

| Mode | Command | What it does |
|------|---------|-------------|
| `mamba` | `npm run bot` | World model only — default, no API key needed |
| `hybrid` | `npm run bot:hybrid` | World model picks top 3 → LLM chooses the best |
| `llm` | `npm run bot:llm` | Pure LLM, no world model |

---

## LLM setup (hybrid / llm modes)

Works with any LLM provider — OpenRouter, OpenAI, Bedrock, LM Studio, anything OpenAI-compatible.

```bash
# OpenRouter
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://openrouter.ai/api/v1
export LLM_MODEL=anthropic/claude-haiku-4-5-20251001
export LLM_API_KEY=sk-or-...
npm run bot:hybrid

# AWS Bedrock (default if no provider set)
npm run bot:hybrid

# Local via LM Studio
export LLM_PROVIDER=openai
export LLM_BASE_URL=http://localhost:1234/v1
export LLM_MODEL=your-model-name
npm run bot:hybrid
```

### Env vars

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

Every run saves a full game log to `sessions/` as JSONL — turn by turn, with world model scores, chosen actions, and LLM reasoning. Files stay local and are not committed.

---

## How it works

The world model (Mamba 130M) was trained on 41K synthetic Polytopia games via behavioral cloning. Each turn it scores every available action by `mean log P(action | state)` — higher score means the pattern matched more winning games. In hybrid mode, the LLM picks strategically between the world model's top candidates instead of choosing from scratch.
