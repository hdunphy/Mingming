# The player side has never been in the graded arm: leveling, macros, Drivers, and ROOT ROT reshaped (ticket 77)

- Type: wayfinder:grilling (measurement first — the arms below run before Henry's session)
- Status: open
- Assignee: arms: agent; session: Henry
- Blocked by: nothing for Track A; Track B needs two small harness builds (below); Track C needs one knob type
- Phase: Vertical Slice

## Why this exists

Ticket 76 ended where the data stopped: ROOT ROT is worth +26.6pt at Rootfall's boss, one lever does
not close the gym, the comp is a null, and the toolbox costs at two gyms for reasons that do not
share a mechanism. Every lever measured across tickets 67–76 has been a **boss-side** lever, and
that is not because the boss is where the problem is. It is because the boss side is the only side
the grading arm can see.

Read what the bare arm actually fields. The boss trio brings its full tuned kit, its OS, a Driver,
fixed 20/20/20 IVs and full lookahead. The player brings three 5-card engines and 3 generics — the
**18-card start deck** — with `run.drivers` empty (`createRun.ts:312`; elite Driver drops are dep
ticket 16, unbuilt) and no macros (`runGate.ts` never touches `macroRegistry`; macros are fired by
the screen, `battleReducer.ts:42`, and no AI policy exists to fire one). So the gate has been
measuring a **run-start** player against a **fully-built** boss and asking why the fights are not 84%
each. Ticket 60's diagnosis already said the corpus is symmetric and a roguelike needs structural
player edges; ticket 60 then ruled those edges IN — engine completion, Macros, Drivers — and none of
them ever reached the arm that grades the gyms.

This also frames the toolbox result without asserting a mechanism (75 ruling 1 still stands): the
player's deck is not a tuned deck, it is three fifths of one, and a 5-card engine in an 18-card deck
assembles rarely. A two-card engine (hexbloom wants Weakened on the target first) degrades
**superlinearly** with dilution — Rootfall's curve. A 4–5 turn fight loses a fifth of itself to
one dead draw — Emberfall's curve. Arm A3 below is the test; nothing here presumes the answer.

**Henry's framing for this ticket (2026-09-01):** the balancing focus for playtest is the **player
side** — *"I haven't felt like I've been able to level up or find a really cool synergy with cards…
it's hard to tell if I'm improving my own power scale."* Nerfs are not the focus. ROOT ROT is
allowed to be "a little strong"; if it moves, **it changes shape, it does not gain a cap** — see the
standing rule below.

## Standing rule, new this ticket (Henry, 2026-09-01): NO CAPS. Nerf by changing the SHAPE.

> *"I really don't like using caps, even like 'it only triggers on the first turn.' It doesn't read
> well and it feels bad. If everything has a limit, things should feel good because players — or
> even the enemies — were smart about synergies and played things well. If it's too easy to trigger
> those then they need to be nerfed: maybe a different way we attack adding Poison instead of just a
> +1 stack everywhere. If we're going to nerf it, change the shape. Don't add caps."*

Applies to Drivers, OSes and cards alike. "Once per turn", "first application only", "at most N" are
all the same rejected move. A ceiling comes from how hard the synergy is to assemble, never from a
clamp. (The ticket-24 `momentum_crash` cap and the ticket-29 priced-stack cap predate this rule; they
are not licences.)

## The arms

All arms: **n=60 per cell, bare-arm baseline (75 ruling 2), `--matchup favourable`, Rally live,
paired seeds, same tree same day** as the bare row they are compared to. Re-take the bare row on the
day; do not reuse research/76's. Report per-fight %, compound, McNemar vs bare, player and boss
damage/turn, turns, and — new, and the number this ticket is really about — **payoff casts per
fight** (how often each member's engine actually assembled). Where an arm needs a harness flag, the
flag is named; it is a `--tweak`/option in `src/debug`, printed in the banner under NOT-A-BASELINE,
never a `programs.json` edit.

Cost guide from research/75: one gym's three cells at n=60 ≈ 180 battles ≈ **~1.5 h** on Henry's
machine with `--out`; a boss-only cell ≈ 0.5 h. Long runs are Henry's machine, incremental `--out`,
never a container (HANDOFF, learned twice).

### Track A — what "leveling" is worth (harness only, no design, run first)

**A1 — the ceiling.** Each member fields its **full tuned per-OS deck** (the biome-2 list
`runGate.ts:642` already resolves for wilds), merged. No generics. All three gyms. This bounds what
any amount of kit completion can buy: if completed engines do not reach ~84%/fight, deck progression
cannot be the whole answer and the session knows it before designing anything. Flag: `--deck full`.

**A2 — engine +3.** Each member's 5-card `startKit` plus the **next three cards of its own tuned
list** in registry order (8 per member, 24 + the starter's 3 generics). This models a mid-run pick
track built from cards that already exist, i.e. what "picks weighted toward your own engine's missing
cards" would deal. All three gyms. Flag: `--deck engine-plus-3`.

**A3 — dilution control.** Bare deck **plus three copies of the run's generic** (`water_slap`, the
card `deckFor` already deals) — same size as the all-three toolbox arm, zero situational text.
Rootfall and Emberfall (the two gyms with per-card toolbox data). If this arm costs what the toolbox
costs (Rootfall −16.6, Emberfall −18.4), the mechanism is dilution and the counters are innocent;
if it is free, the printings are back on the table. Flag: `--deck bare-plus-generics`.

### Track B — the ruled run systems the arm never had (two small builds, then arms)

**B1 — macros.** Three slots, fired by a harness policy that is deliberately a **floor** on a human:
a damage macro fires when its previewed damage is lethal on any enemy, otherwise every unfired macro
fires on turn 1 of the **boss** fight (Surge at the lowest-HP enemy, Cripple at the highest-attack
enemy, Mend on the lowest-% ally); Mend also fires at the start of any turn an ally is under 40%.
Two loadouts: **B1a** 3× `surge`; **B1b** `surge` + `cripple` + `mend`. Rootfall and Emberfall.
Build: a `macroPolicy` in `src/debug/balance` that dispatches the same `PLAY_PROGRAM`-shaped action
the screen does. Flag: `--macros surge3|mixed`. Report macros fired per fight beside the win rate.
Sizing prior: Surge is ~30 power ≈ 9 HP ≈ 11% of a pool; three of them is roughly a free extra turn
of energy across the gauntlet.

**B2 — player Drivers.** `run.drivers` is already applied to the player side (`battleSetup.ts:91`);
the arm needs only a hooks.json entry per candidate and a flag, not ticket 16's drop mechanism.
Three candidates, one per hypothesis, each at Rootfall and Emberfall:

- **`driver_antivenom`** — *"At the end of this side's turn, every member sheds 1 Poison."*
  (`scrubber`'s hook, side-scoped.) The Rootfall counter as a Driver rather than a card: zero deck
  cost, so if it lands where `scrubber`-the-card was free (p = 1.00), "counters must not be cards"
  is measured, not argued.
- **`driver_third_strike`** — *"Every third attack this side plays deals +15 power."* (SIDE counter,
  the TIDAL SURGE machinery.) Generic, proc-visible, the mono-team-agnostic edge.
- **`driver_element_<lean>`** — *"This side's <element> cards deal +10 power."* The mono-team payoff
  from macros-and-drivers.md, at the party's lean. This is the arm that asks whether type
  preparation can be made to pay in the **rolled** fights, where 76 arm 3 showed it currently does
  not.

Flag: `--player-driver <id>`. Numbers above are starting points; move in 5s, one change per sim.

### Track C — ROOT ROT reshaped (the one boss-side arm; shape, not cap)

ROOT ROT is *"whenever this side's card applies Poison, it applies 1 more."* Its weight comes from
price-curve arbitrage: Poison is priced quadratically (`1.5·S(S+1)`), so "+1 per application" onto a
pile is worth far more than one stack, and the boss trio applies Poison 5–8 times a turn. TIDAL
SURGE's flat 10 power is inert for the mirror-image reason. **Each candidate keeps the Driver
proc-visible and uncapped and changes what the trigger is:**

- **C1 Creeping Rot** — *"At the end of this side's turn, every Poisoned enemy gains 1 Poison."*
  Per turn per body instead of per application: the value no longer scales with how many Poison
  cards the boss chains, only with how many enemies it has touched.
- **C2 Spreading Rot** — *"Whenever this side's card applies Poison, another enemy gains 1 Poison."*
  Breadth instead of depth: the extra stack lands on a fresh pile (linear value), never on the pile
  being built (quadratic value). Reads as the strangler spreading.
- **C3 Festering** — *"Whenever this side's attack hits a Poisoned enemy, it gains 1 Poison."*
  Fires on attacks, not applications, so the boss has to mix hitting with poisoning and cannot
  double-dip its own Poison cards.

Boss cell only, Rootfall, against the day's bare (was 56.7) and `--boss-relics off` (was 83.3).
A candidate succeeds if it lands **between** those two and the log shows it firing every turn.
Knob type: a Driver substitution in `experimentalTweaks` (`--tweak root-rot-<c1|c2|c3>`), which is a
hooks.json swap rather than a registry card swap — a new knob shape, so `optionsThreading.test.ts`
gets a case for it before any run (the `--toolbox` lesson).

### Order and budget

A1 → A3 → A2 → B1 → B2 → C. Track A is ~9 h of Henry-machine time and needs no code beyond the deck
flag; run it first because A1's answer decides how much of B is worth building. B is two builds
(~one agent session each) plus ~12 h of arms. C is ~1.5 h. Everything is report-only; **no lever
moves before Henry's session.**

## TRACK A REPORTED — 2026-09-02. The premise is confirmed; the expected conclusion is not.

8 arms, 1,440 battles, bare rows re-taken on the day.
[research/77-player-side-arms.md](../research/77-player-side-arms.md).

| arm | deck | Rootfall | Emberfall |
| --- | --- | --- | --- |
| **bare (grading)** | 18 | **27.7%** | **62.4%** |
| A1 full tuned | 25-28 | 19.0% (-8.7) | 40.3% (-22.1, p = 0.0046) |
| A2 engine +3 | 27 | 13.0% (-14.7, p = 0.015) | 33.9% (-28.5, p = 0.00006) |
| A3 bare + 3 BLANKS | 21 | 18.5% (-9.2) | 31.1% (-31.3, p = 0.00003) |
| *(75) bare + 3 counters* | 21 | 11.1% (-16.6) | 44.0% (-18.4) |

**EVERY ARM THAT ADDS CARDS LOSES, at both gyms, without exception.** The 18-card run-start deck is
the best deck measured at every size tried. **A2 — "the next three cards of your own engine", exactly
what a weighted pick track would deal — is the WORST of the four**, costing 14.7pt at Rootfall and
28.5pt at Emberfall. The targeted version of progression is worse than the wholesale version.

**A1's instruments say why**: payoff casts RISE ~40% (the engine does assemble more often) and player
damage/turn FALLS anyway, while the enemy's rate barely moves. The start kit IS the engine — five
tagged cards, no filler — and the tuned list buries it in the filler that smooths a nine-card enemy
deck. Handing the player the whole list does not complete an engine.

**A3 answers ticket 76's open question as far as measurement can take it.** Three BLANK generics cost
9.2pt at Rootfall and 31.3pt at Emberfall, against the counters' 16.6 and 18.4. So at Rootfall the
counters cost 7pt more than blanks and **at Emberfall 13pt LESS** — the counters are not bad cards,
they are cards that do not pay for a slot. **Deck size is the lever; card quality is a second-order
correction.** And the mechanism is NOT dead draws: the blanks arm has FEWER dead cards than bare
(3.0% vs 4.1%) because `water_slap` is always playable — its damage/turn simply falls. Added cards
displace better cards in the draw whether or not they are situational.

**What this does to the ticket.** The framing holds — the player side had never been in the graded
arm. The anticipated conclusion does not: the run-start deck is not an impoverished version of a
finished one, it is the most concentrated deck the game offers, and every progression path measured
makes it worse. **"More cards" is not progression at an 18-card deck size.** Track B (macros,
Drivers) is now the more interesting half rather than the fallback, because it is the only measured
route to player power that does not cost a card slot.

**Not asserted:** Track A cannot separate "the added card is worse than the average card" from "a
smaller deck cycles its engine faster" — both predict every row above. The arm that would separate
them is bare plus three DUPLICATES of the deck's own cards, and it has not been run.

## What this ticket does NOT do

- No encounter nerfs beyond Track C, and Track C is one Driver at one gym.
- No pool weighting of the rolled lead-ins toward the gym's element (76 arm 3's finding) — held
  for the ticket-73 session, where it belongs with the launch triangle.
- No `TYPE_CHART` change (deck-archetypes 35, 1,440 games).
- No card printings move, no `programs.json` edits (75 ruling 1b).
- No caps, anywhere, on anything.

## For Henry's session, beyond the arms

Two things the arms cannot measure but the playtest complaint names:

1. **A visible power readout.** Henry cannot tell whether a pick raised his deck's power. The deck
   editor could show a per-member and per-deck figure the player can watch move — expected
   damage/turn from the tuned `powerscale` numbers, or simply "engine 5/9 assembled". This is a UI
   ticket (34's chassis), and it is the cheapest possible answer to "I can't tell if I'm improving".
2. **The pick pool has no weighting** (HANDOFF 2026-08-2x: 56 ruling 1's weighting clause is absent;
   "not yet in the run deck" is ticket 12's explicit refusal). If A2 shows engine completion is worth
   real points, the reward track that delivers it is a `rollDropTable` bias toward the party's own
   missing tuned cards, and it needs a strength number Henry rules.

## Done when

Tracks A–C reported in `research/77-player-side-arms.md` with the day's bare rows; Henry's session
held; the ruled lever(s) applied and re-measured at n=60; gauntlet compound within 60±5 at each gym
or the residual explicitly accepted, with the player-side lever named as the one that closed it.

## Resolution

_(open)_
