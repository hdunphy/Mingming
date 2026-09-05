# Ticket 141 — the Workshop tells you what you are buying

**Status:** shipped
**Branch:** `legion/ai-perf`
**Asked by Henry:** *"The workshop screen doesn't give you any descriptions. We don't know what each
OS does nor do we know what the cards do. We need to provide those descriptions."*

---

## What was wrong

The Workshop asks for two irreversible purchases:

- **Assembly** — spend a blueprint and 60 scrap on a species, and the firmware you pick at that
  moment is fixed for that individual for good. Choosing the firmware *is* choosing the nine-card
  engine that goes into your deck.
- **Reflash** — spend a blueprint and 40 scrap to trade a whole engine away. The old cards go to the
  run collection and the new ones into the deck.

Both were being asked for against information the screen was withholding:

| where | showed | should show |
|---|---|---|
| assembly OS picker | `◈` and the firmware NAME | name + what the firmware does |
| assembly engine list | cost, element, card name | + what the card does |
| reflash engine lists (both columns) | cost, element, card name | + what the card does |
| reflash OS headers | name + description ✓ | already correct |

**No copy had to be written.** Every string already exists and is already displayed elsewhere:
`OSDefinition.description` in the firmware registry (shown by `RanchScreen`'s firmware modal, the
`FirmwareTerminal`, the in-battle 💾 tooltip and the Codex), and `ProgramData.description` in
`programs.json` (shown by the Marketplace and the Loadout Editor). `cardFace()` — which the Workshop
already calls — has been returning `description` the whole time and the screen was dropping it.

So this was a wiring gap, not a content gap.

---

## What shipped

**`src/ui/screens/WorkshopNode.tsx`**

- `EngineRows` rows now carry the card text. The identity line is unchanged and a second line sits
  under it.
- The assembly OS picker prints each firmware's description under its name — **every** option, not
  just the selected one, because the point is choosing.

**`src/ui/screens/WorkshopNode.css`**

- New `.ws-erow` / `.ws-erow-head` / `.ws-erow-desc`. `.rs-row` is a fixed 27px single-line flex row
  **shared with the Marketplace and the Loadout Editor**, so none of this touches it — the two-line
  form is a workshop-scoped modifier and no other screen moves by a pixel.
- `height` becomes `min-height`: a fixed height with a wrapping second line clips the text, and
  clips it silently.
- `.rs-desc` carries `flex: 1`, which is right inside the Marketplace's column tiles and exactly
  wrong in a flex column — it would stretch the description and push it off its baseline. Reset.
- `button.ws-erow { text-align: left }` — a button does not inherit the row's text alignment on
  every browser, and without it the firmware description centres itself under a left-aligned name.

### Inline, not on hover — Henry's ruling

The alternative kept the two reflash columns on one screen with no scrolling, at the price of hiding
the text behind a hover. Hover does not exist on a controller or a Steam Deck, and it asks the
player to go looking for the thing they need in order to know there is anything to look for. The
columns scroll instead; `.ws-oscard` already had `overflow: auto`.

### One thing deliberately left alone

The **secondary OS picker inside reflash** (the chip row, `options.length > 1`) is still name-only.
Selecting a chip immediately repaints the offer column, which prints that firmware's full
description directly above — so a description on the chip would duplicate what is already on screen
two inches away. It is also unreachable today: no species has a third firmware.

---

## A standing law was reversed to do this, and you should know

`WorkshopNode.test.tsx` carried a case named *"prints no card description in the bay, and therefore
no power number"*, ending in `expect(markup).not.toMatch(/power/i)`. Its own comment names this
change as the way it gets broken: *"the cheapest way to break that is not a price — it is a
well-meant 'show the card text' patch."*

The history, from that comment:

1. It began as `not.toMatch(/power/i)` — no internal numbers on a shop screen.
2. **Henry's 2026-08-23 amendment: power stays in card descriptions, or cards cannot be compared.**
   That turned it into "print every strippable card's text".
3. Paid removal was deleted 2026-08-26, and with it the comparison that needed the text. The case
   reverted to an absence, on the stated grounds that *"a bay lists engines by NAME and COST — that
   is what an engine row is."*

**Point 3's premise is the one this ticket overturns**, on Henry's instruction. The bay is not a
list; it is two irreversible comparisons. So the 2026-08-23 amendment governs here exactly as it
does at the Marketplace, and the text comes back.

`not.toMatch(/power/i)` went with it, and had to: it cannot coexist with printed card text.
`brute_force` alone reads *"25 power. +8 power if you have Strength."* Keeping both would mean
re-authoring 223 cards' copy to dodge one word.

The case was replaced by its **positive** form — three cases, asserted against the registry rather
than against hard-coded strings, so a retag of a species' `startKits` moves the expectation with the
screen:

- the assembly stage prints every engine card's description;
- the assembly picker prints every available firmware's name **and** description;
- the reflash comparison prints both engines' card text.

**If you want the no-power law kept, this is the ticket to say so on** — the alternative is
hover-only text in the Workshop, or card copy rewritten to avoid the word.

---

## Gates

```
npx vitest run   157 files, 2129 tests, all passing   (was 2127: +3 new, −1 replaced)
npx tsc -b       clean
npx eslint       clean
```

No engine, registry or save change. UI only.
