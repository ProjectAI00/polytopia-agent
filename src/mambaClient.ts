/**
 * mambaClient.ts — HTTP client for the Mamba world model server.
 * Server lives in world_model/server.py, port 7331.
 *
 * Uses a persistent keep-alive Agent so TCP connections are reused across
 * requests — eliminates per-call handshake overhead (~5-15ms each).
 */

import http from "http";

const MAMBA_HOST = "127.0.0.1";
const MAMBA_PORT = 7331;

// Reuse TCP connections across all requests to the model server
const _agent = new http.Agent({ keepAlive: true, maxSockets: 8 });

function post(path: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request({
      host: MAMBA_HOST,
      port: MAMBA_PORT,
      path,
      method: "POST",
      agent: _agent,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode !== 200) { reject(new Error(`Mamba ${res.statusCode}: ${data}`)); return; }
        resolve(JSON.parse(data));
      });
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

/** Health check — verifies Mamba server is running. */
export async function checkMamba(): Promise<boolean> {
  return new Promise((resolve) => {
    http.get({ host: MAMBA_HOST, port: MAMBA_PORT, path: "/health", agent: _agent }, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

/**
 * Rank a list of actions by model log-probability given the current state.
 * Returns ranked list sorted best-first.
 */
export async function rankActions(
  stateTokens: number[],
  actions: Array<{ idx: number; label: string; tokens: number[] }>,
): Promise<Array<{ idx: number; label: string; score: number; rank: number }>> {
  const res = await post("/rank_actions", { state_tokens: stateTokens, actions });
  return res.ranked;
}
