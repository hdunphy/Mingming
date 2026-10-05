# Steam Input — the checked-in template (ticket 37)

`mingming_keyboard_mouse.vdf` is the controller template Steam loads for this game. It is the
ticket's **minimum viable path**, chosen because the alternative was measured and is expensive:

> *"Controller: minimum viable path is a Steam Input keyboard/mouse template plus the existing
> hotkeys; native Gamepad API navigation is a stretch — measure how many UI surfaces need focus
> handling before committing."*

## The measurement that decided it

Counted in a real Chromium at 1280×720, on the battle screen — the densest one:

| | |
|---|---|
| focusable elements | **13** |
| clickable elements that are **not** focusable | **37** |

Native Gamepad API navigation needs every one of those 37 to gain focus handling, a focus ring and a
sensible tab order — on one screen, before the map, ranch, workshop, marketplace, loadout editor and
codex are counted. That is the stretch goal the ticket suspected it was, and this template is why it
does not have to be done to ship on a Deck.

## What the template does

**The cursor is the primary path.** The game is mouse-driven and every action is reachable by
pointing, so the right stick drives the mouse and the right trigger left-clicks. Nothing is
unreachable with a controller the moment that is true.

**The hotkeys are accelerators, bound to the keys the game already listens for.** Every binding below
comes from `src/ui/keybinds.ts` — the same table the in-fight legend and the settings screen render,
so a keybind change moves all three at once. `steamInputTemplate.test.ts` asserts this file covers
every key constant that table exports, so a NEW binding fails the build until the template has it.

| control | sends | does |
|---|---|---|
| A | `Enter` | Cast |
| B | `Escape` | Clear selection (settings, with nothing selected) |
| X | `Space` | End turn |
| Y | `Tab` | Cycle enemies |
| Left bumper / Right bumper | `W` / `E` | Select caster, party slots 1 and 2 |
| Left trigger (soft pull) | `R` | Select caster, party slot 3 |
| Right trigger | mouse left click | The primary path |
| D-pad ←↑→↓ | `1` `2` `3` `4` | Select card by position |
| D-pad, held with Left grip | `A` `S` `D` | Target enemy by slot |
| Left grip + A/B/X | `Z` `X` `C` | Fire macro 1–3 |
| Right stick | mouse move | |
| Right stick click (hold) | `Right Shift` | Fast-forward the fight (x3) |
| Left stick | `W`/`E`/`R` + `⇧` | Ally targeting, via the shift layer |

## What still needs a human

**This VDF has not been loaded into the Steam client.** It was written against Steam Input's
documented `controller_mappings` structure, but the client is not available in the environment that
produced it, so the schema is unverified — the MAPPING is the reviewed content here, not the file
format. Before ship: open it in Steam's controller configurator, confirm it loads without a warning,
and re-export it from there so the file is one Steam wrote.

Button assignment is taste, not measurement. The table above is a defensible default, not a ruling.
