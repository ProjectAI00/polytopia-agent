/**
 * adapter.ts — Maps Magnus's API state to Mamba token sequences.
 *
 * Token vocab mirrors polytopia-bench/src/scripts/tokenizer.ts exactly.
 * The Mamba model was trained on these token IDs — do not change mappings.
 */

// ── Vocab constants (mirrors token_vocab.py + tokenizer.ts) ──────────────────

const V = {
  PAD: 0, SEP: 1, ACT: 2,
  TURN_BASE: 5,

  // Terrain
  TERRAIN_FIELD: 85, TERRAIN_FOREST: 86, TERRAIN_MOUNTAIN: 87,
  TERRAIN_WATER: 88, TERRAIN_OCEAN: 89, TERRAIN_ICE: 90, TERRAIN_WETLAND: 91,

  // Resources
  RESOURCE_NONE: 93, RESOURCE_FRUIT: 94, RESOURCE_GAME: 95, RESOURCE_FISH: 96,
  RESOURCE_CROP: 97, RESOURCE_ORE: 98, RESOURCE_WHALE: 99,
  RESOURCE_STARFISH: 100, RESOURCE_SPORES: 101, RESOURCE_ALGAE: 102,

  // Improvements
  IMPROVEMENT_NONE: 103, IMPROVEMENT_FARM: 104, IMPROVEMENT_MINE: 105,
  IMPROVEMENT_LUMBER_HUT: 106, IMPROVEMENT_WINDMILL: 107, IMPROVEMENT_FORGE: 108,
  IMPROVEMENT_SAWMILL: 109, IMPROVEMENT_PORT: 110,

  // Owner
  OWNER_NEUTRAL: 119,
  OWNER_P1: 120,

  // City
  CITY_LVL1: 126, IS_CAPITAL: 131, HAS_WALLS: 132,

  // Unit types
  UNIT_WARRIOR: 133, UNIT_RIDER: 134, UNIT_DEFENDER: 135,
  UNIT_SWORDSMAN: 136, UNIT_ARCHER: 137, UNIT_CATAPULT: 138,
  UNIT_KNIGHT: 139, UNIT_GIANT: 140, UNIT_BOAT: 141,
  UNIT_SHIP: 142, UNIT_BATTLESHIP: 143, UNIT_MIND_BENDER: 144,
  UNIT_AMPHIBIAN: 145, UNIT_TRIDENTION: 146, UNIT_CRAB: 147,
  UNIT_POLYTAUR: 148, UNIT_NAVALON: 149, UNIT_DRAGON_EGG: 150,
  UNIT_BABY_DRAGON: 151, UNIT_FIRE_DRAGON: 152, UNIT_MOONI: 153,
  UNIT_ICE_ARCHER: 154, UNIT_BATTLE_SLED: 155, UNIT_ICE_FORTRESS: 156,
  UNIT_GAAMI: 157, UNIT_HEXAPOD: 158, UNIT_KITON: 159,
  UNIT_PHYCHI: 160, UNIT_RAYCHI: 161, UNIT_SHAMAN: 162,
  UNIT_EXIDA: 163, UNIT_DOOMUX: 164, UNIT_CLOAK: 165, UNIT_DAGGER: 166,

  // Unit flags
  IS_VETERAN: 167, CAN_MOVE: 168, CANNOT_MOVE: 169,
  CAN_ATTACK: 170, CANNOT_ATTACK: 171,

  // HP buckets
  HP_0: 172, HP_1_3: 173, HP_4_6: 174, HP_7_9: 175,
  HP_10: 176, HP_11_14: 177, HP_15_19: 178, HP_20_29: 179,
  HP_30_39: 180, HP_40: 181,

  // Stars buckets
  STARS_0: 182, STARS_1_2: 183, STARS_3_5: 184, STARS_6_9: 185,
  STARS_10_14: 186, STARS_15_19: 187, STARS_20_29: 188, STARS_30_49: 189, STARS_50P: 190,

  // Score buckets
  SCORE_0: 191, SCORE_1_99: 192, SCORE_100_499: 193, SCORE_500_999: 194,
  SCORE_1K_1999: 195, SCORE_2K_3999: 196, SCORE_4K_5999: 197,
  SCORE_6K_7999: 198, SCORE_8K_9999: 199, SCORE_10KP: 200,

  // Techs
  TECH_CLIMBING: 201, TECH_FISHING: 202, TECH_HUNTING: 203, TECH_ORGANIZATION: 204,
  TECH_RIDING: 205, TECH_ARCHERY: 206, TECH_FARMING: 207, TECH_FORESTRY: 208,
  TECH_FREE_DIVING: 209, TECH_MEDITATION: 210, TECH_MINING: 211, TECH_ROADS: 212,
  TECH_SHIELDS: 213, TECH_WHALING: 214, TECH_AQUATISM: 215, TECH_CHIVALRY: 216,
  TECH_CONSTRUCTION: 217, TECH_MATHEMATICS: 218, TECH_NAVIGATION: 219,
  TECH_SMITHERY: 220, TECH_SPIRITUALISM: 221, TECH_TRADE: 222, TECH_PHILOSOPHY: 223,

  // Tribes
  TRIBE_BARDUR: 224, TRIBE_IMPERIUS: 225, TRIBE_OUMAJI: 226, TRIBE_KICKOO: 227,
  TRIBE_HOODRICK: 228, TRIBE_LUXIDOOR: 229, TRIBE_VENGIR: 230, TRIBE_ZEBASI: 231,
  TRIBE_AI_MO: 232, TRIBE_QUETZALI: 233, TRIBE_YADAKK: 234, TRIBE_AQUARION: 235,
  TRIBE_ELYRION: 236, TRIBE_POLARIS: 237, TRIBE_CYMANTI: 238,

  // Actions
  ACTION_MOVE: 239, ACTION_ATTACK: 240, ACTION_TRAIN: 241, ACTION_RESEARCH: 242,
  ACTION_BUILD: 243, ACTION_CAPTURE: 244, ACTION_HEAL: 245, ACTION_CONVERT: 246,
  ACTION_EMBARK: 247, ACTION_DISEMBARK: 248, ACTION_CITY_REWARD: 249,
  ACTION_INFILTRATE: 250, ACTION_END_TURN: 251,

  // Tile flags
  HAS_ROAD: 328, HAS_RUIN: 329, IS_VILLAGE: 330,

  X_BASE: 260, Y_BASE: 290,
  MODE_DOMINATION: 320, MODE_PERFECTION: 321, MODE_SPEEDRUN: 322, MODE_COLOSSUS: 323,
  MAP_DRYLAND: 324, MAP_CONTINENT: 325, MAP_ARCHIPELAGO: 326, MAP_WATERWORLD: 327,
};

// ── API int → token lookups ──────────────────────────────────────────────────

// Tribe int (API) → tribe token
const TRIBE_ID_TO_TOKEN: Record<number, number> = {
  0: V.TRIBE_BARDUR,   1: V.TRIBE_IMPERIUS,  2: V.TRIBE_OUMAJI,
  3: V.TRIBE_KICKOO,   4: V.TRIBE_HOODRICK,  5: V.TRIBE_LUXIDOOR,
  6: V.TRIBE_VENGIR,   7: V.TRIBE_ZEBASI,    8: V.TRIBE_AI_MO,
  9: V.TRIBE_YADAKK,   10: V.TRIBE_AQUARION,  11: V.TRIBE_QUETZALI,
  12: V.TRIBE_ELYRION, 13: V.TRIBE_POLARIS,  14: V.TRIBE_CYMANTI,
};

// Game mode int → mode token
const GAME_MODE_TO_TOKEN: Record<number, number> = {
  1: V.MODE_PERFECTION, 2: V.MODE_DOMINATION, 3: V.MODE_SPEEDRUN,
  4: V.MODE_DOMINATION, 6: V.MODE_DOMINATION,
};

// Map preset int → map token
const MAP_PRESET_TO_TOKEN: Record<number, number> = {
  1: V.MAP_DRYLAND, 2: V.MAP_CONTINENT, 3: V.MAP_ARCHIPELAGO, 4: V.MAP_WATERWORLD,
};

// Unit name string → unit token (extracted from UnitData.displayName)
const UNIT_NAME_TO_TOKEN: Record<string, number> = {
  warrior: V.UNIT_WARRIOR, rider: V.UNIT_RIDER, defender: V.UNIT_DEFENDER,
  swordsman: V.UNIT_SWORDSMAN, archer: V.UNIT_ARCHER, catapult: V.UNIT_CATAPULT,
  knight: V.UNIT_KNIGHT, giant: V.UNIT_GIANT, boat: V.UNIT_BOAT,
  ship: V.UNIT_SHIP, battleship: V.UNIT_BATTLESHIP, mind_bender: V.UNIT_MIND_BENDER,
  mindbender: V.UNIT_MIND_BENDER,
  amphibian: V.UNIT_AMPHIBIAN, tridention: V.UNIT_TRIDENTION, crab: V.UNIT_CRAB,
  polytaur: V.UNIT_POLYTAUR, navalon: V.UNIT_NAVALON, dragon_egg: V.UNIT_DRAGON_EGG,
  dragonEgg: V.UNIT_DRAGON_EGG, dragonegg: V.UNIT_DRAGON_EGG,
  baby_dragon: V.UNIT_BABY_DRAGON, babydragon: V.UNIT_BABY_DRAGON,
  fire_dragon: V.UNIT_FIRE_DRAGON, firedragon: V.UNIT_FIRE_DRAGON,
  mooni: V.UNIT_MOONI, ice_archer: V.UNIT_ICE_ARCHER, icearcher: V.UNIT_ICE_ARCHER,
  battle_sled: V.UNIT_BATTLE_SLED, battlesled: V.UNIT_BATTLE_SLED,
  ice_fortress: V.UNIT_ICE_FORTRESS, icefortress: V.UNIT_ICE_FORTRESS,
  gaami: V.UNIT_GAAMI, hexapod: V.UNIT_HEXAPOD, kiton: V.UNIT_KITON,
  phychi: V.UNIT_PHYCHI, raychi: V.UNIT_RAYCHI, shaman: V.UNIT_SHAMAN,
  exida: V.UNIT_EXIDA, doomux: V.UNIT_DOOMUX, cloak: V.UNIT_CLOAK, dagger: V.UNIT_DAGGER,
};

// Tech name string → tech token
const TECH_NAME_TO_TOKEN: Record<string, number> = {
  climbing: V.TECH_CLIMBING, fishing: V.TECH_FISHING, hunting: V.TECH_HUNTING,
  organization: V.TECH_ORGANIZATION, riding: V.TECH_RIDING, archery: V.TECH_ARCHERY,
  farming: V.TECH_FARMING, forestry: V.TECH_FORESTRY, free_diving: V.TECH_FREE_DIVING,
  freediving: V.TECH_FREE_DIVING, meditation: V.TECH_MEDITATION, mining: V.TECH_MINING,
  roads: V.TECH_ROADS, shields: V.TECH_SHIELDS, whaling: V.TECH_WHALING,
  aquatism: V.TECH_AQUATISM, chivalry: V.TECH_CHIVALRY, construction: V.TECH_CONSTRUCTION,
  mathematics: V.TECH_MATHEMATICS, navigation: V.TECH_NAVIGATION,
  smithery: V.TECH_SMITHERY, spiritualism: V.TECH_SPIRITUALISM,
  trade: V.TECH_TRADE, philosophy: V.TECH_PHILOSOPHY,
  // API variations
  fishingsimple: V.TECH_FISHING,  // Aquarion's fishing tech
};

// Tech API int → tech token.
// Confirmed: farming=6 (Zebasi), fishing=7 (Aquarion), organization=20 (Imperius).
// Rest derived from cross-referencing tribe starting techs + available research options.
const TECH_INT_TO_TOKEN: Record<number, number> = {
  1:  V.TECH_CLIMBING,
  2:  V.TECH_HUNTING,
  3:  V.TECH_RIDING,
  4:  V.TECH_ARCHERY,
  5:  V.TECH_FORESTRY,
  6:  V.TECH_FARMING,      // confirmed: Zebasi
  7:  V.TECH_FISHING,      // confirmed: Aquarion / Kickoo
  8:  V.TECH_MEDITATION,
  9:  V.TECH_SHIELDS,
  10: V.TECH_AQUATISM,
  11: V.TECH_MINING,
  12: V.TECH_ROADS,
  13: V.TECH_WHALING,
  14: V.TECH_CHIVALRY,
  15: V.TECH_SPIRITUALISM,
  16: V.TECH_CONSTRUCTION,
  17: V.TECH_MATHEMATICS,
  18: V.TECH_NAVIGATION,
  19: V.TECH_SMITHERY,
  20: V.TECH_ORGANIZATION, // confirmed: Imperius / Luxidoor
  21: V.TECH_TRADE,
  22: V.TECH_PHILOSOPHY,
  23: V.TECH_CHIVALRY,   // Strategy tech — maps closest to Chivalry in vocab
  38: V.TECH_FREE_DIVING,  // Aquarion special (seen as first research pick)
};

// Unit type API int → unit token.
// Confirmed: type=5 → Defender (from state dump UnitData.displayName).
// Sequence derived from IL2CPP metadata with offset=2.
const UNIT_INT_TO_TOKEN: Record<number, number> = {
  2:  V.UNIT_WARRIOR,
  3:  V.UNIT_RIDER,
  4:  V.UNIT_KNIGHT,
  5:  V.UNIT_DEFENDER,
  6:  V.UNIT_BOAT,       // Ship in game enum
  7:  V.UNIT_CATAPULT,
  8:  V.UNIT_ARCHER,
  9:  V.UNIT_MIND_BENDER,
  10: V.UNIT_GIANT,
  12: V.UNIT_BOAT,
  13: V.UNIT_POLYTAUR,
  14: V.UNIT_NAVALON,
  15: V.UNIT_DRAGON_EGG,
  16: V.UNIT_BABY_DRAGON,
  17: V.UNIT_FIRE_DRAGON,
  18: V.UNIT_AMPHIBIAN,
  19: V.UNIT_TRIDENTION,
  20: V.UNIT_MOONI,
  21: V.UNIT_BATTLE_SLED,
  22: V.UNIT_ICE_FORTRESS,
  23: V.UNIT_ICE_ARCHER,
  24: V.UNIT_CRAB,
  25: V.UNIT_GAAMI,
  26: V.UNIT_HEXAPOD,
  27: V.UNIT_DOOMUX,
  28: V.UNIT_PHYCHI,
  29: V.UNIT_KITON,
  30: V.UNIT_EXIDA,
  32: V.UNIT_RAYCHI,
  33: V.UNIT_SHAMAN,
  34: V.UNIT_CLOAK,
};

// Terrain int → terrain token.
// Observed in state dumps: 3=forest, 4=field, 5=mountain.
const TERRAIN_INT_TO_TOKEN: Record<number, number> = {
  0: V.TERRAIN_WATER,   // water
  1: V.TERRAIN_OCEAN,   // deep ocean
  2: V.TERRAIN_ICE,     // ice
  3: V.TERRAIN_FOREST,  // forest (observed)
  4: V.TERRAIN_FIELD,   // field/plains (observed)
  5: V.TERRAIN_MOUNTAIN,// mountain (observed)
  6: V.TERRAIN_WETLAND, // wetland
};

// Resource type int → resource token.
// Observed: 1=ore(on mountain), 2=fruit(on forest), 5=crop/game(on field), 6=game(on forest)
const RESOURCE_INT_TO_TOKEN: Record<number, number> = {
  1: V.RESOURCE_ORE,
  2: V.RESOURCE_FRUIT,
  3: V.RESOURCE_FISH,
  4: V.RESOURCE_WHALE,
  5: V.RESOURCE_CROP,
  6: V.RESOURCE_GAME,
  7: V.RESOURCE_STARFISH,
  8: V.RESOURCE_SPORES,
  9: V.RESOURCE_ALGAE,
};

// City reward type int → reward token (252–259 range).
// API int order guessed; corrected as we see real commands via cmd-debug log.
const CITY_REWARD_INT_TO_TOKEN: Record<number, number> = {
  1: 252, // REWARD_FORGE
  2: 253, // REWARD_EXPLORER
  3: 254, // REWARD_CITY_WALL
  4: 255, // REWARD_RESOURCES
  5: 256, // REWARD_GROW
  6: 257, // REWARD_EXPAND
  7: 258, // REWARD_PARK
  8: 259, // REWARD_GIANT
};

// City reward name string → reward token (for APIs that send string names).
const CITY_REWARD_NAME_TO_TOKEN: Record<string, number> = {
  forge: 252, explorer: 253, city_wall: 254, citywall: 254,
  resources: 255, grow: 256, expand: 257, park: 258, giant: 259,
};

// Improvement type int → improvement token.
// 1=city/village (handled separately), 47=ruins.
// Build Type=7 seen at turn 1 (2-star cost, basic Forestry improvement) = LumberHut.
const IMPROVEMENT_INT_TO_TOKEN: Record<number, number> = {
  2: V.IMPROVEMENT_LUMBER_HUT,
  3: V.IMPROVEMENT_MINE,
  4: V.IMPROVEMENT_FARM,
  5: V.IMPROVEMENT_PORT,
  6: V.IMPROVEMENT_FORGE,
  7: V.IMPROVEMENT_LUMBER_HUT, // confirmed: buildable at turn 1 with basic tech
  8: V.IMPROVEMENT_SAWMILL,
  9: V.IMPROVEMENT_WINDMILL,
  10: V.IMPROVEMENT_FORGE,
  15: V.IMPROVEMENT_LUMBER_HUT, // seen on forest+game tiles
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeHP(displayHp: number): number {
  if (displayHp <= 0)   return V.HP_0;
  if (displayHp <= 3)   return V.HP_1_3;
  if (displayHp <= 6)   return V.HP_4_6;
  if (displayHp <= 9)   return V.HP_7_9;
  if (displayHp === 10) return V.HP_10;
  if (displayHp <= 14)  return V.HP_11_14;
  if (displayHp <= 19)  return V.HP_15_19;
  if (displayHp <= 29)  return V.HP_20_29;
  if (displayHp <= 39)  return V.HP_30_39;
  return V.HP_40;
}

function encodeStars(n: number): number {
  if (n <= 0)  return V.STARS_0;
  if (n <= 2)  return V.STARS_1_2;
  if (n <= 5)  return V.STARS_3_5;
  if (n <= 9)  return V.STARS_6_9;
  if (n <= 14) return V.STARS_10_14;
  if (n <= 19) return V.STARS_15_19;
  if (n <= 29) return V.STARS_20_29;
  if (n <= 49) return V.STARS_30_49;
  return V.STARS_50P;
}

function encodeScore(n: number): number {
  if (n <= 0)    return V.SCORE_0;
  if (n < 100)   return V.SCORE_1_99;
  if (n < 500)   return V.SCORE_100_499;
  if (n < 1000)  return V.SCORE_500_999;
  if (n < 2000)  return V.SCORE_1K_1999;
  if (n < 4000)  return V.SCORE_2K_3999;
  if (n < 6000)  return V.SCORE_4K_5999;
  if (n < 8000)  return V.SCORE_6K_7999;
  if (n < 10000) return V.SCORE_8K_9999;
  return V.SCORE_10KP;
}

/** Map API player IDs to sequential 1-indexed owner tokens. */
function buildOwnerMap(playerStates: any[]): Map<number, number> {
  const ids = playerStates
    .map((p: any) => p.Id as number)
    .filter((id: number) => id > 0 && id < 255) // exclude the "no player" sentinel
    .sort((a: number, b: number) => a - b);
  const m = new Map<number, number>();
  m.set(0, 0); // neutral
  ids.forEach((id, idx) => m.set(id, idx + 1));
  return m;
}

function encodeOwner(apiOwnerId: number, ownerMap: Map<number, number>): number {
  const seq = ownerMap.get(apiOwnerId) ?? 0;
  if (seq === 0) return V.OWNER_NEUTRAL;
  return V.OWNER_P1 + Math.min(seq - 1, 5);
}

/** Extract unit type string from UnitData.displayName ("unit.names.defender" → "defender"). */
function unitTypeName(unit: any): string {
  const displayName: string = unit?.UnitData?.displayName ?? "";
  // Format: "unit.names.<type>" or just the raw enum name
  const match = displayName.match(/unit\.names\.(.+)$/);
  if (match) return match[1].toLowerCase().replace(/[^a-z_]/g, "");
  // Fallback: try to use it directly lowercased
  return displayName.toLowerCase().replace(/[^a-z_]/g, "");
}

/** Convert API unit.health (internal int, ~10x display) to display HP. */
function displayHP(unit: any): number {
  const raw: number = unit?.health ?? 0;
  const maxRaw: number = unit?.UnitData?.health ?? 100;
  if (maxRaw <= 0) return Math.round(raw / 10);
  // Determine display max from unit type name
  const typeName = unitTypeName(unit);
  const displayMaxByType: Record<string, number> = {
    warrior: 10, rider: 10, archer: 10, catapult: 10, knight: 10, mind_bender: 10,
    mindbender: 10, amphibian: 10, mooni: 10, ice_archer: 10, icearcher: 10,
    hexapod: 10, kiton: 10, raychi: 10, shaman: 10, exida: 10, cloak: 5,
    dagger: 10, polytaur: 10,
    defender: 15, swordsman: 15, boat: 15, baby_dragon: 15, babydragon: 15,
    battle_sled: 15, battlesled: 15, tridention: 15, navalon: 30,
    ship: 20, fire_dragon: 20, firedragon: 20, ice_fortress: 20, icefortress: 20,
    phychi: 20,
    battleship: 30, gaami: 30, crab: 40, giant: 40, dragon_egg: 10, dragonegg: 10,
    doomux: 30,
  };
  const displayMax = displayMaxByType[typeName] ?? 10;
  return Math.round((raw / maxRaw) * displayMax);
}

// ── State tokenization ────────────────────────────────────────────────────────

export function buildStateTokens(apiState: any, botPlayerId: number): number[] {
  const tokens: number[] = [];

  const turn = (apiState.CurrentTurn ?? 0) + 1;
  const modeToken = GAME_MODE_TO_TOKEN[apiState.Settings?.RulesGameMode] ?? V.MODE_DOMINATION;
  const mapToken  = MAP_PRESET_TO_TOKEN[apiState.Settings?.mapPreset] ?? V.MAP_DRYLAND;

  // Header
  tokens.push(V.TURN_BASE + Math.min(turn, 80), modeToken, mapToken, V.SEP);

  const playerStates: any[] = apiState.PlayerStates ?? [];
  const ownerMap = buildOwnerMap(playerStates);

  // Bot player state
  const player = playerStates.find((p: any) => p.Id === botPlayerId);
  if (!player) return tokens;

  const tribeToken = TRIBE_ID_TO_TOKEN[player.tribe] ?? V.TRIBE_IMPERIUS;
  tokens.push(tribeToken, encodeStars(player.Currency ?? 0), encodeScore(player.score ?? 0));

  // Researched techs from availableTech (list of owned tech int IDs)
  const availableTech: number[] = player.availableTech ?? [];
  for (const techInt of availableTech) {
    if (techInt === 0) continue; // skip None/placeholder
    const tok = TECH_INT_TO_TOKEN[techInt];
    if (tok) tokens.push(tok);
  }
  tokens.push(V.SEP);

  const tiles: any[] = apiState.Map?.Tiles ?? [];

  // Own units (sorted by y then x)
  const ownUnits = tiles
    .filter((t: any) => t.unit?.owner === botPlayerId)
    .sort((a: any, b: any) =>
      a.coordinates.Y !== b.coordinates.Y
        ? a.coordinates.Y - b.coordinates.Y
        : a.coordinates.X - b.coordinates.X);

  for (const tile of ownUnits) {
    const u = tile.unit;
    const typeName = unitTypeName(u);
    const unitToken = UNIT_NAME_TO_TOKEN[typeName] ?? V.UNIT_WARRIOR;
    const hp = displayHP(u);
    const canMove   = !u.moved;
    const canAttack = !u.attacked;

    tokens.push(
      unitToken,
      encodeHP(hp),
      V.X_BASE + Math.min(tile.coordinates.X, 29),
      V.Y_BASE + Math.min(tile.coordinates.Y, 29),
      canMove   ? V.CAN_MOVE   : V.CANNOT_MOVE,
      canAttack ? V.CAN_ATTACK : V.CANNOT_ATTACK,
    );
    if (u.promotionLevel > 0) tokens.push(V.IS_VETERAN);
  }
  tokens.push(V.SEP);

  // Visible cities (improvement.type === 1 = city/village)
  const cityTiles = tiles
    .filter((t: any) => t.improvement?.type === 1)
    .sort((a: any, b: any) =>
      a.coordinates.Y !== b.coordinates.Y
        ? a.coordinates.Y - b.coordinates.Y
        : a.coordinates.X - b.coordinates.X);

  for (const tile of cityTiles) {
    const c = tile.improvement;
    const level = c.level ?? 1;
    tokens.push(
      encodeOwner(tile.owner ?? 0, ownerMap),
      V.CITY_LVL1 + Math.min(level - 1, 4),
      V.X_BASE + Math.min(tile.coordinates.X, 29),
      V.Y_BASE + Math.min(tile.coordinates.Y, 29),
    );
    // Capital: tile.capitalOf is non-zero and != 255 if this is a capital
    if (tile.capitalOf && tile.capitalOf !== 0 && tile.capitalOf !== 255) {
      tokens.push(V.IS_CAPITAL);
    }
  }
  tokens.push(V.SEP);

  // Non-empty tiles: resources, improvements, roads, ruins, enemy units
  const interestingTiles = tiles
    .filter((t: any) => {
      if (t.resource) return true;
      if (t.improvement && t.improvement.type !== 1 && t.improvement.type !== 47) return true;
      if (t.HasRoad) return true;
      if (t.improvement?.type === 47) return true; // ruins
      if (t.unit && t.unit.owner !== botPlayerId) return true;
      return false;
    })
    .sort((a: any, b: any) =>
      a.coordinates.Y !== b.coordinates.Y
        ? a.coordinates.Y - b.coordinates.Y
        : a.coordinates.X - b.coordinates.X);

  for (const tile of interestingTiles) {
    const terrainToken = TERRAIN_INT_TO_TOKEN[tile.terrain] ?? V.TERRAIN_FIELD;
    const imp = tile.improvement;
    let surfaceToken = V.RESOURCE_NONE;
    if (imp && imp.type !== 1 && imp.type !== 47) {
      surfaceToken = IMPROVEMENT_INT_TO_TOKEN[imp.type] ?? V.IMPROVEMENT_NONE;
    } else if (tile.resource) {
      surfaceToken = RESOURCE_INT_TO_TOKEN[tile.resource.type] ?? V.RESOURCE_NONE;
    }

    tokens.push(
      terrainToken,
      surfaceToken,
      encodeOwner(tile.owner ?? 0, ownerMap),
      V.X_BASE + Math.min(tile.coordinates.X, 29),
      V.Y_BASE + Math.min(tile.coordinates.Y, 29),
    );
    if (tile.HasRoad) tokens.push(V.HAS_ROAD);
    if (imp?.type === 47) tokens.push(V.HAS_RUIN);

    // Enemy unit on this tile
    const u = tile.unit;
    if (u && u.owner !== botPlayerId) {
      const typeName = unitTypeName(u);
      const unitToken = UNIT_NAME_TO_TOKEN[typeName] ?? V.UNIT_WARRIOR;
      tokens.push(
        unitToken,
        encodeHP(displayHP(u)),
        encodeOwner(u.owner, ownerMap),
      );
    }
  }
  tokens.push(V.SEP);

  return tokens;
}

// ── Command tokenization ──────────────────────────────────────────────────────

export function commandToTokens(cmd: any): number[] {
  switch (cmd.CommandType) {
    case "Move":
    case "MoveAndAttack":
      return [
        V.ACTION_MOVE,
        V.X_BASE + Math.min(cmd.From?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.From?.Y ?? 0, 29),
        V.X_BASE + Math.min(cmd.To?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.To?.Y ?? 0, 29),
      ];
    case "Attack":
      return [
        V.ACTION_ATTACK,
        V.X_BASE + Math.min(cmd.From?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.From?.Y ?? 0, 29),
        V.X_BASE + Math.min(cmd.To?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.To?.Y ?? 0, 29),
      ];
    case "Research": {
      const techToken = TECH_INT_TO_TOKEN[cmd.Type];
      return techToken ? [V.ACTION_RESEARCH, techToken] : [V.ACTION_RESEARCH];
    }
    case "Train": {
      const unitTypeToken = UNIT_INT_TO_TOKEN[cmd.Type] ?? V.PAD;
      return [
        V.ACTION_TRAIN,
        V.X_BASE + Math.min(cmd.Coordinates?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.Coordinates?.Y ?? 0, 29),
        unitTypeToken,
      ];
    }
    case "Build":
      return [
        V.ACTION_BUILD,
        V.X_BASE + Math.min(cmd.Coordinates?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.Coordinates?.Y ?? 0, 29),
        IMPROVEMENT_INT_TO_TOKEN[cmd.Type] ?? V.PAD,
      ];
    case "Capture":
      return [V.ACTION_CAPTURE,
        V.X_BASE + Math.min(cmd.Coordinates?.X ?? 0, 29),
        V.Y_BASE + Math.min(cmd.Coordinates?.Y ?? 0, 29),
      ];
    case "Heal":
    case "Recover":
      return [V.ACTION_HEAL];
    case "ConvertUnit":
      return [V.ACTION_CONVERT];
    case "Embark":
      return [V.ACTION_EMBARK];
    case "Disembark":
      return [V.ACTION_DISEMBARK];
    case "UpgradeCity":
    case "CityReward": {
      const cx = cmd.Coordinates?.X ?? cmd.CityX ?? 0;
      const cy = cmd.Coordinates?.Y ?? cmd.CityY ?? 0;
      const rewardTok = typeof cmd.Reward === "string"
        ? (CITY_REWARD_NAME_TO_TOKEN[cmd.Reward?.toLowerCase()] ?? V.PAD)
        : (CITY_REWARD_INT_TO_TOKEN[cmd.Reward ?? cmd.Type] ?? V.PAD);
      return [
        V.ACTION_CITY_REWARD,
        V.X_BASE + Math.min(cx, 29),
        V.Y_BASE + Math.min(cy, 29),
        rewardTok,
      ];
    }
    case "Stay":
      return [V.ACTION_HEAL]; // nearest proxy
    case "EstablishEmbassy":
    case "SendPeaceRequest":
    case "AcceptPeace":
    case "ExamineRuins":
      return [V.ACTION_END_TURN]; // out-of-vocab, use end_turn fallback
    case "EndTurn":
    case "EndMatch":
      return [V.ACTION_END_TURN];
    default:
      console.warn(`  [adapter] Unknown command type: ${cmd.CommandType}`);
      return [V.ACTION_END_TURN];
  }
}

export function prepareRankInput(apiState: any, commands: any[], botPlayerId: number) {
  const stateTokens = buildStateTokens(apiState, botPlayerId);
  const actions = commands.map((cmd, idx) => ({
    idx,
    label: formatCommandLabel(cmd),
    tokens: commandToTokens(cmd),
  }));
  return { stateTokens, actions };
}

const TECH_LABEL: Record<number, string> = {
  1: "Climbing", 2: "Hunting", 3: "Riding", 4: "Archery", 5: "Forestry",
  6: "Farming", 7: "Fishing", 8: "Meditation", 9: "Shields", 10: "Aquatism",
  11: "Mining", 12: "Roads", 13: "Whaling", 14: "Chivalry", 15: "Spiritualism",
  16: "Construction", 17: "Mathematics", 18: "Navigation", 19: "Smithery",
  20: "Organization", 21: "Trade", 22: "Philosophy", 23: "Strategy", 38: "FreeDiving",
};

const UNIT_TYPE_LABEL: Record<number, string> = {
  2: "Warrior", 3: "Rider", 4: "Knight", 5: "Defender", 7: "Catapult",
  8: "Archer", 9: "MindBender", 10: "Giant",
};

function formatCommandLabel(cmd: any): string {
  switch (cmd.CommandType) {
    case "Move": return `move (${cmd.From?.X},${cmd.From?.Y})→(${cmd.To?.X},${cmd.To?.Y})`;
    case "Attack": return `attack (${cmd.From?.X},${cmd.From?.Y})→(${cmd.To?.X},${cmd.To?.Y})`;
    case "Research": return `research ${TECH_LABEL[cmd.Type] ?? `tech#${cmd.Type}`}`;
    case "Train": {
      const unit = UNIT_TYPE_LABEL[cmd.Type] ?? `unit#${cmd.Type}`;
      return `train ${unit} at (${cmd.Coordinates?.X ?? cmd.From?.X},${cmd.Coordinates?.Y ?? cmd.From?.Y})`;
    }
    case "Build": {
      const imp: Record<number,string> = {2:"LumberHut",3:"Mine",4:"Farm",5:"Port",6:"Forge",7:"LumberHut",8:"Sawmill",9:"Windmill",15:"LumberHut"};
      return `build ${imp[cmd.Type] ?? `imp#${cmd.Type}`} at (${cmd.Coordinates?.X},${cmd.Coordinates?.Y})`;
    }
    case "Capture": return `capture at (${cmd.Coordinates?.X ?? cmd.From?.X},${cmd.Coordinates?.Y ?? cmd.From?.Y})`;
    default: return cmd.CommandType?.toLowerCase() ?? "unknown";
  }
}
