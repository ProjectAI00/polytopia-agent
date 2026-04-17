# polytopia-agent

AI bot for [The Battle of Polytopia](https://store.steampowered.com/app/874390/The_Battle_of_Polytopia/).

---

## Requirements

- Node.js 18+
- Python 3.9+
- The Battle of Polytopia (Steam)

---

## Setup

**1. Steam launch option — do this once**

In Steam, right-click Polytopia → Properties → Launch Options:
```
cl_controlport 5060
```

**2. Install**

```bash
git clone https://github.com/ProjectAI00/polytopia-agent
cd polytopia-agent
npm install
```

This downloads the world model (~300MB) and Python dependencies automatically.

**3. Run**

```bash
npm run bot
```

First run asks which AI you want to use and saves your choice. Every run after that starts immediately.

---

## Switching AI

```bash
npm run setup
```

Walks you through the options again and overwrites your saved config.

---

## Modes

| Mode | What it does |
|------|-------------|
| `mamba` (default) | World model only — no API key needed |
| `hybrid` | World model picks candidates → LLM chooses the best |
| `llm` | Pure LLM, no world model |

Set during setup, or override anytime:
```bash
BOT_MODE=hybrid npm run bot
```

---

## Multi-player

To run bots for multiple players at once:

```bash
npm run play
```

---

## Docs

- [Getting started](docs/getting-started.md) — full setup walkthrough
- [Modes](docs/modes.md) — mamba vs hybrid vs llm, provider options
- [Multi-agent](docs/multi-agent.md) — running multiple bots at once

---

## Sessions

Every run saves a full game log to `sessions/` — actions, scores, and LLM reasoning. Stays local, never committed.
