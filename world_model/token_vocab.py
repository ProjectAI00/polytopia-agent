"""
Token vocabulary — mirrors tokenizer.ts V constants.

Used by PolytopiaMambaScorer to build synthetic states and decode action probs.
Keep in sync with src/scripts/tokenizer.ts.
"""

# ─── Special tokens ───────────────────────────────────────────────────────────

PAD  = 0
SEP  = 1
ACT  = 2
WIN  = 3
LOSS = 4

# ─── Turn numbers: TURN_BASE + turn (1-80) → tokens 5-84 ─────────────────────

TURN_BASE = 5

# ─── Stars buckets: 182-190 ───────────────────────────────────────────────────

STARS_0     = 182
STARS_1_2   = 183
STARS_3_5   = 184
STARS_6_9   = 185
STARS_10_14 = 186
STARS_15_19 = 187
STARS_20_29 = 188
STARS_30_49 = 189
STARS_50P   = 190

# ─── Score buckets: 191-200 ───────────────────────────────────────────────────

SCORE_0       = 191
SCORE_1_99    = 192
SCORE_100_499 = 193

# ─── Tribes: 224-238 ──────────────────────────────────────────────────────────

TRIBES: dict[str, int] = {
    "bardur":    224,
    "imperius":  225,
    "oumaji":    226,
    "kickoo":    227,
    "hoodrick":  228,
    "luxidoor":  229,
    "vengir":    230,
    "zebasi":    231,
    "ai-mo":     232,
    "quetzali":  233,
    "yadakk":    234,
    "aquarion":  235,
    "elyrion":   236,
    "polaris":   237,
    "cymanti":   238,
}

# ─── Action types: 239-251 ────────────────────────────────────────────────────

ACTION_MOVE        = 239
ACTION_ATTACK      = 240
ACTION_TRAIN       = 241
ACTION_RESEARCH    = 242
ACTION_BUILD       = 243
ACTION_CAPTURE     = 244
ACTION_HEAL        = 245
ACTION_CONVERT     = 246
ACTION_EMBARK      = 247
ACTION_DISEMBARK   = 248
ACTION_CITY_REWARD = 249
ACTION_INFILTRATE  = 250
ACTION_END_TURN    = 251

ACTION_TOKEN_RANGE = range(ACTION_MOVE, ACTION_END_TURN + 1)  # 239..251

ACTION_NAMES: dict[int, str] = {
    239: "move",
    240: "attack",
    241: "train",
    242: "research",
    243: "build",
    244: "capture",
    245: "heal",
    246: "convert",
    247: "embark",
    248: "disembark",
    249: "city_reward",
    250: "infiltrate",
    251: "end_turn",
}

# ─── Game modes: 320-323 ──────────────────────────────────────────────────────

MODE_DOMINATION = 320
MODE_PERFECTION  = 321
MODE_SPEEDRUN    = 322
MODE_COLOSSUS    = 323

MODES: dict[str, int] = {
    "domination": MODE_DOMINATION,
    "perfection":  MODE_PERFECTION,
    "speedrun":    MODE_SPEEDRUN,
    "colossus":    MODE_COLOSSUS,
}

# ─── Map types: 324-327 ───────────────────────────────────────────────────────

MAP_DRYLAND     = 324
MAP_CONTINENT   = 325
MAP_ARCHIPELAGO = 326
MAP_WATERWORLD  = 327

MAPS: dict[str, int] = {
    "dryland":     MAP_DRYLAND,
    "continent":   MAP_CONTINENT,
    "archipelago": MAP_ARCHIPELAGO,
    "waterworld":  MAP_WATERWORLD,
}
