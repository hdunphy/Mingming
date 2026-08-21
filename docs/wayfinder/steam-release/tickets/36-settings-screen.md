# Settings screen: audio, display, motion, keybinds, save management (ticket 36)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [23](23-save-v4.md)
- Phase: Content Complete

## Deliverable

The only setting today is `AudioControls` (mute + volume). Build a settings screen reachable from the main menu AND in-run (Esc): master/music/SFX volume, fullscreen/windowed + resolution (ticket 37 supplies the mechanism), reduced motion (honour `motionPrefs.ts`), text size, keybind display (remap if cheap), colourblind-safe element palette toggle (ticket 38), save slots if ruled, delete-save with confirmation, credits + licences. Settings persist outside the game save.

## Done when

Every setting round-trips through restart; Esc in battle pauses to settings without breaking the reducer.

## Resolution

_(open)_

