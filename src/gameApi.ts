/**
 * gameApi.ts — HTTP client for Magnus's game API.
 *
 * Uses Node.js http module directly (not fetch) because port 5060
 * is blocked by undici/fetch (SIP protocol port restriction).
 */

import http from "http";

const GAME_PORT = 5060;

// Reuse TCP connections — avoids handshake overhead on every poll
const _agent = new http.Agent({ keepAlive: true, maxSockets: 4 });

function request(method: "GET" | "POST", path: string, body?: object, timeoutMs = 0): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: GAME_PORT,
      path,
      method,
      agent: _agent,
      headers: {
        "Content-Type": "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Game API ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Bad JSON: ${data}`)); }
      });
    });

    req.on("error", reject);
    if (timeoutMs > 0) req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("Game API timeout")); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** Blocks until a bot turn is available. Returns { State, Commands, SuggestedCommand } */
export function getBotTurn(timeoutMs = 0): Promise<any> {
  return request("GET", "/api/current-bot-turn", undefined, timeoutMs);
}

/** Execute one command. Pass back a command object exactly as received from getBotTurn. */
export function sendCommand(command: object): Promise<any> {
  return request("POST", "/api/bot-command", { Command: command });
}

/** Start a fresh custom game. */
export function startGame(settings: object): Promise<any> {
  return request("POST", "/api/start-game", settings);
}
