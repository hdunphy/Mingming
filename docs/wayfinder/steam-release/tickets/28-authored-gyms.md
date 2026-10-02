# Authored gym bosses: curated 3v3 teams with signature firmware per biome pair (ticket 28)

> **RE-RULED 2026-09-24 (evening): the guest is the element the gym BEATS — Emberfall fenrir_v2 + sköll_v2 + huldra_v1; Tidewrack = authored TIDAL SURGE (jormungandr_v1 + kraken_v2 + sköll_v2); Rootfall unchanged. Gate: each gym loses to its named counter party more than to the other two. BOSS_COMPS deleted.**

> **2026-09-24 — 28a IS DONE. One comp table: `leaderComp` is deleted and `AUTHORED_BOSSES` is the only one; the scout, the biome element plan and 157's walker all read it. The three trios are re-composed as Henry ruled, canaried first (`results/t28a-canary.txt`). **TWO CONFLICTS CAME OUT OF THE CANARY AND ARE HENRY'S TO RULE ON — see the write-back at the foot of this file.** The remaining 28 work is names, flavour, icons. History below.**

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [18](18-gauntlet-refit.md), [27](27-content-plan.md), deck-archetypes [109](../../deck-archetypes/tickets/109-3v3-pricing-and-canary.md)
- Phase: Content Complete

## Deliverable (sized by ticket 05: THREE leaders at EA launch, one per mono biome; Air's leader is the stretch)

Today's gym leader is `wardenPool[0]` at `maxHp × 1.5` with three generic moves. Author one boss per ruled gym (ticket 27): a named leader, a 3v3 team drawing one species per biome pair of that run (the team is assembled at run start from the three biomes, so "authored" means per-biome candidate lists + the leader's signature firmware), flavour text, a map icon. Difficulty by tier = meaner team + more elites + enemy Drivers, never bigger numbers. Every authored comp runs through `teamComps.ts` canary gates (FTK 0, no stalls) — the comps are designed by Henry with the deck-archetypes method; this ticket integrates, it does not design.

## Done when

All launch gyms authored, canary numbers recorded per boss comp, one session per 2–3 bosses.

## Resolution

_(open)_

---

## 28a — done (2026-09-24), and two things it turned up

### One table

`IGym.leaderComp` is **deleted**. 142b put three firmware ids there as an explicit placeholder and
said so — *"ticket 28 should overwrite these with the authored teams"* — and it never did, so the
game carried two gym comp tables that disagreed **at every gym**: `AUTHORED_BOSSES` is what the
gauntlet fields, `leaderComp` is what the scout previewed. A free look at a team the gym does not
field is worse than no free look, because the player has no reason to distrust it.

`gyms.gymLeaderFirmware(gymId)` is the one accessor now, and the three consumers that have to agree
all call it: `gymCompElementPlan` (the approach biome's elements), `encounter.scoutFirmwareFor` (the
preview), and 157's walker when it recruits toward the gym. **The way two tables came to disagree in
the first place was that each consumer read whichever one was nearest**, so the fix is the accessor
rather than a copy-paste.

`pathAndScout.test.ts` gains the assertion that was never there: the preview equals what the gauntlet
fields, at every gym. It also pins 28a's composition rule (two own-element bodies + one guest) and
that **no OS is fielded at more than one gym** — 72's own *"the same OS at two gyms makes the roster
read as a pool"*, which was not true before today.

### The trios, and the canary

`results/t28a-canary.txt` — the REAL gauntlet boss fight (`rollGauntletFight`, so `BOSS_IVS` and the
gym's Driver are in), each trio against the counter party its own doc comment names, 3 iterations,
**beam 0** (§157's calibrated setting; the encounter's own beam costs minutes a battle and put six
cells at four hours).

| gym | arm | boss win% | turns | FTK | stall |
|---|---|---|---|---|---|
| Emberfall | before | 0% | 2.0 | 0 | 0 |
| Emberfall | **after** | **0%** | 3.0 | 0 | 0 |
| Tidewrack | before | 33% | 4.3 | 0 | 0 |
| Tidewrack | **after** | **100%** | 3.3 | 0 | 0 |
| Rootfall | before | 100% | 4.3 | 0 | 0 |
| Rootfall | **after** | **100%** | 3.0 | 0 | 0 |

**Both gates pass everywhere: FTK 0, no stall.** n=3 at beam 0 is a smoke read and the ticket says so
of n=10; what it is good for is direction, and the direction is clear.

### DECISION 1 — Tidewrack re-creates the two-engine fight ticket 74 dismantled

The ruled trio is `jormungandr_v1 + kraken_v1 + ratatoskr_v1`. **`kraken_v1` is the body ticket 74
removed from this gym**, because the trio was *"two card-count-and-draw engines plus a closer"*:
research/73 measured that fight at **30.0% against a ~84.3% per-fight guide** and found the cause was
the FLOW rather than the payoff's printed power (a 64% cut to `ink_stream` bought 13 points and did
not clear, p = 0.22).

Measured on the tree as it stands: **the pile holds two `ink_stream` again**, and both engines are on
the field to read their own draws. The canary reads **33% → 100%**.

What is genuinely different is the collection, not the composition: `undertow` costs its caster a
Weakened since 152, and the v2 kits are not the v1 ones. Whether that is enough is exactly the
question, and it is not one an implementation should answer. `tidalSurge.test.ts`'s row was rewritten
to assert the RETURN with the count rather than deleted, so this cannot go quiet.

**Shipped as ruled, flagged here.** The cheap next step is the same canary at n=10 on the two
Tidewrack arms.

### DECISION 2 — ruling 3's odd-member clause now holds at one gym of three

Ticket 68 ruling 3: *"the third slot exists to counter the player's expected counter"*, so a prepared
player is answered rather than immune. Under 28a's synergy trios:

- **Emberfall** (Fire) — guest `kraken_v2`, **Water**, which is the player's counter element itself.
  Ruling 3 wanted Nature.
- **Tidewrack** (Water) — guest `ratatoskr_v1`, **Nature**, the counter element again. Ruling 3
  wanted Fire.
- **Rootfall** (Nature) — guest `jormungandr_v2`, **Water**. Ruling 3 holds.

`runGate.test.ts` records it exactly that way rather than dropping the assertion: the 2-1 lineup shape
still holds and is still what the gate measures; what has gone is the guarantee that the odd member
punishes preparation. A synergy trio is a different KIND of hard from a rock-paper-scissors one, and
which one the gyms should be is a design call.

**Emberfall is worth a second look on its own terms**: it loses 0 of 6 across both arms against its
own named counter, and the new trio's only measured gain is surviving a turn longer (2.0 → 3.0).

### One retirement

`rootfall-rat-v2` (ticket 76 arm 4) was the knob proposing exactly the `ratatoskr_v1 → ratatoskr_v2`
swap 28a shipped at Rootfall — on the synergy argument, not on the knob's numbers, which were never
run. The knob is RETIRED in `experimentalTweaks.ts` with the ruling named, because this module's own
header says a knob whose experiment has shipped is not left switched off "in case". **Its staleness
guard is what caught 28a in the gate**, which is the guard working exactly once and then being
replaced by the fact it was guarding.

---

## 28b — done (2026-09-25)

**The guest is the element the gym BEATS.** Emberfall `fenrir_v2 + skoll_v2 + huldra_v1`; Tidewrack
back to the authored TIDAL SURGE trio `jormungandr_v1 + kraken_v2 + skoll_v2`; Rootfall unchanged
and already the shape the rule asks for. The scout reads the same table (28a's accessor, untouched).

### The two rules turn out to be the same rule

28a broke ticket 68's ruling 3 — *"the third slot exists to counter the player's expected counter"*
— at two of three gyms, and `runGate.test.ts` carried the exception list. Walk the triangle under
28b:

```
gym Fire   → counter Water  → guest Nature (Fire beats Nature)  → Nature beats Water ✓
gym Water  → counter Nature → guest Fire   (Water beats Fire)   → Fire beats Nature  ✓
gym Nature → counter Fire   → guest Water  (Nature beats Water) → Water beats Fire   ✓
```

In a three-element cycle *"the element I beat"* and *"the element that beats the element that beats
me"* are the same element. So ruling 3's assertion goes back to being universal rather than carrying
exceptions, and **28a's synergy heuristic was the only one of the three that could ever break it.**

### The canary — `results/t28b-canary.txt`

3 iterations per (gym × element party), the real gauntlet boss fight, beam 0. **Boss win%**, so the
gate is that the named counter column is the LOWEST.

| gym | trio | Water | Nature | Fire | named counter | gate |
|---|---|---|---|---|---|---|
| Emberfall | fenrir_v2 + skoll_v2 + huldra_v1 | **0%** | 100% | 100% | Water **0%** | **PASS** |
| Tidewrack | jormungandr_v1 + kraken_v2 + skoll_v2 | 67% | 67% | 100% | Nature 67% | tie |
| Rootfall | huldra_v2 + ratatoskr_v2 + jormungandr_v2 | 100% | 100% | **67%** | Fire **67%** | **PASS** |

**The honest reading is the ORDER, not the cells.** At three battles a 33-point step is one battle,
so no single number here is a number. What the table says:

- **In all three gyms the named counter is at or tied for the lowest boss win rate.** No gym does
  BETTER against the party it is supposed to lose to. That is 142's route pointing the right way at
  every gym.
- **Two of three separate strictly.** Emberfall is emphatic — its Water counter takes it 3 of 3
  while Nature and Fire take it 0 of 3.
- **Tidewrack cannot separate Nature from Water**, both at 1 of 3. One battle apart. It is not
  evidence against the route; it is three battles failing to resolve a difference.

FTK 0 and no truncation in all nine cells, so ticket 18's standing gates hold across the
re-composition.

**The instrument's limit, stated because it bounds everything above:** the player party carries a
run-START deck (18 cards, no picks, no upgrades, no patches) against a tuned trio with a Driver and
`BOSS_IVS`, at beam 0 rather than the encounter's 8. That is why cells saturate at 0% and 100%. The
reading that can actually grade these trios is the walker's gym-clear rate, which waits on the
fight-one decision.

### Two conflicts, shipped as ruled and recorded in tests

1. **`skoll_v2` is now fielded at TWO gyms.** Ticket 74's docblock rules against it in as many words
   — *"the same OS at two gyms would make the roster read as a pool"* — and 28a settled Rootfall's
   third slot partly on it. There is no second Fire firmware the element rule allows at Tidewrack
   without re-opening the guest. `pathAndScout.test.ts` now asserts *"exactly ONE firmware appears
   twice, and it is `skoll_v2`"* rather than zero, so a SECOND duplicate is still drift and still
   fails. **The trios ship; the principle needs a ruling.**
2. **Every route now covers all three elements, and nothing asked for that.** A road is
   `counter(gym) → gym → the gym's own biome`, and the last biome's elements are the leader comp's.
   Seating the guest from the element the gym beats makes that final biome `{gym, beaten}`, and
   `counter(gym) + gym + beaten` is the whole triangle. **This reverses a cost Henry took knowingly
   under 142 §7** — *"It's fine if there are no Water mingmings in there"* — because Rootfall used to
   run Fire → Nature → Nature+Water and never stand in a Water biome. Found by
   `marketplace.test.ts`'s vacuity guard, which could no longer find an off-route species.
   **Worth a ruling: "you cannot recruit that element on this road" was a routing decision the map
   was making.**

### `BOSS_COMPS` is deleted, and `gauntlet-boss.balance.ts` with it

Its own docblock ruled its end: *"that space shrinks by one gym per authoring session until it is
empty, at which point this table goes, rather than being ported."* All three gyms are authored, so
the space is empty and the suite was measuring a boss the game cannot field. The replacement was
already named there — the run gate pinned to a gym — and `scratch/t28b_canary.ts` is the cheap
version for a composition change. Ticket 40's canary note is updated to match.

**The `kraken_v1`-return test is deleted with the shape it flagged.** Not inverted to *"there is
only one engine now"*: the trio pin already states the composition card for card, and a second test
of one fact is two things to keep true. The lineage is recorded in its place, because the two-engine
shape has now been removed twice and may be proposed a third time — and the indictment was never the
payoff card's printed power (a 64% cut to `ink_stream` bought 13 points, p = 0.22) but the FLOW.
