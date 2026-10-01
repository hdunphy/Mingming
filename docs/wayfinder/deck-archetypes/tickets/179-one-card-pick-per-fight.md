# Ticket 179: One card pick per fight

**Type:** economy. **Status:** OPEN; small, and independent of 176, so it can be built before it. Decisions P1–P3 below have recommended defaults; build those unless Henry rules otherwise.

**Henry (2026-10-01):**

> *"Another thing to help with scrap bloat is we should always offer one set of card rewards per battle. Right now it is one set per Mingming."*

## What happens today

`rollDropTable` (`src/engine/RewardSystem.ts`) rolls once per **defeated enemy**: `rollForEntity` returns a blueprint roll and a "pick 1 of `SALVAGE_CHOICES_PER_FOE` (3)" card choice for each corpse.

Wild fights mirror your party size (`enemyPartySize`), so in practice it's one pick per Mingming:

- 1 pick in biome 0
- 2–3 picks later in the run
- 3 picks at an ambush, which fields one more enemy than you

The reward screen (`BattleReport`), the run log (`BattleArena`) and the walker (`runWalker.ts`) all loop over `bundle.cardChoices`, so none of them assumes a count.

**Why it bloats scrap:** a 3v3 fight hands out three cards. Most of them end up in the collection and get sold (5–20 scrap each), on top of the fight's scrap.

## Decisions (recommended defaults first)

- **P1. Blueprints stay one roll per defeated enemy.** Only the card pick changes. Blueprints are how you recruit, and 142's rates were measured per body.
- **P2. Every fight gives exactly one pick of 3,** whatever its size: wild, rival, elite, alpha, ambush, and event fights. Gauntlet fights stay at none (18a).
- **P3. Fight scrap is unchanged** (`scrapForWin`: 10 + 5 per extra enemy, elite 45). The scrap squeeze comes from fewer cards to sell, not from lower pay.

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
4. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.**
5. **Report** in plain English at the end, with 179b's table.

| Row | What |
|---|---|
| 179a | `rollDropTable` returns one card choice per fight |
| 179b | Measure it with the walker |

---

## 179a: One card choice per fight

1. **In `rollDropTable`,** keep calling `rollForEntity` for every defeated enemy, exactly as now, so the PRNG chain and therefore **every blueprint roll stays the same**. Push only the **first** corpse's `cardChoice` into `cardChoices`; drop the rest.
   - Rolling choices that are then thrown away is deliberate: it is what keeps blueprint drops identical for every existing seed.
   - The instance-id stream (`ids`) is separate, so the choice that is kept keeps its ids.
2. **Comments:** update the ones that say "one triple per defeated body" (`BattleArena.tsx` near the `CARD_PICKED` logging) and the `SALVAGE_CHOICES_PER_FOE` doc comment ("per defeated foe" becomes "per fight"). Leave the constant's name and its value (3).
3. **Tests** (`RewardSystem.test.ts`; the existing expectations of 3 choices at 3 bodies change to 1):
   - a 1-, 2- and 3-body win each return exactly **one** card choice of 3 options
   - an ambush and an elite each return one
   - a gym fight still returns none
   - **blueprints unchanged:** for 50 fixed seeds and 1–3 bodies, `blueprints` equals the parent's output exactly. Compute the expected arrays on the parent first and paste them into the test.
   - scrap unchanged for the same seeds
   - `BattleReport` shows one pick row for a 3-body fight (update the reward screen tests that assumed three)

## 179b: Measure it

Run 174's scrap walk (`npm run balance:scrap-walk`), parent vs 179, on the same 360 seeds (12 EA starters × 30), with the upgrade policy on as in 174. Write `docs/balance/card-picks-179.md` (LF):

- **Per run:** cards offered, cards taken into the deck, cards to the collection, cards sold, scrap from selling
- **Per biome:** 174's table (fights, income, spent, low point, scrap at biome end)
- **Final deck size** and how often it was at the floor
- **Win rates:** wild and elite fights won; walks that reached and cleared the gym
- **A verdict line:** how much late-run scrap (biome 2, scrap at end) went down, and whether decks still reach a healthy size

**Do not change any number to hit a target.** If decks come out thin, report it and say which lever you'd suggest (shop stock, event card picks, or `SALVAGE_CHOICES_PER_FOE`).

## Done when

- Every fight offers one card pick, and blueprint drops and scrap are byte-identical to the parent for the same seeds.
- `docs/balance/card-picks-179.md` shows the before/after scrap and deck growth.
