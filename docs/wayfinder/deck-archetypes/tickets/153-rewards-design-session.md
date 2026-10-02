# Ticket 153 — Design session: rewards that reward (cards, scrap, and the blueprint hunt)

> **Status: CLOSED 2026-09-24 — Henry: "good for now". Absorbed by 161 (kits), 163 (upgrades at three benches, patches from elites/gate/shop) and 142 (blueprint pool). Reopen with a fresh playtest note if scrap still feels flat on the merged build; 163e's take-rates are the numbers to read first.**

**Type:** wayfinder:grilling — a design session with Henry; nothing is pre-authorised for
implementation. **Status:** OPEN, opened 2026-09-11 at Henry's request off the 2026-09-10 playtest
(142 §6).
**Henry:** *"I'm finding a lot of scrap as I hunt for blueprints, which is partly why this feels
tedious and the rewards aren't very rewarding. Please add a new ticket to do a design session to
add in some better card rewards."* And, same playtest: *"I still don't feel like I'm leveling up
with my decks. I almost always send cards to the collection and search for 2–3 cards to add."*
**Relates to:** 148 (progression curve — the deck-size tax that makes most picks go to the
collection), 142 §7 (the static shop and blueprints for sale), 151 (two damage paths per deck —
what a "good pick" would have to serve), steam-release 77 (Track A), 59 (the 71 orphan cards that
are now annotated and could be reward-pool content).

---

## 1. What the run log says the reward loop is today

From `mingming_run_log.json` (14 fights, tier 0 Rootfall):

- **Every fight paid 10 scrap** (15 at 2-wide, 45 at an elite) and offered a 3-card pick. Scrap
  income over the run: ~280. Spend: two recruits (50), one card (15), one card (35), two macros
  (80), one reroll (10), three sells (+15). Henry ended the run holding **80 scrap** and had 100+ in
  the bank for most of biome 2. Scrap is not scarce, so a 10-scrap fight reward is not a reward.
- **20 card picks, 3 skips.** Picks by fate: `ignite` ×3, `ragnarok_edge` ×2, `war_pact` (bought
  then sold), `riptide`, `core_overclock_daemon`, `cinder_armor_daemon`, `scrubber`,
  `battle_rhythm`, `fury_strike`, `strength_burst`, `ash_communion`, `unbound_fang`, `ember_mend`,
  `sap_vigor`, `nettle_sting`, `slander` (bought). The deck at each seam went 8 → 17 → 8 → 17 → 8:
  the picks ride along with the recruit's five engine cards and leave with them. Of the 20 picks,
  the ones still in a deck at the end of the run: *none* (the final party was the biome-1 recruit
  with its own 8).
- **Offers repeat.** `adrenaline` was offered three times in a row and never taken; `ignite`
  three times and taken every time; `forage` three times. A 3-of-N offer from a small party pool
  shows the same cards until the party changes.

So the loop is: win → 10 scrap you don't need → a pick from a pool you've already seen → the card
goes to the collection because the deck is the size that wins (ticket 77) → repeat, while the thing
you actually want (the blueprint that recruits the counter) is not in any of these rewards.

## 2. Questions for the session, in order

1. **What is a reward for?** Three candidates, not exclusive: a *deck* reward (a card that goes in
   and stays in — which under 77's finding means a *replacement*, not an addition), a *body* reward
   (blueprint progress toward the recruit you are hunting — the thing Henry is actually grinding
   for), a *run* reward (scrap, macros, a reflash). Today every fight pays the third kind, which is
   the one that is already saturated.
2. **Should a card pick be a swap?** "Pick one of three, and it replaces a card in your deck" keeps
   the deck at the winning size and makes every pick a decision instead of a donation to the
   collection. The rejected card goes to the collection, so nothing is lost — the *deck* levels
   instead of the *collection*.
3. **Rarity and the over-band rare.** Henry (149 §4): *"we should add some rare cards that are over
   band to help players win easier."* Elites and rivals could pay a rare pick (over-band, or a
   daemon — 149's sanctioned rare) where wilds pay a common one. Which tickets' cards are the rare
   pool — 59's orphans, 151's two-path payoffs?
4. **Blueprint drops as the hunt's reward.** The workshop recruits; the fights should progress the
   hunt. Options: a species' blueprint fragment drops from *that species* (the rival system, 142a,
   already puts the path species in your way); elites drop a whole blueprint; the shop sells one
   (142 §7, 50 scrap). What is a blueprint worth in scrap, and does that price make 10-scrap fights
   meaningful again or just make scrap a blueprint currency?
5. **Scrap: fewer, bigger, or spent on more?** If the shop is static (142 §7) and blueprints and
   refreshes cost 50, scrap has a sink and 10 a fight becomes a real number again. Does the fight
   reward stay flat, or scale with node kind / biome / party width the way it partly does now
   (10/15/45)?
6. **Offer memory.** Should an offer you skipped be less likely next time (a pity/weight, like the
   pack pity in `runSlice.pity`), so `adrenaline` ×3 stops happening?
7. **What does "leveling up" look like on the screen?** A deck that grows in *quality* at fixed
   size needs the UI to say so: a deck power read-out, a "replaced X with Y" moment, the
   marketplace chassis showing the outgoing card. This is the 145/146 lane's problem once the
   design is ruled.

## 3. What comes out of the session

A ruling per question above, then implementation tickets: the reward table (per node kind), the
swap-pick if ruled, blueprint drop rules, rarity tiers and the rare pool, and the scrap re-tune —
each with its own field gate on the run (fights to gym, deck size at gym, scrap at gym, blueprint
rate) measured by `scratch/t149_runmix.ts`'s route walker extended with rewards.

## 4. Not in this ticket

The shop's static stock and blueprint slot (142 §7 — implementation, ruled). The deck-size arms
(148 P0–P3). The two-path deck rework (151).
