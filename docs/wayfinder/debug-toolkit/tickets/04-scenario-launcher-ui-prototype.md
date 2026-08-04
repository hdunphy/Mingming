# Scenario launcher UI prototype

- Type: wayfinder:prototype
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: [Scenario schema & normalizer](10-scenario-schema-implementation.md), [Debug gating scaffold](12-debug-gating-scaffold.md) ([Scenario schema v1](02-scenario-schema.md), [Debug gating architecture](03-debug-gating-architecture.md) closed)

Note: a prototype can stub the Launch button, but a launch that actually produces a battle also needs [Scenario materializer](11-scenario-materializer.md).

## Question

What does the launcher look and feel like? Build a cheap, rough Debug-tab panel to react to before committing the real build: pickers for 1–3 player mingmings (species / level / IVs / OS), deck assignment (existing saved decks, base decks, or ad-hoc card lists), enemy group with per-enemy overrides, seed field (blank = random, shown after roll), `enemyMode` toggle, gauntlet-context toggle — plus load-scenario-from-file and save-composition-to-file, then a Launch button that drives `setBattleState` (or the chosen dispatch surface).

Resolve by reacting to the prototype: layout, which knobs matter vs clutter, what defaults ("mirror my current save party" as a one-click preset?), and what v1 cuts. Links the prototype branch/artifact as an asset.

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Scenario launcher panel](23-scenario-launcher-panel.md).

**Prototype artifact:** [`prototypes/04-scenario-launcher.html`](../prototypes/04-scenario-launcher.html)
— a self-contained clickable mockup, no engine behind it, populated with the real registry
(16 species, real card ids, `<species>_v1/_v2` OS naming). It is the visual spec for ticket 23.

**Reaction: approved as mocked, nothing cut from v1.** The cut list offered was gauntlet context,
starting statuses, per-enemy `maxHpOverride`/deck, and the ad-hoc deck builder; Henry kept all four.
So the launcher covers the whole of `ComposedSetupSchema` in its first build.

### Layout decisions the prototype locks

- **Three columns:** player | enemies | live `ComposedSetup` JSON. The JSON pane is permanent, not
  a hidden preview — it keeps the on-disk format legible while composing and is how a missed field
  gets spotted.
- **Per-unit progressive disclosure.** Species / level / OS are always visible; IVs, `currentHp`,
  starting statuses and (enemies only) `maxHpOverride` + per-enemy deck sit behind a `▸ more`
  toggle. Without it, three party units plus enemies puts ~30 controls on screen at once.
- **`Mirror my save party` is the primary action**, top-left of the player column — the ticket asked
  whether the preset should exist; it is the default way to start, not a convenience tucked away.
- **Deck is a three-way segmented control** — base decks / saved deck / ad-hoc — reflecting schema
  v1's single shared `player.deck`.
- **`Match player level`** on the enemy column is opt-in. It reproduces what the old fallback branch
  force-applied at `battleFactories.ts:188`, but as a choice rather than an imposition.
- **Seed blank = rolled at launch**, with an explicit `⟳ Roll` to pin one before launching.
- **CARDS-mode warning** appears contextually once enemies exist, because a CARDS enemy with no deck
  has nothing to play — the failure mode fixed in `cf7ad48`.

### Open, deliberately deferred to the real build

- Whether the JSON column keeps its width once the form is trusted, or collapses to a toggle.
- Whether relics belong here at all, given the save editor already grants relics.
- The ad-hoc card picker needs search and duplicate counts; the mockup's `prompt()` is a stand-in.
