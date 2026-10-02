# Ticket 190: The new attack effects and the five speed tiers

**Type:** battle presentation and settings. Nothing under `src/engine` changes. **Status:** RULED (Henry, 2026-10-02), not started. **Blocked by:** [189](189-impact-timing.md) for every row. 190a also waits for 183f, which restyles the settings screen. 190e also waits for 183b, which builds the plaques that show the HP ghost chunk.

**Where this comes from.** This is the same research pass as 189:
- the **Battle Juice Lab** artifact (https://claude.ai/artifact/QzDRnvRLHquCYnwNPHtm4p);
- the Claude project doc "battle-juice-research-2026-10-02".

The lab's code is checked in as [`../research/battle-juice-lab.js`](../research/battle-juice-lab.js), and it is the reference for every effect and number below. Port its ideas, not its structure: it is one prototype file, and the game wants small composed pieces.

**Henry's brief (2026-10-02):**

> *"1. Lunge forward into the 'attack' position*
> *2. Fire out an elemental attack based on the card element (a vine for nature, a flame column for fire, a jet of water for water). They should go from the caster to the target. Side targets would need a different effect (maybe a wall of fire, a wave, and a cloud of poison/pollen dust). Statuses would also need something if there is not attack attached maybe just a wiggle then a unique effect for each status type applied. The length of these effects should also be effected by the amount of damage. Quick for small attacks, long for larger attacks.*
> *3. On impact more particles on the targets along with a hit stop and screenshake on damage dealt that scales with damage dealt*
> *4. Mingming returns to his position*
> *5. The card goes to the middle lane but discards before the next card is played. On enemy turns this should hover for 1s before the next attack*
>
> You should be able to disable these in the settings to speed up gameplay."*

**His rulings on the lab (handwritten, 2026-10-02, then in chat):**

> *"1) … Maybe best option is a button toggle group [Slow] [Showy] [Snappy] [Fast] [Instant] with slow being a more impactful slower 'Showy' and fast 2x Snappy … 5) The five speed tiers instead of 1x, 2x, 4x. Other buttons are good. Catch up should default to ON. 6) Yes good call* [contact cards dash in] *7) Later pass, unless you know of some free Assets."*
> *Sprite sheet cannot be AI generated. Let's look for free assets 1st, if not can hire someone. Or I can use Aseprite.*
> Chat: *"1. Default is showy 2. Slow is good 3. Yes that's fine"* (3 = a company's "we don't use AI" statement is enough)

**How to work it.** The same rules as 189:
- one commit per row, test first;
- commits authored by Henry with no co-author trailers; nothing is pushed;
- CRLF in `docs/wayfinder`, LF in new `src` files;
- small composed modules, with each element effect its own file.

| Row | What | Blocked by |
|---|---|---|
| 190a | Settings: the five-tier battle speed (default Showy), shake slider (60%), hit-stop, flashes, catch-up (on), hold-to-fast-forward | 189a, 183f, D1, D2 |
| 190b | The tier profiles: one data table of every timing, read by the clock and the choreography | 189a |
| 190c | Choreography: crouch, lunge and hold, contact cards dash in, return; status-only wiggle and orb | 190b |
| 190d | The element attacks: flame beam, water jet, vine; fire wall, tidal wave, pollen cloud. Length grows with damage | 190c |
| 190e | Impacts: element bursts, super-effective and resisted, one beat per hit on multi-target cards, the HP ghost chunk | 190d, 183b |
| 190f | Status landings: one distinct landing per status; riders land while the attacker walks back | 190c |
| 190g | Big-hit extras: stage dim and charge-up, camera punch | 190d |
| 190h | **Parked (later pass):** a flipbook sprite renderer and the free human-made asset shortlist | Henry |

---

## 190a: Settings

**Build** (in `settings.ts`, its zod schema, and `SettingsScreen` in 183f's kit):
- **`battleSpeed`**: `slow | showy | snappy | fast | instant`, default **`showy`** (ruled).
  - Shown as one five-button toggle group, as in the lab.
  - It feeds `SpeedPolicy`: Fast = ×2 on the clock, Instant = the clock's Instant mode, the others ×1 with their own profile.
- **`screenShake`**: a 0–100 slider, default **60** (ruled).
- **`hitStop`**: on/off, default on.
- **`flashes`**: on/off, default on. It covers hit flashes and the big-move dim. Keep it under WCAG's limit of no more than 3 flashes a second.
- **`catchUp`**: on/off, default **on** (ruled). When cards are queued, the clock runs ×(1 + 0.2·min(queued, 3)), so a long AI turn tops out at 1.6×.
- **Hold to fast-forward**: ×3 while held. **The key is D2:** Space is already End Turn (`END_TURN_KEY` in `keybinds.ts`). It goes in the keybind list and the Steam Input template (`steamInputTemplate.test.ts`).
- **`particles`** and **`reducedMotion`** stay as they are. Reduced motion still outranks everything: no movement, no shake, no hit-stop, a colour flash and the numbers only.
- **D1:** the old `vfx` and `animations` switches.
- Migration: an old save with `animations: false` gets `battleSpeed: instant`.

**Tests.**
- The schema defaults are as listed.
- The migration works.
- `SpeedPolicy` returns 1 / 1 / 1 / 2 / Instant for the five tiers, ×3 while held, and ×1.4 with two cards queued.

## 190b: The tier profiles

**Build.** One data module, `tierProfiles.ts`, with one entry per tier. All timings are ms at the tier's own speed. `s = clamp(sqrt((damage ÷ maxHp) ÷ 0.45), 0, 1)`, so a chip stays quick and a 45 isn't three times as long as a 15.

| | Snappy (Fast = this at 2×) | Showy (default) | Slow |
|---|---|---|---|
| Wind-up (crouch) | 50 | 120 + 100s | 1.3 × Showy |
| Lunge | 100 ms, 34 px | 150 ms, 54 px | 190 ms, 62 px |
| Projectile head | 120 + 60s | 180 + 80s | 1.3 × Showy |
| Projectile pour (sustain) | 20 + 180s | 120 + 480s | 1.3 × Showy |
| Hit-stop | 40 + 70s, kill 140 | 60 + 80s, kill 170 | 1.25 × Showy, kill 210 |
| Knockback, then return | 110, 130 | 170, 200 | 220, 250 |
| Status-only: wiggle, orb, landing | 200, 220, 340 | 300, 320, 520 | 380, 400, 650 |
| Card in, card out | 150, 140 | 180, 160 | 220, 200 |
| Enemy card hover | 1000 | 1000 | 1000 |
| Camera shake from | 20% max HP | 12% | 8% |
| Trauma added | 0.25 + 0.45s | 0.3 + 0.55s | Showy + 0.1 |
| Target-only shake | 3 + 5s px | 4 + 7s px | 5 + 8s px |
| Particles | ×0.85 | ×1.3 | ×1.5 |
| Dim / charge-up from | never | s > 0.6 / s > 0.5 | s > 0.35 / s > 0.3 |
| Camera punch | 0 | 3% × s | 4.5% × s |
| Damage number size | 26 + 22s px | 30 + 30s px | 34 + 32s px |

The common rules from 189d stay:
- hit-stop +20 ms super-effective, ×0.6 resisted, ×0.6 per hit on multi-target;
- knockback 6 + 14s px, ×0.4 when resisted;
- trauma decays at 1.6 per second;
- camera at most 14 px × the shake setting, plus 1.2°.

Measured in the lab, one Flame Column at 45 damage takes Slow 2.24 s, Showy 1.74 s, Snappy 0.91 s, Fast 0.44 s and Instant 0.

**Tests.**
- Every profile field is present for every tier.
- A plan built from the Showy profile at 45 damage totals 1740 ± 10 ms.
- The timeline (wind-up, lunge, travel, hit-stop, knockback, return) is in that order.

## 190c: Choreography

**Build** (on the clock, through `useClockedControls`):
- **Wind-up:** the caster crouches back 8 px with a small squash (scale 1.06 × 0.92).
- **Lunge:** 34 / 54 / 62 px toward the enemy side. The caster **holds that pose until the hit lands**, then knockback plays out and the caster returns.
- **Contact cards dash all the way in** (ruled: *"Yes good call"*). That means every single-target Attack card with element None:
  - `tackle` and `tackle+`;
  - `zealots_edge`, `genesis_surge`, `feedback_token`;
  - the enemy `baseline_*` cards.
  - List them in the commit. Henry can exempt any of them.
  - The dash ends about 115 px short of the target, with speed lines. The hit lands on arrival.
- **Status-only cards:**
  - the caster wiggles (a hop with a small rock and squash);
  - an orb in the status colour lobs to the target (a buff on yourself rises and drops back);
  - then the status lands (190f).
- **The card** arrives in the lane during the wind-up and leaves while the attacker returns (189e's rule, now on the profile's in and out times).

**Tests.** The lunge holds until the impact. A contact card's impact time equals the dash end. A status-only card plays no lunge.

## 190d: The element attacks

**Build.** One small file per effect under `src/ui/vfx/attacks/`, each a function from (caster, targets, head, sustain, s) to the hit times. Each is drawn in the existing canvas layer:
- additive blending (`'lighter'`) for light;
- normal blending for solid shapes;
- cached glow textures, as the lab does.

The current `trails.ts` shapes are replaced for the three elements below. Earth, Ice, Air, Light and Dark keep their tinted streak, as ticket 146d's reserved placeholders.

| Card shape | Fire | Water | Nature |
|---|---|---|---|
| Single target | **Flame beam**: a pouring stream of flame from the caster's mouth, with a bright core. Embers splash off the target while it pours. | **Water jet**: a rippling jet on a slight arc. Drops shed at the head; spray bounces back off the target. | **Vine**: grows along the ground from the caster's feet, whips up and coils round the target, squeezes on the hit, retracts after. Leaves shed as it grows. |
| Side / All | **Fire wall**: erupts in front of the enemy row, then rolls over it. Each body is hit as the wall passes. | **Tidal wave**: sweeps the lane from the caster's side. Each body is hit as the crest passes. | **Pollen cloud**: puffs lob to each target and bloom into slow clouds with glints. Poison follows as its rider. |

**Length grows with damage:** head + sustain come from the profile (`s`). The target trembles slightly while a beam or jet is pouring.

**Tests.** Each effect returns one hit time per target. Side cards' hits are in order of distance. Each effect is drawn only while live and frees its particles. An effect never runs under reduced motion or Instant.

## 190e: Impacts

**Build** (at 189's impact moment, one file per element):
- **Fire:** embers spray away from the attacker, plus dark smoke and an orange ring.
- **Water:** drops arc up and fall, plus mist and a blue ring.
- **Nature:** leaves tumble, plus green sparks and a ring.
- **None:** white streaks and a ring.
- **Super-effective:** half again as many particles, a white ring, star sparks and the tag "SUPER EFFECTIVE".
- **Resisted:** half as many, a grey fizzle puff, the tag "RESISTED", and no camera shake.
- **Kill:** the white ring, a longer freeze, and the death fade.
- **A white hit flash** of about 90 ms on the target. It is off when `flashes` is off.
- **Multi-target cards give each body its own short beat** (ba-ba-bam), not one wide flash.
- **The HP ghost chunk** is 189c's, drawn in 183b's new plaque.

**Tests.** The particle count scales with `s` and the matchup. There is no flash with `flashes` off. A three-target card produces three impact beats.

## 190f: Status landings

**Build.** One landing per status, in `statusTells.ts`'s family. It plays once per status with an ×N count and no stagger between mingmings (ruled 2026-09-27):

| Status | Landing |
|---|---|
| Burn | Flames lick up the body; orange glow |
| Poison | Purple bubbles rise and green drips fall; the sprite dulls briefly |
| Dazed | Three stars circle the head; the sprite wobbles |
| Weakened | Grey chevrons sink through; the sprite slumps and greys briefly |
| Strength | Red chevrons rise; embers; the sprite pumps up |
| Sharp | White glints flash across the body, plus one slash glint |
| Regen | Green plus signs and motes rise gently |
| Bark Shield | Bark planks fly in and lock into a ring, then settle into the brown band over the HP bar (183) |

Statuses not in this table keep today's tells: Asleep, Stunned, Energized, StableOS, the two Stances. A status a card adds after its damage (a "rider") lands **while the attacker walks back**, as its own beat. Ticket 172's rule that every status-applying hook gets its own after-card beat still holds.

**Tests.** Every status in the table has a landing. A rider lands after the impact. A rider's landing overlaps the return and does not add its full length to the sequence.

## 190g: Big-hit extras

**Build.**
- **Dim and charge-up:** above the profile's threshold, the stage dims during the wind-up (opacity up to 0.4·s; off when `flashes` is off), and sparks converge into the caster's mouth.
- **Camera punch** on Showy and Slow: a brief zoom of 3–4.5% × s that eases back over 260 ms.

**Tests.** No dim on Snappy or Fast. No dim with `flashes` off. The zoom returns to exactly 1.

## 190h (parked): Flipbook sprites, a later pass

Ruled for later (*"Later pass"*). **No AI-generated sprite sheet ever ships**:
- free human-made packs first;
- then hire someone or author our own.

A company's own "we don't use AI" statement counts (ruled). When this row opens:
- build a small `FlipbookSprite` renderer for the canvas layer:
  - downscale each sheet once at load;
  - additive blending for light, normal blending for solid shapes;
  - tint to the element colours;
- pack the sheets into atlases, never a loose PNG folder, because the CraftPix licence forbids making its files reusable.

The checked shortlist is in the Claude project doc "battle-juice-research-2026-10-02":
- Sinestesia's hits and explosions and Cethiel's magic effects (both CC0, 2017–19);
- the CraftPix freebies;
- Pipoya;
- Kenney.

For drawing our own, Krita fits the HD art better than Aseprite.

---

## Decisions for Henry

1. **D1: the old Effects and Animations switches.** Today Settings has `vfx` ("what things look like") and `animations` ("what moves"). With the five tiers plus Particles, Flashes and Reduced motion, my suggestion is to **retire both**:
   - Animations off becomes **Instant**;
   - Effects off is covered by Particles and Flashes.

   Keep them, or retire them?
2. **D2: the fast-forward key.** Space is End Turn. My suggestion: **hold Shift**, or hold the mouse button anywhere on the stage, both doing the same thing. The other option is "hold Space while something is animating", but a held Space would then end your turn the moment the animation finishes, so I'd avoid it.
