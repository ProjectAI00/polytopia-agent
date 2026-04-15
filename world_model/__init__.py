"""
world_model — universal world model scoring and brief injection.

Architecture:
  WorldModelScorer (abstract) — domain-agnostic interface
  PolytopiaMambaScorer       — Polytopia implementation using Mamba 130M
  format_brief()             — universal scorer output → LLM-readable text

Design: scorer and formatter are separate concerns.
  scorer.score(state) → signals dict  (domain-specific input, structured output)
  format_brief(signals) → str         (domain-agnostic, LLM-ready text)

This separation means the same brief format works for Polytopia, coding agents,
or any future domain. Only the scorer changes per domain.
"""

from world_model.scorer import WorldModelScorer
from world_model.brief_formatter import format_brief

__all__ = ["WorldModelScorer", "format_brief"]
