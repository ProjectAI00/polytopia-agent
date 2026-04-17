# Getting Started

## What this is

An AI bot for The Battle of Polytopia. You play as normal — the bot controls one or more opponent tribes. It uses a Mamba world model trained on 41K games, optionally combined with an LLM for strategic reasoning.

---

## Before you begin

You need:
- [Node.js 18+](https://nodejs.org)
- Python 3.9+
- Polytopia on the beta branch (API port is already active)

---

## Step 1 — Install

```bash
git clone https://github.com/ProjectAI00/polytopia-agent
cd polytopia-agent
npm install
```

`npm install` automatically downloads the world model (~300MB from HuggingFace) and installs Python dependencies. Takes about a minute the first time.

---

## Step 2 — Configure

```bash
npm run bot
```

First run launches a setup wizard:

```
Which AI do you want to use?

  1. LM Studio   (local model, no API key needed)
  2. OpenRouter  (cloud, any model)
  3. AWS Bedrock (Claude via AWS)
  4. OpenAI      (GPT models)
  5. Skip        (world model only, no LLM)
```

Pick your option, follow the prompts, and your config is saved to `.env`. You won't see this again unless you run `npm run setup`.

---

## Step 3 — Play

1. Open Polytopia and start a game that includes a bot player
2. Run `npm run bot` in your terminal

The bot takes over immediately when it's the bot player's turn. You play your own turns normally in the game window.

To stop the bot, press `Ctrl+C`.

---

## Switching AI later

```bash
npm run setup
```

Walks through the same wizard and overwrites your saved config.
