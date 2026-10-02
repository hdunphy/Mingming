# Resolution, fullscreen and controller: 16:9, 16:10 Steam Deck, Steam Input (ticket 37)

- Type: wayfinder:task
- Status: closed
- Assignee: legion (2026-09-25)
- Blocked by: [26](26-wrapper-research.md), [10](10-region-map-screen.md), [22](22-3v3-game-side.md)
- Phase: Content Complete

## Deliverable

`index.css` uses `100vw/100vh` roots with 4 real breakpoints and many fixed-px sizes; there is no fullscreen, no resize handling, no gamepad. Establish a scaling rule (a design resolution, e.g. 1280×720 safe-area scaled by `min(w/1280, h/720)`, letterboxed) and apply it to battle, map and ranch; fullscreen toggle via the wrapper (ticket 42) with a browser fallback; verify 1280×800 (Steam Deck), 1920×1080, 2560×1440, ultrawide. Controller: minimum viable path is a Steam Input keyboard/mouse template plus the existing hotkeys; native Gamepad API navigation is a stretch — measure how many UI surfaces need focus handling before committing.

## Done when

Every screen is usable at 1280×800 and 1920×1080 with no horizontal scroll; a Steam Input template is checked in under `steam/`.

## Resolution

Closed 2026-09-25. **The deliverable's central premise did not survive measurement, and that is the finding.**

### The scaling rule: measured, and the answer is DO NOT LETTERBOX

The ticket proposes *"a design resolution, e.g. 1280×720 safe-area scaled by `min(w/1280, h/720)`, letterboxed"*. Measured in a real Chromium at five viewports — 1280×720, 1280×800 (Steam Deck), 1920×1080, 2560×1440 and 3440×1440 (ultrawide) — walking title → ranch → assembly → gym offer → party picker → region map → a fight:

**The document never scrolls horizontally at any of them, and no page throws.** The Done-when's first half was already satisfied before this row started.

Three elements DO overflow their box, and all three are deliberate:

| element | what it is | verdict |
|---|---|---|
| `.rm-canvas` (map) | 1238 wide, 1448 of content at 1280×800 | **pans** — `overflow-x: auto`, `scrollLeft` 0 → 210 verified reachable. Its own docblock rules this and names ticket 37: *"a 15-column region is genuinely wider than that frame, and the honest answer is to pan it, not to shrink nodes below a readable size."* |
| `.ranch-screen` | 800 clip, 935 of content | **scrolls** — `overflow-y: auto`, verified reachable |
| `.battle-screen` | 1280 clip, 1508 of content | the **enemy-hand drawer parked off-screen** (159's collapsible face-up hand). `overflow: hidden` is what stops a parked drawer creating a scrollbar — correct, not a leak |

**So a letterbox would be a regression.** The layout is genuinely fluid and SPENDS the extra space — at 1920 the map shows all three biome panels that need panning at 1280. Scaling a 1280×720 stage up would replace that with a bigger picture of less information, and bars. The scaling rule is therefore *fluid, with a measured 1280×720 floor*, which is what the CSS already implements. **Nothing was changed to satisfy this half of the ticket, and the measurement is the reason.**

### Fullscreen

`src/ui/hooks/useFullscreen.ts` plus a Display group in the settings screen. **There is one code path, not a wrapper path and a fallback** — Electron's renderer is Chromium, so `requestFullscreen` behaves identically in the packaged app and a browser tab, and a bridge member would be a second thing to keep true for no behavioural difference (`IDesktopBridge` is deliberately small for exactly that reason).

Two design points, both pinned by tests:

- **State is derived from `document.fullscreenElement` on every `fullscreenchange`, never remembered.** A player can leave fullscreen with Escape, F11 or the window manager; a hook that set a flag when it asked would then offer "Leave fullscreen" on a windowed game.
- **The control is not rendered at all where the API is absent or disallowed** (older WebKit, an embedded webview) rather than rendered disabled. A dead toggle reads as a bug in the game; an absent one reads as a feature the host does not offer, which is the true statement.

Verified in a real browser end to end: the Display group renders, "Go fullscreen" enters fullscreen, the label flips to "Leave fullscreen", zero page errors. The settings screen's "Not here yet" entry moved from *"Fullscreen and resolution"* to *"Resolution and windowing"*, and `SettingsScreen.test.ts` asserts the absence of the old phrasing as well as the presence of the new, so a half-applied revert cannot leave the screen claiming both.

### Controller: the measurement the ticket asked for, and what it decided

> *"native Gamepad API navigation is a stretch — measure how many UI surfaces need focus handling before committing."*

Counted in Chromium at 1280×720 on the battle screen, the densest one:

| | |
|---|---|
| focusable elements | **13** |
| clickable elements that are **not** focusable | **37** |

Thirty-seven surfaces would need focus handling, a focus ring and a sensible tab order — **on one screen**, before the map, ranch, workshop, marketplace, loadout editor and codex are counted. That settles it for the ticket's own minimum viable path.

`steam/controller_config/mingming_keyboard_mouse.vdf` is checked in with a README carrying the mapping table. **The cursor is the primary route** (right stick drives the mouse, right trigger clicks) — every action in the game is reachable by pointing, so nothing is unreachable the moment that is true. The hotkeys are accelerators bound to the keys `keybinds.ts` already handles.

`steamInputTemplate.test.ts` asserts the template covers every key constant that table exports. **That is the tripwire the ticket needs**: add a binding to `KEYBINDS` and nothing otherwise tells you the controller cannot reach it — the game keeps working on a keyboard and quietly loses a control on a Deck. It deliberately does NOT parse the VDF: the claim is coverage, not syntax.

### What still needs a human

**The VDF's schema is unverified.** It was written against Steam Input's documented `controller_mappings` structure, but the Steam client was not available in the environment that produced it. The MAPPING is the reviewed content; the file format is not. Before ship: open it in Steam's controller configurator, confirm it loads without warnings, and re-export from there so the file is one Steam wrote.

**Button assignment is taste.** The table in the README is a defensible default, not a ruling. A controller reaches cards 1–4 (the d-pad's whole budget) and the cursor reaches 5–9; that gap is asserted in the test so it is stated rather than discovered.

