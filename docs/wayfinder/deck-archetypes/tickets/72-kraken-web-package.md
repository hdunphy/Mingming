# Kraken web package (ticket 72): the riptide daemon, and the probes that pick her tools

- Type: wayfinder:task - Henry-approved design (2026-08-16 session). Implementing session
  flips closed + appends Resolution.
- Status: **CLOSED - SUPERSEDED (2026-08-20, ticket 108 session).** The field gate this ticket
  existed to fix is met by other means; the riptide daemon is UNBUILT and salvageable. See
  Resolution.
- Assignee: -
- Blocked by: ticket 70 (SHIPPED - ATK 100 baseline). DEEP-PHASE POLICY + the NEW
  bucket-band standard bind (see HANDOFF: neutral cells are the only balance bugs; typed
  cells are design). Branch card-dev; author Henry Dunphy <hdunphy15@gmail.com>;
  line-ending law; locks -> _to_delete/git-locks/.

## Context

Ticket 70 fixed kraken_v1 (43.2 field, neutral zeros -> 0) and STOPPED on kraken_v2 (27.9,
below the field gate; stats exhausted, three instruments agree the residue is TOOLS).
Under the archetype web (research/archetype-web.md): **v1 = the roster's designated
ZOO-KILLER control deck; v2 = ramp that needs a clock sustain cannot erase.** Henry's
anti-zoo shape decision: a PUNISH DAEMON taxing play-velocity itself (beats the veil
alternative - flat reduction has a poison hole and the veil would be a new status; the
daemon is data + one counter). Veil is PARKED as fallback design, do not build it.

## Part 1 - the card (programs.json LF + hooks.json LF + daemonKeys)

`riptide_daemon` | Riptide Daemon | **1e** Water Daemon Rare | Self |
*"Daemon: an enemy that plays 3 or more cards in one turn is seized by the deep - Kraken
deals damage with 25 power for the 3rd card and every card after it."*

- Trigger: enemy-side card play, per-turn play counter >= 3 (COUNTER machinery with
  turn-reset - the OUROBOROS/jorm_v1_count pattern; enemy-action triggers have the
  TREACHERY precedent). Proc = pipeline ATTACK at 25 power vs the player of the card -
  POWER-DENOMINATED, never flat HP (the law). Procs on the 3rd and each subsequent card.
- **1 Energy deliberately** (core_overclock's 42.5%-dead autopsy: a 2e daemon on a 2e frame
  never comes online against the fast decks it exists to counter).
- No card generation (loop audit). Template chain: echo_chamber_v2 / hoofbeat_daemon.
- **`liveness.ts` after the hooks edit - standing policy.** Unit tests: threshold fires on
  3rd not 2nd; multiple procs per turn (5 plays = 3 procs); counter resets per turn; the
  AI-lookahead exclusion (0-AI-SIM-COUNTS) in any instrument reading it.

## Part 2 - probe arms (in-memory, ticket-60 style; field row + census-style cell reads)

Instrument per arm: full 15-species field row (10-iter rank, 30-iter + two seed bases on
anything within 6 of a line), kraken's NEUTRAL-cell list vs the census baseline, daemon
procs/game + HP delivered by matchup, FTK, dead cards.

| arm | deck change (pre-approved by Henry) |
|---|---|
| a | kraken_v1 + riptide_daemon (9 -> 10 cards, no cut) |
| b | kraken_v2: water_slap x2 -> water_slap x1 + riptide_daemon |
| c | kraken_v2: water_slap x2 -> venom_fang + corrosive_bolt (the Poison clock; sharing
|   | jorm's appliers WITHOUT his payoff is rulebook-legal) |
| d | kraken_v2: both - water_slap x2 -> riptide_daemon + venom_fang |
| e | riptide variant: trigger = every 5 cards CUMULATIVE (Henry's original sketch) on
|   | arm-b's list - demonstrates the game-length confound vs the per-turn shape with
|   | numbers rather than assertion |

**CAPACITOR IS UNTOUCHABLE in every arm (Henry, 2026-08-16):** it is the RAMP ENABLER -
the only route from her 2-Energy frame to the 3e payoffs (hydro_blast + maelstrom, 58.6%
of her damage, the cards TIDAL_CRUSH exists for). Its 0.0 damage/play is its JOB, not a
dead slot (the ticket's original arms b-d cut it - that was a designer error, corrected).
The spendable slots are the water_slaps: 0e filler at 1.4 damage/play with no energy or
OS role.

## Ship rule

Ship the v2 arm (b/c/d) that puts kraken_v2 inside the 0.35-0.80 field gate AND cuts her
sub-10% NEUTRAL cells the most, subject to: no NEUTRAL cell moving above 90%, FTK 0, dead
<=0.35 both sides, control >=0.60 held. Arm (a) ships alongside ONLY if it moves v1's
jormungandr/nidhoggr cells >= 10 points without breaking v1's existing greens (she is IN
BAND - do not destabilize a healthy deck for the web role; if marginal, report and leave
v1 untouched). Knobs, max 2 rounds, ONE change per sim: riptide power 25 -> 20 or -> 30;
threshold 3 -> 4. Anything else -> STOP. No arm reaches the gate -> STOP with the table
(veil design returns to Henry).

## Docs + commit

Full npm run balance; 8-DIFF (kraken rows move; control frozen; nothing else beyond
noise). ONE commit: card + hooks + registry lists + tests + report + this ticket's
Resolution + map line + HANDOFF refresh. Deliverable: arm table, shipped lists, knob
rounds, per-cell before/after vs the census, deviations - or findings if STOPPED.

## Amendment 1 (Henry, 2026-08-16): web-aligned v2 arms - ramp preys on CONTROL

Henry's re-aim off the archetype web: kraken_v2's jormungandr zero is BY DESIGN (zoo preys
on ramp - the wheel). Her real web violations are her PREY cells: **huldra 0%, draugr 2%,
ratatoskr 7% - a ramp deck losing to every control deck.** The fix is ramp OVERDELIVERY,
not zoo-hedging.

**NEW STANDING LAW (0-RAMP-PREMIUM, add to HANDOFF): a ramp deck's payoff is priced
against the turns it SKIPS, not the curve alone - the ramped turn must exceed 2x a normal
turn's output. Zoo punishing the skip is the web working; control being unable to punish
it is what the premium crushes.** Today capacitor is net-zero energy time-shifted (2e now,
2e later, minus a card, minus a turn of chip on 58 HP) - the skip has no premium.

### v2 arm set (replaces b/c/d; a and e stand as written)

| arm | change (ONE per arm) | targets |
|---|---|---|
| b | water_slap x1 -> riptide_daemon | the neutral 0% FLOOR vs zoo (jorm cell 0 -> ~20-35 = the soft-counter band; no-0%-cells is a hard gate even for predator matchups) |
| c | water_slap x2 -> venom_fang + corrosive_bolt | peer/sustain cells (valkyrie, audhumbla) |
| f | TIDAL_CRUSH 15% -> 25% | PREY conversion (huldra/draugr/ratatoskr) - the lawful enabler-side push |
| g | capacitor: "Gain 2 Energy next turn" -> "Gain 3" | ramp overdelivery - 5e turn = hydro_blast + surge_protection, ~46+ vs ~26 over two normal turns. CHECK: double-capacitor chain (6e turn) for degeneracy + engine energy cap; FTK watch |
| h | best-of-round-2: combine the two strongest of {b,c,f,g} after reading round 1 | the ship candidate |

Fallback design (do NOT build unless g degenerates): capacitor draw-rider ("...and draw a
card") - repays card-tempo instead of upsizing energy.

### Reading framework + ship rule (replaces the original ship rule for v2)

Per-cell targets under the web: PREY (huldra/draugr/ratatoskr) -> 65-80%; PREDATOR (jorm)
-> 20-35% (hard floor: off 0%); PEERS (valkyrie/audhumbla) -> 40-60%. Ship the arm (or h
combo) that lands field 0.35-0.80 with the most cells in their role bands, subject to: no
NEUTRAL cell at 0% or >90%, FTK 0, dead <=0.35, control >=0.60. Two seed bases near any
line. Knobs unchanged (riptide 25 -> 20/30, threshold 3 -> 4) plus TIDAL_CRUSH -> 20 as a
half-step if 25 overshoots. Anything else -> STOP.

---

## Resolution: superseded, with one design left on the table

**Closed without building anything.** The ticket's premise was `kraken_v2` at **27.9% field, below
the 0.35 gate**, with three instruments agreeing the residue was TOOLS rather than stats. The
74-through-84 arc, and the status re-denomination after it, fixed her by other routes.

Measured today, 30 iterations x 2 orders across the full 30-cell field row:

| deck | field at ticket time | **field now** | gate |
|---|---|---|---|
| `kraken_v1` | 43.2% | **39.9%** | 0.35-0.80 - in band |
| `kraken_v2` | **27.9%** | **43.7%** | 0.35-0.80 - **in band, +15.8** |

`kraken_v2` is no longer the deck this ticket describes, and building a card to fix a problem that
is gone would be shipping a change nothing asked for. **Part 1 (the card) and Part 2 (the five probe
arms) are both cancelled.**

### What is NOT resolved, and is deliberately left as a design rather than a bug

Her remaining low cells - `ymir_v1` and `ymir_v2` at 0.0 for both OSes, plus `huldra` at 1.7 for v1 -
are untouched by this closure. Under the bucket-band standard **only NEUTRAL cells are balance
bugs**, and these have not been classified. That classification is a separate job; nobody should
read "72 closed" as "kraken has no zero cells."

### The salvage: the riptide daemon design survives its ticket

The card was never built, and the design is still the best answer on record to a question the
roster still has - **`kraken_v1` is the designated ZOO-KILLER control deck** under the archetype
web, and she currently has no tool that punishes play velocity as such:

> `riptide_daemon` | 1e Water Daemon Rare | Self | *"Daemon: an enemy that plays 3 or more cards in
> one turn is seized by the deep - Kraken deals damage with 25 power for the 3rd card and every card
> after it."*

Everything that made it a good design still holds: it is data plus one counter rather than a new
status; 1 Energy deliberately (the `core_overclock` autopsy - a 2e daemon on a 2e frame never comes
online against the fast decks it exists to counter); power-denominated, never flat HP; no card
generation, so it passes the loop audit.

Two things have changed *in its favour* since it was written. **Ticket 103 raised the roster's
card velocity** - `sleipnir_v1` now plays 3.40 cards a turn and hits four-plus on 47% of turns
(research/draw-four.md), so a 3-cards-in-a-turn trigger fires far more than it would have. And
**ticket 100 confirmed the zoo shape is live** rather than theoretical.

**Henry's call, at leisure:** re-open the daemon as its own small ticket aimed at kraken_v1's web
role, or let it go. It is not blocking anything. If it comes back, note that arm (e) from Part 2 -
the cumulative-5-cards variant - is still the right control to run beside it, because it is what
separates a velocity punish from a game-length punish with numbers instead of assertion.
