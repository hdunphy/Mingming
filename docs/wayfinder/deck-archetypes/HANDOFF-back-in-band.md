# Handoff — the roster is out of band, and card COST is why

Paste everything below the line into a fresh agent session working in the Mingming-Balancing repo.
It is self-contained: the agent needs no other context, and every number in it is reproducible from
a command in the last section.

---

You are picking up a **balance investigation** on branch `legion/ai-perf` in
`C:\Users\hdunp\Documents\GameDev\Unity\GitHub\Mingming-Balancing` (React 19 / TypeScript / Vite /
Redux Toolkit Norse roguelike deckbuilder; headless engine in `src/engine`, UI in `src/ui`,
balance instruments in `src/debug/balance` and `scratch/`).

The previous agent was called **Legion**. Everything below is what Legion knows. Read all of it
before touching anything — several of the environment notes will cost you hours if you rediscover
them the hard way.

---

## 1. Where things stand in one paragraph

Three feel-driven changes shipped in tickets 131a–131e: every mingming draws **+1 card** (hand cap
9 → 15), every mingming got **+50% HP**, and all health and damage numbers were multiplied by
**10**. They fixed the two things Henry said felt bad. They also **doubled the spread of the deck
roster**: the 1v1 grid went from mean 50.3 / sd 9.2 / 31 of 32 decks in band, to mean 49.9 / sd
19.4 / 22 of 32 in band. The level is fine; the shape is not. Legion then measured five
economy-wide knobs to pull it back in, and **all five failed** — four did nothing to the spread and
the fifth overshot so violently it reduced three decks to single-digit win rates. Henry has been
given four options and **has not yet chosen one**. That choice is the live decision. Do not start
building until he picks.

---

## 2. What changed and why the roster moved

This is the mechanism. If you understand nothing else here, understand this, because every failed
knob failed for the same reason.

**Before ticket 131, the game was card-limited.** Henry's words: *"I seem to always play all my
cards and often have an energy left over. The strategy then becomes what order instead of which
cards to play."* When cards are the scarce resource, a 2-energy card is not much worse than a free
one, because you were never getting to a fourth play anyway. What separated decks was **card
quality**.

**After ticket 131, the game is energy-limited.** +1 draw per body is +3 cards a turn at 3v3, and
the hand cap went to 15, so you now hold more cards than you can pay for. When energy is the scarce
resource, a 0-cost card is strictly better than a 2-cost card of equal power, because you cast
three of them instead of one. What separates decks is now **card cost**.

The grid measured this independently, before any of Legion's arms ran:

| predictor | correlation with how far a deck moved |
|---|---|
| average card cost | **r = −0.568** |
| 0-cost share of the deck | **r = +0.571** |
| percentage-denominated share | r = +0.298 |

The first two are the same signal seen from both ends, and they are the strongest signals on
record. The zoo decks are **not** a special case — Henry's instinct was that they were, and the data
says they are simply among the cheapest decks in the game, so they caught the biggest tailwind.
Nerfing three decks will not fix an economy-wide shift.

### The draw change is non-negotiable

Henry, verbatim, after Legion pushed back on it three times:

> *"Going back to the old card draw is non-negotiable... stop trying to get me to remove the extra
> card draw. It doesn't make sense to limit the 3v3, they need the card draw more. I'm telling you
> it feels bad to play when you have energy on the table. Feel always carries more weight than
> decisions or numbers we picked in the past. If the game feels bad to play then no one will buy it
> or play the game."*

Do not propose reverting the draw, the hand cap, or reducing either. It has been ruled on. Any
solution has to work *with* an energy-limited game, not by undoing it.

---

## 3. The five knobs Legion measured, and why each failed

All arms ran on the ten decks that moved furthest — five from each tail — so a knob that only helps
one side shows as one-sided instead of averaging out to "no effect." 1v1, beamless, 30 iterations
per matchup, every deck against the full opponent field. Every arm asserts its change took effect
and throws if it did not.

| deck | before 131 | now | +1 energy | −15% cheap attacks | ÷1.5 % effects | 0e → 1e |
|---|---|---|---|---|---|---|
| ratatoskr_v1 | 40.7 | **75.3** | 68.6 | 74.5 | 77.8 | **7.0** |
| huldra_v1 | 62.1 | **91.8** | 83.4 | 91.5 | 92.2 | **90.6** |
| jormungandr_v1 | 45.8 | **74.6** | 72.7 | 69.1 | 77.1 | **2.6** |
| nidhoggr_v1 | 52.3 | **78.5** | 68.3 | 81.0 | 81.7 | **79.7** |
| sleipnir_v1 | 56.8 | **72.4** | 71.1 | 72.0 | 74.7 | **1.2** |
| ymir_v2 | 66.4 | 42.1 | 19.9 | 46.4 | 46.8 | 63.3 |
| fafnir_v2 | 38.5 | 17.8 | 19.0 | 15.6 | 20.1 | 26.0 |
| nidhoggr_v2 | 53.8 | 35.3 | 26.0 | 33.8 | 32.9 | 33.5 |
| fafnir_v1 | 34.6 | 19.0 | 28.1 | 21.4 | 22.1 | 23.6 |
| sleipnir_v2 | 56.4 | 41.4 | 38.9 | 28.6 | 46.6 | 71.9 |
| **mean** | 50.7 | 54.8 | 49.6 | 53.4 | 57.2 | 39.9 |
| **spread (sd)** | **10.0** | 25.3 | 24.1 | 26.0 | 25.2 | **31.9** |
| **in band (35–80)** | **9/10** | 7/10 | 5/10 | 4/10 | 5/10 | 3/10 |

The band is **35–80**, defined at `scratch/rebaseline.mjs:124`. Use that one. Legion's first draft
of ticket 134 used 35–65 from memory and reported much lower counts; the ranking of the arms was
unchanged but the absolute numbers were wrong.

**Nothing beat leaving it alone.**

**`ENERGY` (+1 maxEnergy on every unit) — actively harmful.** The theory was that expensive decks
now draw cards they cannot pay for, so give them the energy. The reality is that the *cheap* decks
had more cards in hand to spend it on, so it amplified exactly the advantage it was meant to
offset. ymir_v2 went 42.1 → 19.9.

**`CHEAPNERF` (−15% power on every 0e and 1e ATTACK, 89 cards) — missed entirely.** ratatoskr
75.3 → 74.5, huldra 91.8 → 91.5. The decks that are winning are cheap **utility and sustain** decks
— heals, Regen, Poison, status — not cheap aggro. There was almost no cheap attack power in them
to cut. If you retry anything in this family, it has to scale non-ATTACK actions too.

**`PCTNERF` (heal power ÷1.5, `BURN_CONFIG.tiers[].damagePercent` ÷1.5, 28 things) — shifted the
level, not the shape.** The theory was sound and the underlying observation is a real bug worth
fixing on its own: damage does **not** read `maxHp`, but heals (`maxHp × power / 400`) and
Burn/Poison (`damagePercent × maxHp`) do, so the +50% HP buff silently buffed every heal and every
damage-over-time relative to every attack. Measured, a 40-power attack went from 10.4% of a health
bar to 6.9% while a 30-power heal stayed at 7.5% — attack:heal fell from 1.39 to 0.92. Dividing the
percentage effects back out raised the whole panel by ~2.4 points and changed the spread from 25.3
to 25.2. **65 of 223 cards are percentage-denominated.** Fix it for correctness; do not expect it
to fix the band.

**`BIGDISCOUNT` (−1 cost on every 3e+ card) — a dead arm, and the dead arm is the finding.** Only
**12 of 223 cards in the game cost 3 or more**, and exactly one of them appears anywhere in the
ten-deck panel. Legion killed the run once that was clear. See §4.

**`ZEROCOST` (every 0-cost card becomes 1-cost, 40 cards) — the only knob with real force, and far
too much of it.** Seventy-point moves: ratatoskr 75.3 → 7.0, jormungandr 74.6 → 2.6, sleipnir_v1
72.4 → 1.2. It lifted the losing tail as intended (sleipnir_v2 41.4 → 71.9, ymir_v2 42.1 → 63.3)
but left two of the five winners untouched, so the spread got **worse** (25.3 → 31.9).

---

## 4. The two things the failures uncovered

### 4a. The cost curve has almost no top end

| cost | cards | share |
|---|---|---|
| 0 | 40 | 18% |
| 1 | 101 | 45% |
| 2 | 66 | 30% |
| 3 | 11 | 5% |
| 4 | 1 | 0% |
| non-numeric | 4 | 2% |

**93% of the game costs 0, 1 or 2 energy.** Across the ten-deck panel the average card cost runs
from 0.67 to 1.50 — that is the *entire* spread of "cheap deck" versus "expensive deck" in this
game.

While cards were scarce that flatness was invisible, because cost was not the binding constraint.
Now that energy is scarce, cost is the main axis of the game, and the main axis has three notches
on it. That is why a flat +1 on 0-cost cards is a 70-point swing: on a curve that only runs 0–2,
+1 is a 50% cost increase applied to a fifth of the game at once. **There is no gentler version of
that knob available, because there is nothing between the notches.**

### 4b. There are two different kinds of winner, and only one is a cost problem

The `ZEROCOST` arm separates them cleanly. Deck profiles:

| deck | cards | avg cost | 0e | 1e | 2e | 3e+ | % denominated |
|---|---|---|---|---|---|---|---|
| ratatoskr_v1 | 11 | 0.73 | 6 | 2 | 3 | 0 | 27% |
| huldra_v1 | 9 | 0.67 | 4 | 4 | 1 | 0 | 56% |
| jormungandr_v1 | 9 | 0.67 | 4 | 4 | 1 | 0 | 11% |
| nidhoggr_v1 | 10 | 0.90 | 4 | 3 | 3 | 0 | 80% |
| sleipnir_v1 | 12 | 0.67 | 5 | 6 | 1 | 0 | 0% |
| ymir_v2 | 10 | 1.50 | 0 | 5 | 5 | 0 | 0% |
| fafnir_v2 | 10 | 0.90 | 3 | 5 | 2 | 0 | 40% |
| nidhoggr_v2 | 10 | 0.90 | 5 | 1 | 4 | 0 | 50% |
| fafnir_v1 | 11 | 0.82 | 6 | 2 | 2 | 1 | 0% |
| sleipnir_v2 | 8 | 1.00 | 1 | 6 | 1 | 0 | 0% |

**Group A — cheap-tempo decks, annihilated by a cost change.** ratatoskr_v1 (6 free cards of 11),
jormungandr_v1 (4 of 9), sleipnir_v1 (5 of 12). These win *because* the cards are free. Pure cost
problem, and they respond violently to a cost lever.

**Group B — 1-cost sustain decks, immune to all five knobs.** huldra_v1 sat between 90.6 and 92.2
under every single arm; nidhoggr_v1 between 68.3 and 81.7. They have few free cards and are 56% and
80% percentage-denominated. They win on card quality across the longer games the HP buff created,
and **no cost lever touches them.** Whatever gets built, Group B needs its own treatment.

**Being cheap is not sufficient to be a winner.** nidhoggr_v2 has 5 free cards and scores 35.3;
fafnir_v1 has 6 and scores 19.0. Cost predicts how far a deck **moved**, not where it **ended up**.
Where it ended up is still mostly about the cards themselves. Do not conflate these two questions —
Legion nearly did.

---

## 5. THE LIVE DECISION — Henry has not chosen yet

Four options were put to him. **Do not start building until he picks one.** Ranked as Legion
ranked them:

**Option 1 (recommended) — widen the cost curve, then re-cost per deck.** Add a real 3–4 energy
tier so cost has somewhere to go, and move Group A's free cards up into the space that creates.
The only option that fixes the root cause. It also serves the feel goal directly: a genuinely
expensive card is what makes a full hand a *decision* instead of a play-everything sequence, which
was Henry's original complaint. Roughly 20–30 cards of real design work plus a re-baseline. This is
ticket 114 territory.

**Option 2 — leave the economy alone, hand-cost the ten named decks.** Cheapest path to a tight
band, about a day. Group A gets +1 on a *subset* of its free cards, never all of them (that subset
is the whole difference between a fix and the 70-point overshoot). Group B gets its sustain priced
against the longer games. Does not fix the flat curve, so the next content drop reopens it.

**Option 3 — roll the HP buff from +50% back to +25%.** Untested. `HP_MULTIPLIER` is a
compile-time const in `src/engine/types.ts`, so Legion could not run it as an arm without patching
source mid-comparison. Worth measuring: shorter games specifically hurt Group B, whose whole
advantage is grinding a long game with sustain. Costs some of the feel win, but only half of it.

**Option 4 — fix percentage denomination as its own correctness ticket, not as a band fix.** 65 of
223 cards priced against a health bar that just grew 50%, and it will silently reprice them again
every time HP changes. Do this regardless of which of 1–3 he picks.

Henry was also asked, and has not answered: **does he want the 3v3 numbers before deciding?**
Everything above is 1v1, the game ships 3v3, and at 3v3 the driving mechanism is **three times
stronger** (+1 draw per body is +3 cards a turn). Legion expects the same ranking with bigger gaps
but has not measured it. About four hours of machine time; nothing else blocks on it. **If Henry is
away and you need something useful to do, this is the job** — run the panel at 3v3 and report.

---

## 6. Other open tickets, in the order Legion would take them

- **Ticket 128, UI half — the highest-value open bug.** At 3v3 the deck is shared across the party
  and `BattleArena` **persists the caster selection between plays**, so a card cast off the wrong
  body pays nothing. **16 of 33 firmwares gate on `source: SELF`**, so all 16 look broken. This is
  the "fenrir_v2 doesn't gain any Sharp" bug Henry hit mid-run. The engine half is proven correct
  and pinned by `src/engine/cinderWall.test.ts`, which also documents the two silent ways a working
  firmware shows nothing: **Dazed ate the stack** (duality cancels Sharp against Dazed before the
  behaviour runs — the log line *"feeds on the flames"* still prints, which is the discriminator),
  or **the wrong body cast it** (no log line at all). The fix is UI: make the caster unmistakable
  at 3v3, and reconsider persisting the selection.
- **Ticket 133 — `dawns_respite`.** It heals 6.25% and costs 6%, so repeat-playing it is free
  value. Recommendation on file: heal power 25 → 24, which makes it exactly 6%. Needs Henry's yes.
- **Ticket 130 — daemon pricing.** Three separate defects: `EXPECTED_DAEMON_PROCS = 4` is a flat
  guess (measured is 0.75/turn per unit); the `if (score === 0)` guard voids a daemon's hook value
  entirely if it has any actions at all; and `DRAW` is priced at 15, which was wrong before the
  hand economy changed and is badly wrong now.
- **Steam-release ticket 39 — Web Worker for the AI.** Ticket 127 took a 3v3 enemy decision from
  1320ms to 569ms, but the target is a 1.0s p95 and the search is still synchronous on the main
  thread. 569ms is under the bar only on average.
- **Henry's playtest** of the shipped feel changes is still outstanding. HP stays at +50% for it.

---

## 7. How Henry works — these are not suggestions

- **He does not read tickets.** Every report has to carry its full context in plain language, in
  the message itself. He said this directly: *"recently you haven't been very clear. Please
  highlight what decisions do you need from me, and make sure to include the proper context with
  simple English. Don't give me too much information using shorthand."* End every report with an
  explicit, numbered list of the decisions you need from him.
- **Feel beats numbers.** See the quote in §2. If a balance fix makes the game feel worse, it is
  not a fix.
- **No arbitrary caps.** When something needs to trigger less, find a **condition** that makes it
  fire less often. Do not bolt on a cap.
- **Numbers move in 5s.**
- **He reviews every deck list and card change before it hits the registry.** Do not commit a
  balance change to `programs.json` or `mingmingRegistry.ts` without showing him the change first.
- **One commit per ticket**, authored as Henry:
  ```
  git -c user.name="Henry Dunphy" -c user.email="hdunphy15@gmail.com" \
      commit --author="Henry Dunphy <hdunphy15@gmail.com>" -F <msgfile>
  ```
  He asks for changes to be committed **one at a time** so he can review and revert individually.
- **Check the branch before every commit.** `legion/ai-perf`. There has been at least one other
  agent working in this branch.
- **Every measurement arm must assert its change took effect and throw if it did not.** This is
  ticket 103's dead-arm rule and it has caught real silent no-ops in this arc — twice.
- **Never deliver a whole file from a stale copy.** Re-read before writing.
- **Ship gates:** `npx vitest run` green (2127 tests), `npx tsc -b`, `npx eslint`.

---

## 8. Environment traps — read this section twice

These will each cost you an hour if you meet them cold. All of them are confirmed by experience in
this arc, not theory.

**`npx tsc --noEmit` typechecks NOTHING.** `tsconfig.json` is a solution file: `"files": []` plus
project references. It exits 0 on a repo full of type errors. Use `npx tsc -b`, or point at
`tsconfig.app.json` / `tsconfig.node.json` explicitly.

**Under `vite-node`, environment variables reach module code by no route at all.**
`vite.config.ts` has `define: { 'process.env': {} }` and vite-node hands the module an empty bag,
so `process.env.FOO=bar npx vite-node script.ts` silently sees nothing. The workaround every
instrument in `scratch/` uses: write onto `globalThis.process.env` through **computed keys** (so
the define cannot statically substitute them), then `await import(...)` the engine *after*:
```ts
const P = 'process', E = 'env';
const penv = ((globalThis as any)[P] ??= {}); ((penv[E] ??= {})).AI_BEAM = '0';
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
```

**Mutating card data after the registry loads is a silent no-op.** `GetProgramData` inflates a
fresh object per call. Any arm that changes card data must mutate the raw `programs.json` import
**before** the registry module is first imported. That is ticket 103's trap and it is why every arm
in `scratch/bandarms.ts` does its mutation at the top of the file.

**Git cannot unlink through the desktop mount.** `git add` and `git commit` work. `git merge`,
`git reset --hard`, `git rebase --skip`, `rm -rf` and `tar x` over existing files all
half-complete and leave the tree wrong. **Run merges and rebases from Windows, not through the
bridge.** To overwrite a file in place, extract to a staging dir and `cat src > dest` — truncate in
place rather than replace.

**Stale `.git/*.lock` files must be moved INSIDE the mount.** `mv .git/index.lock /tmp/x` looks
like it works and does not: crossing a filesystem makes `mv` a copy-then-unlink, and the unlink
fails. Move them to a directory inside the repo:
```
mv .git/index.lock  _to_delete/locks/l$(date +%s%N)
mv .git/HEAD.lock   _to_delete/locks/h$(date +%s%N)
```
Check for **both** — a stale `HEAD.lock` from an earlier commit blocked a commit in this session
and the error message only mentions "another git process". Every git command through the mount also
prints `unable to unlink ... Operation not permitted` warnings; those are noise, the command still
succeeded. Judge by the exit status and by `git status`, not by the warnings.

**Mixed line endings, per file AND per region.** `programs.json` has both CRLF and LF regions.
`git show` outputs LF regardless. Detect a file's dominant ending before writing it, or you will
land a four-line change as a 14000-line diff. `deck_grid.json` is 100% CRLF —
`scratch/promotegrid.mjs` normalises back to CRLF on write for exactly this reason.

**A stale staging directory once overwrote `deckLogic.ts` back to a previous value mid-commit.**
Always read `git status` before committing, not after. Legion left `_to_delete/` in the repo root
holding old staging dirs and parked git locks; `device_bash` cannot delete, so Henry has to remove
that folder from Windows.

**Backgrounding a long run:** the tool timeout kills the process group if you launch and sleep in
the same call. Use `setsid nohup ... < /dev/null &`, then poll in later calls.

**Henry's local `node_modules` is broken** — rollup's native binding is missing, so `vite-node`
will not start on his machine. Run instruments in your own container against a copy of the repo.
Plain-node scripts with no dependencies (like `scratch/promotegrid.mjs`) *do* run on his machine.

---

## 9. Reproducing every number here

```bash
# the five arms (each prints how many things it changed, throws if zero)
npx vite-node scratch/bandarms.ts -- --arm ENERGY      --iter 30
npx vite-node scratch/bandarms.ts -- --arm CHEAPNERF   --iter 30
npx vite-node scratch/bandarms.ts -- --arm PCTNERF     --iter 30
npx vite-node scratch/bandarms.ts -- --arm ZEROCOST    --iter 30
npx vite-node scratch/bandarms.ts -- --arm BIGDISCOUNT --iter 30   # dead arm, only 12 cards

# the full 32-deck grid (~20 min on 2 lanes, resumable by deck)
node scratch/rebaseline.mjs --iter 30

# promote a completed re-baseline into docs/balance/deck_grid.json
node scratch/promotegrid.mjs --dry-run    # prints the field summary, writes nothing
node scratch/promotegrid.mjs
```

Each arm takes roughly 25–40 minutes for the ten-deck panel. Run them detached and poll.

### Commits in this arc, newest first

```
1e6974c  ticket 132: promote the re-baseline into deck_grid.json - 772 of 960 cells moved
2f0757d  ticket 132: the grid re-run - half the roster is out of band, and card COST is why
019d6f5  tickets: close out the 131 arc, and open 132 and 133
1f69e37  ticket 131c: every damage and health number x10, and three bugs the old rounding hid
c772cd1  ticket 131e: feedback_loop_daemon drops to 1 energy and its proc goes to 7 power
43994f8  ticket 131d: hand cap 12 -> 15, and it is what put the turn count back
7220ce1  handoff: the whirlpool / draw / HP / number-scale arc
4b083ff  ticket 131b: +1 card draw and +50% HP for every mingming, hand cap to 12
fd720af  ticket 131a: whirlpool_v2 keeps its power and gains 1 Dazed
6a05ae2  tickets 128-131: the measurements behind the whirlpool, draw, HP and scale rulings
1cfffd9  ticket 127 part two: the beam is on in the game, and the wait shows you the card
06991f5  ticket 127: the enemy turn costs 16s at 3v3, and 5.4s of it was paid twice
```

### Reference formulas you will need

```
damage      statusPower   = powerPerStack * ((Str - Weak) + (Dazed_target - Sharp_target))
            effectivePower= max(0, power + statusPower)
            scaled        = floor(8 * effectivePower * atk / def)
            reduced       = (scaled * NUMBER_SCALE) / 45      // 45 is the documented pace dial
            damage        = floor(reduced * modifier)
            -> does NOT read maxHp

heals       maxHp * power / 400                                // DOES read maxHp
Burn/Poison damagePercent * maxHp                              // DOES read maxHp

health      calculateHealth(base, iv)
              = (calculateStandardStat(base, iv) + 15 + 30) * HP_MULTIPLIER * NUMBER_SCALE
            calculateStandardStat itself ends in "+ 5", so the FLAT +50 dominates:
            scaling baseStats.hp by 1.5 only moves final HP by about 13%.

draw        sum(cardDraw) - aliveUnits + 1, clipped by (HAND_SIZE_LIMIT - hand.length)
            -> +1 cardDraw is +1 card at 1v1 and +3 at 3v3

constants   HP_MULTIPLIER = 1.5, NUMBER_SCALE = 10   (src/engine/types.ts)
            HAND_SIZE_LIMIT = 15                     (src/engine/deckLogic.ts)
            GAME_BEAM_WIDTH = 8; the beam is ON in the browser and OFF under Node,
            so every balance number on record is BEAMLESS. Keep it that way, or say
            loudly in the commit that you re-baselined the corpus.
```

### Files worth reading before you touch anything

| file | why |
|---|---|
| `docs/wayfinder/deck-archetypes/tickets/134-back-in-band.md` | the five arms in full, with Henry's decisions |
| `docs/wayfinder/deck-archetypes/HANDOFF-whirlpool-draw-hp-scale.md` | why ticket 131 shipped what it shipped |
| `docs/balance/deck_grid.json` | the promoted post-131 grid. 960 cells, band 35–80 |
| `results/rebaseline/SUMMARY.md` | per-deck deltas, cells moved, zero and 100% cells |
| `scratch/bandarms.ts` | the five arms; the header explains each one's theory |
| `scratch/promotegrid.mjs` | how the grid gets promoted, and what it refuses to do |
| `src/engine/cinderWall.test.ts` | ticket 128's engine half, and the two silent failure modes |
| `src/debug/balance/powerscale.ts` | the static card pricer, and `ASSUMED_MAX_HP` |
