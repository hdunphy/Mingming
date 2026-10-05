# Ticket 195: A mock for the gym prep screen

**Type:** design pass, mock only; no game code. **Status:** opened 2026-10-04, split out of [194r](194-henry-playtest-2026-10-04.md). Not started.

**Henry:** *"Gym prep screen probably needs a redesign."* (playtest notes, 2026-10-04) · *"Yes do a mock, this is probably its own card."* (ruling, the same evening)

---

## What the screen is today

`GauntletNode.tsx` (the "pit stop", ticket 18) is the screen before each of the three gym fights. Its header comment sets out what it is for: one decision, *is the party healthy enough for what is coming, or is this the moment to spend something?* It shows:

- each member's HP as a fraction, with DOWN called out (30% repair between fights, 173a);
- the Draught rack, with what each one does (battle Draughts cannot be fired here, and say so);
- the next opponent's **elements only** ("types visible, contents hidden");
- before fight 1 only: "Edit loadout — last chance before the gym", the free rune bench (`PatchBench`, one rune per visit, 166e) and the free upgrade bench (`UpgradeBench`, 163b);
- "Begin fight N of 3".

These are stacked one under another in one panel. Henry played it on 2026-10-04 and read the rune bench's "choice of two" as two runes (194q). Nothing on it shows the party's runes (194p) or Totems.

## What the mock should show

In the Slant kit (183), at the desktop window size, as a dev-only view in the screen sheet (`screens.html?view=gate`, `src/debug/screenSheet/`), the way the 183 screens were mocked. Two states: **before fight 1** (the free picks are live) and **between fights 2 and 3** (a member DOWN, the free picks gone).

1. **The party:** each member with sprite, HP bar and number, DOWN state, Instinct glyph (194j) and rune (194p's `RuneTag`).
2. **The road ahead:** the three fights as three slots, done / next / later, with the next one's elements. Contents stay hidden, as the rule says.
3. **The two free picks side by side** before fight 1: "Free rune: pick one" (194q's wording) and "Free upgrade". Each says when it is used up.
4. **What the run carries:** the Draught rack and the Totems, compact.
5. **One primary button,** "Begin fight N of 3", and the loadout edit as a secondary action before fight 1.

## Questions for Henry with the mock

- Should the road ahead show anything more than elements for fights 2 and 3?
- Does the loadout edit stay on this screen, or move to the town before the gym?

## Done when

Henry has seen both states and approved one direction (or asked for another round). The build becomes its own ticket after that.
