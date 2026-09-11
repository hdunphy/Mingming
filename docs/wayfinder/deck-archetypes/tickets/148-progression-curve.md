# Ticket 148 — The progression curve: does a run make the player stronger, and by how much

> **Playtest input 2026-09-10** (Henry, see 142 §6): *"I still don't feel like I'm leveling up with my decks. I almost always send cards to the collection and search for 2–3 cards to add."* Deck size went 8→17→8→17→8 across the run because every boundary bench removes the recruit's five engine cards; and the type triangle at biome scale makes benching down to one on-type body the rational move at every seam. Two questions for this ticket's design session: a progression axis that survives a bench, and what makes an off-type body worth keeping through a biome.

**Type:** measurement first, then Henry's design session. **Lane:** balance, aimed at the
single-player question rather than the roster. **Asked by Henry, 2026-09-07:** *"is balanced fun?
Balanced is good for PvP, but this is a single-player game."*
**Continues:** steam-release 77 (player-side arms; Track A reported, Tracks B–C open), 60 (difficulty
and agency: "a roguelike needs structural player edges"), 21 (leveling freeze), 13/14 (market,
workshop). **Branch:** `legion/comp-grid`, authored as Henry.

---

## 1. The reframe

The 1v1 grid is 32 of 32 in band and the 3v3 grid has a measured archetype triangle. Those are the
*floor* of a single-player game — no trap picks, no auto-picks, and fair enemies (every deck is also
an enemy deck). They are not the fun. The fun of a roguelike is lopsidedness the player *built* out
of pieces that were individually fair — the run should make you stronger, visibly, and the choices
along it should be the reason.

Ticket 77 Track A measured whether the run does that, and the answer is **no, it makes you weaker**:

| arm (1,440 battles, two gyms) | Rootfall | Emberfall |
|---|---|---|
| bare 18-card run-start deck | **27.7%** | **62.4%** |
| A1 full tuned per-OS decks (25–28 cards) | 19.0 | 40.3 |
| A2 start kit + next 3 engine cards each (27) | 13.0 | 33.9 |
| A3 bare + 3 blank generics (21) | 18.5 | 31.1 |
| bare + 3 counter cards (21) | 11.1 | 44.0 |

Every arm that adds cards loses, at both gyms, and the *targeted* version (A2, what a weighted pick
track would deal) is the worst. The start kit is the most concentrated deck the game offers; at 18
cards, deck size is the lever and card quality is second-order. So the reward track, the market's
buy side and "engine completion" are all measured as **negative progression**. That is the thing
Henry felt in playtest (*"I haven't been able to level up or find a really cool synergy… it's hard to
tell if I'm improving"*), with a number on it.

**The law this ticket works under (from 77):** at this deck size, progression that adds a card
costs power. Progression therefore has to be **slot-neutral or slot-negative**: upgrade a card in
place, remove a card, replace a generic with an engine card, or add power outside the deck (a third
body, macros, Drivers, the OS). "Add a card" is the one shape that is off the table until the
duplicates arm (§3, P0) says otherwise.

## 2. The curve, defined

**P(stage)** = the player's compound win rate through the gym gauntlet (the ticket-75/77 bare-arm
harness: `--matchup favourable`, Rally live, n = 60, paired seeds, same-day bare row), with the
player's deck and party as they would stand at that stage of a run:

| stage | what the player fields |
|---|---|
| S0 — run start | starter 5 + 3 generics (1 body) |
| S1 — end of biome 0 | + first recruit's 5, + the rewards/market/workshop a policy took in biome 0 |
| S2 — end of biome 1 | + second recruit, + biome 1's choices |
| S3 — the gauntlet | + biome 2's choices, Drivers from elites, macros bought |

Three policies play the nodes, so the curve is a band rather than a line: **`random`** (a first-time
player), **`greedy`** (take the highest-`powerscale` card offered, buy the best macro, recruit at the
first workshop), **`lean`** (recruit, remove generics at the market, buy nothing else). The harness
plays the region graph deterministically per seed — no UI, no AI policy for the nodes beyond those
three rules.

**Targets (Henry rules; these are the proposal):** S0 → S3 is **+20 points** under `greedy` and
**≥ +10 under `random`**, against the same gym; every stage is ≥ the previous one under every policy;
and no single node type (reward, market buy, workshop card) is expected-negative under `greedy`.
The recruit is allowed — expected — to be the biggest single step.

## 3. Arms, in order

**P0 — the duplicates arm** (77's unrun control). Bare + 3 *duplicates* of the deck's own engine
cards, 21 cards, both gyms. This separates "added cards are worse than average" from "a smaller deck
cycles faster." If duplicates are free or positive, **upgrade-in-place and engine replacement are
the model**; if duplicates lose like blanks did, **deck size itself is the tax** and progression
must live entirely outside the deck (bodies, macros, Drivers, OS). Everything below reads
differently depending on this, so it runs first. `--deck bare-plus-dupes`.

**P1 — replacement, not addition.** Bare with the 3 starter generics *replaced* by the next 3 engine
cards (18 cards, all engine). If this beats bare, the reward track's fix is a **swap** ("take this
card, drop one") and the market's removal price is the most underrated node in the game.
`--deck engine-replace`.

**P2 — the recruit step.** S0 (1 body) vs S1 (2 bodies) vs S2 (3 bodies) with nothing else
changed, all three gyms. This is the step the route (142) is built around, and it has never been
measured as a *player* step. Expect it to be large; the question is whether biome 0 alone can
afford it (25 scrap + a blueprint at 20% per body).

**P3 — Track B from 77, as written there:** B1 macros (`surge3`, `mixed`) and B2 player Drivers
(`antivenom`, `third_strike`, `element_<lean>`) — the two slot-free power layers, each at S3.

**P4 — the three policies through the graph** (§2), once P0–P3 have said what the nodes are worth.
This produces the curve, and the write-back plots it per gym.

Cost guide from 77: ~180 battles per gym per arm ≈ 1.5 h on Henry's machine; P0–P3 ≈ 10 gym-arms
≈ a weekend of background running; P4 is three policies × three gyms × four stages ≈ two nights.

## 4. Levers for Henry's session (not decided here — costed after P0–P3)

Each is slot-neutral by construction:

- **Card upgrades at the workshop** ("reflash" a card you own into its + version: +5 power, or +1
  stack, or −1 cost for a 2e card — one visible number, no new slot). The scrap sink that 13/14
  wanted and a power step the player can *see*.
- **Rewards as swaps.** A reward node offers three cards; taking one drops one (starter generics
  first, by default). The reward becomes a decision about the deck's shape, not its size.
- **Removal is progression.** Reprice or re-present the market's removal so it reads as the upgrade
  it measurably is, not the consolation prize.
- **The recruit as the milestone.** If P2 is as large as expected, biome 0 should guarantee the
  blueprint (the alpha already does) and the first workshop should be *the* biome-0 event.
- **Macros and Drivers as the gear layer** (77 Track B) — power without a card slot, proc-visible.
- **A visible power readout** (77 §"for Henry's session", steam-release 34): expected damage/turn
  or "engine 5/5 assembled" per member in the deck editor, so a pick's effect is *seen*. Cheapest
  answer to "I can't tell if I'm improving" and it makes every lever above legible.

Standing rules apply: no caps, no hidden math, numbers in 5s, every number on the card, nerf by
shape. Nothing here is a nerf.

## 5. What the grids are for from now on

The 1v1 and 3v3 grids stay as the **trap-and-fairness check** after any change (anything under ~25
as a player pick is a trap; anything the enemy fields at 80+ is an unfair fight), not as the score.
The score is the curve in §2. The 3v3 triangle at 100/100/90 is fine for single player *provided*
the map lets you build the counter (142) — sharper than PvP would tolerate, and that is a feature.

## 6. Done when

P0–P3 reported in `research/148-progression-curve.md` with same-day bare rows; the three-policy
curve plotted per gym; Henry's session picks the levers; then a second curve after they ship, against
the §2 targets. `--deck bare-plus-dupes|engine-replace` and `--policy random|greedy|lean` added to
`runGate.ts` as NOT-A-BASELINE flags, banner-printed, never a `programs.json` edit.
