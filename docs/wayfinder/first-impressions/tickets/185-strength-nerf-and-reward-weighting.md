# Ticket 185: The Strength engine nerf, and rewards that know your deck

**Type:** balance (card and firmware data), reward economy, one text fix. **Status:** RULED (Henry, 2026-10-02), and all three decisions were answered the same day (see the bottom). **185a–185e are buildable now.** 185f touches `RunSummary.tsx`, so it waits until ticket 182 has finished with that file.

**Where this comes from.** Henry's Rootfall run on 2026-10-02 (`playtest-results/2026-10-02/rootfall-fenrir_v1/`), started with fenrir_v1 and later joined by skoll_v1 and huldra_v2, all three with AMPLIFIER. The run won the gym at tier 0 in 13 fights. Every fight after the first ended in 1–3 turns, and each of the gym's three fights took 2. The review is the Claude project doc "playtest-2026-10-02-rootfall-fenrir-v1-review". In short, four things stacked:

- **Sun Devourer** spent 8 Strength for 1,514 damage on turn 1 of fight 2, and 27 Strength for 4,918 in the last gym fight.
- **Core Overclock+** counts Strength twice: once as +1 power per stack, and again as +30% damage per stack. Sköll's 8-power Desperate Strike+ hit for 1,465 and her Ragnarok Edge for 3,986.
- **Forage feeds fenrir_v1.** UNBOUND_KERNEL says "Attack programs", but the engine asks "does this card contain any attack action", and Forage's self-damage is one. So the 0-energy draw gave Fenrir 2 Strength (4 with AMPLIFIER).
- **skoll_v1 fires on hits that do nothing.** Hits fully soaked by Bark Shield ("takes 0 damage") and enemy cards that only apply a status (Corrosive Bolt, ROOT ROT's Poison) both gave Sköll Strength. In the last gym fight she banked 21 in one enemy turn.

**Henry (2026-10-02), in his words, answering the review's six questions:**

> *"1. No*
> *2. Sure let's make it "if an ally gets damaged by an enemy"*
> *3. Halve it now. We don't care about 1v1 numbers except at the start*
> *4. Nerf it somehow, maybe flat power? 1 extra power for every 3 str? Is that the samething?*
> *5. Yes to A and C, instead of B it should be payoffs cards have a higher chance to show if you don't have a payoff for your deck "currency". Can we even implement that logic? Maybe just check if you have all the payoffs for that OS's tuned deck in your collection.*
> *6. Yes, add that to the UI rework ticket"*

Answer 6 (Bark Shield drawn as a brown band over the HP bar) went into ticket 183, row 183a (`HpBar`) and 183b (plaques). It is not in this ticket.

**Standing ruling from answer 3:** *the 1v1 grid no longer gates card changes, except at the start of a run.* So no row here re-baselines the 1v1 grid. The opening still matters: rows 185a–185d end with the walker's fight-one read (the ≥85% rule for wild fights) for the fenrir_v1 and skoll_v1 starters.

**How to work it.** One commit per row, test first. Commits are authored by Henry with no co-author trailers, and nothing is pushed. `docs/wayfinder` uses CRLF; tests, `src/debug`, JSON and scratch files use LF. Card text and numbers change in the design source (`docs/wayfinder/deck-archetypes/collection-v2/collection.py`, plus the upgrades source for `+` cards) and are regenerated on Henry's machine. Never commit `build.py`, `browser.html` or `registry.json` from the container. Build small, single-purpose pieces and compose them, with no monolith.

| Row | What | Blocked by |
|---|---|---|
| 185a | Only Attack cards feed fenrir_v1's UNBOUND_KERNEL (Forage no longer does) | — |
| 185b | skoll_v1's TREACHERY fires only when an ally actually loses HP to an enemy | — |
| 185c | Sun Devourer halved: 30 → 15 power a stack, the `+` version 40 → 20 | — |
| 185d | Core Overclock becomes flat power per Strength: +1 power per 2 Strength, +1 per Strength for the `+` version | — |
| 185e | Reward offers: no repeats from the last two picks, synergy weighting (×2), and the missing-payoff boost (×3) | — |
| 185f | The run summary says the tier you UNLOCKED, not the one you cleared | 182 finished with `RunSummary.tsx` |

---

## 185a: Only Attack cards feed UNBOUND_KERNEL

**Today.** Both fenrir_v1 hooks in `src/engine/data/lib/hooks.json` (`fenrir_v1_hook` for his own cards and `fenrir_v1_ally_hook` for allies' cards) use `when.actionType: "ATTACK"`. `ConditionValidator` reads that as *"the card has an ATTACK action anywhere"* (see the 162e comment there). Forage's "take damage equal to 15 power" is an ATTACK action aimed at yourself, so Forage (a Skill) counts. Any other Skill whose drawback is self-damage counts the same way.

**Ruled (answer 1):** Forage does not count. Only Attack cards feed the kernel.

**Build.**

- Add `programCategoryIn: ["Attack"]` to the `when` of both fenrir_v1 hooks. That condition already exists (`HookTypes.ts`) and needs no engine work. The firmware text already says "Attack programs", so it stays.
- Check that the patch transforms (`patchRegistry.ts`, `patchOverrides.ts`) carry the new condition through: AMPLIFIER still pays 2 + 2 on an Attack card, SPLITTER still leaves the host unchanged (184e), and RELAY is still never offered.
- **Report, do not change:** 17 other hooks read `actionType: "ATTACK"` the same card-level way, so Forage counts for them too. They are `gullin_v2_ram`, `sleipnir_v2_hook`, `einherjar_standard_hook`, the Tenth Strike and First Blood Drivers, and the nine element-boost Drivers. List which ones Forage (or another self-damage Skill) actually reaches, and Henry rules each one.

**Tests.** Forage gives Fenrir no Strength, from himself or from an ally. Tackle gives 2 (4 with AMPLIFIER). An ally's Tackle gives 1 (2 with AMPLIFIER). Glass Cannon gives 2 once, not once per attack action.

**Then:** the walker's fight-one read for the fenrir_v1 starter (≥85% on wild fights). Report the number. No grid.

---

## 185b: TREACHERY fires only when an ally loses HP to an enemy

**Today.** `skoll_v1_hook` is `onPostDamage` with `source: OPPONENT, target: ALLY`. `onPostDamage` runs after **every** action an enemy resolves on your side (`battleReducer.ts`, the three per-hit sites), whether or not it did damage. So two things trigger it that should not:

1. A hit Bark Shield absorbs completely ("Sköll takes 0 damage, Bark Shield absorbed 72"). This is why huldra_v2 was handing Sköll free Strength.
2. An enemy card that only applies a status: Corrosive Bolt, Poison Injection, and ROOT ROT's extra Poison all gave Sköll Strength in the last gym fight. This is the same bug ticket 162e fixed for `ember_ward`.

**Ruled (answer 2):** *"if an ally gets damaged by an enemy."*

**Build.**

- At the three per-hit sites, record how much HP the target actually lost to that action (HP before the executor minus HP after, so Bark Shield is already accounted for), and put it on the hit context.
- Add a hook condition that passes only when that number is above 0. Name it something like `hpLost: true`, and document it in `HookTypes.ts` beside `isAttack`.
- Add the condition to `skoll_v1_hook`. Keep `target: ALLY`, which already includes Sköll herself.
- **Burn and Poison ticks do not count** (ruled, decision 3). They happen at the end of a turn, not as an enemy action, and today they do not trigger it either. Keep it that way.
- **Text (ruled, decision 3):** "Whenever an ally loses HP to an enemy, Sköll gains 1 Strength." Change it in `collection.py` and `hooks.json`, and check that the patch text table (`patchText.ts`) still reads right for skoll_v1.

**Tests.** No Strength when a hit is fully absorbed by Bark Shield. +1 when a hit is partly absorbed. No Strength from an enemy card that only applies a status. +1 when an enemy hits Sköll herself. +2 with AMPLIFIER. A Burn tick on an ally gives nothing.

**Then:** the fight-one read for the skoll_v1 starter.

---

## 185c: Sun Devourer halved

**Ruled (answer 3):** *"Halve it now."*

- `sun_devourer`: 30 → **15** power per Strength consumed.
- `sun_devourer+`: 40 → **20**.
- The text follows the numbers ("Consume all your Strength: 15 power per stack consumed."). Change both in the design source, then regenerate. Enemy decks that carry it change with it, as intended.
- Do not re-baseline the 1v1 grid (the standing ruling above). Do run the fight-one read for both Strength starters, because the start of a run is the one place where 1v1 still matters.

**Tests.** The power values and the text, through the existing registry and description tests. One battle test: 8 Strength consumed is 120 power (160 for the `+` version).

---

## 185d: Core Overclock becomes flat power

**Today.** `core_overclock` and `core_overclock+` are daemons (`daemon_double_strength` and `daemon_double_strength+` in `hooks.json`) on `onDamageCalculated` with `scaling: STRENGTH_STACKS`, which works out to damage × (1 + 0.2 × Strength), or 0.3 for `+`. Strength already adds +1 power a stack before that, so Strength counts twice and the damage grows with Strength *squared*. `STRENGTH_STACK_CAP` is Infinity, and that stays (no arbitrary caps).

**Ruled (answer 4):** nerf it, as flat power per Strength. Henry asked whether *"1 extra power for every 3 Str"* is the same thing as today. **It is not.** Today's version multiplies the whole hit, while flat power adds a little to it. Fury Strike (25 power), cast by the daemon's owner:

| Strength | No daemon | Today, `+` (×(1+0.3·Str)) | 1 per 3 Str | 1 per 2 Str | 1 per 1 Str |
|---|---|---|---|---|---|
| 6 | 31 | 87 | 33 | 34 | 37 |
| 12 | 37 | 170 | 41 | 43 | 49 |
| 21 | 46 | 336 | 53 | 56 | 67 |

(Values are raw power, the number the damage formula starts from. Ratios between columns hold through the formula.)

So "1 per 3" is a nerf of roughly 85% at 21 Strength, and it leaves a 2-energy Rare worth about +15% on each hit. **Decision 1 (ruled): +1 power per 2 Strength for `core_overclock`, +1 power per Strength for `core_overclock+`.**

**Build.**

- Move both hooks from `onDamageCalculated` to `onPowerCalculated` (ticket 150b's power-side twin, which lands where Strength itself lands). The bonus is `floor(Strength ÷ 2)` power for `core_overclock` and `Strength` power for `core_overclock+`. It is still uncapped, and it applies on every hit of a multi-hit card, the same way Strength does.
- Text: "Daemon (exhaust): +1 power for every 2 Strength you hold." and, for `+`, "Daemon (exhaust): +1 power for every Strength you hold." Change both in `collection.py`, the upgrades source and `hooks.json`.
- Update the comment in `HookFactory.ts` (`STRENGTH_STACKS`) that argues for a cap on the old multiplier, because nothing will read that path any more.

**Tests.** The bonus at 0, 1, 2, 3, 6 and 21 Strength for both versions (base: 0, 0, 1, 1, 3, 10; `+`: 0, 1, 2, 3, 6, 21). It applies per hit on Pack Tactics+. It no longer changes with Sharp, Dazed or STAB in any way beyond what plain power already does.

---

## 185e: Reward offers that know your deck

**Today.** `RewardSystem.rewardCardPool` is every Early-Access card of the party's elements. `rollCardFromPool` picks a rarity (Common 50 / Uncommon 30 / Rare 15 / Epic 5), then picks evenly within that rarity. Nothing remembers what was offered before, and nothing looks at the deck. In Henry's run, 10 picks showed 30 cards but only 24 different ones, and Sun Devourer, Forage, Fury Strike, Riptide, Soothe and Slander each came up twice. Event card picks (`events/eventCards.ts`) copy the same rarity roll.

**Ruled (answer 5):** A and C, plus a payoff boost in place of B.

**Can the payoff logic be built? Yes. The data already exists.** `collection-v2/collection.json` tags all 99 cards with a `shape` (enabler / scalar / consume / glue / converter / hate) and a `cur`, the currency the card feeds or spends (Strength, HP, Burn, Poison, cards, …). Ticket 158-r1 already moved each firmware's currency into the engine (`osGrammar.ts`; fenrir_v1 is Strength · HP, skoll_v1 is Strength). A **payoff** is a `scalar` or `consume` card. `startKits.test.ts` already uses exactly that definition. Henry's fallback ("check the OS's tuned deck") is also possible, but the currency version is what he described and covers more of the right cards. For fenrir_v1 it lifts every Strength payoff (Sun Devourer, Unbound Fang, Flare Burst, Core Overclock, …) instead of only the one in his tuned deck.

**Build.**

1. **Card shape and currency into the registry.** Add `shape` and `cur` to the card data the engine reads, the way 158-r1 moved the firmware currency. Add a test that every Early-Access card's values match `collection.json`, so the two sources cannot drift.
2. **One weighted draw.** Replace "roll a rarity, then pick evenly" with a single weighted pick in which each card's weight is `RARITY_WEIGHTS[its rarity] ÷ (number of pool cards of that rarity) × its multipliers`. With every multiplier at 1, each card's odds are exactly today's. Fight rewards and event card picks both use it. The shop is untouched, because its stock is frozen on the first visit.
3. **A — no repeats from the last two picks.** The run remembers the cards shown in its last two reward picks (fight and event card picks), saved with the run. Those cards are left out of the next pick. If the pool cannot fill three distinct options without them, let them back in, oldest first. Distinct-within-one-pick stays as it is.
4. **C — synergy.** A card whose `cur` matches a currency of any party member's firmware gets the synergy multiplier.
5. **The missing-payoff boost.** For each currency the party's firmware use: if the run's cards (the deck plus any cards held for benched members) include **no** payoff of that currency, then the payoffs of that currency get the payoff multiplier instead of the synergy one. The boost turns off as soon as one such payoff is owned.
6. **Multipliers (decision 2, ruled "lets start with that"):** synergy **×2**, missing payoff **×3**. Both are named constants beside `RARITY_WEIGHTS`, so they can be retuned after play.
7. **Seeds move once.** The draw sequence changes, so every walker and reward baseline moves. The commit says so. This is a game change, not an instrument change.

**Tests.** All multipliers at 1: each card's odds equal today's, over the exact weights rather than a sample. The last two picks' cards never reappear, unless the pool is too small. A fenrir_v1 deck with no Strength payoff sees Strength payoffs more often than baseline over 1,000 seeded rolls, and at baseline once Sun Devourer is in the deck. The save round-trips the recent-offers list. Event picks go through the same function.

---

## 185f: The run summary says what was unlocked

**Today.** After clearing Rootfall at tier 0, the summary says "Rootfall cleared · tier 0 unlocked". Clearing tier N unlocks N+1 (`tiers/tierUnlocks.ts`, `unlockedTiers`). The new 182a screen still builds the line as `` `tier ${run.tier} unlocked` `` (`RunSummary.tsx`, around line 216).

**Build.** Show `tier N+1 unlocked` from `unlockedTiers`, not by doing the arithmetic in the screen. When the cleared tier is already the top one (`MAX_TIER`), say "Rootfall cleared · top tier" instead. Wait until ticket 182 is done with this file.

**Tests.** A tier-0 clear reads "tier 1 unlocked". A clear at `MAX_TIER` names no higher tier.

---

## Decisions (all answered by Henry, 2026-10-02)

> *"1. Agree, go with 1 per 2 and 1 per 1 upgraded*
> *2. Sure lets start with that*
> *3. Yes agree"*

1. **Core Overclock's rate (185d):** +1 power per 2 Strength; `core_overclock+` +1 power per Strength. (Option 2. Henry's first suggestion, 1 per 3, measured out at about +15% per hit at 21 Strength.)
2. **Reward multipliers (185e):** synergy ×2, missing payoff ×3, as a starting point to retune after play.
3. **Sköll's text and ticks (185b):** "Whenever an ally loses HP to an enemy, Sköll gains 1 Strength." Burn and Poison ticks do not count.

**Next step:** an agent builds 185a–185e in order, one commit per row, and reports the fight-one reads for the fenrir_v1 and skoll_v1 starters. 185f follows once 182 is done with `RunSummary.tsx`.
