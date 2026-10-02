# Ticket 189: Hits land when they land (the battle clock and impact timing)

**Type:** battle presentation (UI timing only). Nothing under `src/engine` changes, so no balance number, grid or walker read moves. **Status:** RULED (Henry, 2026-10-02), not started. **Blocked by:** see D1 at the bottom. 189a and 189b touch no file that ticket 183 touches. 189c–e touch the plaque and HP bar that 183b rewrites.

**Where this comes from.** Henry, 2026-10-02: *"I'm not happy with the current VFX and game juice."* That started a research pass and a playable prototype:
- the **Battle Juice Lab** artifact (https://claude.ai/artifact/QzDRnvRLHquCYnwNPHtm4p);
- the Claude project doc "battle-juice-research-2026-10-02".

The lab's source is checked in next to this ticket as [`../research/battle-juice-lab.js`](../research/battle-juice-lab.js), so every timing below can be read in code. This ticket is the timing fix. [Ticket 190](190-attack-effects-and-speed-tiers.md) is the new effects and the five speed tiers, built on top of it.

**Henry's answers (handwritten, 2026-10-02):**

> *"2) Yes its own ticket*
> *3) Before makes more sense*
> *4) 60% is good."*

Answer 2 says the timing fix ships as its own ticket: this one. Answer 3 says the enemy card hovers for 1 s *before* its attack (row 189e). Answer 4 sets screen shake to 60% (row 189d).

## The problem, in plain words

The game works out a whole card the instant it is played: damage, statuses, deaths. The screen then reacts to those results **at different moments**:

- **At the moment of play**, all of these fire before anything has visibly happened:
  - the damage number, the HP bar drop, the hit sound, the big-hit and kill sounds (`useBattleVfx`, on `DAMAGE_TAKEN`);
  - the hit-stop and the stage shake (`useImpactFeedback`, also on `DAMAGE_TAKEN`).
- **180 ms later** the element trail leaves the caster (`useCastSequence`, `FLIGHT_MS`).
- **About 400 ms later** it lands (`TRAIL_MS` 220), and the impact burst plays after the number is already floating.
- **The hit-stop only pauses particles** (`ParticleLayer` checks `isHitStopped`), and none exist yet when it fires. It does nothing anyone can see.
- **The lunge** (`MingmingUnit`, 16 px out and back in 240 ms) is over before the trail leaves.
- **Every hit shakes the whole stage** by 2–8 px, so nothing stands out.
- **The player's card holds a fixed 1.5 s** (`PLAYER_CARD_HOLD_MS`). **The enemy waits a fixed 1.2 s** (`PLAYED_CARD_REVEAL_MS`, in `BattleArena`'s `runAI`), whatever the card does.
- **Victory and defeat fire on the state change** (`isVictory`/`isDefeat` in `BattleArena`), so the stinger and banner can arrive before the killing blow is drawn.

In the lab, tick **Compare with today** and play a heavy Flame Column. The timeline marks the number firing at 0 ms and the trail landing at 400 ms.

## The idea

**The engine stays instant, and the screen gets its own clock.**
- The reducer still resolves a card in one synchronous burst, exactly as now. That is what keeps this ticket out of balance.
- The UI keeps a **displayed board** (the HP, Bark and knocked-out state the player sees).
- A single ordered **presenter** moves the displayed board forward one beat at a time, on a **battle clock** that battle speed, hit-stop and Instant all go through.
- When the presenter has nothing left to play, the displayed board must equal the real one.

**How to work it.**
- One commit per row, test first.
- Commits are authored by Henry with no co-author trailers. Nothing is pushed.
- `docs/wayfinder` uses CRLF; new `src` files use LF.
- Many small single-purpose modules, composed. No monolith: the clock, the speed policy, hit-stop, the driver and the displayed board are separate pieces.
- Two agents share this folder: follow HANDOFF's rules, and commit by explicit path.

| Row | What | Blocked by |
|---|---|---|
| 189a | The battle clock: game time, waits, hit-stop that freezes it, Instant, one rAF driver | — |
| 189b | One ordered presenter queue for everything the board shows | 189a |
| 189c | The displayed board: HP, Bark and knocked-out state change at impact, not at play | 189b, and D1 |
| 189d | The number, sounds, hit-stop and shake move to the impact; target-only shake for small hits | 189c |
| 189e | Pacing: the card leaves when its sequence ends, the enemy card hovers 1 s first, battle end waits | 189b, 189d |

---

## 189a: The battle clock

**Build** (new folder `src/ui/vfx/clock/`, each piece small and separately tested):

- **`BattleClock`**
  - Game time in ms.
  - `wait(ms)` returns a promise resolved by game time.
  - `play(ms, fn, ease)` calls `fn(p)` every frame and resolves at the end.
  - `cancelAll()` for unmount.
- **`SpeedPolicy`**
  - One function that returns the clock's multiplier.
  - In this ticket it returns **1** (ticket 190a adds the tier setting, hold-to-fast-forward and catch-up).
  - Built now so that 190 only adds inputs.
- **`HitStop`**
  - Replaces the module-level `stoppedUntil` in `hitStop.ts`.
  - A freeze is in **real** ms and stops game time completely.
  - Length = `max(30, ms / sqrt(speed))`, so it shrinks at high speed but never drops below the 30 ms nobody can see.
- **`ClockDriver`**
  - One `requestAnimationFrame` loop.
  - It runs only while something is live, the same rule `ParticleLayer` already follows.
  - `ParticleLayer` steps by the clock's dt instead of reading `isHitStopped`.
- **`useClockedControls`**
  - The bridge to framer-motion: it sets `.speed` on live controls to the clock multiplier, and pauses and resumes them around a freeze.
  - It is used by the lunge and card flight now, and by everything 190 adds.
- **Instant:** when the clock is in Instant mode, **every** `wait` and `play` resolves at once. Skipping animation must also skip the waits. Temtem's "skip animations" left its pauses in, and players hated it.

**Tests.**
- `wait(300)` resolves at 300 ms of game time.
- At speed 2 it resolves at 150 ms of real time.
- A freeze holds every wait and `play`, then resumes them.
- Instant resolves synchronously.
- `cancelAll()` leaves nothing pending.
- The driver stops when nothing is live.

## 189b: One ordered presenter queue

**Today** `useCastSequence` queues casts. But DoT ticks, expiries, deaths and self-costs play the moment they arrive, so a Burn tick at a turn boundary can play in front of the impact that is still on its way.

**Build.**
- `useCastSequence` becomes the presenter: **one queue for everything the board shows.** That covers:
  - casts (the cast-window logic is unchanged);
  - hook beats (ticket 171f);
  - DoT ticks and expiries at turn boundaries;
  - recoil and toll;
  - deaths.
- An event that arrives while the queue is busy waits its turn.
- Every `window.setTimeout` in the sequence becomes `clock.wait`.
- It exposes `isIdle()` and `whenIdle()` for 189e.

**Tests.**
- A Burn tick that arrives during a cast plays after that cast's impact.
- Seven AI casts in one synchronous burst play in order, one after another.
- The 155a re-render case keeps passing.

## 189c: The displayed board

**Build.**
- **`displayedBoard`**: a small store holding, for each entity, the HP, Bark and knocked-out state the player sees.
  - It equals the real state when a battle mounts.
  - **Only the presenter writes to it, at the impact.**
- The HP bar, the HP text, the Bark band (183's brown bar) and the knocked-out look read from it.
- Targeting, the damage preview and every engine call keep reading real state.
- **The HP bar at impact:**
  - the fill drains to the new value over about 240 ms;
  - a pale "ghost" chunk holds for about 380 ms, then drains over about 420 ms;
  - the green → yellow → red colours (ruled 2026-10-01) stay.
- **Safety net:** when the queue is idle, the displayed board must equal real state for every entity. In dev, a mismatch logs an error and snaps to real state, so a missed beat can never leave a wrong number on screen.

**Tests.**
- After a 30-damage cast, the HP text reads the old value until the impact, then the new one.
- A mingming looks knocked out only after the killing impact.
- With the queue idle, displayed equals real after:
  - a 3v3 AI turn;
  - Bark absorbing a hit;
  - a heal;
  - a recoil;
  - a DoT kill.

## 189d: Everything that says "hit" moves to the impact

**Build.** At the presenter's impact moment, instead of on `DAMAGE_TAKEN`:
- the damage float, in the element colour (ruled 2026-10-01);
- the shield float;
- `impactCue`, `hitBig`, `kill` and the cry;
- the hit-stop;
- the shake.

Recoil, toll and DoT ticks keep their own sounds and floats, as their own queued beats. The sound spacing ruling (2026-09-25: overlapping sounds are spaced, not cut) still holds through the rate limiter's `step`.

**Hit-stop.**
- It now freezes the clock, so particles **and** sprite motion both stop.
- The target **and** the attacker vibrate during it: 2–6 px, decaying.
- Lengths are the default tier's (Showy):
  - `60 + 80·s` ms, where `s = clamp(sqrt((damage ÷ maxHp) ÷ 0.45), 0, 1)`;
  - **170 ms** on a kill;
  - +20 ms when super-effective;
  - ×0.6 when resisted, and ×0.6 per hit on a multi-target card.

**Shake.**
- Hits under **12%** of the target's max HP shake **only the target sprite**: `4 + 7·s` px, decaying, after the freeze.
- Bigger hits and kills also add camera **trauma**:
  - `0.3 + 0.55·s`, plus 0.25 on a kill;
  - camera shake = trauma² × 14 px × the shake setting, plus up to 1.2° of rotation;
  - smooth noise, not random jitter;
  - trauma decays at 1.6 per second of game time;
  - camera shake never plays during a freeze.
- Resisted hits never shake the camera.
- The shake setting is **60%** (ruled). Ticket 190a makes it a slider; this row uses 0.6.

**Tests.**
- The damage float and the impact sound happen at the impact time, not at play.
- A kill's freeze is longer than a chip's.
- A 6%-of-max-HP hit adds no camera trauma; a 20% hit does.
- No camera offset is non-zero during a freeze.

## 189e: Pacing (cards, enemy turns, battle end)

**Build.**
- **Your card** leaves the lane when its sequence ends. This replaces the fixed `PLAYER_CARD_HOLD_MS`. A card is always gone before the next card's sequence starts.
- **The enemy's card**:
  - arrives;
  - **hovers 1 s so you can read it** (ruled: *"Before makes more sense"*);
  - then its attack plays;
  - then it is discarded.
- **`runAI`**:
  - thinks during the hover, the way ticket 127 overlaps thinking with the pause;
  - dispatches the next action only after `whenIdle()`;
  - replaces the fixed `PLAYED_CARD_REVEAL_MS` pause.
  - The gym's thinking indicator (166f) is unchanged.
- **Battle end**: the victory or defeat stinger and the banner wait for `whenIdle()`, so the killing blow always plays.
- **You can still play cards while the queue is busy.** They queue behind the current sequence, the same as today. Ticket 190's catch-up speed handles a long pile-up.

**Tests.**
- The enemy's action N+1 is not dispatched before action N's sequence has finished.
- The enemy card is on screen for 1 s before its first particle.
- The victory banner appears after the last impact.
- Under Instant, a whole AI turn completes with no waiting.

**Done when:**
- `npm run gate` is green.
- `git diff --stat` shows no file under `src/engine`.
- Henry plays a fight and the hits land where they are drawn.

---

## Decisions for Henry

1. **D1, order against ticket 183.** 189c–e change the plaque and HP bar, and 183b rewrites them. My suggestion:
   - build 189a and 189b any time, since they share no files with 183;
   - build 189c–e **after 183b**, so the new plaque reads the displayed board from the start and nobody rebases a half-finished plaque.
2. **D2, playtest round 2.** Should 189 (and 190) be in the round-2 build? That would make them blockers of ticket 181. My suggestion: 189 yes, because it is most of the "feels off". 190 if it's ready in time.
