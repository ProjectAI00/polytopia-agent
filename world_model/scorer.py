"""
scorer.py — universal WorldModelScorer interface.

Every domain (Polytopia, coding, session data) implements this interface.
The output schema is fixed so brief_formatter.py stays domain-agnostic.

Output schema from score():
  {
    "action_scores":  dict[str, float]  # action_name → probability (sums to 1)
    "confidence":     float             # 0–1, how certain the model is
    "patterns":       list[str]         # learned patterns to surface (positive framing)
    "domain":         str               # "polytopia" | "coding" | "session" | ...
    "meta":           dict              # domain-specific extras (optional, for debugging)
  }

Design principle: scorer knows the domain, formatter knows nothing about it.
"""

from __future__ import annotations
from abc import ABC, abstractmethod


class WorldModelScorer(ABC):
    """
    Abstract scorer — load once, call score() per turn or per game.

    Subclasses must implement:
      score(state: dict) -> dict

    state is domain-specific but must contain enough for the scorer to produce
    action_scores. Scorers are responsible for their own tokenization.
    """

    @abstractmethod
    def score(self, state: dict) -> dict:
        """
        Score a state and return learned signals.

        Args:
            state: Domain-specific dict. For Polytopia: {"state_tokens": [...], "tribe": str, ...}
                   For coding: {"session_tokens": [...], "task_type": str, ...}
                   For pre-game: {"tribe": str, "map_type": str} (no tokens yet)

        Returns:
            {
                "action_scores":  dict[str, float],  # top actions, sum ≤ 1
                "confidence":     float,              # 0–1
                "patterns":       list[str],          # what the model learned
                "domain":         str,
                "meta":           dict,               # debug info
            }
        """
        ...

    @property
    @abstractmethod
    def domain(self) -> str:
        """Short domain identifier: "polytopia", "coding", etc."""
        ...
