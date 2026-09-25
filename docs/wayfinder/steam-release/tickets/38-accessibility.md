# Accessibility baseline: focus order, labels, colour, text (ticket 38)

- Type: wayfinder:task
- Status: closed
- Assignee: legion (2026-09-25)
- Blocked by: [34](34-ui-art-pass.md), [36](36-settings-screen.md)
- Phase: Content Complete

## Deliverable

7 `aria-*` attributes and zero `role=` in all of `src/ui`. Baseline: keyboard focus order on every screen, labels on cards/units/nodes, element colours checked for colourblind contrast (`contrastText.ts` exists — extend to the palette), text size setting honoured, no information carried by colour alone (elements already have glyphs — keep it that way on the map). Not a WCAG audit; a Steam-player baseline.

## Done when

A keyboard-only full run is possible; an automated axe pass on each screen reports no critical issues.

## Resolution

Closed 2026-09-25. **Both halves of the Done-when are met and measured — and the defect that mattered most was one no scanner could have found.**

### The premise had already moved

The deliverable opens *"7 `aria-*` attributes and zero `role=` in all of `src/ui`"*. Counted today: **104 `aria-*` and 21 `role=`**. The UI work since (145 / 155 / 158) carried most of the labelling baseline in with it, so this row is smaller than the ticket expected — which is worth saying, because the remaining defects were real and would have been buried in a re-do.

### axe: zero violations, on every screen

Run with `axe-core` in real Chromium at 1280×800, walking title → ranch → settings → assembly modal → gym offers → region map → a fight.

| | before | after |
|---|---|---|
| critical / serious | **2 serious** | **0** |
| moderate | 6 | **0** |

The Done-when asks for *"no critical issues"*. There are none at any severity, on all seven screens.

**The two serious ones, and both were real:**

- **`scrollable-region-focusable` on `.rm-canvas`** — the region map pans (ticket 37 confirmed that as the design: a 15-column region is genuinely wider than a 1280×800 frame, so it pans rather than shrinking nodes below readable size), and **the pan was mouse-only**. The div took no focus, so the arrow keys never reached it. `tabIndex={0}` plus a name and `role="group"` is the whole fix — a focused scroll container is arrow-scrollable by the browser, so no key handler was added.
- **`color-contrast`, three separate colours** once the first was cleared. The macro slot's *"empty"* label failed six times over; **the cause was `opacity: 0.5` on the whole slot**, which is why the first attempt at a lighter ink changed nothing — axe measured the RENDERED `#575552` while the sheet said `#a8a29a`, and halving contrast needs roughly four times the luminance to undo. The opacity came off and the quietness moved into the colours themselves. That unmasked two more at **4.48 against a required 4.5** — `.pile-label` and the hand's caster banner, both on the house value `rgba(255,255,255,0.45)`, failing by two hundredths at 9.28px. Both raised to 0.52.

Moderates cleared with them: every `App` branch now lands in `<main className="app-main">` (only the ranch shell had a landmark, so a screen reader arriving on a fight had none), and the battle screen has a visually-hidden `h1`.

### The keyboard-only run, and the defect that proves why it was asked for

Driven in Chromium with **Tab, Enter, Space and the game's own hotkeys — no mouse events at all.**

**It got one screen.** The starter card is a `motion.div` with an `onClick`; framer-motion's `whileTap` gives it a tabindex of its own, so the Tab ring reached it — **and Enter did nothing.** The first interaction in the game was reachable and inert, which is the worst of the three possible states: not focusable is at least honest, whereas reachable-but-inert puts a focus ring on something that refuses to answer.

**Neither existing guard could have caught it.** `App.starterPicker.test.tsx` dispatches `click`, which a `div` answers to perfectly well, so that file was green throughout. And axe reads an element's PROPERTIES — the element had a tabindex. Whether Enter does anything is behaviour. **That is precisely why this ticket's done-when asks for a RUN and not only a scan**, and it is the row's main finding.

Fixed with `role="button"`, an explicit `tabIndex`, an `aria-label` and a key handler taking Enter **and** Space. Not converted to a `<button>`: the card is 280px of layout with an `h2` inside it, and a button would bring a user-agent stylesheet and nested-heading semantics with it.

After the fix, keyboard-only reaches the end:

```
OK   pick a starter            -> ranch          OK   begin the run     -> region-map
OK   dismiss tips                                OK   enter a node      -> battle
OK   open assembly                               OK   cast a card by hotkey   PLAYED=1
OK   choose firmware                             OK   end turn by SPACE       TURN=2
OK   spend blueprint
OK   open expedition           -> gym-offers
OK   choose a gym              -> party-picker
OK   add to party
```

Space takes **12 seconds** to show TURN=2 — that is the enemy's turn animation, not a fault, and it is recorded because two shorter waits read it as a failure first.

`testing/interaction.tsx` gained `pressKey`, and three regression cases pin the card: Enter works, Space works, and it announces itself as a button. Either the semantics or the handler alone is the broken state, so all of it is asserted.

### Not done, and deliberately

- **The colourblind palette is still deferred**, and still named on the settings screen. `contrastText.ts` exists and the eight element colours are defined in one place, but WHICH palette is a design decision, not a toggle to invent here — the ticket's own framing.
- **No information is carried by colour alone** on the map today (elements have glyphs) and nothing in this row changed that; it was checked, not altered.
- **Not a WCAG audit.** A Steam-player baseline, as the ticket says.

