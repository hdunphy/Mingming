# Ticket 145 — Battle scene redesign: the formation stage

**Type:** UI. **Asked by Henry, 2026-09-07:** *"I don't love it right now — the active Mingming is
really awkward."*
**Relates to:** steam-release 34 (UI/art pass), 146 (juice — needs the anchor points this defines),
147 (SFX). **Branch:** `legion/ai-perf`, authored as Henry. **Mock first** (§4), then build.

---

## 1. What is awkward, said precisely

Today the stage (`BattleStage.tsx`, `index.css` `.stage-area`) is two spotlights: the selected
player unit as a very large sprite lower-left, the focus enemy upper-right, each with a plaque
under it — while the full HUD card for the same unit also sits in the party column. From Henry's
screenshot: Fenrir is drawn at roughly a third of the stage height, his HP/EP plaque floats under
him, the same HP/EP is in the HUD card at top-left, the enemy is small and far away, and the played
card hovers above Fenrir with a "READING FOR FENRIR" caption at the bottom. Three problems:

1. **The active unit is a portrait, not a combatant.** It is huge, faces nobody, and its size says
   "selected in a menu" rather than "standing on a field." The other two allies are not on the
   field at all — 3v3 reads as 1v1 with a sidebar.
2. **Every number is shown twice.** Plaque and HUD card carry the same HP/EP; status chips live on
   the card; the eye has to travel between them.
3. **Nothing has a fixed place.** The spotlight swaps when the selection changes, so a projectile
   or a flame (146) would have no stable anchor to aim at, and the played-card reveal covers the
   caster.

## 2. The proposal: a formation stage

Both parties stand on the field, in rows, in light perspective, facing each other. One plaque per
unit. The active caster steps forward; nothing else moves.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │  [played-card reveal lane — fixed, centre-top, 700 ms hold]            │
 │                                                                        │
 │                                          E3  ◦  E2  ◦  E1   (enemy row, │
 │                                          ▭   ▭   ▭          upper-right,│
 │                                                             facing left)│
 │          A1  ◦  A2  ◦  A3    (ally row, lower-left, facing right)      │
 │          ▭   ▭   ▭            active ally steps forward + lit;          │
 │                               others 85% scale, 70% brightness          │
 ├──────────────────────────────────────────────────────────────────────┤
 │ [macros]        [ hand — centred, fanned, caster badge on each card ]  │
 │ [draw n]        [ energy pips per ally under the hand ]     [discard]  │
 └──────────────────────────────────────────────────────────────────────┘
```

- **Sprites:** all living units, ally row lower-left, enemy row upper-right, in a shallow diagonal
  so the rows read as depth. Sprite frame ≈ 200 px at 1280×800 (the current spotlight is ~380),
  clamped by viewport. Dead units stay as a dimmed silhouette in their slot for the battle (the
  slot is the anchor — 146's flames need it not to move). One `MingmingUnit` renders each; the
  `party-column` HUD cards **go away** on the battle screen (they stay in the ranch/loadout).
- **Plaque per unit, under the sprite:** name · element glyph · HP bar with numbers · EP pips ·
  status chips with stack counts (the chips move here from the HUD card). The plaque is the only
  place a number appears. Hover a chip = the existing status tooltip.
- **The active caster:** steps 24 px forward and up, full brightness, a rim light in its element
  colour, its plaque bordered. Switching caster = click an ally sprite (the spotlight click/drop
  handlers already exist; they generalise to a slot) or the existing W/E/R keys. Cards in hand show
  the current caster's badge; a card the caster cannot afford is dimmed *per caster*, so switching
  caster visibly changes what is playable — that is the 3v3 decision made legible.
- **Targeting:** click an enemy sprite or drop the card on it, as today; the hovered enemy gets a
  reticle and its plaque highlights; the type-matchup tooltip (`ElementMatchupTooltip`) shows the
  ×1.5 / ×0.67 against *this caster* on hover.
- **Played-card reveal:** fixed centre-top lane, never over a sprite. The "READING FOR …" caption
  becomes a small caster badge on the reveal itself.
- **Hand:** centred under the field rather than right-aligned; the console keeps its 265 px.
  Macro rack and draw/discard piles stay in the console's corners.
- **Intent:** enemy intents as icons above the enemy plaque (they exist as `intentIcon`); the
  targeted ally's slot flashes when an intent resolves on it.

**Why rows and not "the two that matter":** the 3v3 findings in 140/141 are all about allies
reading each other's plays; a scene that hides two of three allies hides the game's own argument.

## 3. The alternative, so the choice is explicit

**B — keep the spotlight, fix its proportions.** Active ally at ~60% of today's size, anchored to a
fixed lower-left point instead of centred; plaque merged *into* the HUD card (one number, one
place) and the HUD column kept; the two non-active allies drawn as small "bench" silhouettes beside
the spotlight; reveal lane moved centre-top as in §2. Less work, keeps the sidebar, still 1v1-shaped.

Recommendation: **A (the formation stage).** It costs the HUD column, which is where the duplicate
numbers live, and it gives 146 stable anchors. Henry picks before the mock.

## 4. Order of work

1. **Mock:** a static build of the chosen layout with real sprites at 1280×800 and 1920×1080, one
   screenshot each, in the write-back, before any interaction is wired. Henry approves the mock.
2. **Slots:** `BattleStage` renders rows from `playerParty` / `enemyParty`; slot positions exposed
   via a `useStageAnchors()` hook returning `{ entityId → {x, y, w, h} }` in stage coordinates —
   146 consumes this.
3. **Plaque:** move status chips + tooltips from `MingmingUnit`'s HUD card to the plaque; remove
   the HUD column from the battle screen (guard with a feature flag for one release in case the
   mock lied).
4. **Caster/target interaction** on slots; per-caster affordability dimming in `CardHand`.
5. **Reveal lane**; then the reduced-motion pass (rows and steps become instant, no rim pulse).

Tests: `MingmingUnit.test`, `CardHand.test`, and a new `BattleStage.test` asserting one plaque per
living unit, the active slot's forward offset, and that anchors are stable across a selection change.

## 5. Not in this ticket

Sprite art (steam-release 33), backgrounds per biome (34), particles (146), sounds (147).
