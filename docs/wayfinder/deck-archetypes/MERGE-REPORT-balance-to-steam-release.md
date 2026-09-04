# Handoff: `legion/balance` → `steam-release-prep`

**For the agents working on the steam-release branch.** This is what the balance branch changes about
the game and the toolchain, what it does NOT change, and four traps in this repo that cost real time
to find. Read sections 3 and 4 even if you skip the rest — they will bite you otherwise.

31 commits. Engine files touched: `ActionExecutors.ts`, `TacticalAI.ts`, `battleReducer.ts`,
`deckLogic.ts`, `resolutionEngine.ts`, `types.ts`, `damagePreview.ts`, `MingmingUnit.tsx`,
`programs.json`, `hooks.json`.

---

## 1. Behaviour changes you can feel

| ticket | change | measured effect |
|---|---|---|
| **111** | A card can no longer draw **itself** out of its own mid-resolution reshuffle. `handlePlayProgram` puts the played card in the discard *before* its actions resolve, so a 0-cost "draw a card" used to find its own copy and loop forever. | `valkyrie_v2` had 213 `glimmer` plays a game and 43 of 60 games never deciding. Both gone. |
| **113** | `ascension` drops `exhaust`; its 50 power is kept. | `valkyrie_v1` +18.6 field. |
| **115** | Five control cards target the **side** instead of a single enemy: `ice_spear`, `killing_frost`, `numbing_gale`, `rimefrost`, `frost_bite`. **Ships knowingly over band** — see §5. | `panel-control` vs `panel-zoo` at 3v3: **10% → 40%**. |
| **116** | `kraken_v1`'s `ABYSSAL_INK_SYS` dazes the whole enemy side instead of a random enemy. | +20 points at 3v3. |
| **117** | `audhumbla_v2`'s `PRIMORDIAL_MILK` guard `target: SELF` → `source: SELF`. The card says "every heal card Audhumbla **casts**"; the code was checking whether the heal *targeted* her. | 1v1-neutral by construction. At 3v3 an ally healing her no longer fills her Regen battery. |
| **123** | `CARDS_PLAYED` scalers count the **caster's** plays, not the whole side's. All three cards (`stampede`, `serpents_coil`, `seed_bomb_v2`) already said so in their own text. | `stampede` was hitting for 78 off an 11-power card. `triple-sleipnir` vs control 93.3% → 76.7%. |
| **124** | `rimebreaker` pays **one stack of every status it counts**. It read the pile without paying for it, so every cast was bigger than the last. | `draugr_v2` −7.2 field at 1v1. Confirmed twice, on both engines. |
| **125** | The hover preview shows what a card does to the target's **statuses**, diffed out of the same simulated play that produces the damage number. | `hexbloom` previewed nothing at all before — no ATTACK action and no HP lost meant it failed both gates. |

**Ticket 125 has an unverified half:** the chip row in `MingmingUnit.tsx` is test-covered at the data
layer but nobody has looked at it rendering. Worth an eyeball.

## 2. State of balance

`docs/balance/deck_grid.json` is regenerated on the merged build — 960 cells, seed base `grid`, 30
iterations per order. **Roster mean 50.3%, one deck out of band** (`fafnir_v1` at 34.7%, low by 0.3,
deliberately left).

**The merge itself is balance-neutral.** 77 commits of steam-release work moved 30 of 32 decks by
under a point. The only real mover is `draugr_v2` at −7.2, which is ticket 124, not anything from
your side.

### Early access — Nature, Water, Fire

All 12 EA decks are **in band against EA opponents**, subset mean 49.9%. Several read *better* than
their full-roster number because their weak cells are against elements that will not ship:
`kraken_v1` 39.9% → 49.7%, `fenrir_v1` 41.2% → 52.4%, `skoll_v2` 49.9% → 59.1%. Weakest is
`huldra_v2` at 36.0%.

**The one thing to look at before launch:** those three elements are exactly the rock-paper-scissors
triangle — Fire beats Nature beats Water beats Fire — and type advantage is 1.5× with resistance
removed entirely (ticket 35). The result is that **21 of the 120 EA matchups are 0% or 100%**: 17.5%
of the shipping set is decided at character select. In a nine-element roster that is diluted by
neutral pairings; in a three-element one it is the dominant experience. That is a consequence of the
EA scope, not a balance bug, and it may even be desirable — a clean triangle is legible. But if it is
not the intent, **the lever is the 1.5× multiplier, not any individual deck.**

## 3. Four traps in this repo

These cost days to find. None of them announce themselves.

### `tsc --noEmit` typechecks NOTHING

`tsconfig.json` is a solution file — `"files": []` plus two references. The default invocation
resolves an empty program and exits 0. Vitest strips types rather than checking them. **So neither
command anyone reaches for is looking at `src/`.** A live type error sat in ticket 124's code through
a full merge and 1984 passing tests. The real checks:

```
tsc --noEmit -p tsconfig.app.json     # src/
tsc --noEmit -p tsconfig.node.json
```

**Both are clean as of this merge. Worth wiring into the CI workflow this branch just added** —
nothing currently typechecks this repo.

### `vite.config.ts` deletes `process.env` from everything Vite transforms

`define: { 'process.env': {} }` keeps a stray env read from throwing in the browser bundle. The
substitution is textual and fires on **every file vite-node loads**, including `src/`.

Consequences, both fixed here but worth understanding before you write tooling:

- Every scratch instrument was reading its own configuration as `undefined` and silently running its
  defaults. The ticket-114 re-baseline measured `draugr_v2` eleven times over under other decks'
  names and produced a completely plausible CSV — 330 rows, sensible win rates, a field average.
- **`TacticalAI` reads `AI_LITE` / `AI_GREEDY` / `AI_BEAM` the same way**, so tier and beam control
  were dead: every measurement ran at full tier with the beam off no matter what it was asked for,
  and the label on the result still said whatever the harness thought it set.

`scratch/_env.ts` reaches the environment off `globalThis` by a computed key, which leaves no
`process.env` token to match. `scratch/envprobe.ts` verifies both halves — run it if a measurement
ever looks suspiciously like a default.

**New debug CLIs should take flags** (`arg()` in `scratch/_env.ts`), per the convention
`vite.config.ts` states.

### Git cannot delete files through the desktop mount

If you are operating on this repo from a Linux VM mounted onto the Windows checkout: git can *create*
files but `unlink` fails with "Operation not permitted". `merge`, `reset --hard`, `checkout -- .` and
`merge --abort` all half-complete and leave the tree inconsistent. `git add` and `git commit` are
safe because they only write `.git`. Stale `.git/*.lock` files also cannot be removed and block the
next command — move them aside rather than deleting.

**Run merges and resets from Windows.**

### A dead arm reads exactly like a null result

Four times in this arc a measurement "worked", stayed green, and measured nothing: a mutation applied
to a fresh copy that gets discarded (`GetProgramData` inflates per call — mutate `ProgramRegistry`),
an edit to a code path that is never reached, a filter that excluded the very cards it meant to
change, and a field name that did not exist and produced `NaN`. Each returned numbers
indistinguishable from "this lever does nothing".

**Every arm must assert it took effect and throw if it did not**, and where possible measure the
mechanism directly rather than inferring it from a win rate.

## 4. Toolchain notes

- `scratch/pool.mjs` spawns `vite-node`'s `.mjs` entry under `process.execPath`. It used to spawn
  `npx tsx` — `npx` is `npx.cmd` on Windows and Node will not resolve it without a shell, and `tsx`
  is not a dependency of this repo at all, so it was reaching for the network on every lane.
- `scratch/gridshard.ts` takes `--deck` (**required**, throws when absent), `--iter`, `--seedbase`,
  `--shard`, `--shards`. A silent default is what let a broken run look like a finished one.
- Re-baseline: `node scratch/rebaseline.mjs`. Resumable by deck. Fewer lanes may be faster than more
  — each lane pays a full vite-node boot, so startup dominates on short rows.
- Playtest scenarios live in `src/debug/scenarios/playtest/ticket-118/` with a run sheet at
  `docs/wayfinder/deck-archetypes/PLAYTEST-118.md`. `src/debug/scenarios/scenarioFiles.test.ts` walks
  every committed `.scenario.json` through the real load path, so a rotted scenario fails the suite
  rather than the launcher.

## 5. Open items you may inherit

**Shipping over band, deliberately.** The five ticket-115 cards are 87–143% over their cost band. The
scorer multiplies Side scope by ×2.2 — one constant for a quantity that is genuinely 1.0 at width 1
and 3.0 at width 3. Measured, those cards became **0% stronger at 1v1 and ~4.5× stronger at 3v3**.
Every way of paying was measured and defeats the purpose: +1 Energy each gives back 35 of the 45
points at 3v3 *and* costs `draugr_v2` 18.4 at 1v1. **Do not "correct" these back without reading
ticket 119** — the ledger is currently set up to undo a change that works.

Open tickets, in rough priority:

- **119** — the width-blind Side multiplier above.
- **120** — `hexbloom` scores 16.5 against a 5.2–6.5 band *as it ships today*. The four worst
  over-band cards in the pool (`umbral_feast` +397%, `contagion` +214%, `hexbloom` +154%,
  `corrosive_leak` +130%) are all scaling/consume cards, which points at one scorer problem rather
  than four card problems.
- **121** — the cost band needs a stated tolerance. Median absolute deviation across all 208 costed
  cards is 10.0%, so ±15% is ~1.5× the pool's own noise. **Do not use standard deviation** — drawback
  cards score negative (`desperate_strike` −410%) and inflate it to 67.5%.
- **122** — `hraesvelgr_v2` lost 10.3–10.6 points to ticket 111, confirmed on three seed bases. It
  was quietly living on the self-draw bug without ever producing an undecided game. Mechanism still
  unidentified.
- **118** — playtest session: stacked-species comps (`triple-jormungandr` beats the zoo panel 86.7%
  where 25 hand-built stress comps all failed) and whether coverage-based control is fun.

**Not started, from playtest feedback:** Burn/Poison/Regen moving to start-of-turn (needs the
end-of-turn loop extracted so a start pass gets defeat detection and HP-threshold bookkeeping); the
3v2 snowball, which is the absence of any comeback mechanism rather than a resource asymmetry —
`battleReducer` already scales draw from `aliveUnits`, so 7 cards at three bodies, 5 at two, 3 at one;
AI performance, which is slow enough at 3v3 to be a playtest complaint in its own right; and the AI
not prioritising lethal.

## 6. What this merge does not touch

Deck lists, the type matrix, the power curve, the status model, and every element outside the five
ticket-115 cards and the two firmware guards. `mingmingRegistry.ts` is unchanged.
