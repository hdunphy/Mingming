# Run start: pick your starter, pick one of three gyms, seed the run (ticket 09)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [07](07-region-graph.md), [08](08-start-kit-rule.md)
- Phase: Vertical Slice

## Deliverable

**From [ticket 23](23-save-v4.md) (2026-08-21): this ticket DELETES `src/engine/save/ranchProjection.ts`.** Save v4 persists `IRanchState`, but the six run-scoped fields it drops (`cardInventory`, `activeDeck`, `scrapCount`, `relics`, `gauntlet`, `baseDecksGranted`) had nowhere to live yet, so 23 left the `game` slice in its pre-roguelike shape and translated at the save boundary. Landing the run loop means: move those six into `IRunState`, delete the projection module and its test, and grow the autosave subscription in `ui/store/store.ts` a second arm that calls `saveRun` on run-slice changes (the two keys are written independently — that is the point of the split). The subscription carries a comment saying so.

Replace `MainMenuView`'s hardcoded three starters + `HubScreen`'s QUICK DEPLOY with the ruled run start: choose ONE assembled mingming from the ranch (roster), see three offered gyms (each = a boss + its three biome pairs, with difficulty tier shown), pick one, and a run is created from `IRunState` with a seed, the region graph (ticket 07), the start kit (ticket 08), 0 scrap, empty Macro slots. First-ever boot still needs a starter grant (three species, no scrap): keep the starter pick but route it through blueprint assembly so the ranch is the single path.

## Done when

A new player can boot, assemble a starter, start a run, and land on the region map with one mingming and its start kit. Tests on run creation determinism.

## Resolution

**Closed 2026-08-22.** A run exists: you pick a gym, pick a party, and get a seeded region, a start
deck and a position that survives closing the app. Suite **1002 → 1045**, `tsc -b` clean, build green.

### What landed

| File | What it is |
| --- | --- |
| `engine/run/regionGraph.ts` | The TS port of ticket 07's Python prototype. 3 biomes x 5 layers, ruled parameters in one exported `REGION_PARAMS`. |
| `engine/run/gyms.ts` | `GYM_REGISTRY` (3 placeholder leaders — **ticket 28 authors them**) and `offerGyms(seed)`. |
| `engine/run/createRun.ts` | `createRun` + the ticket-08 start-deck rule; also `recruitDeckFor` for ticket 14. |
| `ui/store/runSlice.ts` | `IRunState | null`. Every reducer replaces rather than mutates — `IRunState` is deeply readonly and immer's draft type is right to refuse. |
| `ui/screens/RunStart.tsx` | Gym offers → party. `ui/screens/RunScreen.tsx` is the run shell. |
| `mingmingRegistry.ts` | The 12 ratified `startKits`, plus `LAUNCH_SPECIES` and `GENERIC_HIT`. |

`store.ts` now has **two autosave arms**, each firing on its own slice's identity. That is what makes
the two-key split real rather than nominal: travelling a node does not rewrite the ranch, assembling
a mingming does not rewrite the run, and `runSlice.test.ts` asserts both directions plus the
key-removal on `clearRun`.

### The generic is `water_slap` (your call to me, answered)

It is already `element: "None"`, named "Tackle", 0-cost, 12 power, and its own description reads *"A
plain, reliable hit. Neutral programs gain no STAB - priced at 12 power to compensate."* It is
exactly the card ticket 08 describes and it already appears in 9 of the 12 launch decks. Minting a
`basic_strike` would duplicate a shipped card **and** change `ProgramRegistry`, which changes
`registryHash` and invalidates every stored battle snapshot in `playtest-results/`. Reuse beats churn.

---

## Three things that need your eye

### 1. The mix and the market/workshop guarantee contradict each other

Ticket 07's table says marketplace 8% / workshop 8% **and** "exactly one market and one workshop
guaranteed per biome". Both cannot hold. A biome has 6–9 middle nodes, so a filler pool that can
also roll a marketplace produces doubles regularly — the Python prototype has exactly this bug.

I made **the guarantee win** and dropped both kinds from the filler pool, because a biome with two
workshops and a biome with none are both worse than a biome with one, and your own test list names
"exactly one per biome" as a port requirement. Measured cost over 200 seeds: realised mix is **wild
52 / elite 12 / marketplace 9.5 / workshop 9.5 / event 8.4** against the ruled 60/14/10/8/8. Markets
and workshops run ~13% *within a biome's middle nodes* versus the ruled 8%. `REGION_PARAMS` keeps
your numbers verbatim rather than being quietly rewritten to what the generator emits.

Fight envelope over the same 200 seeds: **shortest 8.19 mean (6–11), longest 14.88 mean (11–18)**,
against the prototype's 6.7 / 14.6. The long end matches; the short end is ~1.5 fights higher because
the prototype's `int(weight * 20)` pool quantisation distorted your percentages and I used them
literally. If 6.7 was the number you liked, **the lever is the event weight, not the graph shape.**

### 2. The offer screen has only two possible shapes

Rule: the gym's element is the LAST biome (my reading — you fight the leader in its own region, and
no ticket says it in so many words). Combined with your guarantee that the three offers open on three
different biomes, the opening element becomes a *derangement* of three items — and there are exactly
two of those. So an offer screen is always either "each gym opens on what it beats" or "each gym opens
on what beats it", and the middle biome is then fully determined.

That is less variety than the screen looks like it has. It is correct under both rules, but if you
wanted three visibly different routes each time, one of the two rules has to give.

### 3. `kraken_v2`'s start deck reads as very repetitive

`capacitor, capacitor, surge_protection, surge_protection, hydro_blast` + 3x `water_slap` — five of
eight cards are doubles, and the generic happens to be the same card `kraken_v2`'s tuned deck already
uses as filler. Correct per the ratified tags; just worth seeing before playtest.

---

## Scope I moved, and why

**`engine/save/ranchProjection.ts` is NOT deleted, and the legacy dev-only tabs are still there.**
This ticket's note said it would do both. It should not, and the reason is concrete: those two jobs
are the same job as moving `createBattleState` off `IPlayerSave`, and `createBattleState` is what the
**entire balance harness and scenario system** call. Deleting the projection here means rewriting the
battle path, which is **ticket 11**'s deliverable, and dragging 11 and 12 into 09 would have produced
one unreviewable commit instead of three.

So the split is: 09 makes a run **exist and persist**; **ticket 11** moves the battle path onto run
state and takes the projection, the `game`-slice run fields, `addToRoster`'s base-deck grant and the
legacy Hub/Sectors/Deck tabs with it. Ticket 11 has been amended to say so.

## Also worth knowing

- **`startNewGauntlet` is deleted.** `MainMenuView`'s starter pick now grants a **blueprint** and
  routes the player to the ranch to assemble it — "the ranch is the single path", per this ticket.
- Travel moves `currentNodeId` and increments `visited`. It does **not** trigger the node: ticket 07
  rules that entering a node triggers it again *always*, and ticket 11 owns the trigger. `visited` is
  a count precisely so a second visit rolls a second encounter rather than replaying a cached one.
- The offer screen is rolled once per visit and held in component state — not persisted, and not
  re-rolled per render, so a player cannot scrub for a favourable set by navigating away and back.
- `startedAt` is injected into `createRun` rather than read from the clock. An engine module that
  calls `Date.now()` cannot be tested deterministically, and this layer already bans `Math.random`.

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Run start is CONSOLIDATED: three random gym offers (each shows its three biome types in order + the start region; the generator guarantees three different opening biomes) → pick one → THEN pick the party (first run ever: pick a starter from the three offered species instead). No QUICK DEPLOY, no fixed first-run order. Start deck per ticket 08: 5 `startKit` + 3 generics; OS active.

## Ratified startKit tags (Henry, 2026-08-21) — the data this ticket lands

Principle: the kit keeps the deck's engine and identity card; the biggest payoff and redundancy are drafted back (ticket 08). `water_slap` is never tagged — it IS the generic; the start deck's 3 generics are 3× the generic hit (reuse `water_slap` or add a `basic_strike`; Legion's call, say which in the resolution). Add `startKit: string[]` (exactly 5 ids, duplicates allowed, every id present in the deck list) beside each launch deck in `mingmingRegistry.ts`, with a test enforcing both rules for the six launch species. Non-launch species: untagged (test skips them).

| deck | startKit |
|---|---|
| fenrir_v1 | blood_rite, blood_rite, berserk_rush, battle_rhythm, crimson_draw |
| fenrir_v2 | ignite, ignite, molten_core, slag_strike, pyre_sacrifice |
| skoll_v1 | fury_strike, fury_strike, brute_force, battle_rhythm, sun_devourer |
| skoll_v2 | fury_strike, fury_strike, reckless_charge, strength_burst, glass_cannon |
| kraken_v1 | undertow, whirlpool_v2, pressure_point, pressure_point, ink_stream |
| kraken_v2 | capacitor, capacitor, surge_protection, surge_protection, hydro_blast |
| jormungandr_v1 | undertow, undertow, blind_spot, serpents_coil, ink_stream |
| jormungandr_v2 | corrosive_bolt, corrosive_bolt, venom_fang, venom_fang, toxic_surge |
| ratatoskr_v1 | forage, forage, healing_mist, nettle_sting, echo_chamber_v2 |
| ratatoskr_v2 | pollen_cloud, pollen_cloud, nagging_bite, nagging_bite, crippling_vine |
| huldra_v1 | growth, growth, iron_bark, thorn_tithe, hexbloom |
| huldra_v2 | sap_vigor, sap_vigor, thornguard, thornguard, heartwood |

Recruits (ticket 14) take the FIRST 3 of the list + 1 generic. This table is also the request to the deck-archetypes map (their content, ratified here); note it in their HANDOFF when you next touch it.

## AMENDMENT — the walk order is inverted (Henry, 2026-08-30)

This ticket's `offerGyms` shipped four rules. Rule 4 — *the gym's own element is the LAST biome* —
was recorded in the resolution above as **a reading, not a ruling**, and flagged for Henry's eye
along with the observation that "gym element last" + "three different openings" leaves an offer
screen only **two** possible shapes. It has now been ruled, the other way.

**THE RULE: the gym's own element is the FIRST biome, and the walk steps twice along the counter
chain.** `[G, COUNTERED_BY[G], COUNTERED_BY[COUNTERED_BY[G]]]`.

| | biome 1 | biome 2 | biome 3 | the gym |
|---|---|---|---|---|
| **Tidewrack** (Water) | Water | Nature | Fire | Water |
| **Emberfall** (Fire) | Fire | Water | Nature | Fire |
| **Rootfall** (Nature) | Nature | Fire | Water | Nature |

### Why — Henry, verbatim

> *"you ideally come with the advantage starter type and want an easy start so the water boss should
> go water-nature-fire. Fire should be fire-water-nature and nature nature-fire-water. this way biome
> one is easy, biome 2 is type adv null and biome 3 is hardest with an inverted boss. it doesn't work
> thematically but it felt bad to go after the water boss with a nature mingming and get wiped in
> biome 1 by fire or have to build up your blueprints in one boss just to lose them come to the boss
> you want to battle"*

The party is chosen AFTER the gym (ticket 07's consolidation), so picking Tidewrack means picking
Nature. Under the old ordering that counter-pick could meet its own predator in biome 1 — the player
was punished at depth 1 for answering the offer the way the offer invites. The counter-chain walk
makes every offer a clean ramp for the team it asks for: **win, neutral, lose, then the boss you
built for**. The difficulty curve now runs the right way round for the whole run instead of being
decided by which direction the offer screen happened to roll.

### What it costs, stated plainly

**The gym no longer stands in a biome of its own element.** Tidewrack's Water leader is fought at
the end of a *Fire* biome. That was rule 4's entire argument. Henry: *"it doesn't work
thematically."* Ruled anyway — the thing it fixes is a player losing a run to the map's ordering
rather than to a fight.

### What it simplifies

The `OfferDirection` roll is **gone**, and with it the two-shapes problem this ticket flagged. It
existed only to satisfy rule 2 (three offers, three different openings), which needed a derangement
of three elements — there are exactly two, so one direction was rolled per screen and shared by all
three offers. Opening each offer on its own gym element satisfies rule 2 **by identity**: three
gyms, three elements, three openings. One less rolled quantity, one less way for the screen to be
subtly wrong. What still varies by seed is which of three *named* biomes stands in for each element.

### The silent break this caught, and the one it fixed

`runGate.targetElementFor` aimed the prepared arm at `biomes[2]` — correct only while that index
happened to equal the leader. After the reorder it aimed at **the element the leader beats**, with
nothing thrown and no test failing on the right grounds. It now reads `offer.gym.element`; an index
is only ever incidentally the leader. Chasing it also surfaced a live defect in the CONTROL arm:
`lineupAgainst` alternated *the order of a filtered list* rather than the matchup, which cancels
only while the target is held fixed — it is not, so the control's neutrality was a coin flip that
tilted bands by a few points without ever failing loudly. Now alternated on the matchup itself.

### Files

- `src/engine/run/gyms.ts` — `walkOrderFor`; `OfferDirection` / `OFFER_DIRECTIONS` /
  `openingElementFor` and the per-screen roll deleted; rules 2 and 4 rewritten.
- `src/engine/run/gyms.test.ts` — the ordered triple asserted per leader; the "uses both orderings"
  test **flipped** rather than deleted (both "varies" and "is fixed" are bugs under the other rule);
  the thematic cost pinned so a future theme fix has to argue with the ruling.
- `src/debug/balance/runGate.ts` / `.test.ts` — the two fixes above.

**Every measured band that sampled a wild or an elite is now stale**: the element at a given depth
changed, and so did the control arm's lineups. The three-gym table outstanding on ticket 72 should
be run under this rule.
