# Kraken web package (ticket 72): the riptide daemon, and the probes that pick her tools

- Type: wayfinder:task - Henry-approved design (2026-08-16 session). Implementing session
  flips closed + appends Resolution.
- Status: **open**
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
