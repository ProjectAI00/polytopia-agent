"""
server.py — HTTP server for world model scoring.

Loads the Mamba model once and serves score requests from TypeScript runner.ts.
Single endpoint: POST /score

Request body (JSON):
  {
    "domain":    "polytopia",
    "tribe":     "imperius",       // optional, pre-game scoring
    "map_type":  "dryland",        // optional
    "mode":      "domination",     // optional
    "state_tokens": [1, 2, ...],   // optional, per-turn scoring
    "max_chars": 500               // optional brief length cap
  }

Response body (JSON):
  {
    "brief":   "World model signals...",
    "signals": { "action_scores": {...}, "confidence": 0.8, ... }
  }

Health check: GET /health → {"status": "ok", "domain": "polytopia"}

Usage:
  python3 world_model/server.py --checkpoint checkpoints/polytopia-world-model.pt --port 7331
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent.parent))

from world_model.polytopia_scorer import PolytopiaMambaScorer
from world_model.brief_formatter import format_brief, format_brief_json

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# Global scorer — loaded once at startup
_scorer: PolytopiaMambaScorer | None = None


def get_scorer(checkpoint: Path) -> PolytopiaMambaScorer:
    global _scorer
    if _scorer is None:
        _scorer = PolytopiaMambaScorer(checkpoint=checkpoint)
    return _scorer


class Handler(BaseHTTPRequestHandler):
    checkpoint: Path  # set by factory

    def log_message(self, format: str, *args) -> None:
        log.info(f"{self.address_string()} - {format % args}")

    def _send_json(self, data: dict, code: int = 200) -> None:
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            scorer = get_scorer(self.checkpoint)
            self._send_json({"status": "ok", "domain": scorer.domain})
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self) -> None:
        if self.path == "/score":
            self._handle_score()
        elif self.path == "/rank_actions":
            self._handle_rank_actions()
        else:
            self._send_json({"error": "not found"}, 404)

    def _handle_score(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            req = json.loads(body)
        except json.JSONDecodeError as e:
            self._send_json({"error": f"invalid JSON: {e}"}, 400)
            return

        max_chars = int(req.get("max_chars", 500))
        scorer = get_scorer(self.checkpoint)

        state: dict = {}
        if "state_tokens" in req and req["state_tokens"]:
            state["state_tokens"] = req["state_tokens"]
        if "tribe" in req:
            state["tribe"] = req["tribe"]
        if "map_type" in req:
            state["map_type"] = req["map_type"]
        if "mode" in req:
            state["mode"] = req["mode"]

        try:
            signals = scorer.score(state)
            brief   = format_brief(signals, max_chars=max_chars)
            self._send_json({
                "brief":   brief,
                "signals": format_brief_json(signals),
            })
        except Exception as e:
            log.exception("score() failed")
            self._send_json({"error": str(e)}, 500)

    def _handle_rank_actions(self) -> None:
        """
        POST /rank_actions
        Body: {
          "state_tokens": [int, ...],
          "actions": [{"idx": 0, "label": "research forestry", "tokens": [242, 208]}, ...]
        }
        Returns: {
          "ranked": [{"idx": 0, "label": "...", "score": -0.41, "rank": 1}, ...]
        }
        """
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            req = json.loads(body)
        except json.JSONDecodeError as e:
            self._send_json({"error": f"invalid JSON: {e}"}, 400)
            return

        state_tokens = req.get("state_tokens", [])
        actions = req.get("actions", [])

        if not isinstance(state_tokens, list) or not isinstance(actions, list):
            self._send_json({"error": "state_tokens and actions must be arrays"}, 400)
            return

        scorer = get_scorer(self.checkpoint)
        try:
            ranked = scorer.rank_actions(state_tokens, actions)
            self._send_json({"ranked": ranked})
        except Exception as e:
            log.exception("rank_actions() failed")
            self._send_json({"error": str(e)}, 500)


def make_handler(checkpoint: Path):
    class BoundHandler(Handler):
        pass
    BoundHandler.checkpoint = checkpoint
    return BoundHandler


def main() -> None:
    parser = argparse.ArgumentParser(description="World model scoring server")
    parser.add_argument("--checkpoint", type=str,
                        default=str(Path(__file__).parent.parent / "model" / "polytopia-world-model.pt"))
    parser.add_argument("--port", type=int, default=7331)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    args = parser.parse_args()

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        log.error(f"Checkpoint not found: {checkpoint}")
        sys.exit(1)

    # Eager load — fail fast if weights are broken
    log.info(f"Loading model from {checkpoint}…")
    get_scorer(checkpoint)
    log.info(f"Model ready. Starting server on {args.host}:{args.port}")

    server = HTTPServer((args.host, args.port), make_handler(checkpoint))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Server stopped.")


if __name__ == "__main__":
    main()
