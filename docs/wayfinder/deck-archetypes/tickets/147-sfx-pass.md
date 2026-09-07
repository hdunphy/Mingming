# Ticket 147 — SFX pass: the cues the battle is missing

**Type:** audio. **Asked by Henry, 2026-09-07:** *"add additional SFX if we don't have something
already."* **Relates to:** steam-release 35 (audio pass, "audio from owned/free packs"), 146 (every
emitter there has a cue here). **Branch:** `legion/ai-perf`.

---

## 1. What exists

`src/ui/audio/AudioEngine.ts` — a fully synthesized Web Audio engine: lazy singleton context on first
gesture, volume/mute persisted, each sound a small recipe over a toolkit (tone, noise burst, sweeps),
`playSfx(name, { pitch })`. Cues in use today:

`uiClick`, `uiError`, `cardDraw`, `cardPlay`, `heal`, `absorbed`, `death`, `victory`, `defeat`,
`levelUp`, `discountPrimed`, `stanceLight`, `stanceDark`, `breach`, `rewardClaim`, and
`statusApply` (pitched per status by `useBattleVfx`).

So the UI and the card flow have sound; **the hit does not.** There is no impact, no element, no
tick, no shield raise, no turn beat, no kill sting distinct from the death fizzle.

## 2. 147a — The missing battle cues

Same synthesized style (recipes), so nothing waits on packs; each row names the recipe shape and
the event that fires it. `useBattleVfx` is the only caller — it already sees every event.

| cue | fires on | recipe |
|---|---|---|
| `hitFire` / `hitWater` / `hitNature` / `hitNone` | `DAMAGE_TAKEN` by element | short noise burst + body tone: Fire = crackle (filtered noise, 120 ms) + low thump; Water = splash (bandpassed noise sweep down) ; Nature = thwack (short tone 220→90 Hz) + rustle; None = dry thump |
| `hitBig` | the 146d hit-stop condition (≥ 25% max HP or kill) | layered on the element hit: sub thump (50 Hz, 200 ms) + a 1-frame click |
| `superEffective` / `resisted` | ×1.5 / ×0.67 hits | rising two-note sting (C→G, 90 ms) / dull descending tone (muffled) |
| `kill` | HP → 0 (before `death`) | sharp sting + the existing `death` after 120 ms |
| `burnTick` / `poisonTick` | DoT damage at turn start | soft crackle / wet drip; pitch by stacks |
| `shieldRaise` / `shieldCrack` | Bark Shield applied / an absorb (146b cracks) | woody knock rising / short snap; `absorbed` stays for the number |
| `buffUp` / `debuffDown` | Strengthened/Sharp/Regen applied / Weakened/Dazed applied | replaces the generic `statusApply` pitch trick with two families: bright ascending / dull descending, still pitched per status |
| `energyGain` | Energized or EP restored | quick bright pip |
| `turnStart` / `turnEnd` | `TURN_START/END` (player side only) | soft two-tone chime up / down — the "your move" beat |
| `enemyIntent` | intent shown | faint low tick |
| `shuffle` | `DECK_SHUFFLED` | riffle noise burst |
| `discard` | `PROGRAM_DISCARDED` | short paper swish |
| `cardHover` / `targetSelect` | UI | very quiet tick / reticle blip |
| `osProc` | a firmware hook fires (add a `HOOK_FIRED` event, or key off the existing LOG line) | terminal-style blip in the owner's element colour-pitch — the OS is the deck's identity, it should be audible |
| `lowHp` | a unit crosses 25% | single heartbeat; **no loop** (loops fatigue) |
| `gymIntro` / `runWon` | gauntlet start / run end | longer stings; the only two "music-shaped" cues |

## 3. 147b — Mixing rules (the difference between juice and noise)

- **Rate limit per cue:** the same cue cannot fire twice within 60 ms; multi-hit cards play the
  impact twice with a pitch step, not stacked.
- **Ducking:** while `hitBig`, `kill`, `victory`, `defeat` play, everything else is −6 dB for 250 ms.
- **Pitch by magnitude:** impacts drop pitch with damage fraction (bigger = lower), status ticks rise
  with stacks. One rule, applied everywhere, so the ear learns it.
- **Never a sound per particle.** 146 emitters are silent; the *event* has the sound.
- **Reduced motion does not mute** — a separate SFX slider already exists. A "combat sounds" toggle
  is worth adding beside it.
- Headroom: the master bus gets a soft limiter (`DynamicsCompressor`, threshold −6 dB, ratio 12) so
  a six-body turn cannot clip.

## 4. 147c — Sample playback, for when packs arrive (small, optional)

`playSfx` is recipe-only. Add a `registerSample(name, url)` path that decodes once and plays through
the same bus, gain, pitch and rate-limit rules, so steam-release 35's owned/free packs can replace any
recipe name-for-name without touching callers. Not needed to ship 147a.

## 5. Gate

A 20-second capture of a 3v3 turn with 146 on, sound on, in the write-back; Henry listens. Unit test:
every cue name in the table exists in `SfxName`, and `useBattleVfx` maps each listed event to it
(the existing `useBattleVfx` tests extend). No cue plays under vitest (the engine already no-ops
without an `AudioContext`).
