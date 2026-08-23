# Codex: seen/played species, OS and cards; completion payouts (ticket 31)

- Type: wayfinder:task
- Status: open
- Assignee: agent
- Blocked by: [23](23-save-v4.md), [19](19-run-end.md)
- Phase: Content Complete

## Deliverable

The collection-as-achievement layer with ZERO power attached: species seen/assembled, OSes flashed, cards seen/played (logged from the reducer via an `ActionTap`-style middleware — the seam exists in `store.ts`), with completion milestones paying cosmetics or blueprints (Henry numbers). Reuse `statusGlossary`/`TypeChart` as the codex's reference pages. This is also where Steam achievements (ticket 44) read their progress.

## Done when

Codex screen on the ranch, milestones fire once, data persists in save v4.

## RULED 2026-08-23: the payouts wait for cosmetics

Henry chose **option (c)** of the three put to him — not "pay nothing", and not blueprints. The
codex will pay **cosmetics**, once cosmetics exist.

That leaves this ticket open on a dependency rather than on a decision, which is a better place to
be: nothing here needs designing, and the machinery is already built and firing. **There is no
cosmetics ticket on this map** — the art tickets (32 art direction, 33 species art, 34 UI art pass)
are about the game's own look, not about unlockable player-facing cosmetics — so the honest next
step is that a cosmetics system gets a ticket, and this one lists it as `Blocked by`. Wiring the
payout after that is a field per milestone row plus one dispatch in `useCodexRecorder`.

Rejected on the way, with reasons, so they are not re-proposed: **blueprints** (they are the only
persistent currency, so a codex paying them pays power — the one thing `economy-session.md` forbids
it — and ten milestones at even one each is most of a run's income), and **pay nothing** (the stars
already read as though they should do something).

## Progress — built 2026-08-22, payouts still open

**The codex exists, records itself, and shows what you have met.** Suite **1549 -> 1574**, `tsc -b`
clean, build green. The ticket stays **open** on one clause: *"completion milestones paying cosmetics
or blueprints (**Henry numbers**)"*. Milestones are detected, fired once and displayed; what they pay
is `null` on every row.

### Why the payouts were not guessed

Two things make a placeholder actively worse than an empty field here, rather than merely
presumptuous:

- **Blueprints are the only persistent currency in the game.** A codex that pays them pays *power*,
  which is the one thing `economy-session.md` forbids it ("ZERO power attached") unless the amounts
  are derived against the same anchor the rest of the economy came from. That is a ruling, and the
  gym's 3x overpay (ticket 18) is still open in the same account.
- **Cosmetics do not exist.** No system, no registry, nothing to pay with.

**Wiring one is a field per row plus one dispatch** in `useCodexRecorder` — the shape is built and
waiting.

### Five ledgers, because each is a different claim

`ICodex` went from two lists to five, all `.default([])`, **no version bump** (ticket 24's argument):

| ledger | means | written by |
|---|---|---|
| `seen` | on screen — held at run end, or cast by either side | teardown (ticket 19) + the recorder |
| `played` | **you** cast it | the recorder |
| `species` | stood on a battlefield, yours or theirs | the recorder, at battle start |
| `assembled` | you built one from a blueprint | `gameSlice.assembleMingming` |
| `os` | equipped on something you own | `assembleMingming` + `swapOS` |

Collapsing any two loses a distinction that cannot be recovered later. The sharpest is
`played` vs `seen`: *"I have played Maelstrom"* and *"Maelstrom has been played at me"* are different
achievements and only one of them is yours, so the recorder checks the caster's side.

`assembled` and `os` are written **inside the reducers**, not by their callers — `recordCodexSeen`'s
argument, that a law enforced per call site is a law that lapses at the next one. `addToRoster`
deliberately does **not** record: it is the debug and test seam, and a fixture is not an achievement.

### THE ACTION TAP IS THE WRONG SEAM, AND THIS IS WHY

The deliverable says to log plays *"from the reducer via an `ActionTap`-style middleware — the seam
exists in `store.ts`"*. It does exist, and three things make it wrong here:

1. **It is one slot, not a list**, documented "last caller wins", and the debug action tape holds it.
   A production consumer installing itself would silently kill the tape; mounting the debug panel
   would silently kill the codex.
2. **`battle/playProgram` carries the card's INSTANCE id, not its dataId.** A middleware would have
   to resolve it against the pre-dispatch hand — and the card is gone from the hand afterwards.
3. **The action is intent; the event is fact.** `handlePlayProgram` can fizzle *after* the cost is
   paid (the caster dies paying) and return without resolving. A middleware would count that play.

`PROGRAM_PLAYED` carries the dataId, fires only where a play resolved, and — the decisive part — **is
not emitted while the bus is muted**. `TacticalAI` runs whole speculative sequences through the real
reducer to score them, muted, as does every damage preview; a counter in the reducer would record the
AI's imagination. `statusCensus.ts` already calls this the "0-AI-SIM-COUNTS predicate". Subscribing to
the bus gets it for free.

Subscribed once at `App` for the life of the app, not per battle: the bus is a module singleton and a
fight can begin and end without `BattleArena` re-rendering, so a per-fight subscription is a window
in which a resolved play goes unrecorded.

### The denominators needed three filters, and each is an argument

- **Tokens are not counted (216 -> 212).** A token is generated mid-battle by another card — never
  drafted, bought or chosen. Counting them makes 100% depend on having drawn the right generator at
  the right moment, a completion nobody can pursue. They still *record* if played; they just do not
  raise the bar.
- **The control species is not counted.** `mingmingRegistry` says it outright: enumerate through
  `PLAYABLE_SPECIES` "or the control shows up as a wild Mingming".
- **The three `boss_relic_*` firmware are not counted.** They are gym-boss signatures the player can
  never equip; counting them would make the codex permanently incompletable by three. The OS list is
  derived by inverting `availableOS` rather than reading `FIRMWARE_REGISTRY`, which is also a
  correctness fix — that registry is populated *lazily* and enumerating it directly races whatever
  happened to call `getOSBehavior` first.

`held` is **intersected** with the target list rather than taken as a length, because the ledgers are
add-only and never pruned: a save holding a retired id would otherwise report 213 of 212. The codex
may hold more than it counts, which is the honest way round.

### The screen

A ranch tab, five pages. **Every slot is shown and only what you have met is named** — an unfound card
is a numbered blank. The argument is that a codex with zero power attached protects nothing by hiding
silhouettes, and a player who cannot see that 212 is the target cannot pursue it; what stays hidden is
the only thing worth hiding, which is what the card *does*.

`statusGlossary` and `TypeChartPanel` are **reused, not rewritten** — the glossary's duality text is
derived from `STATUS_MODEL` at import time, so a codex-shaped paraphrase could disagree with combat.

### One finding, small

`CodexScreen.test.tsx` asserts the power-dies-at-the-surface law over the pages the codex *authors*,
and excludes the two reference pages **on purpose**: `statusGlossary`'s four duality entries read
"+N POWER per stack" because deck-archetypes ticket 102 re-denominated the status economy in power
and derived that text from the model, and two OS descriptions (`gullinbursti_v1`, `control_v1`) use
the word too. That is the game's own vocabulary for a mechanic, authored deliberately elsewhere —
not a card leaking its pricing figure. Recorded rather than "fixed", because the fix would be
rewriting text this screen exists to quote verbatim.

## Resolution

_(open)_

