# Bot Modes

The bot has three modes. You pick one during setup, or override it anytime with `BOT_MODE=`.

---

## mamba — World model only

```bash
npm run bot
# or explicitly:
BOT_MODE=mamba npm run bot
```

Uses the Mamba 130M world model trained on 41K Polytopia games. Each turn it scores every available action by how often that pattern appeared in winning games and picks the best one.

**No API key needed.** Fastest option.

---

## hybrid — World model + LLM

```bash
BOT_MODE=hybrid npm run bot
# or just set BOT_MODE=hybrid in .env
```

The world model narrows the field to the top 3 candidates, then an LLM picks the best one with strategic reasoning. Combines pattern recognition with situational judgment.

Requires an LLM configured (set during `npm run setup`).

To change how many candidates the LLM sees:
```bash
HYBRID_TOP_N=5 npm run bot   # default is 3
```

---

## llm — Pure LLM

```bash
BOT_MODE=llm npm run bot
```

The LLM sees the full game state and picks from all available actions directly. Slowest but most flexible — useful for testing prompts or trying a new model.

Requires an LLM configured.

---

## Supported LLM providers

All configured via `npm run setup` or `.env` directly.

| Provider | Notes |
|----------|-------|
| **LM Studio** | Local model, no API key, runs on your machine |
| **OpenRouter** | Cloud, pay-per-use, access to Claude / Gemini / Llama / GPT |
| **AWS Bedrock** | Claude models via AWS, uses `~/.aws` credentials by default |
| **OpenAI** | GPT models directly |
| Any OpenAI-compatible API | Set `LLM_BASE_URL` to any compatible endpoint |

---

## Recommended models (OpenRouter)

| Model | Best for |
|-------|----------|
| `anthropic/claude-haiku-4-5-20251001` | Fast, cheap — good default for hybrid |
| `anthropic/claude-sonnet-4-6` | Stronger reasoning |
| `google/gemini-2.5-flash` | Fast alternative |
| `meta-llama/llama-4-scout` | Open-weight option |
