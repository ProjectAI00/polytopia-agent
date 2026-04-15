"""
polytopia_scorer.py — PolytopiaMambaScorer

Uses the Mamba 130M model (polytopia-world-model.pt, d_model=512, n_layers=16) to score
Polytopia game states. The model was trained on 41K games with behavioral cloning
(next-token prediction on state→action sequences), so it has learned what action
types are most likely from any given state.

Two scoring modes:
  1. Pre-game: state = {"tribe": str, "map_type": str}
     Builds a synthetic turn-1 state from tribe/map tokens → gets action prior
  2. Per-turn: state = {"state_tokens": list[int], ...}
     Directly feeds real game state tokens → gets current action distribution

The action type distribution IS the world model's learned prior. Higher P(action)
= model saw this action type correlate with winning from this kind of state.

Weight loading: handles the single key difference between mamba_ssm training
(backbone.embedding.weight) and HF MambaForCausalLM inference
(backbone.embeddings.weight).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F
from transformers import MambaConfig, MambaForCausalLM

from world_model.scorer import WorldModelScorer
from world_model import token_vocab as V

log = logging.getLogger(__name__)

# Default checkpoint (relative to polytopia-bench/)
DEFAULT_CHECKPOINT = Path(__file__).parent.parent / "model" / "polytopia-world-model.pt"

# Architecture: d_model=512, n_layers=16 (trained on EC2 with mamba_ssm)
BEST_V2_D_MODEL  = 512
BEST_V2_N_LAYERS = 16


def _get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _load_model(path: Path, device: torch.device) -> MambaForCausalLM:
    """
    Load Mamba model from checkpoint.

    Handles the single key mismatch between mamba_ssm training weights
    (backbone.embedding.weight) and HF MambaForCausalLM
    (backbone.embeddings.weight).
    """
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    state = ckpt.get("model_state") or ckpt.get("model_state_dict")
    if state is None:
        raise ValueError(f"No model_state in checkpoint. Keys: {list(ckpt.keys())}")

    # Infer architecture from weights
    embed = state.get("backbone.embedding.weight")
    if embed is None:
        embed = state.get("backbone.embeddings.weight")
    if embed is None:
        raise ValueError("Cannot find embedding weight in checkpoint")
    vocab_size, d_model = embed.shape
    n_layers = sum(1 for k in state if k.endswith(".mixer.A_log"))

    log.info(
        f"Loading Mamba: vocab={vocab_size} d_model={d_model} n_layers={n_layers} "
        f"val_loss={ckpt.get('val_loss', '?'):.4f} val_acc={ckpt.get('val_acc', '?'):.4f}"
    )

    cfg = MambaConfig(
        vocab_size=vocab_size,
        hidden_size=d_model,
        state_size=16,
        num_hidden_layers=n_layers,
        expand=2,
        conv_kernel=4,
        num_heads=n_layers,  # HF requires this; doesn't affect Mamba SSM logic
        pad_token_id=V.PAD,
    )
    model = MambaForCausalLM(cfg)

    # Remap the one key that differs between mamba_ssm and HF
    if "backbone.embedding.weight" in state and "backbone.embeddings.weight" not in state:
        state["backbone.embeddings.weight"] = state.pop("backbone.embedding.weight")

    model.load_state_dict(state, strict=True)
    model.to(device)
    model.eval()
    return model


def _build_pregame_tokens(tribe: str, map_type: str, mode: str = "domination") -> list[int]:
    """
    Build a synthetic turn-1 state token sequence from tribe/map metadata.

    Format (minimal, matches training format):
      [TURN_1] [MODE] [MAP_TYPE] [SEP]
      [TRIBE] [STARS_3_5] [SCORE_0] [SEP]
      [ACT]

    This is the model's "blank slate" input for the given tribe/map combination.
    The logits after ACT are the model's prior for what action to take first.
    """
    turn_tok  = V.TURN_BASE + 1
    mode_tok  = V.MODES.get(mode, V.MODE_DOMINATION)
    map_tok   = V.MAPS.get(map_type, V.MAP_DRYLAND)
    tribe_tok = V.TRIBES.get(tribe.lower(), V.TRIBES["imperius"])

    return [
        turn_tok, mode_tok, map_tok, V.SEP,
        tribe_tok, V.STARS_3_5, V.SCORE_0, V.SEP,
        V.ACT,
    ]


class PolytopiaMambaScorer(WorldModelScorer):
    """
    Scores Polytopia game states using the Polytopia World Model (Mamba 130M).

    Load once, call score() per game (pre-game) or per turn (per-turn).
    Thread-safe for read-only inference (no weight updates here).
    """

    def __init__(
        self,
        checkpoint: Path = DEFAULT_CHECKPOINT,
        device: Optional[torch.device] = None,
        top_k: int = 5,
    ):
        self._device = device or _get_device()
        self._model = _load_model(checkpoint, self._device)
        self._top_k = top_k
        log.info(f"PolytopiaMambaScorer ready on {self._device}")

    @property
    def domain(self) -> str:
        return "polytopia"

    @torch.no_grad()
    def score(self, state: dict) -> dict:
        """
        Score a state. Accepts two forms:
          Pre-game:  {"tribe": str, "map_type": str, "mode": str (optional)}
          Per-turn:  {"state_tokens": list[int], "tribe": str (optional)}

        Returns standard WorldModelScorer output dict.
        """
        # Build input tokens
        if "state_tokens" in state and state["state_tokens"]:
            tokens = list(state["state_tokens"]) + [V.ACT]
        else:
            tribe    = state.get("tribe", "imperius")
            map_type = state.get("map_type", "dryland")
            mode     = state.get("mode", "domination")
            tokens = _build_pregame_tokens(tribe, map_type, mode)

        # Forward pass — get logits for the token after ACT
        input_ids = torch.tensor(tokens, dtype=torch.long, device=self._device).unsqueeze(0)
        out = self._model(input_ids=input_ids)
        logits = out.logits[0, -1, :]  # [vocab_size]

        # Extract action type distribution (tokens 239-251)
        action_logits = logits[V.ACTION_MOVE : V.ACTION_END_TURN + 1]  # 13 tokens
        action_probs  = F.softmax(action_logits, dim=-1).cpu().tolist()

        action_scores: dict[str, float] = {
            V.ACTION_NAMES[V.ACTION_MOVE + i]: float(p)
            for i, p in enumerate(action_probs)
        }

        # Confidence: entropy-based (low entropy = high confidence)
        # max_entropy for 13 actions = log(13) ≈ 2.565
        import math
        entropy = -sum(p * math.log(p + 1e-9) for p in action_probs)
        max_entropy = math.log(len(action_probs))
        confidence = float(1.0 - entropy / max_entropy)

        # Top-k patterns: action types the model assigns highest probability
        sorted_actions = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        top_actions = sorted_actions[: self._top_k]

        patterns = [
            f"{name} ({prob:.0%})" for name, prob in top_actions if prob > 0.05
        ]

        return {
            "action_scores": action_scores,
            "confidence": confidence,
            "patterns": patterns,
            "domain": self.domain,
            "meta": {
                "top_action": sorted_actions[0][0] if sorted_actions else None,
                "entropy": entropy,
                "input_len": len(tokens),
            },
        }

    _MAX_SEQ_LEN = 2048

    @torch.no_grad()
    def rank_actions(self, state_tokens: list[int], actions: list[dict]) -> list[dict]:
        """
        Compute log P(action_tokens | state_tokens, ACT) for each action.

        Input:
          state_tokens: encoded game state (from encodeGameState in tokenizer.ts)
          actions: list of {"idx": int, "label": str, "tokens": list[int]}

        Output:
          ranked list of {"idx", "label", "score", "rank"} sorted by score desc.
          score = mean log-prob of action token sequence given state.
        """
        # Separate valid (non-empty tokens) from empty ones
        valid = []
        empty_scores = []
        for action in actions:
            tokens = list(action.get("tokens", []))
            idx = int(action.get("idx", 0))
            label = str(action.get("label", ""))
            if not tokens:
                empty_scores.append({"idx": idx, "label": label, "score": float("-inf"), "rank": 0})
            else:
                valid.append({"idx": idx, "label": label, "tokens": tokens})

        if not valid:
            scored = empty_scores
            scored.sort(key=lambda x: x["score"], reverse=True)
            for i, a in enumerate(scored): a["rank"] = i + 1
            return scored

        prefix = state_tokens + [V.ACT]

        # Build padded batch: each row = prefix + action_tokens, right-padded with PAD
        seqs = []
        for a in valid:
            full = (prefix + a["tokens"])[-self._MAX_SEQ_LEN:]
            seqs.append(full)

        max_len = max(len(s) for s in seqs)
        padded = [s + [V.PAD] * (max_len - len(s)) for s in seqs]

        input_ids = torch.tensor(padded, dtype=torch.long, device=self._device)
        out = self._model(input_ids=input_ids)
        # out.logits: [batch, seq_len, vocab_size]
        log_probs = F.log_softmax(out.logits, dim=-1)

        scored = list(empty_scores)
        for i, a in enumerate(valid):
            full_seq = seqs[i]
            act_tokens = a["tokens"]
            base_len = len(full_seq) - len(act_tokens)

            total_lp = 0.0
            n_valid = 0
            for j, tok in enumerate(act_tokens):
                pred_pos = base_len - 1 + j
                if 0 <= pred_pos < log_probs.shape[1]:
                    total_lp += log_probs[i, pred_pos, tok].item()
                    n_valid += 1

            avg_lp = total_lp / max(n_valid, 1)
            scored.append({"idx": a["idx"], "label": a["label"], "score": avg_lp, "rank": 0})

        # Sort by score descending (higher log-prob = model prefers this action)
        scored.sort(key=lambda x: x["score"], reverse=True)
        for i, a in enumerate(scored):
            a["rank"] = i + 1

        return scored
