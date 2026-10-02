# Ticket 165 — Hover shows the full card at the upgrade and sell lists; releasing a drag lets go of the card

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 165a–165b (`0122242..9f605e4`). The status line below is kept as history.

**Type:** UI. **Status:** OPEN — **165b's two decisions RULED by Henry 2026-09-26 (see 165b); ready to build.** Asked by Henry on 2026-09-26, with a screenshot of the marketplace's UPGRADE and SELL panels: *"write up a ticket for these fixes, don't implement yet"*. There are two rows. Each is one commit, with a failing test first.

---

## 165a — Hovering a row shows the whole card; an upgrade row shows the upgraded card

**What Henry asked.** *"From the screenshot I need to be able to see the full card on hover. For the upgrades it should show what my upgraded card looks like."*

**Where.**

- **Upgrade list:** `src/ui/screens/UpgradeBench.tsx`. This one component renders the upgrade list at all three venues: the market stall (`MarketplaceNode.tsx`), the workshop node (`WorkshopNode.tsx`) and the gym gate (`GauntletNode.tsx`). Fixing it once fixes all three.
- **Sell list:** the `SELL — YOUR CARDS` panel inside `MarketplaceNode.tsx`, around line 480.

Today both lists show a card's cost, element and name only.

**This overrides a written rule, so update the comment that states it.** `UpgradeBench.tsx`, around line 90, says *"NO CARD DESCRIPTION, not even in a `title`"*. It cites the workshop bay's law — *"a bay lists engines by NAME and COST"* — and says the upgraded face is "one click away in the loadout editor". Henry's ask supersedes that for these two lists. The rows stay name + cost, so the one-line row law still holds. The full card appears beside them on hover. Rewrite that comment to say so and quote him.

**The pattern already exists — reuse it, don't invent a third one.**

- `EnemyHandPanel.tsx` (the `peek` state and `.ehp-peek`) and `LoadoutEditor.tsx` (`.led-peek`) both show a card on row hover.
- Both render the card with `CardTileFace` as an ordinary block **under** the rows. They deliberately avoid `position: fixed`, which put the loadout peek in the middle of the screen at every width but 1280 (155h).
- Both use `onMouseOver`/`onMouseOut` with a `relatedTarget` guard (so the peek doesn't flicker across child spans) plus `onFocus`/`onBlur` (so keyboard users get it too).

Pull that behaviour into one small shared piece, for example a `useCardPeek()` hook plus a `<CardPeek>` block, and use it in both lists.

- Refactoring EnemyHandPanel and LoadoutEditor onto it is **optional**. If you do, it goes in its own commit and must not change what they render.
- Keep it a small, single-purpose module rather than growing either screen file.

**What the peek shows.**

- **Sell row:** the card as held, `cardFace(dataId)` with `dataId` passed through. A card that is already a `+` then gets its moved numbers picked out automatically, because `CardTileFace` does that when it knows the `dataId` (163b, `describeUpgrade`).
- **Upgrade row:** the **upgraded** card, `cardFace(upgradeIdFor(dataId))`. Passing the `+` id's `dataId` makes the numbers that change light up in the element colour. That answers "what will I get" without a second card beside it.
- **Copies:** the ×N badge follows the row's stack count, as the other peeks do.

**The trap: greyed-out rows.** Most rows in Henry's screenshot are greyed:

- upgrades he can't afford (Cinder Lance, Flashover);
- sell rows at the deck floor.

They are real `disabled` `<button>`s, and Chromium/Electron does not fire mouse events on a disabled button. A peek wired to the button would never open on exactly the rows a player most wants to read ("what would this be if I could afford it?"). Do one of these two things:

1. put the hover and focus handlers on a wrapper element around each button; or
2. switch the rows from `disabled` to `aria-disabled` plus a guarded `onClick`. The reducer already refuses on its own; the button's disabled state is a courtesy (see the comment at the top of `UpgradeBench.tsx`).

Either way, a test has to prove the peek opens on a greyed row.

**Placement.** Show the peek inside the same panel, under the rows. Both panels have empty space there in the screenshot. The sell panel is a fixed 310px wide (`.mk-sell` in `MarketplaceNode.css`), so check the tile fits at 1280×720 and at the widest supported layout. A screenshot at each is the write-back.

**Tests.** Follow `playedCardReveal.test.tsx` or `LoadoutEditor`'s test: `react-dom/client` + `act`, jsdom.

1. Hovering an upgrade row shows the `+` card's name and its changed number marked.
2. Hovering a sell row shows that card.
3. Hovering or focusing a **greyed** row still shows it.
4. Moving off the row hides it.
5. Keyboard focus shows it too.

The first three fail on the parent.

---

## 165b — Releasing a drag lets go of the card, and a click on a unit is not a drop

**What Henry asked.** *"When I drag a card releasing it should deselect it. Too often its selected then I go to change my active mingming then attack my ally."*

**What is actually happening (read from the code).**

1. **One gesture starts both ways of playing.** A pointerdown on a hand card always selects it (`CardHand.tsx`, `onPointerDown` → `selectCard(card.id)`) and starts the drag line (`onTargetingStart`). The game supports click-to-select and drag-to-play, and both begin with that same pointerdown.
2. **A release over nothing keeps the card selected.** Releasing over empty stage runs `.battle-screen`'s `onPointerUp` (`BattleArena.tsx`, around line 1151). That clears the drag line and the hover, but **not** `selectedCardId`, so the card stays selected.
3. **A plain click on a unit is treated as a drop.** Each stage unit has an `onPointerUp` that calls `handleEntityPointerUp` (`BattleArena.tsx`, around line 1085), and it plays the selected card at that unit whenever `isValidCardTarget` allows it. It does not check whether a drag was in progress.
4. **So clicking your own mingming to switch the active caster plays the selected card on it.** The click's pointerup lands on the ally and the card resolves there.
5. **Why an attack can land on an ally at all.** `isValidCardTarget` (`src/ui/utils/targeting.ts`, line 54) allows a card onto an ally if it has **any** HEAL or STATUS action. Ember Jab is "8 power. Apply 1 Burn." — an ATTACK plus a STATUS — so it counts as legal on your own mingming. That carve-out is how this report became "attack my ally" rather than a harmless no-op.

**The fix, as asked.**

- **Tell a drag from a click.** Record the pointerdown point. The gesture is a drag once the pointer has moved more than a small threshold, for example 8 px scaled by the stage scale. Put this in its own small hook, for example `useCardDrag`, rather than more state in `BattleArena`.
- **Releasing a drag anywhere that is not a successful play deselects the card.** That covers empty stage, the hand, the console, and a unit the card cannot target. It clears `selectedCardId` (and `selectedTargetId` if the drag set it) as well as the drag line.
  - A successful drop already deselects, because `handleEntityPointerUp` calls `selectCard(null)`. Keep that.
- **A unit's `onPointerUp` only drops when a drag is in progress.** A plain click on a unit goes to `handleEntityClick`, which is its job. Switching the active mingming with a card selected then just switches the caster.

**RULED by Henry, 2026-09-26:**

1. **Click-to-select stays; releasing a DRAG deselects.** *"Yes on drag and release deselects."* A plain click on a card still selects it (click the card, then click a target), and so do the keyboard and the macro flow. Only the release of a real drag (the pointer moved past the threshold) lets go of the card when it did not play.
2. **Attacks stay aimable at your own mingming. Do NOT touch `isValidCardTarget`.** *"Yes you can attack on your own mingmings. Sometimes its beneficial."* The ally carve-out (point 5 above) is deliberate, and Ember Jab on an ally is a legal play. So the whole fix is the two gesture changes above: a released drag deselects, and a plain click on a unit never plays the card. Add a one-line comment above the carve-out in `targeting.ts` quoting this ruling, so the next reviewer does not "fix" it.

**Tests.** Jsdom, through `BattleArena` with a real battle state; see `BattleStage.test.tsx` for the setup.

1. Pointerdown on a card, move past the threshold, release over empty stage: `selectedCardId` is null. This fails on the parent.
2. Drag and release on a valid enemy: the card is played and deselected (unchanged).
3. Click a card, then **click** an ally: no card is played, and the ally becomes the active caster. This fails on the parent.
4. Click a card, then click an enemy: the target is selected. This is the unchanged click-select flow (ruled 1).
5. Drag Ember Jab onto your own mingming and release: it plays there (ruled 2 — attacks on allies stay legal).

---

## Rules

- **Commits:** one commit per row, authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`), with no Co-Authored-By trailers. End each message with a `HANDOFF:` line.
- **Don't push.** Report the push command instead.
- **Gate:** `npm run gate` must be green for each row.
- **Screenshots:** check each row by eye in headless Chromium. A vite dev server on a small harness page works; see 145's write-back. Attach the before/after screenshots to the report.
- **Line endings:** CRLF in `docs/wayfinder`; LF for tests, `src/debug` and JSON. Otherwise keep each file's existing endings.
- **Report** in plain English, ending with the decisions Henry needs to make (none are open for 165b; 165a has none).

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`0122242..9f605e4`), merged to `main` in PR #13.
