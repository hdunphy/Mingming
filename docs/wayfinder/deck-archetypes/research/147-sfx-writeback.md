# Ticket 147 — write-back (147e)

**Rows built:** 147a (sample playback), 147b (mixing), 147d (wiring). 147c was done on 2026-09-19.
**Branch:** `playtest-polish`. **Commits:** `3862d5f` (147a), `6803e57` (147b), `c1c13e0` (147d).
**Captured on:** headless Chromium, 1280×800, the posed 3v3 from the 155 write-back, every VFX
switch on.

---

## 1. What was captured

§147e asks for *"a 20-second capture of a 3v3 turn with 146 on and sound on; a second with combat
sounds off"*. There are three, because two would not answer Henry's first question.

| file | board | what it is for |
|---|---|---|
| `147e-normal.mp3` | FFN party vs **three Hel** (Dark) | every impact is ORDINARY — Dark takes 1.0 from Fire, Water and Nature alike |
| `147e-on.mp3` | FFN party vs Sköll / Draugr / Kraken | every impact is SUPER-EFFECTIVE on this board |
| `147e-off.mp3` | the same board, **combat sounds off** | what the switch actually does |

**The first take exists because the second one failed its own purpose.** The mixed board was
supposed to contain both kinds of hit; it produced four `impactSuper` and no `impactNormal`,
because that party is elementally ahead of that enemy trio on every axis. A capture with only
super-effective hits cannot answer *"can you tell super-effective from normal with your eyes
closed"*. So the mirror take was built against a Dark trio, where the matrix gives 1.0 on every
axis, and the two files are the A/B.

These are real recordings of the game's own audio graph — the output is tapped at the node that
feeds the speakers, so the ducking, the limiter and every pitch shift are in them, not a re-mix.

## 2. The ear tests, and where to hear each one

**1. Super-effective against normal.** Play `147e-normal.mp3` and then `147e-on.mp3`. Every
impact in the first is `impactNormal` or its element's impact; every impact in the second is
`impactSuper`. First hits at **1.12 s** in both.

**2. A Poison or Burn tick against a hit.** `147e-on.mp3` at **12.17 s** — `burnTick`, pitched up
by stacks — sits three seconds after the last impact so there is nothing to confuse it with.
147 §4's rule is that a tick is *"never the impact sound"*, and this is the moment to check it.

**3. An OS firing.** `daemonProc` fires nine times in `147e-normal.mp3`, first at **3.06 s**,
usually on the heel of a cast. These are the family blip, not a per-OS tell: the sampled OS cues
are named `os_<species>_<OS>` and this board's firmware is not among the eleven that have one, so
it falls to the default, which is the behaviour 147 §8 rules for every OS outside Early Access.

## 3. Every rule in 147d, as it actually fired

The cue timeline, read off the live graph. `@` is the playback rate, which is how a sample is
pitched.

| time | cue | what it proves |
|---|---|---|
| 1121 ms | `impactNature @0.995` | an ordinary hit takes its ELEMENT's impact, pitched down by damage |
| 1148 ms | `impactSuper @0.978` | super-effective overrides the element, as §8 rules |
| 3060 ms | `sharpRaise @0.97` | Sharp gets its own cue, not the generic buff |
| 3060 ms | `debuffDown @0.85`, 8921 ms `@1.27` | the status family, pitched per status |
| 5092 ms | `absorbedNoDamage` | the shield held and said so |
| 12169 ms | `burnTick @1.139` | a tick, pitched by the stacks the target was carrying |
| 27216 ms | `cardFly @0.841` | the ENEMY's card — exactly three semitones down (2^−3/12) |
| 12164 ms | `cardDiscard`, 12163 ms `turnEnd` | two events this hook had never listened to |

**Not in these takes, and honestly so:** `kill`, the species cries and `hitBig`. Nothing died
inside twenty seconds and no single hit reached 35% of a max HP bar, so those three rules are
covered by tests and not by ear here. If Henry wants them, the capture needs a weaker enemy.

## 4. The switch

`147e-off.mp3` is the same board with combat sounds off. It contains exactly **one** voice, a
`turnEnd` at 12.0 s, and measures **−37.7 dB mean against −20.2 dB** for the same turn with them
on. The fight is silent; the game still answers you.

The sample bank still loads with the switch off, on purpose: the switch is a runtime toggle, and
flipping it on mid-fight has to work on the next hit rather than after a 675 KB fetch.

## 5. Levels

Measured on the raw capture, before the mp3 encode:

| take | mean | peak | samples at 0 dBFS |
|---|---|---|---|
| `147e-normal` | −20.9 dB | −0.2 dB | 38 of ~1,000,000 |
| `147e-on` | −23.2 dB | −0.5 dB | 10 of ~1,000,000 |

A 20 dB crest factor is healthy for short transients, and the limiter is holding the ceiling
rather than squashing — 38 samples at full scale out of a million is the compressor catching the
loudest few hits, which is its job. It is riding close to the top, though, and that is a taste
call: the default volume is 0.7, which the engine squares to 0.49 of master, so there is headroom
in the setting if Henry wants it quieter by default.

## 6. What the gate says

eslint 0, `tsc -b` 0, **2,542 vitest across 186 files**, production build clean, `assert-no-debug`
OK, `assert-sfx` OK — 61 cues in `dist/sfx`, 675 KB, none over 60 KB.

Worth saying plainly: **the suite cannot hear anything.** It is silent by construction — there is
no `AudioContext` in node or in jsdom, so `playSfx` returns before it touches the graph. A green
run says the rules are right, not that a sound played. That is why the browser numbers above
exist: 61 of 61 samples decoded on battle mount, one AudioContext, one DynamicsCompressor, and 24
sample voices in a single turn against 1 with the switch off.

## 7. Decisions needed

1. **Element on the impact, or only on the cast.** §8 left this flipped on with a note that
   *"Henry can flip that rule after hearing it"*. Right now an ordinary Fire hit plays
   `impactFire` and a super-effective one plays `impactSuper` whatever the element. Listen to
   `147e-normal.mp3` — the element impacts are in it — and say whether the element belongs on the
   hit at all, or only in the cast where 147 §1's Pokémon model puts it. Flipping it is deleting
   one lookup.
2. **`daemonProc` nine times in twenty seconds.** Every OS outside the eleven sampled ones falls
   to the family blip, and on a board with three of them it is the most frequent sound in the
   take. Either more OS cues get sampled, or the family blip needs to be quieter or rate-limited
   harder than the 60 ms everything else gets.
3. **How hot is too hot.** Peaks at −0.2 dB with the limiter engaging. Leave it, or drop the
   default volume?
