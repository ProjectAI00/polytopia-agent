#!/usr/bin/env python3
"""
setup.py — one-time setup for the Polytopia World Model.

Run automatically via `npm install` (postinstall).
Also safe to re-run manually: skips download if model already exists.

Steps:
  1. Install Python dependencies (torch, transformers, huggingface_hub)
  2. Download polytopia-world-model.pt from HuggingFace
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
MODEL_DIR = ROOT / "model"
MODEL_PATH = MODEL_DIR / "polytopia-world-model.pt"
HF_REPO = "ProjectAI00/polytopia-world-model"

# ── Step 1: Python deps ───────────────────────────────────────────────────────

print("Installing Python dependencies...")
subprocess.check_call([
    sys.executable, "-m", "pip", "install", "--quiet",
    "torch", "transformers", "huggingface_hub",
])
print("  ✓ torch, transformers, huggingface_hub")

# ── Step 2: Model download ────────────────────────────────────────────────────

if MODEL_PATH.exists():
    print(f"Model already present: {MODEL_PATH}")
    sys.exit(0)

print(f"Downloading Polytopia World Model from {HF_REPO}...")
MODEL_DIR.mkdir(exist_ok=True)

from huggingface_hub import hf_hub_download

hf_hub_download(
    repo_id=HF_REPO,
    filename="polytopia-world-model.pt",
    local_dir=str(MODEL_DIR),
)

print(f"  ✓ Model saved to {MODEL_PATH}")
print("Setup complete.")
