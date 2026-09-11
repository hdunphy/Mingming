# Ticket 145 — Battle scene redesign: the stagger stage (mock approved 2026-09-08)

> **Status: BUILT — all six rows shipped by Legion 2026-09-08/09** (`ae37565` 145a stagger stage + `useStageAnchors`; `0850b87` + `2040bc0` 145b plaque, statuses, rim light, dead-body silhouette, firmware chip/daemons/preview moved; `c782772` 145c–f top bar, console, target chip, reveal lane, backdrop; follow-ups `af7bc62` hand card 180×255, `168e0c1` hand on the marketplace chassis, `25f44ca` collapsed log draws nothing — the top bar is that surface; `bce8574` the ticket-58 harness clicks the stage slots). Renders in `Claude outputs/stage-1280x800.png` and `battle-screen-final.png`. **Closes on Henry's eyes**: play a fight at 1280×800 and 1920×1080 and note anything that differs from `145-mock/`; then 146/147 start.

**Type:** UI. **Status:** design RULED by Henry after three prototyping rounds (2026-09-07/08);
ready for Legion. **Branch:** `legion/comp-grid`, authored as Henry, one commit per lettered row.
**Mock:** `145-mock/145-mock.html` (open in a browser; 1280×800) and `145-mock/final.png` /
`final-between-plays.png` (2× renders) beside this ticket. The mock's geometry is the spec; where
this text and the mock disagree, the mock wins.
**Relates to:** 146 (juice — consumes the anchors defined here), 147 (SFX), steam-release 34.

---

## 1. What Henry rejected, so it is not rebuilt by accident

- The spotlight (one huge active sprite lower-left, focus enemy upper-right): *"the active Mingming
  is really awkward."*
- Horizontal rows of sprites: *"we need vertical spacing for the Mingmings, otherwise the card draw
  becomes an issue."*
- Enemy intents on the field: enemies play from a hand, so a per-card intent is not honest. None.
- The current battle card chassis: the **marketplace** chassis is the card, everywhere.
- Deck/hand/discard counts in the top bar; energy at the foot of a card; three-letter status
  abbreviations (the app's emoji badges stay).

## 2. The screen, at 1280×800 (every number below is from the mock)

Three bands: **top bar 44px · stage 546px · console 210px.**

### 2a. Top bar (44px, `rgba(5,5,8,.7)`, 1px hairline below)

Left to right, 12px gaps, 14px side padding, pills as today's `.pill`:
`TURN 3` · `YOUR MOVE` · `PLAYED 2` (cards played this turn — a plain number, gold; no pips, since
draws mean there is no known maximum) · the **latest combat-log line** centred with a chevron that
opens the log (143c's collapsed/expanded model) · **volume slider** (icon + 70px track) ·
`ROOTFALL · ELITE` · **settings** gear (30×28 tile).

**Drivers row** directly under the bar on the left: `DRIVERS` micro-label, then one chip per active
Driver (violet, 28px tall, dot + name). At more than three Drivers the chips go icon-only with the
name on hover. Macros are **not** in the bar (they are in the console, §2c).

### 2b. Stage (y 44–590)

**Backdrop** (146 can extend it; 145 ships this minimum): the biome's name centred at the top in
its element colour at 30% (`VERDANT SPRAWL`), three soft skewed light shafts in the element colour
at 6–10% alpha, a 140px haze at the foot, a one-pixel ground line. It is the same radial stage
gradient as today underneath.

**Units — the stagger.** Both parties in three-row columns, 170px row pitch, plaques on the
*outside*, the active ally stepped **60px toward the centre**:

| slot | sprite box (x, y, w×h) | plaque (x, y, 168 wide) |
|---|---|---|
| ally 1 (active in the mock) | 330, 62, 150×120 | 154, 110 |
| ally 2 | 270, 232, 150×120 | 94, 280 |
| ally 3 | 270, 402, 150×120 | 94, 450 |
| enemy 1 | 790, 62, 150×120 (mirrored) | 948, 110 |
| enemy 2 | 850, 232, 150×120 | 1008, 280 |
| enemy 3 | 850, 402, 150×120 | 1008, 450 |

Rule: the active ally's slot is its column x + 60; the others stay. Enemies never step. The gap
between the two columns is ~300px and is the **reveal lane**. Sprites sit on a soft elliptical
floor glow (violet for allies, the element colour for enemies); the active ally gets a rim light
in its element colour. A dead unit stays in its slot as a 40%-brightness silhouette (its slot is an
anchor, see §3).

**Plaque** (168×~72, `rgba(18,18,24,.85)`, 1px `rgba(255,255,255,.08)` border, 6px radius,
6/8px padding, 4px row gap): name row (8px element dot, name uppercase 10px/600/0.12em) · HP bar
(6px, green ≥50% / orange ≥25% / red) with `cur/max` right-aligned 10px · EP pips (14×6, blue,
dimmed when spent) with `n/m EP` · **status badges** — the app's `.hud-status-badge` look: emoji
glyph from `statusGlossary` + `×n`, 1px border in the status colour, one row, overflow chip after
the fourth. The active ally's plaque border is its element colour.

**Reveal lane.** While a card resolves (the existing 700ms `PlayedCardReveal` hold), the card is
drawn at 148×196, centred in the lane (x 566, y 118), rotated −4°, with `FENRIR CASTS WAR PACT`
(11px, 0.2em, element colour) under it at y 330. Between plays the lane is empty — see
`final-between-plays.png`; that emptiness is intended, it is where the play happens.

### 2c. Console (y 590–800, `#0a0a0f`, 2px hairline top)

Left to right: **Macro stack** at (30, +12): `MACROS` label then three 28px gold chips stacked
(filled: icon + name; empty: dashed) · **Draw pile** at (176, +72): a 58×80 face-down card with a
two-card stack shadow, `DRAW` label above, count badge on its corner · **the fan**, centred in the
remaining width · **Discard pile** at (1150, +40): a single 58×80 face-down card, `DISCARD` label,
count badge · **End Turn** at (1128, +140), 102×36, directly under the discard.

**The fan.** Cards 140×176 on the marketplace chassis (`runShell.css` `.rs-card`: 1px `#303a48`,
8px radius, `#171d27→#10151d`, energy pips top-left, type glyph top-right, 44px art band, centred
12.5px/700 name, description 10px `#aeb9c6`, element word at the foot, 3px element bar). New on the
battle card: a **target chip directly under the name** (crosshair "ONE ENEMY" / three lines "EVERY
ENEMY" / up-arrow "SELF", 8.5px uppercase, `#303a48` border) — the foot carries only the element.
No energy at the foot; no caster badge. Five cards: rotations −12/−6/0/+6/+12°, transform-origin
50% 130%, **lifts 0/10/18/10/0 (centre card highest — an arch)**, overlap −18px. The selected card
gets today's white border + glow and lifts a further 10px. **Fan angle is a function of hand size:**
±12° at five, flattening toward ±8° at eight with overlap tightening to −30px, so the hand stays
inside the pile-to-pile width.

## 3. The anchors (146 depends on these)

`useStageAnchors()` returns `{ entityId → {x, y, w, h} }` in stage coordinates for every slot in
§2b plus `reveal` (the lane box) and `hand` (the fan's centre). Slots do not move on selection,
death, or hand size; only the active ally's x changes (+60), and 146 reads the new x on change.

## 4. Order of work

1. **145a — stage geometry:** `BattleStage` renders the two staggered columns from
   `playerParty`/`enemyParty` with plaques outside; HUD column removed from the battle screen
   (feature flag for one release); `useStageAnchors()`. Screenshot at 1280×800 and 1920×1080 in
   the write-back (at 1920 the stage scales its column x's proportionally and keeps the 170px
   pitch; sprites cap at 190px).
2. **145b — plaque:** move status badges and their tooltips from the HUD card to the plaque;
   active-ally border and rim light; dead-unit silhouette.
3. **145c — top bar + Drivers row:** the strip in §2a; `PLAYED n`; the Drivers row; remove the
   counts; volume slider and settings from `AudioControls`/settings screen.
4. **145d — console:** macro stack (from `MacroRack`), draw/discard as face-down mini cards with
   counts, End Turn under discard, the arched fan with the hand-size angle rule.
5. **145e — battle card chassis:** `ProgramCard` on the marketplace chassis with the target chip;
   keep `CardKeywordChips`' tooltips; the STAB ×1.5 shows as today's small red tag on the art's
   corner (not in the mock — Henry's call whether it stays).
6. **145f — reveal lane** wired to `PlayedCardReveal`, and the backdrop minimum.
7. Reduced motion: steps and lifts become instant, rim light static, no shafts animation (none
   animates in 145 anyway — 146 owns motion).

Tests: `BattleStage.test` (one plaque per living unit, active slot +60, anchors stable across a
selection change and a death), `CardHand.test` (fan angle by hand size; selected lift), `MingmingUnit`
/ `CombatLog` tests updated for the moved badges and the bar's log line.

## 5. Not in this ticket

Sprite art and biome art (steam-release 33/34), particles and hit-stop (146), sounds (147), any
change to what a card does. The unchosen directions are on the prototyping canvas (three rounds,
25 boards) for reference only.
