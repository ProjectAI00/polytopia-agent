# Getting Started

## What this is

An AI bot for The Battle of Polytopia. You play as normal — the bot controls one or more opponent tribes. It uses a Mamba world model trained on 41K games, optionally combined with an LLM for strategic reasoning.

---

## Before you begin

You need:
- [Node.js 18+](https://nodejs.org)
- Python 3.9+
- The Battle of Polytopia on Steam

---

## Step 1 — Steam launch option

This is a one-time setting. It tells the game to open an API port so the bot can connect.

1. Open Steam
2. Right-click **The Battle of Polytopia** → **Properties**
3. Under **Launch Options**, paste:
   ```
   cl_controlport 5060
   ```
4. Close. Every time you open the game from now on, the port will be active.

---

## Step 2 — Install

```bash
git clone https://github.com/ProjectAI00/polytopia-agent
cd polytopia-agent
npm install
```

`npm install` automatically downloads the world model (~300MB from HuggingFace) and installs Python dependencies. Takes about a minute the first time.

---

## Step 3 — Configure

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

## Step 4 — Play

1. Open Polytopia (with the Steam launch option set)
2. Start a game that includes a bot player
3. Run `npm run bot` in your terminal

The bot takes over immediately when it's the bot player's turn. You play your own turns normally in the game window.

To stop the bot, press `Ctrl+C`.

---

## Switching AI later

```bash
npm run setup
```

Walks through the same wizard and overwrites your saved config.
