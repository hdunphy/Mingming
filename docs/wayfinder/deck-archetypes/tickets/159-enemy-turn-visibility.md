# Ticket 159 — Seeing the enemy's turn coming, without going back to moves

**Type:** design session → UI + one engine timing change. **Status:** RULED 2026-09-21 (§5), asked by Henry
2026-09-20: *"the enemy card deck hides a lot of what the enemies are doing. How can we make that
more visible. I think we were trying to avoid moves and keep the cards. Show their hand? Show their
deck? Anything else?"* **Relates to:** 155 (the battle screen this lands on), 146 (tells), 152
(the one-turn Jormungandr loss — the case a player should have seen coming), 147 (`enemyIntent`
cue, cut in §8 for lack of an intent), 157/158.

**Research:** [single-player-card-games.md](../research/single-player-card-games.md) §1 and §5.1 — five telegraph patterns across nine games with pros/cons in our engine; the face-up hand is Library of Ruina's shape, Inscryption's queue row is the post-EA option, Vault of the Void's threat pool changes the game's tense.

## 1. The engine fact that decides this

`END_TURN` discards the active side's hand (`battleReducer.ts` L1196); the next `TURN_START` draws
it fresh. So **during the player's turn the enemy holds no cards.** "Show their hand" today would
show an empty fan. Any real telegraph needs one timing change: **the enemy draws at the end of its
own turn** (equivalently, at the start of the player's), so the hand it will play from exists while
the player decides. Nothing else about the rules changes — same draw count, same discard, same AI;
the draw just happens one phase earlier. (Ticket-111's reshuffle guard is per-instance and
unaffected; DRAW-on-cast cards still draw mid-turn as now.)

That one change makes every option below possible; without it, only §2.4–2.5 are.

## 2. The options, weakest to strongest information

**2.1 Deck list on the plaque.** Hover/hold an enemy: its deck as a list (cards + counts), the
way a Pokémon player learns a species' movepool. Static, honest, no turn information. Cheap; ships
with 155's tooltip work. Teaches the game over runs, not the turn.

**2.2 Hand count + discard pile.** How many cards, and what has already been cast this fight.
Card counting for players who want it. Cheap. Still not "what's coming".

**2.3 The hand, face-up.** After the timing change: the enemy's drawn hand shown as a fan behind
the enemies, cards readable on hover. The player sees *what could* be cast, not *what will*: with
Energy limits and three casters, a seven-card hand is still a decision the player has to read.
This is the Hearthstone-mirror answer — open information, hidden intent — and the closest to
"keep the cards" of anything here. The Jormungandr case reads as "four Undertow in hand, Ink Stream
in hand": the player knows to shield or kill Jorm *this* turn.

**2.4 Threat line (derived, no card shown).** Run the enemy's own `TacticalAI` at the start of the
player's turn against the *current* state and show only the *summary* of its planned sequence:
"Kraken → 38 to Rat, Jorm → Poison ×3 on Rat". This is Slay-the-Spire's intent, produced by the
card AI rather than authored per move — no moves come back. Two costs: it is a *prediction* (the
player changes the state, the AI re-plans), so it must be labelled as such ("if you passed now");
and the search is the 2.3× beam-8 browser cost, paid once more per turn. Works without the timing
change if it plans from the enemy's *next* draw — but then it is guessing the draw, which is the
lie intents tell.

**2.5 Both: hand face-up + threat line.** The hand is the truth, the line is the AI's reading of
it. Most information, most UI. Probably where a card-battler that refuses moves ends up.

**2.6 Partial: top of deck / next N.** Reveal the next draw(s) rather than the hand. Weaker than
2.3 and no cheaper. Listed to be crossed off.

## 3. Initial recommendation

Do the timing change and **2.3 (hand face-up) + 2.1 (deck on plaque)** first. It is the only
option that adds *no* authored or predicted information — the cards themselves are the intent —
and it turns the 152 loss into a readable board. Hold **2.4** as the second step: measure, after
2.3 ships, whether players still ask "what is it going to do"; if they do, the threat line is a
half-day on top of the AI that already exists. Never 2.6.

Costs to price in the session: the enemy hand needs a place on the 145 stage (behind the enemy
row, above the console — 155's geometry fix first); a Settings switch ("Show enemy hand", default
on) beside 146's three; `runLog`/156 unaffected; the balance suite unaffected (draw timing is a
phase move, not a rule change — but the grid **must** re-baseline to prove it: OS hooks on
`OWNER_TURN_END` that read hand size, if any, would shift).

## 4. Session questions (defaults ruled in §5 — Henry overrides any of them)

1. Timing change: draw at end of own turn — accepted as a rule change for *both* sides (symmetric,
   simplest) or enemy only?
2. Face-up hand: all cards, or hidden costs / hidden text until hovered (a smaller fan)?
3. Is a *prediction* (2.4) acceptable in a game that chose cards over moves, if it is labelled
   "if you end turn now"? Or is that moves by the back door?
4. Enemy Energy already shows on the plaque (`MingmingUnit`), so "what can it cast" is hand ×
   Energy — should the face-up hand grey out the cards it cannot afford this turn?

## 5. Ruling (Henry, 2026-09-21: *"I like the face up hand idea"*) — for Legion

Build §2.3 + §2.1. Rows, one commit each:

- **159a — the draw moves.** The active side draws its next hand at the end of its own turn (after
  `discardHand`, before `TURN_END` fires) instead of at `TURN_START`; `TURN_START` keeps energy refill
  and `OWNER_TURN_START` ticks. **Symmetric** — both sides — because the player's hand then also shows
  during the enemy's turn (a free, honest "what I'll have" read) and one code path is one bug surface.
  Battle creation draws the first player hand as today. MOVES-mode enemies still never draw. The draw
  count is computed from the side's *living* units at the moment of the draw (a unit that dies during
  the other side's turn does not un-draw). Gate: the balance grid re-baselines and the win-rate deltas
  are reported per cell — a `OWNER_TURN_END` hook that reads hand size is the one thing that can shift;
  none is expected. `runLog`/156 rows unaffected.
- **159b — the edge tab (Henry picked prototype C, 2026-09-21: *"Just C is good"*).** A 34 px tab at the right
  edge of the stage, under the top bar, reading `ENEMY HAND · N`; hover, focus or click slides a 270 px panel
  over the enemy plaques and it slides back on leave. The panel IS the Edit Loadout deck column — `.rs-panel`,
  `h2` "ENEMY HAND · N" with the enemies' highest current Energy at the right, 27 px `.rs-row`s in cost then
  name order with `×N` stacks, and on row hover/focus the collection tile (`CardTileFace` under `.rs-card`,
  152×200) under the rows exactly as `.led-peek` does. Rows whose cost exceeds the highest current Energy among
  living enemies are greyed (opacity .38, cost disc grey, a `no EP` tag). Cards drawn mid-turn appear as drawn.
  Nothing is *predicted*: no targets, no order. The tab and panel are in the stage layer above the cast lane;
  a cast in flight plays over them. Keyboard: the tab is focusable and toggles; rows are buttons. Reference:
  `159-mock/159-mock.html`, variant C.
- **159c — the switch.** Settings: "Show enemy hand" (default on) beside 146's three; off hides the tab and panel. 147's `enemyIntent` cue stays cut.
- **Held: the plaque deck list (§2.1, prototype D).** Not in this pass — Henry took C alone.
- **Held: the threat line (§2.4).** Not built. Revisit only if the first playtest on 159b still asks
  "what is it going to do"; if built, it is a labelled "if you ended turn now" summary in StS2's format
  (number × hits, tiered icon, `???`), behind the same switch.
- **Held: the committed queue (§2.5-Inscryption, research §5.1-C).** Post-EA option; the only one that
  buys counterplay and the only one that costs the AI its judgement.

Tests: a reducer test that the hand exists at `TURN_END` and is unchanged at `TURN_START`; a test that
a DRAW-on-cast still draws mid-turn; `useBattleVfx` unaffected; a UI test that the panel lists N rows in cost
order, greys by affordability, and shows the tile on row hover; the grid re-baseline committed as `docs/balance/balance_report.json` only.

## 6. Prototypes (2026-09-21)

`159-mock/159-mock.html` — the 145 stage with four placements of the hand, all drawn as the Edit Loadout deck column (`.rs-panel` + `.rs-row` + the `.led-peek` tile on hover, greyed by affordability): **A** right rail (enemy row moves 150 px left), **B** centre lane (collides with the cast lane — toggle *a cast in flight*), **C** edge tab that slides over the plaques, **D** the 159c deck list off a plaque. **Henry picked C** (2026-09-21); 159b is C.

## 7. Write-back (2026-09-21) — 159a reverted, 159b rebuilt on a preview

**159a is gone, on Henry's ruling.** It shipped as `46a7ab5` and was reverted by `c0fd32b`.

Henry, after reading it: *"Instead of making the enemy draw should we just show a preview of the next
x (where x is the card draw) cards in the deck. This way we don't mess up any hooks that happen on
turn start. Also the preview needs to update when a mingming dies or the card draw is effected by
other cards"*.

He was right on the hook, and right for a second reason he did not name.

**The hook he named is real.** `fertile_ground_daemon` / `daemon_extra_draw` carries an `onTurnStart`
hook whose action is a literal `DRAW`. Hooks run *before* the refill in `processPreTurn`, so moving
the refill moves that card's timing relative to it. All seven `onTurnStart` hooks were read: the
other six do status and counter work only. One card is the whole exposure — and one is enough, since
this is exactly the class of break the suite is blind to and a playtest finds six weeks later.

**The one he did not: the re-baseline disappears.** §5's gate asked for a grid re-baseline because
159a reorders PRNG consumption, which re-rolls the drawpile of most fights in the game. That run sat
at 1h40m without finishing one of twelve files. The preview changes no engine code, so there is
nothing to re-baseline and nothing owed. `docs/balance/balance_report.json` is untouched and correct.

**And it costs no information.** Under the restored timing the enemy discards at end of turn and
redraws at the start of its next, so during the player's turn it holds nothing: the top X of its
drawpile *is* the hand it is about to play.

### What 159b does now

Same panel, same geometry, same "show the hand, predict nothing" — a different source:

- **The enemy's own turn:** their real hand.
- **The player's turn:** the top X of their drawpile, X from `describeDraw(state, 'ENEMY')`. Both of
  Henry's cases fall out of that for free: a member dying drops out of the living-party sum, and a
  `cardDraw` buff lands in it, because there is one copy of the formula rather than two.
- `data-source` and the tab label (`ENEMY HAND` vs `ENEMY DRAWS`) say which is on screen.

**The reshuffle is a gap, not a guess.** When the drawpile holds fewer than X, `drawCards` shuffles
the discard back in. That shuffle is seeded, so it *could* be simulated — and must not be: the seed
advances on every card the player casts, so a simulated tail would rewrite itself between one play
and the next, which is worse than admitting the gap. The tail is a count, never a card
("+3 more after reshuffle"), clamped to the discard, and it still counts toward the tab's number
because the *size* of the turn coming is knowable even when its contents are not. **Open for Henry:
show nothing at all in that case instead?**

**The energy reading changed with the source.** Against a held hand, `currentEnergy`. Against a
preview, `maxEnergy + Energized stacks` — what `processPreTurn` will refill to — because a preview is
read after the enemy has spent down, and measured against the empty tank every row would grey out at
exactly the moment the player is deciding.

### §5's test list, reconciled

- ~~a reducer test that the hand exists at `TURN_END` and is unchanged at `TURN_START`~~ — moot, the
  draw did not move. Replaced by **the preview names the cards the reducer actually deals**, asserted
  card for card and in order against a real battle driven through the turn boundary. Verified by
  reintroducing the bug (`slice` from the tail rather than the front) and watching it fail. It is the
  only test in the file that compares the preview against something other than a second copy of my
  own rule.
- a DRAW-on-cast still draws mid-turn — **kept**, the one test that outlived 159a. What it guards is
  true under either timing and was never covered.
- the UI test (N rows, cost order, affordability greying, tile on hover) — **kept**, plus the preview
  fallback, the source label, and the reshuffle row.
- the grid re-baseline — **dropped as unnecessary**, see above.

### One thing found by measuring rather than looking

The reshuffle row is a `<div>` (no tile to peek at, and a hoverable row that shows nothing is a dead
control). It rendered 8 px wider and 15 px taller than the buttons beside it: `.rs-row` sets
`height: 27px` / `width: 100%` with a border and padding and no `box-sizing`, which a `<button>` gets
free from the UA sheet and a `<div>` does not. Fixed on `.rs-row` itself, which also quietly fixes
`WorkshopNode`'s static rows — wrong since 142, and invisible in a screenshot.

### Still open

- **159c** — the "Show enemy hand" switch, unchanged by any of this.
