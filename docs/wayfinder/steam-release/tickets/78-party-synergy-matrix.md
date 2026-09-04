# Party synergy: the only channel between members is the enemy's status bar (ticket 78)

- Type: wayfinder:grilling (measurement first — the matrix runs before Henry's session; the session designs bridges only where the matrix says a pair is dead)
- Status: open
- Assignee: matrix + tags: agent; session + bridge design: Henry (with deck-archetypes for the printings)
- Blocked by: nothing for the tags and the matrix; the recruit-screen readout is UI (34 chassis) and waits on the tags being ratified
- Phase: Vertical Slice

## Why this exists

Henry, 2026-09-01: *"Sometimes it feels bad adding a new mingming if they don't synergize, so there
needs to be a synergy option between each type and within the types."* Two other things he said the
same day belong to this ticket's frame: he has not felt able to find *"a really cool synergy with
cards"* in his own runs, and the balancing focus for playtest is the **player side**.

The party plays **one merged deck** (three 5-card engines plus the starter's generics, 61 AMENDED
SPEC). So "does this recruit synergize" has a precise meaning: **does anything this engine produces
get read by an engine already in the party, or vice versa.** Nothing in the game tags that, nothing
shows it at recruit time, and — the structural point below — most of the channels that *used* to
carry it were closed on purpose.

## The structural finding (from the code, before any arm)

Cross-member value can only travel through state both members can see. Walk the twelve EA engines'
kits (ticket 60's ratified tag table) and sort every effect by where it lands:

| lands on | effects | can another member read it? |
| --- | --- | --- |
| **the ENEMY** | Poison (jorm_v2, rat_v2, huldra_v1/v2), Weakened + Dazed (rat_v2, huldra_v1), Burn (fenrir_v2) | **YES** — `hexbloom` consumes Weakened, `contagion`/`toxic_surge` read Poison, any Burn-consumer reads Burn |
| **SELF** | Strengthened + Sharp (fenrir_v1, skoll_v1/v2, huldra_v2 `sap_vigor`, kraken_v2 `capacitor`), Regen, Energized, Energy | **NO** — self-scoped by definition; `sun_devourer` consumes only its own stacks |
| **a per-caster counter** | triggered draws (`ink_stream`, kraken_v1 / jorm_v1), cards played (`serpents_coil`, `seed_bomb_v2`) | **NO, and this is recent** — `CARDS_DRAWN_TRIGGERED` was scoped to the mingming on 2026-08-30 (Henry's ruling, HANDOFF) and `CARDS_PLAYED` in deck-archetypes 123. Both rulings were right for 3v3 balance (`ink_stream` was landing 52.9 off party width) and both **deleted the only cross-member channel Water and ratatoskr_v1 had.** |

So the prediction the matrix should confirm or kill:

- **Nature has a within-type channel** (rat_v2's Weakened feeds huldra_v1's `hexbloom`; huldra_v2's
  and rat_v2's Poison feed jorm_v2's `contagion` across types).
- **Fire has no within-type channel.** fenrir × skoll are both self-Strengthened engines; nothing
  either produces lands where the other reads. Burn (fenrir_v2) has no consumer in the launch set
  outside fenrir_v2 itself.
- **Water has no within-type channel** since the scoping fixes. kraken × jormungandr both run
  `ink_stream`; neither feeds the other any more.
- **Between types, Poison is the only live cross-element channel today** (Nature → jorm_v2).

If that holds, "add a synergy option between each type and within the types" is not 66 pairs of
design work. It is **two dead within-type channels (Fire, Water) and a small number of dead
cross-type channels**, and the tags say where.

## Step 1 — produce / consume tags (agent, no design)

Add to each of the 12 EA engines a **`synergy`** block, derived from its kit and its OS, ratified by
Henry before the matrix runs (it is the vocabulary the recruit screen will print):

```
produces: [status-on-enemy | status-on-self | draw | energy | burn ...]   — what the engine puts into the world
reads:    [Poison-on-enemy | Weakened-on-enemy | Strengthened-on-self ...]  — what its payoff scales on or consumes
```

A pair **has a channel** iff `A.produces ∩ B.reads ≠ ∅` or the reverse, and the tag names *where*
the status lives (`-on-enemy` / `-on-self`), because that is the whole finding above. First draft
from the kits, for Henry to correct:

| engine | produces | reads |
| --- | --- | --- |
| fenrir_v1 | Strengthened-on-self, Sharp-on-self | own missing HP |
| fenrir_v2 | Burn-on-enemy (and self) | Burn-on-enemy |
| skoll_v1 | Strengthened-on-self | Strengthened-on-self (consumes) |
| skoll_v2 | Strengthened-on-self, energy, draw | Strengthened-on-self |
| kraken_v1 | draw (own) | own triggered draws |
| kraken_v2 | Energized-on-self, Sharp-on-self | energy |
| jormungandr_v1 | draw (own) | own cards played, own triggered draws |
| jormungandr_v2 | Poison-on-enemy | **Poison-on-enemy** (multiply, trigger) |
| ratatoskr_v1 | draw, cards played | own cards played |
| ratatoskr_v2 | Weakened-on-enemy, Dazed-on-enemy, Poison-on-enemy | — |
| huldra_v1 | Weakened-on-enemy, Sharp/Regen-on-self | **Weakened-on-enemy** (consumes → Poison) |
| huldra_v2 | Poison-on-enemy, Strengthened-on-self | — |

Read the table's `reads` column: **only three engines read anything an ally can supply**
(jorm_v2, huldra_v1, fenrir_v2), and all three read the enemy's status bar. That is the number the
ticket is about.

## Step 2 — the pair matrix (agent, report-only)

**Cell:** the **biome-1 elite** (`PARTY_SIZE_AT_BIOME(1) = 2`, `runGate.ts:620`) — the fight where
the second recruit actually joins — bare arm, Rally live, paired seeds, current tree.

**Rows:** every legal pair of the 12 EA engines (distinct species — the no-duplicate-species law)
= **60 pairs**, plus **12 baselines**: each engine paired with the **control** body (the control
species' `baseline_*` deck, the neutral the harness already carries).

**Score:** `synergy(a,b) = W(a,b) − ½·[W(a,ctrl) + W(b,ctrl)]`. Positive means the pair is worth
more than its members; **dead = residual ≤ −5pt**, **live = ≥ +5pt**, with McNemar against the
better member's baseline row. Report the 12×12 as a heatmap-ready table in
`research/78-synergy-matrix.md`, with the **tag prediction beside each cell** (channel / no channel)
so the matrix grades the tags as well as the pairs.

**n:** 30 per cell first pass (72 cells, 2v2 is well under a 3v3's cost — expect ~5–6 h on Henry's
machine, `--out`, splittable by row), then n=60 on every cell within ±5 of a threshold.

**Harness:** `--handbuilt` already substitutes a lineup with the run-dealt deck (`deck` omitted);
the matrix is a generated list of 72 `HandbuiltParty` entries with a `--cells biome1-elite`
selector. No engine change. `optionsThreading.test.ts` gets the case (the `--toolbox` lesson).

## Step 3 — Henry's session: bridges only where the matrix says dead

Rules going in:

- **Bridges are on-curve cards** (card law: cards stay on curve, fix at the enabler). A bridge is
  not stronger; it is a card whose effect lands **where an ally reads**, which today means one of
  three shapes: it puts a status on the enemy that an ally's payoff reads; it puts a status on an
  **ally** (`target: ALLY` — Strengthened/Sharp to a teammate is a new target for the launch set,
  and it is the only way Fire gets a within-type channel without touching the scoping rulings); or
  it *reads an ally's* state explicitly (*"for each Poison on the target"* is already legal, *"if an
  ally has Strengthened"* is a `HAS_STATUS` with an ally target — check the conditional supports it).
- **No caps** (77's rule). A bridge that would run away is reshaped, not clamped.
- **Do not reopen the scoping rulings.** Cross-member draw/play counting was the 52.9-damage bug;
  a bridge that wants "ally draws" must say `ALLY` on the card, not widen a counter.
- **Element pools:** a bridge lives in the pool of the element that *produces*, so it shows up for
  the party that can use it (69's "the pick pool is your elements"). Cross-element bridges are the
  argument for the neutral slot.
- **Budget guess, to be replaced by the matrix:** 2 within-Fire, 2 within-Water, ~4–6 cross-type
  (Fire→Nature via Burn-consumer, Water→Fire via ally-Energized, Nature→Fire via Weakened-reader
  in a Strength deck…), ~8–10 cards, not 66. Each is a deck-archetypes printing with its own arm.

## Step 4 — the recruit-screen readout (UI, after the tags are ratified)

Half of "it feels bad" is not being able to *see* it before the pick. At the recruit / roster
screen (ticket 62's editor), for a candidate against the current party, print the channel by name:

> **Feeds:** Poison → *contagion* (jormungandr_v2) · **Fed by:** Weakened ← *thorn_tithe*
> (huldra_v1) · **No channel with:** fenrir_v1

Derived from the tags, not the sim, so it is free at runtime and it never lies about a channel the
tags declare. Same block on the deck-power readout 77 asked for. This is ticket 34's chassis and
should be its own `task` ticket once the vocabulary is ratified.

## What this ticket does NOT do

- No card printings, no `programs.json` edits before the session (75 ruling 1b pattern).
- No change to `CARDS_DRAWN_TRIGGERED` / `CARDS_PLAYED` scoping.
- No 3-member matrix (220 triples); pairs are the unit of the feeling and the third member's
  synergy is the sum of two pairs until measured otherwise.
- No OS changes: an OS that gives its ally something is a real design direction (huldra_v1 is
  already "team-leaning") but it is a deck-archetypes question.

## Done when

Tags ratified; the 12×12 matrix reported with tag-vs-measured agreement; Henry's session held;
the dead-pair list ruled with a bridge (or an explicit "this pair is meant to be dead") per entry;
bridge printings handed to deck-archetypes as tickets with per-card arms; the readout ticket filed.

## Resolution

_(open)_
