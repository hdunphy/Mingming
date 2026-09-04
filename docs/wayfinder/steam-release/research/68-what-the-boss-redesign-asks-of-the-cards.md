# What the boss redesign asks of the cards — a report for the deck-archetypes map

**From:** steam-release, ticket [68](../tickets/68-boss-redesign-drivers.md), built and measured
2026-08-28.
**For:** the design agent working the deck-archetypes map.
**Supersedes:** the counter-lever table in
[67 §9 Q2](67-gate-validity-and-the-power-ceiling.md#q2--ruled-yes-there-is-a-power-tier-and-it-is-anti-boss)
— that brief is not cancelled, but the fight it describes no longer exists at one of the three gyms
and will not exist at the other two after their design sessions.

Nothing here is a ruling. Steam-release built what Henry ruled and measured it; what the card pool
should do about it is yours and his.

---

## 1. The headline

**The anti-boss card tier was briefed against a boss that has been replaced.**

Q2 ruled *"each deck should have 2-3 cards at launch that help you defeat the boss"* — 24 to 36
cards — and handed you a table of three `boss_relic_*` firmwares to answer. That brief was written
when the gym boss was **unbeatable**: 0 wins in 60 for a prepared player, and §12 isolated the cause
as the relic stack (switching the relic hooks off bought **+58.3 points**; halving the boss's stats
bought 1.7).

Henry reviewed the relic system in session — it had never been through him — and rebuilt the fight
from first principles. The rebuilt Emberfall now measures **80.0% for a prepared player against a
60% target**. The fight went from impossible to 15 points too easy, and it did so without a single
card being written.

**So: do not start writing 24-36 cards against that table.** Two of its three rows are still live at
two gyms and will be retired as those gyms are authored. The tier may still be wanted — that is
Henry's call, and §7 below lists what he has to answer before the pass is worth starting.

## 2. What changed, in one page

Three of ticket 68's rulings matter to you.

**Enemy passives are DRIVERS.** `boss_relic_*` is retired as a concept and as a naming. Enemy
passives now run on the same side-level machinery as the player's Drivers
(`engine/data/driverRegistry.ts`), and the standing naming law extends: neither side's Drivers are
ever called relics. Ticket 60's gauntlet rung — *"kit + OS + Driver"* — is literal now.

**A Driver is ADDITIVE.** It attaches hooks to every member of its side and never touches
`activeOS`. That single property is the whole redesign: the old boss had its firmware *overwritten*
by a relic, which silently cost it its real OS and left its deck resolving through a documented
fallback. A boss member now keeps its own tuned OS and gains the Driver on top.

**Boss teams are hand-authored per gym, not formula-drawn.** Each leader fields a trio of real
species running their **real tuned decks and real tuned OSes** — decks a player could build. One
Driver per fight, side-scoped. The composition heuristic (authoring guide, explicitly not a formula)
is *two of the leader's own element plus one countering the player's expected counter-team*.

**EMBERFALL is authored. Tidewrack and Rootfall are NOT** — they keep the old relic boss until their
own design sessions, one gym per session, so both shapes are live in the tree today.

Emberfall, in full:

| slot | species | OS | element |
|---|---|---|---|
| 1 | fenrir | `fenrir_v1` UNBOUND_KERNEL | Fire |
| 2 | skoll | `skoll_v1` TREACHERY_KERNEL | Fire |
| 3 | ratatoskr | `ratatoskr_v2` INSTIGATOR_OS | Nature |

Driver: **WAR FOOTING** — *at the end of this side's turn, every member gains 1 Strengthened; from
turn 4 on, 2.*

Henry's design note, kept because it is the intent the measurement should be read against:
*"skoll_v1 punishes wide chip (zoo feeds it) — deliberate; the first fight in the game that pushes
back on the dominant zoo comp."* Intended counter, for the record: control-leaning 2 Water + 1 Fire.

## 3. The numbers

Pinned to Emberfall (`--gym gym_emberfall`, new in this ticket), 60 battles per arm, boss stats and
AI grade untouched.

| arm | result | 95% CI | vs the 0/60 it replaces | avg turns |
|---|---|---|---|---|
| PREPARED (counter-element party) | 48/60 — **80.0%** | 68.2-88.2 | **+80.0pt** | 4.1 |
| CONTROL (same element as the target) | 39/60 — **65.0%** | 52.4-75.8 | +65.0pt | 4.5 |

And the whole gauntlet, prepared: fight 1 **83.3%**, fight 2 **90.0%**, fight 3 **80.0%**. It read
68.3 / 81.7 / 3.3 before. The cliff became a gauntlet.

Zero first-turn kills and zero stalls in 180 battles.

## 4. What is dead in the Q2 brief, and what survives

**Dead at Emberfall, alive at the other two gyms until they are authored:**

| Q2's row | status |
|---|---|
| `FIRE_RELIC_OS` — end-of-turn party-wide Fire damage scaled by Sharp | gone at Emberfall |
| `WATER_RELIC_OS` — the enemy side heals 5% max HP whenever it takes damage | gone at Emberfall |
| `ICE_RELIC_OS` — your programs aimed at a Poisoned target cost +1 energy | gone at Emberfall |

Two consequences worth stating plainly:

- **A card written to beat the WATER relic ("one big hit, not many small ones") is worthless at
  Emberfall and useful at Tidewrack — for now.** Anything you build against the relic table has a
  known expiry date: the session that authors that gym.
- **The ICE_RELIC asymmetry §9 flagged has not been resolved, only deferred.** That relic taxed
  `jormungandr_v2`'s entire Poison plan by name. It still does, at two gyms. If it was an accident,
  it is an accident with two gyms left to inherit it.

**What survives unchanged** are the four open sub-questions Q2 could not settle, and they are
untouched by any of this: where anti-boss cards appear (elite rewards / marketplace / gym clears /
ordinary pool), whether they stay inside the party's species pool (ticket 56), whether the enemy ever
gets them, and whether the 12 existing off-deck Rares can do the job instead of 24-36 new cards.

## 5. What the NEW fight asks — and it is much less than the old one did

### WAR FOOTING is arithmetically small at this fight length

Strengthened is **+1 power per stack, uncapped** (ticket 102). WAR FOOTING grants 1 per member per
round, 2 from turn 4. Over the measured 4.1-turn fight that is **3 to 5 stacks by the end** — so a
boss card that reads 25 power lands at 28-30 on its last swing. That is a real edge and it is not a
wall, which is exactly what the 80% says.

**The escalation clause is nearly decorative.** It starts at turn 4 and the fight averages 4.1
turns, so in most battles it fires once or not at all. If the intent was an aura that punishes a long
fight, this fight is not long. Anything you design that deliberately *extends* the fight — stall,
sustain, a slow engine — is walking into the half of the Driver nobody currently meets.

### 4.1 turns is the binding constraint on any anti-boss card

This is the number to design against, and it is stricter than anything in the Q2 brief. A card that
needs a turn of setup gets one payoff turn. A card that needs three stacks of something before it
does anything may never fire. The old boss's 60-turn grind is gone; the fight now resolves like an
ordinary 3v3, which means **anti-boss cards have to be good on the turn they are drawn.**

### skoll_v1 is the designed pushback on zoo

TREACHERY_KERNEL feeds on wide chip, and §9's own note predicted its feed rate scales roughly 3x at
3v3. Henry put it in this trio on purpose. If the card pool's answer to a Fire gym is "more small
hits", that answer is now being taxed by design — and whether the pool contains an alternative is a
question about your card list, not about the boss.

## 6. The finding worth the most: the prepared team cannot answer the Driver

WAR FOOTING generates Strengthened. **Weakened cancels Strengthened stack for stack** — that is the
duality valve ticket 102 shipped, and it is the direct, mechanical answer to an escalating aura.

Which launch cards apply Weakened to an enemy:

| card | element | cost | in a tuned deck? |
|---|---|---|---|
| `pollen_cloud` — 4 power, 1 Weakened + 1 Poison | Nature | 0 | yes — ratatoskr |
| `crippling_vine` — 30 power, 2 Weakened + 2 Dazed + 3 Poison | Nature | 2 | yes — ratatoskr |
| `hamstring` — 20 power, 2 Weakened | None | 1 | **no launch deck holds it** |

Everything else that applies Weakened is Ice or Dark, and neither element ships at Early Access
(ticket 05: Fire / Water / Nature).

**So the only launch species that can cancel WAR FOOTING is ratatoskr — and ratatoskr is on the
boss's side of the table.** Emberfall is the Fire gym; the prepared answer to Fire is Water; neither
Water species carries a Weakened applier. **A player who brings the counter-team the type chart
tells them to bring has no access to the mechanical answer to the fight's central rule.**

That may be intended — it is arguably what makes ruling 3's "counter to the counter" third member
mean something. But it is worth knowing that it is true, because it has three possible readings and
they lead to different card work:

1. **Intended.** The Driver is meant to be raced, not answered, and 80% says racing works. Then no
   anti-WAR-FOOTING card is needed and the tier's job is something else.
2. **A gap in the pool.** Water should have a Weakened applier and does not. That is one or two
   cards, not twenty-four.
3. **A gap in acquisition.** `hamstring` already exists, is element-neutral, Common, and costs 1 —
   it is the card, and the question is only whether a Water party can ever be offered it. Ticket 56
   rules stock draws from the party's species pool, and a `None`-element card's route into that pool
   is not something this report could establish.

Reading 3 is the cheapest if it is true, and it is a question about the marketplace's pool rules
rather than about card design at all.

## 7. What Henry has to rule before the anti-boss pass is worth starting

Steam-release is not asking you to start it. These are the questions blocking it, all his:

1. **Is 80.0% wrong?** The target says 60. Nothing was tuned — the unturned levers are `BOSS_IVS`
   (20/20/20, and ruling 7 asks for a re-check against the new Driver that has not been run), WAR
   FOOTING's numbers, the authored composition, and **the 60% target itself, which was set against a
   boss nobody had designed.**
2. **Does the anti-boss tier still have a job?** It was ruled to answer a fight that was unbeatable.
   The fight is now too easy. A power tier above the base decks may still be wanted for other
   reasons — but "help you defeat the boss" is no longer a problem statement.
3. **If the tier survives, does it target the DRIVER or the TEAM?** A card that answers WAR FOOTING
   is one card that works at one gym. A card that answers "a trio of real tuned decks played at full
   lookahead" is a card that works everywhere and is much harder to write.

## 8. What steam-release is NOT asking for

- **No tuning.** `BOSS_IVS`, the AI grade, the enemy ladder: all untouched by ticket 68 and not
  yours to move.
- **No authoring of Tidewrack or Rootfall.** Those are Henry's design sessions, one per session, and
  ruling 6 is explicit that they keep the old boss until then.
- **No new passive system.** Drivers reuse the player's machinery. If a boss needs a new behaviour,
  it is a hooks.json entry, not a mechanism.

## 9. Instruments you can use now

- **`npm run balance:run-gate -- --cells gauntlet:fight2 --gym gym_emberfall --matchup favourable`**
  — `--gym` is new and the gate needs it: the cell walks all three leaders, and after ruling 6 the
  three leaders are no longer the same fight. An unpinned run blends one rebuilt boss with two
  unchanged ones and reports an average about neither.
- **`npm run decks`** — writes `docs/balance/deck_browser.html`, a standalone at-a-glance reference
  for all 32 decks: firmware text, the ratified engine, the cost curve, every card, and borrowed win
  rates that are **badged stale by registry hash** when a card or species definition has moved since
  they were measured. They are stale right now.
- **`--boss-relics off`** still isolates a boss's signature passive and now follows the Driver at an
  authored gym, so the "what is the card pool actually being asked to beat" arm still works.

## 10. Standing request, unchanged

Ticket [22](../tickets/22-3v3-game-side.md) is still open on your side: **142 of 216 card
descriptions print their power figure.** Henry's 2026-08-23 amendment says those are CORRECT and are
not to be "fixed" — the printed figure is the comparison currency out of combat. The request is only
that new cards keep doing it consistently.
