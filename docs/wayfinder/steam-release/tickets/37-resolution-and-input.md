# Resolution, fullscreen and controller: 16:9, 16:10 Steam Deck, Steam Input (ticket 37)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [26](26-wrapper-research.md), [10](10-region-map-screen.md), [22](22-3v3-game-side.md)
- Phase: Content Complete

## Deliverable

`index.css` uses `100vw/100vh` roots with 4 real breakpoints and many fixed-px sizes; there is no fullscreen, no resize handling, no gamepad. Establish a scaling rule (a design resolution, e.g. 1280×720 safe-area scaled by `min(w/1280, h/720)`, letterboxed) and apply it to battle, map and ranch; fullscreen toggle via the wrapper (ticket 42) with a browser fallback; verify 1280×800 (Steam Deck), 1920×1080, 2560×1440, ultrawide. Controller: minimum viable path is a Steam Input keyboard/mouse template plus the existing hotkeys; native Gamepad API navigation is a stretch — measure how many UI surfaces need focus handling before committing.

## Done when

Every screen is usable at 1280×800 and 1920×1080 with no horizontal scroll; a Steam Input template is checked in under `steam/`.

## Resolution

_(open)_

