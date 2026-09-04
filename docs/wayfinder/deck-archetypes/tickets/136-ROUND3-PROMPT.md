# Ticket 136 — ROUND THREE implementation prompt (136o … 136t)

Paste into a fresh agent session. Same repo, same branch (`legion/ai-perf`), same rules as
`136-IMPLEMENTATION-PROMPT.md` (read its header and HANDOFF §7/§8 first): **one commit per ticket
letter, authored as Henry, no tuning, STOP on any gate failure outside the listed test-assertion
updates, stage explicit paths only.** Nothing here is committed; the two 136 spec files are NOT
edited by this round — this file is the whole spec.

Base: HEAD after round two (`c9fdb74`). Measured on that build in the design container, full grid,
1v1 beamless, seed base `grid`, 30 iterations:

|  | mean | sd | in band |
|---|---|---|---|
| round two (shipped, promoted) | 49.9 | 12.0 | 26/32 |
| **round three** | 49.9 | **9.6** | **30/32** |

Pre-131 the roster sat at sd 9.2 / 31 of 32. The two still out are EXPECTED and ruled: skoll_v1 34.6
(Henry: do not push her, she is a 3v3 deck) and valkyrie_v2 25.5 (Ascension stays, no second
Glimmer — a second Glimmer measured 91, a full-cycle loop; next session).

## Targets (accept ±5, band count ≥ 29/32)

| deck | round three | round two | | deck | round three | round two |
|---|---|---|---|---|---|---|
| jormungandr_v1  | 71.6 | 72.8 | | nidhoggr_v1  | 69.9 | 71.4 |
| sleipnir_v2  | 62.7 | 65.0 | | fenrir_v2  | 59.7 | 61.4 |
| draugr_v2  | 59.0 | 60.4 | | kraken_v2  | 58.8 | 60.1 |
| audhumbla_v1  | 57.4 | 59.1 | | huldra_v1  | 56.2 | 58.6 |
| fenrir_v1  | 55.1 | 58.2 | | huldra_v2  | 54.7 | 57.8 |
| hraesvelgr_v1  | 54.6 | 57.0 | | ratatoskr_v1  | 53.3 | 54.6 |
| skoll_v2  | 52.8 | 55.5 | | sleipnir_v1  | 52.2 | 54.3 |
| jormungandr_v2  | 52.0 | 53.1 | | gullinbursti_v2  | 50.9 | 34.1 |
| hel_v2  | 50.8 | 54.7 | | hel_v1  | 48.2 | 31.6 |
| kraken_v1  | 47.2 | 49.1 | | gullinbursti_v1  | 47.2 | 47.5 |
| fafnir_v1  | 46.8 | 50.6 | | draugr_v1  | 44.3 | 48.3 |
| fafnir_v2  | 43.2 | 46.4 | | audhumbla_v2  | 43.2 | 28.5 |
| hraesvelgr_v2  | 43.1 | 46.4 | | ratatoskr_v2  | 42.6 | 44.9 |
| valkyrie_v1  | 41.6 | 43.5 | | ymir_v1  | 41.5 | 44.2 |
| ymir_v2  | 39.2 | 34.9 | | nidhoggr_v2  | 37.9 | 39.9 |
| skoll_v1 **OUT** | 34.6 | 29.5 | | valkyrie_v2 **OUT** | 25.5 | 23.7 |

|  | mean | sd | in band |
|---|---|---|---|
| round two (shipped) | 49.9 | 12.0 | 26/32 |
| **round three** | 49.9 | 9.6 | 30/32 |

Unspent energy over 15%: audhumbla_v1 23%, fafnir_v2 21%, draugr_v2 19%

---

## 136o — ymir_v2 GLACIAL_PACE (34.9 → 39.2). Card draw stays 4 (species stat; draw 3 dropped ymir_v1 to 33).

New cards — NEW ids, so `thaw`, `ice_spear`, `numbing_gale` are untouched for the four other decks that run them:

```json
{
    "glacier_thaw": {
        "id": "glacier_thaw",
        "name": "Glacier Thaw",
        "description": "15 power. Gain 4 Strengthened and 3 Sharp.",
        "element": "Ice",
        "target": "Single",
        "category": "Attack",
        "rarity": "Uncommon",
        "baseCost": 2,
        "constraints": [
            "not_stunned",
            "not_asleep",
            "energy_base"
        ],
        "actions": [
            {
                "type": "ATTACK",
                "power": 15,
                "target": "TARGET"
            },
            {
                "type": "STATUS",
                "status": "Strengthened",
                "stacks": 4,
                "target": "SELF"
            },
            {
                "type": "STATUS",
                "status": "Sharp",
                "stacks": 3,
                "target": "SELF"
            }
        ]
    }
},
{
    "rime_spear": {
        "id": "rime_spear",
        "name": "Rime Spear",
        "description": "40 power to side. Apply 2 Weakened to side.",
        "element": "Ice",
        "target": "Side",
        "category": "Attack",
        "rarity": "Uncommon",
        "baseCost": 2,
        "constraints": [
            "not_stunned",
            "not_asleep",
            "energy_base"
        ],
        "actions": [
            {
                "type": "ATTACK",
                "power": 40,
                "target": "TARGET"
            },
            {
                "type": "STATUS",
                "status": "Weakened",
                "stacks": 2,
                "target": "TARGET"
            }
        ]
    }
},
{
    "numbing_storm": {
        "id": "numbing_storm",
        "name": "Numbing Storm",
        "description": "35 power to side. Apply 3 Dazed to side.",
        "element": "Ice",
        "target": "Side",
        "category": "Attack",
        "rarity": "Uncommon",
        "baseCost": 2,
        "constraints": [
            "not_stunned",
            "not_asleep",
            "energy_base"
        ],
        "actions": [
            {
                "type": "ATTACK",
                "power": 35,
                "target": "TARGET"
            },
            {
                "type": "STATUS",
                "status": "Dazed",
                "stacks": 3,
                "target": "TARGET"
            }
        ]
    }
}
```
`mingmingRegistry.ts` ymir `decks.ymir_v2` →
`["bracing_cold", "bracing_cold", "glacier_thaw", "rime_spear", "numbing_storm", "glacial_maul", "glacial_maul", "glacial_slam"]`
(one Ice Spear, one Numbing Gale and the 1e Thaw leave; the deck is 8 cards, every card 2e — the
species comment at ymir should say so: "one card a turn, so every card is a full turn"). Check
`startKits` for ymir; if v2 has one, it must be a sub-multiset of the new deck.

## 136p — gullinbursti_v2 KINETIC_RAM (34.1 → 50.9)

1. New cards:
```json
{
    "keen_strike": {
        "id": "keen_strike",
        "name": "Keen Strike",
        "description": "20 power. Gain 3 Sharp.",
        "element": "Earth",
        "target": "Single",
        "category": "Attack",
        "rarity": "Uncommon",
        "baseCost": 1,
        "constraints": [
            "not_stunned",
            "not_asleep",
            "energy_base"
        ],
        "actions": [
            {
                "type": "ATTACK",
                "power": 20,
                "target": "TARGET"
            },
            {
                "type": "STATUS",
                "status": "Sharp",
                "stacks": 3,
                "target": "SELF"
            }
        ]
    }
},
{
    "pebble_flurry": {
        "id": "pebble_flurry",
        "name": "Pebble Flurry",
        "description": "4 power, twice.",
        "element": "Earth",
        "target": "Single",
        "category": "Attack",
        "rarity": "Common",
        "baseCost": 0,
        "constraints": [
            "not_stunned",
            "not_asleep",
            "energy_base"
        ],
        "actions": [
            {
                "type": "ATTACK",
                "power": 4,
                "target": "TARGET"
            },
            {
                "type": "ATTACK",
                "power": 4,
                "target": "TARGET"
            }
        ]
    }
}
```
2. `decks.gullinbursti_v2`: both `"water_slap"` → `"pebble_flurry"`, both `"keen_edge"` → `"keen_strike"`
   (keen_edge stays in the registry — gullinbursti_v1 runs it).
3. `hooks.json` gullinbursti_v2 description → `"Earth Attack cards deal +2.5 power per stack of Sharp
   Gullinbursti holds, on every hit, but the ram blunts its own edge: he takes 1 Dazed at the start of
   each of his turns."` (Henry: the text must say POWER and must carry the number; the hook's `bonus`
   is 2.5 since 136a.)

## 136q — hel_v1 TWILIGHT_CADENCE (31.6 → 48.2)

`src/engine/core/Hooks.ts`: `STANCE_BONUS = { dark: 0.35, light: 0.35 }` → `{ dark: 0.45, light: 0.45 }`.
**Text bug found while measuring:** the OS description says 30% and the code has said 35% for some
time. Description → `"The element Hel casts sets her stance at the end of the action. Dark Stance:
+45% damage dealt. Light Stance: -45% damage taken."` `StanceSystem.test.ts` pins the multiplier —
update the value. Deck unchanged (the Weakened-heal card measured +7 alone and diluted the stance
number when combined; not shipped).

## 136r — skoll_v1 (29.5 → 34.6, ruled acceptable)

`sun_devourer`: STATUS_CONSUMED attack `"power": 15` → `20`; description →
`"Devour the light: consume all your Strength and deal 20 power per stack consumed."` Nothing else.

## 136s — audhumbla_v2 PRIMORDIAL_MILK (28.5 → 43.2)

`drink_deep`: STATUS_CONSUMED attack `"power": 15` → `18`; description →
`"Drink deep: consume all your Regen and deal 18 Light damage per stack consumed."` Smite untouched
(shared with valkyrie_v1). For the record: 20 measured 58, 25 → 75, 30 → 84 single-row; 18 is Henry's pick.

## 136t — valkyrie_v2 REBIRTH_CYCLE (23.7 → 25.5)

1. `falling_star`: ATTACK `"power": 40` → `50`; description → `"50 power. Exhaust."`
2. `starfall` description → `"18 power for each card an effect drew you this turn."` (text only; the
   action is unchanged — Henry: "card a card" does not read.)
Ascension stays. Do NOT add a second Glimmer (measured 91 — a loop).

## Gates

Per commit: `npx tsc -b`, `npx vitest run`, `npx eslint .`. After 136t: full grid
(`node scratch/rebaseline.mjs --iter 30 --outdir results/rebaseline-r3`) against the table above,
±5 per deck, ≥ 29/32 in band; `promotegrid --dry-run`, then promote in its own commit as before.
Ticket 137 (AI Regen constant) still lands AFTER this round.

## Docs
SHIPPED section appended to `136-per-deck-rebalance.md` (round three), map.md decision lines for
ymir_v2 (all-2e, one card a turn) and gullinbursti_v2 (Sharp-per-hit, the shield engine measured
24 and was rejected), HANDOFF open threads: valkyrie_v2 next, unspent playtest list
(audhumbla_v1 23%, fafnir_v2 21%, draugr_v2 19%), fenrir_v1 kit-equals-deck (Henry: leave for
playtesting), BURN_TIMES_ENERGY kept on purpose, hel_v2 heal loan ruled fine.
