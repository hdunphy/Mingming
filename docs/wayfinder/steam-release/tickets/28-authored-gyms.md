# Authored gym bosses: curated 3v3 teams with signature firmware per biome pair (ticket 28)

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
