# Ticket 162 — Collection v2: archive the card pool, start again under the grammar

**Type:** data (registry) + design review. **Status:** DRAFT collection delivered 2026-09-22 for Henry's
review; nothing committed to the registry. **Asked by Henry 2026-09-22:** *"I think we need to revisit
the card pool. My latest playtest showed they were not exciting and it is still hard to build decks.
Can we archive the current card collection and start a new one. Try to build a card collection after
the notes I uploaded yesterday."* **Relates to:** 160 (this is 160's sessions done in one pass as a
draft), 158 §2 (the grammar), 161 (start kits — applied here), `research/os-directions-2026-09-21.md`
(Henry's directions, applied), 149c (prices every number below before it ships), 78 (tags).

## 1. What was delivered

`collection-v2/` — `collection.py` (the source of truth: 99 cards, 12 kits, 36 sample decks),
`collection.json` (the same, for tooling), `build.py` (validator + generator), `browser.html`
(the browsable breakdown: decks by OS · collection with filters · census).

**99 cards: 58 kept, 8 revised, 33 new.** Every kit is 8–9 cards with a 5-card start kit marked ★ that
holds no consume (161 §2); the consume and the second lane are "found in the run". Every kit has at
least two payoffs on two different counters (158 §2.6), except where one currency is Energy (which has
no counter until 160-r2 ships). Twelve run-only cards (hate daemons, the two ramp daemons, Tidal
Battery) are never in a kit.

## 2. The rules the draft applied (from the 09-21 directions)

- Fenrir v1 = Str **consume** + HP fuel (Sun Devourer moves here). Sköll v1 = Str **multi-hit** (Flare
  Burst, Pack Tactics) + deny/battery (Snarl, Snap, Howl). No "build Str + consume" twice.
- Sköll v2 = **EMBER_FUSE** (new OS: attacks on a Burning target add 1 Burn) — the detonation deck;
  its old Str kit is archived.
- Rat: **Poison gone** (Acorn Toss, Pollen Cloud revised). v1 = 0e zoo + keeper (Tend, ally-target).
  v2 = 0e → Dazed with **binary** riders; Slander moves to Kraken (per-stack is Kraken's).
- Jorm v1 = cards-played + **refund ramp** (Riptide Run new); **Ink Stream is Kraken-only**. Jorm v2 =
  Poison riders × multi-hit + double-then-trigger; Venom Glut (new) is the Poison consume, reads the
  target.
- Kraken v1 = draw scalar + Dazed consume. Kraken v2 = Energy ramp + **steam** Burn (kept).
- Huldra v1 = Weakened scalar (Sap Strength, new, reads the target) + **keeper** (Bolster, Tend,
  Verdant Ward — ally-target, 160-e1). Huldra v2 = Bark scalar/consume (Bark Smash new) + Thornguard.
- Glue: **Quick Scan** (None, 0e, draw 1) in every kit that lacked draw; Soothe and Mend are ally-target
  generics. The three Fire prints: Flare Burst, Sharp Edge, Brand.
- Daemons: all exhaust (Henry). Riptide / Short Circuit kept, Static Ward (anti-control) new,
  Overclock Core (160-r1) and Short Fuse (160-r2) new; Battery Pack archived (superseded).

## 3. What the census says about the draft

Poison: 3 owners (Jorm v2 owner, Huldra v2 converter, Huldra v1 consume) — down from 5 decks.
Strength: Fenrir consume vs Sköll multi-hit, distinct. Burn: converter (Fenrir v2), detonation (Sköll
v2), steam (Kraken v2). Dazed: per-stack (Kraken) vs binary (Rat). Cards in more than one kit: only
shared-element cards by design (Undertow ×2 Water, Acorn Toss ×2 Rat, Serpent Flurry/Coil across the
two Jorms, Heartwood/Bolster as Nature staples) plus the generics.

## 4. What it is not, yet

- **Not priced.** Every number is a draft in the current bands (0e ≈ 12, 1e ≈ 25, 2e ≈ 45–60,
  3e ≈ 90–105, 1 Energy ≈ 35, draw 20/15/10). 149c scores each card before it ships; MANUAL REVIEW on
  the new ones.
- **Not measured.** 160 §5's before-numbers on the *current* registry first, then this collection
  through the 140 grid and the 141 gym check with the research doc's two teams per gym.
- **Three engine dependencies:** ally-target cards (160-e1: Tend, Bolster, Shell Share, Mend, Soothe,
  Howl, Verdant Ward); EMBER_FUSE as a hook (attack on Burning target → +1 Burn); detonation numbers.
- **Not decided by Henry:** the 33 new cards' names and text are proposals; the OS rename for Sköll v2;
  whether Battle Rhythm / Crimson Draw / Brute Force survive in the run pool or go to the archive.

## 5. Rows (after Henry's review)

- **162a — archive.** `programs.json` → `src/engine/data/archive/programs-v1.json` (kept for the
  card browser's history and the 59 orphan annotations); `mingmingRegistry.ts` decks and start kits
  from `collection.json`; `hooks.json` gets EMBER_FUSE; ids that changed (`water_slap → tackle`,
  `whirlpool_v2 → whirlpool`, …) get an alias table so run logs and tests keep reading.
- **162b — score.** 149c over the 99; ledger to Henry; MANUAL REVIEW rows ruled.
- **162c — measure.** 140 grid + 141 gym check + run gate on v2; the 160 §5 numbers before/after.
- **162d — the browser as a dev tool.** `build.py`'s output wired to `npm run decks` so the HTML
  regenerates from the registry, not from a copy.
