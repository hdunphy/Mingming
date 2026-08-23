# Onboarding-lite: the first fight teaches the fight, the first run teaches the run (ticket 24)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [09](09-run-start.md), [10](10-region-map-screen.md), [18](18-gauntlet-refit.md)
- Phase: Vertical Slice

## Deliverable

Three layers to teach (fight → run → ranch) and no tutorial exists. Vertical-slice scope: (1) a scripted FIRST FIGHT (the `Epic8` "Initiation" idea) with 4–6 contextual callouts — energy, play a card, STAB, end turn, the type chart; (2) first-visit callouts on the region map (types visible, the gym, workshops grow the team); (3) a first-ranch callout on blueprints. Build as a reusable `<Callout>` + a `seenTips` set on the save; everything skippable; reduced-motion honoured. Full tutorialization is re-cut after the first playtest (ticket 25).

## Done when

A tester who has never seen the game completes a first fight without help from Henry (measured in ticket 25).

## Resolution

**Closed 2026-08-22.** The three layers each say one thing at the moment it becomes true, the player
can stop them for good with one click, and the first fight of a first run can no longer be a tuned
elite. Suite **1480 -> 1514**, `tsc -b` clean, build green with `[assert-no-debug] OK`.

---

### THE TICKET'S ASSUMPTION WAS WRONG, AND HERE IS WHAT REPLACED IT

The deliverable asks for *"a scripted FIRST FIGHT (the `Epic8` 'Initiation' idea)"*. Epic8's
Initiation cannot be built any more, and not for a small reason: its defining mechanic is the
**scripted counter** — *"this opponent's element is always the weakness of the player's chosen
starter"* — and since ticket 07 the biome's element **is the promise the map makes**
(`encounterSpeciesPool`). The biome was chosen by the player two screens earlier on the gym offer.
An opponent whose element is picked to counter them is an opponent the map lied about. Epic8 also
puts the Initiation in a Training Hub, which `vision.md` deleted along with sectors.

**So the first fight is not scripted content. It is a floor**, made of rules that already existed:
when the run carries the `onboarding` modifier and `fightsResolved === 0`, the enemy is pinned to
`KIT_FRACTION_BY_BIOME[0]` (the same eight cards the player is holding, no firmware) and to **one
body**. Nothing else about the roll changes — same seed, same species pool, same IVs. Where the node
was already gentle the two rolls are byte-identical, and a test asserts exactly that so the floor
cannot quietly become a second difficulty curve.

**Why it needs to exist at all — this is the finding.** A brand-new player's first step is *not*
guaranteed to be a gentle wild. `generateRegionGraph` assigns biome-0 layer-1 kinds from the shuffled
`[marketplace, workshop, ...weighted pool]` list, and that pool contains **`elite`** — which
`kitFractionFor` gives the FULL tuned per-OS deck *regardless of depth*. So the first fight of the
game could be one mingming holding 8 cards against a complete tuned list. An `ambush` there is two
enemies against your one. Either is a run ended by the map roll before the tutorial finished its
sentence.

**FLAGGED READING, cheap to reverse.** Whether the first fight should be softened *at all* is a
design call, not an implementation one — the opposite reading is that a roguelike's first fight is
whatever the seed says it is, and losing it teaches that too. Deleting `isOnboardingFight` and the
two `onboarding ?` expressions in `rollEncounter` reverts it completely; nothing else reads the
modifier. **The alternative fix, if you would rather the map never produce that fight in the first
place, is one line in `generateRegionGraph`** pinning biome-0 layer-1 kinds to `wild` — but that
changes the map for every run forever, which is a bigger ruling than this ticket should make.

---

### One piece of state, both halves

`IRanchState.seenTips: string[]`, `.default([])` on `RanchStateSchema`, **no version bump** — a v4
save written before the field existed is a player who has seen no tips, which is what the default
says. It is a **ranch** field, not a run field: a player who dies in biome 0 has still been taught
what energy is, and teaching them again on the next attempt is the thing tutorials are hated for.

The same field decides the softened fight: `RunStart` passes `onboarding: !seenTips.includes(
'battle:energy')`. **So "Skip tips" turns the easier first fight off too.** That falls out of tying
both halves to one piece of state, and it is the right way round: a player who says they do not need
teaching is not quietly handed an easier fight anyway.

Stored as loose strings rather than a `TipId` union, deliberately — the save has to survive a build
that renamed or retired a tip, and a union in the schema would fail the whole parse on an id this
build has never heard of. A test feeds it `battle:whatever-we-called-it-in-june` and asserts the
sequence is unmoved.

### Nine tips, and the predicate is the honesty

`engine/tips.ts` holds the copy AND the moment each line becomes true, pure, in one place. The split
is what makes onboarding testable at all: **there is no way to test a tip's appearance in this repo**
(no `@testing-library/react` — a lockfile change is forbidden — and `renderToStaticMarkup` runs no
effects, so "click Got it and see the next one" is not a test anyone can write). `tips.test.ts`
tests the sequence exhaustively instead; the untested link is reduced to one `onClick` line.

Each surface asks for *the first unseen tip whose moment has arrived*, in a fixed order — a priority
list, not a queue, so nothing is blocked behind a tip that is still waiting. Five callouts stacked on
a first fight is not onboarding, it is a EULA.

- **Fight (5):** energy -> play a card -> STAB -> the type chart -> end turn. STAB waits until a card
  in hand could actually STAB for someone on the field; the matchup tip waits until a non-neutral
  pairing is really on screen (read out of `ElementalMatrix`, not a copy of it). Nothing fires while
  the enemy is acting — a callout that appears mid-enemy-turn reads as a comment on what the enemy
  just did.
- **Map (3):** types are visible before you step -> the gym is the run -> workshops grow the team.
  The workshop tip waits until a workshop is **one step away**; every biome has exactly one, so
  "there is a workshop somewhere" would be true from the first frame and would teach nothing.
- **Ranch (1):** blueprints are what a run leaves behind. On the assembly tab, where the sentence is
  actionable.

**Two orderings changed from the ticket's list.** The ticket says "energy, play a card, STAB, end
turn, the type chart"; the type chart moved ahead of END TURN because a matchup is worth knowing
while you still have energy to act on it. And `battle:endturn`'s moment is *"you have played a
card"*, not *"you cannot afford anything"* — the honest version of the second one is
`getEffectiveCardCost` over every (card, caster) pair on every render, which is real work to answer
a question the greyed-out cards already answer on screen. So the tip's sentence was rewritten to
match the moment it does fire: energy does not carry over.

### The callout is a strip, not a coach mark

Costed and rejected in the open. Anchoring a bubble to the energy pips means hand-rolled
`getBoundingClientRect` plus resize/scroll listeners (no positioning library, no lockfile change),
landing a floating element in the one layout whose arithmetic ticket 22 tuned to the pixel — and a
measured position is a position **no test in this repo can ever see**. The strip earns "contextual"
the other way: the *moment* is contextual, and the sentence names the thing in words ("the pips under
its name") instead of pointing at it.

The battle strip is `position: absolute` against `.console-area`, so it costs the console none of the
30px of vertical slack ticket 22 measured. Reduced motion is honoured twice — the entrance class is
withheld when `prefersReducedMotion()` is true, and a `@media` block covers a preference that changes
after mount.

Battle callouts render **only inside a run**, `MacroRack`'s rule for `MacroRack`'s reason: a debug
scenario is not a player's first fight, and burning a once-ever tip on one means the real first fight
never gets it.

### Small things worth knowing

- `RegionMap` still takes props and touches no store — the map callout sits in `RunScreen` above it,
  so the map keeps the property that its test renders it with no `<Provider>` at all.
- **No `unseeTip` reducer.** Replaying the tips is a debug affordance, not a player one. It is also
  the one thing ticket 25 will want on the day (watch a tester, reset, watch another): today that
  means `resetSave`, and a one-button "replay onboarding" belongs with the run-editor panel the
  debug-toolkit map still needs.
- Seven test fixtures gained `seenTips: []`, and three "the ranch has exactly these keys" assertions
  gained the field. Those three are the guard that made this a five-minute change instead of a
  silent one — they are worth keeping.

### RE-RULED 2026-08-23: the opening fight is scripted in EVERY run, and Skip tips no longer touches it

Two corrections from Henry, and the second one simplifies the first out of existence.

**"skip tips doesn't fix the first fight."** The flagged reading above tied the softened fight to
`seenTips`, so pressing *Skip tips* silently made your opening encounter harder. That coupling is
gone — not patched.

**"it's fine to script the first encounter to an easy fight like slay the spire."** Slay the Spire
draws Act 1's opening encounters from a separate easy pool **every run**, not only a player's first,
and adopting that wholesale is what removes the machinery:

- `ONBOARDING_MODIFIER`, `createRun`'s `onboarding` input and `tips.FIRST_BATTLE_TIP_ID` are all
  **deleted**. No flag, no modifier, no save field, no coupling.
- `isOnboardingFight` becomes **`isOpeningFight(run)` = `run.fightsResolved === 0`**. Three lines.
- The floor itself is unchanged: one enemy, holding `KIT_FRACTION_BY_BIOME[0]`, everything else
  identical — same seed, same species pool, same IVs.

**And the other half of the Slay the Spire model landed too: the first *step* is now always a
fight.** `generateRegionGraph` pins biome 0's layer 1 to `wild` (`REGION_PARAMS.scriptedOpeningLayer`),
so the opening move out of the entry can no longer be a marketplace you have no scrap for — or the
biome-0 elite, which is the finding this ticket reported. Pockets are untouched: a pocket shares its
host's layer and can still be an alpha, but it hangs off a middle node rather than the entry, so it
can never be the first step. The test asserts over the entry's neighbours for exactly that reason.

The market/workshop guarantee survives the pin (it displaces 2-3 of a biome's 6-9 middles, and the
two guaranteed kinds are placed first into what is left) and a test now pins that too.
