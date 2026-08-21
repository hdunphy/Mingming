# Audio pass: music loops, owned SFX packs, license inventory (ticket 35)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [36](36-settings-screen.md)
- Phase: Content Complete

## Deliverable

Audio is 20 procedural Web Audio SFX (`sfxRecipes.ts`) and no music. Henry owns SFX packs from the Unity Asset Store — **first verify their licence permits use outside Unity** (the Asset Store EULA restricts some assets to Unity-built projects; record per-pack findings in `docs/licenses.md`). Add: a music bus with ducking in `AudioEngine.ts`, 4–6 loops (ranch, map, fight, gauntlet, victory, defeat) from permissively-licensed sources (CC0/CC-BY with attribution file), music volume in settings (ticket 36), and swap in sample-based SFX where they beat the synth. Every asset gets a line in `docs/licenses.md` (title, author, licence, URL) — Steam review and the credits screen need it.

## Done when

Music plays per screen, volumes persist, `docs/licenses.md` complete, credits screen lists attributions.

## Resolution

_(open)_

