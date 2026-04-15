"""
brief_formatter.py — universal WorldModelScorer output → LLM-readable brief.

Domain-agnostic: works for any scorer output (Polytopia, coding, session data).
The scorer provides structure; the formatter provides LLM-readable language.

Design principles (learned from imi-agent brief.ts):
  - Positive framing: anchor the LLM to what winning looks like, not warnings
  - Concise: 3–5 lines max, each line adds a distinct signal
  - Confidence-gated: hide low-confidence signals rather than polluting the brief
  - Universal format: same template regardless of domain

Output example (Polytopia, high confidence):
  "World model signals (81% confidence):
  • Prioritize: research (34%), move (28%), train (18%)
  • Key pattern: research → expansion combos drive early advantage
  • Play aggressively — model expects high-action turns"

Output example (low confidence):
  "World model signals (low confidence — early game, limited data):
  • Balanced approach: no strong prior for this state"
"""

from __future__ import annotations


# Confidence thresholds
HIGH_CONF  = 0.55
MED_CONF   = 0.20


def format_brief(signals: dict, max_chars: int = 500) -> str:
    """
    Format WorldModelScorer output into an LLM-ready brief string.

    Args:
        signals: Output from WorldModelScorer.score() — must have:
                   action_scores: dict[str, float]
                   confidence: float
                   patterns: list[str]
                   domain: str
        max_chars: Soft cap on output length (truncates patterns if needed).

    Returns:
        Multi-line string suitable for direct injection into LLM system/user prompt.
    """
    confidence: float = signals.get("confidence", 0.0)
    action_scores: dict = signals.get("action_scores", {})
    patterns: list = signals.get("patterns", [])
    domain: str = signals.get("domain", "unknown")

    lines: list[str] = []

    # ── Header with confidence ────────────────────────────────────────────────
    pct = int(confidence * 100)
    if confidence >= HIGH_CONF:
        conf_label = f"{pct}% confidence"
    elif confidence >= MED_CONF:
        conf_label = f"{pct}% confidence (moderate)"
    else:
        conf_label = "low confidence — limited signal"

    lines.append(f"World model signals ({conf_label}):")

    # ── Top action priorities ─────────────────────────────────────────────────
    if action_scores and confidence >= MED_CONF:
        sorted_acts = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        top = [(name, p) for name, p in sorted_acts if p > 0.08][:4]
        if top:
            priority_str = ", ".join(f"{name} ({p:.0%})" for name, p in top)
            lines.append(f"• Prioritize: {priority_str}")
    elif action_scores:
        # Low confidence — just show top action
        sorted_acts = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        if sorted_acts:
            top_name, top_p = sorted_acts[0]
            lines.append(f"• Weak prior: {top_name} ({top_p:.0%}) — verify with game state")

    # ── Learned patterns ─────────────────────────────────────────────────────
    if patterns and confidence >= HIGH_CONF:
        # Show up to 2 pattern lines
        for pat in patterns[:2]:
            line = f"• {pat}"
            if sum(len(l) for l in lines) + len(line) > max_chars:
                break
            lines.append(line)

    # ── Confidence-gated play style hint ─────────────────────────────────────
    if confidence >= HIGH_CONF:
        # Infer play style from top action
        sorted_acts = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
        top_action = sorted_acts[0][0] if sorted_acts else None
        if top_action in ("research", "build"):
            lines.append("• Economic/tech focus — invest before expanding")
        elif top_action in ("move", "capture", "attack"):
            lines.append("• Aggressive expansion — action windows open now")
        elif top_action == "train":
            lines.append("• Build military before committing to expansion")
        elif top_action == "end_turn":
            lines.append("• Consolidate — no strong action signal this state")

    result = "\n".join(lines)

    # Hard truncate if over limit
    if len(result) > max_chars:
        result = result[:max_chars - 3] + "..."

    return result


def format_brief_json(signals: dict) -> dict:
    """
    Return the raw signals as a clean dict (for debugging or structured injection).
    Strips the meta field and normalizes to 3 decimal places.
    """
    action_scores = signals.get("action_scores", {})
    sorted_acts = sorted(action_scores.items(), key=lambda x: x[1], reverse=True)
    return {
        "domain": signals.get("domain", "unknown"),
        "confidence": round(signals.get("confidence", 0.0), 3),
        "top_actions": [
            {"action": name, "prob": round(p, 3)}
            for name, p in sorted_acts[:5]
            if p > 0.01
        ],
        "patterns": signals.get("patterns", []),
    }
