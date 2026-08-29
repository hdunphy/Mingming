# Settings screen: audio, display, motion, keybinds, save management (ticket 36)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [23](23-save-v4.md)
- Phase: Content Complete

## Deliverable

The only setting today is `AudioControls` (mute + volume). Build a settings screen reachable from the main menu AND in-run (Esc): master/music/SFX volume, fullscreen/windowed + resolution (ticket 37 supplies the mechanism), reduced motion (honour `motionPrefs.ts`), text size, keybind display (remap if cheap), colourblind-safe element palette toggle (ticket 38), save slots if ruled, delete-save with confirmation, credits + licences. Settings persist outside the game save.

## Done when

Every setting round-trips through restart; Esc in battle pauses to settings without breaking the reducer.

## Resolution

**Closed 2026-08-22.** There is a settings screen, it is reachable from the shell and from inside a
fight, and every control on it does something. Suite **1514 -> 1547**, `tsc -b` clean, build green
with `[assert-no-debug] OK`.

---

### TWO THINGS THE DELIVERABLE WAS WRONG ABOUT

Both recorded rather than quietly worked around.

**1. "master/music/SFX volume" — there is no music.** `AudioEngine` is pure synthesized SFX behind a
single gain node with one `{volume, muted}` pair. There is no second channel to put a second slider
in front of, and three sliders where one thing exists is a settings screen that lies to the player
about what it controls. **One volume control ships** — the existing `AudioControls`, rendered rather
than reimplemented, so there cannot be two sliders that disagree. Ticket 35 (audio pass) is where
music arrives and earns the split.

**2. "reachable from the main menu" — there is no main menu.** `MainMenuView` is the first-run
starter picker: three cards, shown only while the roster is empty, with no Continue, no Quit and no
menu. So the entry points are **the nav bar** (every non-fight screen) and **Escape** (inside a
fight), which between them cover everywhere the game can actually be. A real main menu belongs to
ticket 34's UI pass, and the settings button will move onto it when it exists.

### Escape, sequenced rather than rebound

Ticket 22 bound Escape to "clear the selection" — the only way a keyboard player can back out of a
half-built play. This ticket's Done-when wants it to open settings. Both, in this order: **Escape
clears if anything is selected, and opens settings if nothing is.**

Clearing wins the tie because it is the reversible one — press Escape twice and you get settings
anyway, whereas an Escape that always opened settings would leave a keyboard player with no way to
drop a selected card. The other half of the gate is satisfied by construction: the overlay is
`state.ui`, the battle stays mounted underneath, and **nothing on this screen dispatches at the
battle reducer**. In a turn-based game with no clock, that is what a pause is.

### A fourth slice, for one boolean

Two unrelated places open the same overlay — the nav bar and a keydown handler inside `BattleArena` —
and `BattleArena` cannot reach a `useState` in `App`. The alternatives were worse: a bespoke event
bus is a store with none of the tooling, and hanging `settingsOpen` off `battleSlice` would make "is
the settings screen open" a property of a battle that may not exist. `uiSlice` follows ticket 09's
precedent (add the slice, fix the handful of hand-built test stores — two, here) and holds **session
state only**. The settings themselves are not in Redux, because nothing in a reducer needs to read
them.

### The keybind table — the drift this ticket was one copy away from

Ticket 22 wrote the bindings **twice**: a straight run of `if (e.key ...)` in `BattleArena`, and a
hardcoded legend string in `CardHand` whose comment justified itself with *"a fight has no options
screen to hide a key list behind"*. This screen is that options screen, so there would have been a
**third** copy. Three is where drift stops being hypothetical.

`ui/keybinds.ts` is now the one copy. The in-fight strip is generated from it (`keybindLegend()`),
the settings table renders the same rows, and the handler compares against its exported constants
instead of literals — so a key can only move in one file, and moving it there moves both displays.

**Remap is not built, and the screen says so in as many words** rather than showing controls that do
nothing. "Remap if cheap" was not cheap: every binding needs a stored override, a conflict checker, a
capture UI, and an answer to what `Shift+W/E/R` means once `W` has moved. What IS done is the part
remapping actually needed — the bindings are data.

### Reduced motion has three states now, and both halves move together

`system` / `on` / `off`. The JS half is a `motionPrefs` override, which reaches all seven components
that call `prefersReducedMotion()` because none of them cache it. The CSS half cannot be reached
from JavaScript, so `<html>` carries `data-reduced-motion`, and the five `@media (prefers-reduced-
motion: reduce)` blocks are now scoped `:root:not([data-reduced-motion])` with a matching
`:root[data-reduced-motion="on"]` block beside each.

**That scoping is what makes `off` real.** Without it, a player whose OS says "reduce" could never
get the game's animations back, because the CSS degradations would fire regardless of what they
chose. `system` deliberately leaves NO attribute, so anyone who never opens this screen is on exactly
the behaviour they had before it existed — and a test asserts the attribute is *removed*, since an
attribute reading `"system"` would silently disable every one of those media queries.

### Text size is a ladder, not a slider, and the reason is ticket 22's pixel budget

90 / 100 / 115 / 130 percent on the root em. A slider would be smoother and worse: ticket 22 measured
the 1280x800 console to the pixel (six energy pips fit *by one pixel*), and `body`, `#root` and
`.battle-screen` are all `overflow: hidden`, so every step up is a step toward clipping the hand.
Four rungs is enough to be an accessibility affordance and few enough that each one can actually be
looked at. **The screen says so next to the control** instead of letting the player discover it
mid-fight. Ticket 37 owns resolution and layout scaling and is where the real audit belongs.

### The wipe button comes home, and stops being dead code

Ticket 20's resolution recorded the orphan: *"the 'restart run (wipe data)' button lived on the Hub,
so a player-facing wipe is currently unreachable. Ticket 36 owns save management and should carry
it."* What survived ticket 11's deletion was `SaveSystem.deleteSave()` with **zero callers**, its
docblock still describing a hub and a defeat path that no longer exist.

`ui/settings/wipeSave.ts` is its home, and it is deliberately more than `deleteSave()`: the store is
still holding the ranch and the run, and the autosave writes `state.game` on the next change — so a
wipe that only removed the keys would be undone by the first click after it. Three steps, in order:
**clear the run** (so nothing is mid-fight over a vanished roster), **reset the ranch** (which is what
the autosave then persists), **remove the bytes**. Run telemetry goes too. Settings and audio do not:
they are properties of the person, not the save.

Two-step arm/confirm, not `window.confirm` — ticket 19 removed that from this codebase and the
argument holds (a native modal in a game that draws its own UI, unreachable by gamepad). And
`dispatch` is a parameter, `debug/saveSlots.ts`'s precedent, which is the only reason the destructive
path has a test at all.

### Deferred, and named on screen

Fullscreen/resolution (**ticket 37** owns the mechanism), the colourblind-safe element palette
(**ticket 38** — the eight `--fire`/`--water`/... custom properties in `index.css` are the seam it
will swap, and swapping them reaches everything), and the authoritative third-party licence text
(**ticket 54**). Each is listed under a "Not here yet" heading with one sentence on why, because a
disabled control the player cannot use is indistinguishable from a bug.

### What no test here can reach

A click. There is no `@testing-library/react` (a lockfile change is forbidden) and
`renderToStaticMarkup` runs no effects, so the two-step wipe is asserted only in its at-rest state and
its *effect* is tested through `wipeSave` directly. Everything else was pushed out of the component
for exactly that reason: persistence and the document in `settings.test.ts`, the destructive path in
`wipeSave.test.ts`, the table in `keybinds.test.ts`, the overlay flag in `uiSlice.test.ts`. What is
left untested is the wiring between an `onClick` and a function that is itself covered.

