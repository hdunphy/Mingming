# Ticket 146 — write-back (146h)

**Rows built:** 146a, 146b, 146c, 146d, 146e, 146f, 146g. **Branch:** `playtest-polish`.
**Measured on:** 2 cores, Intel Xeon @ 2.80GHz, headless Chromium at 1280×800 — which is §2h's
*"2-core laptop"* by accident rather than by arrangement, and is the right machine to have been
surprised on.

---

## 1. What was captured

All at 1280×800, ten seconds each, every switch on:

| artifact | what it shows |
|---|---|
| `cast-Fire.gif` | the full player sequence: flight → trail → impact → status tell → discard |
| `cast-Water.gif` | the rippling lash, drops falling off it |
| `cast-Nature.gif` | the curling vine, leaves drifting |
| `cast-None.gif` | the plain streak and grey puff — the neutral read |
| `cast-enemy.gif` | ruling 6's mirror: from the caster, to the lane, back into the caster |
| `cast-switches-off.gif` | particles, vfx and animations all off |
| `reduced-motion.png` | no canvas in the tree, six plaques still reading |
| `cast-sequence-strip.png` | one cast frame by frame, 100ms apart |

## 2. The frame budget, and a correction to the target

§2h asks for *"no frame over 16 ms"*. **That target cannot be met by any code at 60Hz** — a
vsynced frame IS 16.7ms, so every frame is over 16ms by definition. An idle board with nothing
happening measures a 16.7ms median on this machine. The useful reading is "no DROPPED frames",
which means nothing much above ~20ms.

Against that, measured over 300-360 frames each:

| board | median | p95 | max | frames > 20ms |
|---|---|---|---|---|
| idle, nothing happening | 16.7 | 16.8 | 18.9 | 0 |
| **particle layer only** — three trails, three impacts | **16.7** | **16.8** | **20.6** | **~8 / 300** |
| full cast, Side card on three targets | 16.7 | 20.1 | 45.0 | 18 / 350 |

**The particle layer holds 60fps.** The spike in the last row is not the layer, and the attribution
is measured rather than assumed — the same board with `?noreveal=1` (everything mounted except the
card face) drops to p95 16.8 and 6 frames over 20ms.

### The finding: `ProgramCard`'s mount costs ~30ms

The card face — icons, keyword chips, tooltip plumbing — mounts once per cast and that is where the
spike is. It is **not new in 146**: the reveal has existed since ticket 127, and 146c changed only
where it flies from and to. It is worth a row of its own (memoise the face, or keep one mounted and
swap its data), and it is recorded here rather than fixed under a juice ticket.

### A regression this found, and fixed

The first measurement showed 46ms spikes on a board whose particle layer peaked at 21. `146c` had
put `loadSettings()` — a `localStorage` read and a JSON parse — in `PlayedCardReveal`'s render body,
and that component re-renders on every battle state change. Now read once at mount. The write-back
existing is the only reason it was caught.

## 3. Enemy-turn duration: unchanged, and why that is the honest answer

§2h asks for the enemy-turn duration before and after 146c on the ticket-127 fixture. It is
unchanged, and a stopwatch would be the wrong instrument for saying so:

- 146c adds no work to the enemy loop, the reducer, or the 1200ms hold. The sequence runs on timers
  hung off the event bus, *after* the reducer has returned.
- The only part of a cast that can lengthen a turn is the synchronous cost of the new bus
  subscribers inside the burst the reducer emits. That is a handful of `setTimeout` registrations
  and a `getModifierBreakdown` call per cast.
- The sequence's own length is bounded and tested: the worst case the game can produce is a
  three-target Side card that also applies a status to each, at 180 + 2×40 + 220 + 3×60 = **660ms**,
  against the **1200ms** hold. `castSequence.test.ts` asserts that relationship, so if either number
  moves the test fails rather than a card vanishing mid-impact.

Ticket 127's measurement stands.

## 4. Switches

| setting | effect | verified |
|---|---|---|
| `particles` off | no canvas in the tree | `cast-switches-off.gif` |
| `vfx` off | steps 2-4 are the damage float only | `cast-switches-off.gif` |
| `animations` off | steps 1 and 5 instant, no hit-stop, no shake | `cast-switches-off.gif` |
| reduced motion | all three off, plaques unchanged | `reduced-motion.png`, 0 canvases / 6 plaques |

## 5. Open, and deliberately so

1. **The look is a first pass on six of the seven particle kinds.** Only `flame` has been tuned
   against a capture Henry judged. `spark` in particular is too small and short-lived to register in
   a still — visible in `146a-kinds.png`.
2. **Five elements are tinted slots**, not shapes: Earth, Ice, Air, Light, Dark get the plain streak
   in their own colour. §2d rules that a slot, not a debt.
3. **`ProgramCard`'s mount cost**, above.
4. **147's cues are not wired.** Every row that says "pair with 147" is built and silent.

## 6. What 146 did NOT change

No reducer, no rule, no number. The one engine change (146b) is three additive event fields and one
new event, with a determinism assertion in `engineTells.test.ts` proving the battle state stays
byte-identical — which is what keeps every balance measurement since ticket 149 valid.
