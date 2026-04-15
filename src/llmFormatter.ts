/**
 * llmFormatter.ts — Converts Magnus API game state into a human-readable prompt
 * that an LLM can reason about to pick the best action.
 */

const TERRAIN_NAME: Record<number, string> = {
  0: "water", 1: "ocean", 2: "ice", 3: "forest", 4: "field", 5: "mountain", 6: "wetland",
};
const RESOURCE_NAME: Record<number, string> = {
  1: "ore", 2: "fruit", 3: "fish", 4: "whale", 5: "crop", 6: "game", 7: "starfish",
};
const IMPROVEMENT_NAME: Record<number, string> = {
  1: "city", 2: "lumber_hut", 3: "mine", 4: "farm", 5: "port",
  6: "forge", 7: "lumber_hut", 8: "sawmill", 9: "windmill",
  10: "forge", 11: "market", 12: "temple", 13: "library",
  14: "custom_house", 15: "lumber_hut", // type 15 seen on forest+game tiles
  47: "ruins",
};
const TRIBE_NAME: Record<number, string> = {
  0: "Bardur", 1: "Imperius", 2: "Oumaji", 3: "Kickoo", 4: "Hoodrick",
  5: "Luxidoor", 6: "Vengir", 7: "Zebasi", 8: "Ai-Mo", 9: "Yadakk",
  10: "Aquarion", 11: "Quetzali", 12: "Elyrion", 13: "Polaris", 14: "Cymanti",
};
const TECH_NAME: Record<number, string> = {
  1: "Climbing", 2: "Hunting", 3: "Riding", 4: "Archery", 5: "Forestry",
  6: "Farming", 7: "Fishing", 8: "Meditation", 9: "Shields", 10: "Aquatism",
  11: "Mining", 12: "Roads", 13: "Whaling", 14: "Chivalry", 15: "Spiritualism",
  16: "Construction", 17: "Mathematics", 18: "Navigation", 19: "Smithery",
  20: "Organization", 21: "Trade", 22: "Philosophy", 23: "Strategy", 38: "FreeDiving",
};

function formatCommand(cmd: any, idx: number): string {
  const n = idx + 1;
  switch (cmd.CommandType) {
    case "Move":
      return `${n}. Move unit from (${cmd.From?.X},${cmd.From?.Y}) → (${cmd.To?.X},${cmd.To?.Y})`;
    case "Attack":
      return `${n}. Attack from (${cmd.From?.X},${cmd.From?.Y}) → (${cmd.To?.X},${cmd.To?.Y})`;
    case "Train":
      return `${n}. Train unit at city (${cmd.Coordinates?.X},${cmd.Coordinates?.Y}) type=${cmd.Type}`;
    case "Build":
      return `${n}. Build ${IMPROVEMENT_NAME[cmd.Type] ?? `improvement#${cmd.Type}`} at (${cmd.Coordinates?.X},${cmd.Coordinates?.Y})`;
    case "Research":
      return `${n}. Research ${TECH_NAME[cmd.Type] ?? `tech#${cmd.Type}`}`;
    case "Capture":
      return `${n}. Capture city at (${cmd.Coordinates?.X},${cmd.Coordinates?.Y})`;
    case "CityReward":
    case "UpgradeCity":
      return `${n}. City level-up reward: option #${cmd.Reward ?? cmd.Type} at (${cmd.Coordinates?.X ?? cmd.CityX},${cmd.Coordinates?.Y ?? cmd.CityY})`;
    case "Heal":
    case "Recover":
      return `${n}. Heal unit`;
    case "EndTurn":
      return `${n}. End turn`;
    default:
      return `${n}. ${cmd.CommandType}`;
  }
}

export function buildPrompt(turn: any, botPlayerId: number): string {
  const state = turn.State;
  const commands: any[] = turn.Commands ?? [];

  const players: any[] = state.PlayerStates ?? [];
  const me = players.find((p: any) => p.Id === botPlayerId);
  const tribe = TRIBE_NAME[me?.tribe] ?? `tribe#${me?.tribe}`;
  const stars = me?.Currency ?? 0;
  const score = me?.score ?? 0;
  const techs = (me?.availableTech ?? [])
    .filter((t: number) => t > 0)
    .map((t: number) => TECH_NAME[t] ?? `tech#${t}`)
    .join(", ");
  const gameTurn = (state.CurrentTurn ?? 0) + 1;

  const tiles: any[] = state.Map?.Tiles ?? [];

  // Own units
  const myUnits = tiles
    .filter((t: any) => t.unit?.owner === botPlayerId)
    .map((t: any) => {
      const u = t.unit;
      const name = u.UnitData?.displayName?.replace("unit.names.", "") ?? "unit";
      const status = [!u.moved ? "can move" : "", !u.attacked ? "can attack" : ""]
        .filter(Boolean).join(", ") || "done";
      return `  - ${name} at (${t.coordinates.X},${t.coordinates.Y}) [${status}]`;
    }).join("\n");

  // My cities
  const myCities = tiles
    .filter((t: any) => t.improvement?.type === 1 && t.owner === botPlayerId)
    .map((t: any) => {
      const c = t.improvement;
      const name = c.name ?? "City";
      return `  - "${name}" at (${t.coordinates.X},${t.coordinates.Y}) level ${c.level ?? 1}, pop ${c.population ?? 0}`;
    }).join("\n");

  // Enemy units visible
  const enemies = tiles
    .filter((t: any) => t.unit && t.unit.owner !== botPlayerId && t.unit.owner !== 0 && t.unit.owner !== 255)
    .map((t: any) => {
      const u = t.unit;
      const name = u.UnitData?.displayName?.replace("unit.names.", "") ?? "unit";
      return `  - Enemy ${name} at (${t.coordinates.X},${t.coordinates.Y}) owner=${u.owner}`;
    }).join("\n");

  // Owned resource tiles with no improvement yet — these NEED improvements built on them
  const buildable = tiles
    .filter((t: any) => t.owner === botPlayerId && t.resource && !t.improvement)
    .map((t: any) => {
      const terrain = TERRAIN_NAME[t.terrain] ?? `terrain#${t.terrain}`;
      const res = RESOURCE_NAME[t.resource.type] ?? "resource";
      const what = res === "fruit" || res === "game" ? "→ build lumber_hut (2★)"
        : res === "crop" ? "→ build farm (5★)"
        : res === "ore" ? "→ build mine (5★)"
        : res === "fish" ? "→ build port (5★)"
        : "→ build improvement";
      return `  - (${t.coordinates.X},${t.coordinates.Y}) ${terrain}+${res} ${what}`;
    }).join("\n");

  // Other interesting tiles (improvements already built, or enemy-owned resources)
  const interesting = tiles
    .filter((t: any) => t.resource || (t.improvement && ![1, 47].includes(t.improvement.type)))
    .slice(0, 20)
    .map((t: any) => {
      const terrain = TERRAIN_NAME[t.terrain] ?? `terrain#${t.terrain}`;
      const res = t.resource ? `+${RESOURCE_NAME[t.resource.type] ?? "resource"}` : "";
      const imp = t.improvement ? `[${IMPROVEMENT_NAME[t.improvement.type] ?? `imp#${t.improvement.type}`}]` : "";
      const own = t.owner === botPlayerId ? "(mine)" : t.owner > 0 && t.owner < 255 ? "(enemy)" : "(neutral)";
      return `  - (${t.coordinates.X},${t.coordinates.Y}) ${terrain}${res}${imp}${own}`;
    }).join("\n");

  const commandList = commands.map((c, i) => formatCommand(c, i)).join("\n");

  return `You are playing The Battle of Polytopia as ${tribe} on game turn ${gameTurn}.

RESOURCES: ${stars} stars | SCORE: ${score}
KNOWN TECHS: ${techs || "none"}

YOUR UNITS:
${myUnits || "  (none)"}

YOUR CITIES:
${myCities || "  (none)"}

VISIBLE ENEMIES:
${enemies || "  (none)"}

YOUR OWNED RESOURCE TILES (no improvement yet — these generate 0 income until you build):
${buildable || "  (none — all owned resources already improved)"}

OTHER TILES (resources/improvements):
${interesting || "  (none)"}

AVAILABLE ACTIONS:
${commandList}

STRATEGIC PRIORITIES (follow in order):
1. BUILD improvements on your owned resource tiles — each one adds +1 star/turn permanently
2. RESEARCH techs that unlock improvements for resources you already own (e.g. Forestry for fruit/game, Farming for crop, Mining for ore)
3. TRAIN units only if enemy is adjacent or you have stars to spare after building
4. MOVE to expand territory or scout — avoid idle moves
5. END TURN only if nothing useful can be done this turn

Pick the single best action. Respond ONLY with JSON: {"choice": <number 1-${commands.length}>, "reason": "<one sentence>"}`;
}
