# Ticket 140 — Early Access 3v3: comps for Fire / Water / Nature, and the cards that bridge them

**Status:** design proposal, measured where the instrument allows (see §5)
**Asked by Henry:** *"it feels bad to pull in another Mingming once you have a good 1v1 deck... start
building 3v3 decks which you start off with the 1v1-tuned deck... create some suggestions for
synergies between different OSes in the fire water nature decks... at least two of the same type
and one of a different type... a zoo archetype, a control archetype and a ramp archetype... and
maybe some suggestions for new cards to help bridge those gaps."*

---

## 1. Why a good 1v1 deck gets worse when you add a body — the mechanics, in plain words

Four things change at 3v3, and every one of them is why kraken + sköll felt bad:

1. **The hand is shared.** Three bodies draw into one hand (`sum(cardDraw) − 2` cards a turn) and any
   body can cast any card. Your kraken deck is now a third of the pile; two thirds of what you draw
   is somebody else's plan.
2. **Energy is per body, cards are not.** Kraken still has 2 Energy, but the cards in hand were
   built for three different 2-Energy budgets. A card only gets cast if *some* body can pay for it
   and wants to.
3. **STAB follows the caster, not the card.** A Water card cast by Sköll gets no ×1.5. So the
   shared hand quietly taxes every card that the "wrong" body ends up casting, and the AI (and a
   player) will do that whenever the right body is out of Energy.
4. **16 of the 33 firmwares only fire when their owner casts the card** (`source: SELF`). Kraken's
   ABYSSAL_INK fires on *any ally's* effect-draw (it is one of the few side-aware ones); Sköll's
   SOLAR_OVERDRIVE only counts Sköll's own attacks. Put a self-gated OS next to a body that hogs
   the hand and the OS simply stops happening.

So "a 3v3 deck" is not three good 1v1 decks. It is one pile where the cards are cheap enough that
the right body usually has the Energy, where the OSes read each other's actions, and where the
element mix does not throw away STAB on the cards that matter. The three comps below are built on
exactly those three tests.

Two facts to design against, both measured earlier in this arc: the shared hand means each body
plays *fewer* cards than it would alone (ticket 112: most per-card OSes fire at ×0.25–×0.55 their
1v1 rate at width), and side-wide effects gain (BLOOD_SCENT ×1.44, and anything that hits or
buffs "every enemy"/"all allies" is worth three bodies).

The Early Access type triangle: **Fire > Nature > Water > Fire** (×1.5 each way round). A 2+1 comp
always carries one element the opponent's majority beats, so the splash body should be the one
whose value does not depend on its attacks landing.

---

## 2. ZOO — "Gossip Tide": ratatoskr_v1 + huldra_v1 + kraken_v1  (Nature ×2, Water splash)

**The idea.** Cheap cards, lots of them, and three OSes that pay *every ally* per card rather than
paying the caster:

| body | OS | what it does at width |
|---|---|---|
| ratatoskr_v1 GOSSIP_NODE | every 0-cost card heals **all allies** 2.5% | the whole party sustains off the zoo's free cards, cast by anyone |
| huldra_v1 ALLURE_PROXY | every buff she applies to herself **or an ally** mirrors 1 Weakened onto a random enemy | Growth / Iron Bark / Shrug Off become enemy Weakened; hexbloom cashes it |
| kraken_v1 ABYSSAL_INK | every effect-draw **by any ally** Dazes **every enemy** ×2 | Forage ×2, Undertow, Whirlpool ×2, Pressure Point ×2, Echo Chamber tokens — the zoo's draw engine becomes a side-wide Dazed engine, and Dazed is +1 power on every hit |

Why it holds together: the pile is 0.67–0.73 average cost, so whichever body has Energy can cast
almost anything; seed_bomb and Crushing Depths are the two payoffs and both read piles the other
two bodies build (cards played this turn; Dazed on the target). The splash is Water, which the
Nature pair *beats*, so an enemy Water majority cannot punish the two Nature bodies.

**Weakness to know:** Fire majority beats both Nature bodies. Kraken is the answer body there and
he's the frailest frame in the game (58 HP). The comp wins fast or not at all.

**Bridge card — `chorus`** (Nature, 1e, Skill, Self): *"Draw a card. Every ally gains 1 Sharp."*
Draw 15 + 3 × Sharp 10 = 45 against a 35 budget for a 1e — priced as a 3v3 card (at 1v1 it is a
1e "draw, gain 1 Sharp", under curve by design). It is an effect-draw (kraken Dazes everyone), a
buff on two allies (huldra mirrors two Weakened), and Sharp on the zoo. One card, three OS procs.

## 3. CONTROL — "Venom Court": huldra_v2 + ratatoskr_v2 + jormungandr_v2  (Nature ×2, Water splash)

**The idea.** Every body applies Poison or Dazed; one body converts the pile into damage without
consuming it.

| body | OS | role |
|---|---|---|
| jormungandr_v2 TOXIN_FANG | his attacks deal +10 damage per Poison stack on the target | the payoff — reads the *whole party's* Poison, no consume |
| huldra_v2 BARK_SHIELD | a wall on turn one | the tank; Nettle Sting, Thornguard, Heartwood, Blightbloom stack Poison |
| ratatoskr_v2 INSTIGATOR | each 0-cost at an enemy Dazes it | Pollen Cloud ×2 + Tackle ×2 + Echo tokens: Poison, Weakened, Dazed for free; Crippling Vine is the big status dump; Slander reads the Dazed |

Why it works: three Poison sources feeding one uncapped, non-consuming reader means jormungandr's
Venom Fang (25 + 10 × stacks) is the best card in the pile by turn three, and it is a Water card
cast by the Water body, so it keeps STAB. The jormungandr frame (110 HP) and huldra's wall make
this the comp that survives the first three turns — which every 1v1 grid this week says is the
whole game.

**Weakness:** it is slow, and Dazed-on-self decks (kraken_v2's Scald) get free stacks. Fire beats
both Nature bodies but Water beats Fire, so the payoff body survives the bad matchup.

**Bridge card — `spreading_rot`** (Water, 1e, Status, Side): *"Apply 2 Poison to every enemy."*
Poison 1.5·S(S+1) = 9 per target, ×3 targets = 27 — under the 1e budget on purpose, because
TOXIN_FANG multiplies it three times over. `toxic_cloud` (3e, 5 stacks to side) already exists and
is uncastable on 2 Energy; this is the castable version.

## 4. RAMP — "Tidal Forge": fenrir_v2 + skoll_v1 + kraken_v2  (Fire ×2, Water splash)

**The idea.** Two bodies build a resource while the third buys time, then one turn cashes it.

| body | OS | role |
|---|---|---|
| kraken_v2 TIDAL_CRUSH | Water cards costing 2+ deal +30% | Capacitor ×2 banks 3 Energy for the hammer turn; Scald / Boiling Surge are the Burn setup |
| fenrir_v2 CINDER_WALL | gains Sharp whenever *Fenrir* applies Burn | Fenrir casts Scald and Ignite from the shared hand — every one is +1 Sharp; Cinder Lance reads the pile; Ash Communion heals off Burn |
| skoll_v1 TREACHERY | gains Strength whenever **an ally** takes damage | at 3v3 she reads two extra bodies (this is the OS Henry ruled intended for width); Sun Devourer cashes it at 20 per stack |

Why it works: Burn caps at 4 per target, so two Burn bodies do not fight over stacks — one Burns the
target for the payoff, the other Burns *itself* (Pyre Sacrifice, All In) to feed Sharp and Ash
Communion. Sköll's Strength grows every turn the enemy attacks anyone. The cash-in turn is
Capacitor → Hydro Blast + Sun Devourer, roughly 250 power from two bodies.

**Weakness:** Water beats both Fire bodies and the comp does nothing on turn one. It is the comp
that loses to Gossip Tide's tempo and beats Venom Court's grind — which is the triangle you want.

**Bridge card — `tidal_battery`** (Water, 2e, Skill, Self): *"You and one ally gain 2 Energy next
turn."* Energized 35 × 4 = 140 against a 75 budget — priced for width again: at 1v1 it is a
worse Capacitor (2 Energized, one body), at 3v3 it is the card that lets the Fire hammer and the
Water hammer fire on the same turn. Note `battery_pack` (4e daemon, +1 max Energy) exists and is
in no deck; it may be the rare-drop version of this idea.

---

## 5. What was measured (3v3, beam 8 — the search a player actually plays against)

Instrument: `scratch/comps3v3.ts` (container only), round robin, **beamless** (the beam flag did
not load through vite-node — so these are the same search as every 1v1 number on record, not the
in-game beam), 2 paired iterations = 4 battles a cell, on the round-three build. Read for ordering,
not tenths. Two reference trios: `ref_solo_a` = kraken_v1 + skoll_v1 + huldra_v2 (Henry's "felt
bad" pairing, plus a wall), `ref_solo_b` = fenrir_v1 + jormungandr_v1 + ratatoskr_v2 (three
strong 1v1 decks with no shared plan).

| comp | vs zoo | vs control | vs ramp | vs ref a | vs ref b | **avg** |
|---|---|---|---|---|---|---|
| **zoo — Gossip Tide** | — | 75 | 75 | 75 | 100 | **81** |
| control — Venom Court | 25 | — | 25 | 25 | 100 | **44** |
| ramp — Tidal Forge | 25 | 75 | — | 50 | 75 | **56** |
| ref a (kraken_v1 + skoll_v1 + huldra_v2) | 25 | 75 | 50 | — | 100 | 62 |
| ref b (three solo decks) | 0 | 0 | 25 | 0 | — | 6 |

Games run 4.5–7.25 turns; nothing truncated, no first-turn kills.

**Read:**
- **The zoo is the 3v3 deck**, as predicted by the width findings — three side-aware OSes on the
  cheapest pile in the game. 81 is the "90% effective, not 100%" Henry asked for; it is also a
  warning that the zoo needs a real predator (see control).
- **Ramp beats control and loses to zoo** — the triangle Henry wants exists between two of the three.
- **Control is under-built.** Venom Court's plan is three turns long and the zoo kills in four and a
  half; it also lost to the reference wall comp. The fix is on the *front* of the deck, not the
  payoff: it needs a side-wide Weakened or Dazed on turn one (the huldra_v1 mirror, or Rimefrost-
  style "1 Weakened and 1 Dazed to side" in Nature) so the zoo's free hits do less while the Poison
  lands. `spreading_rot` (§3) is the payoff-side bridge; control also needs a tempo-side one.
- **"Three good solo decks" scores 6.** That is the feeling Henry reported from playtest, measured:
  a comp with no shared engine loses to every comp that has one, including the accidental one.

---

## 6. Design rules that fell out of this

1. **A 3v3 comp needs at least one side-aware OS** (fires on ally actions or hits every enemy).
   In the EA roster those are: GOSSIP_NODE, ABYSSAL_INK, ALLURE_PROXY, TREACHERY_KERNEL, and
   TOXIN_FANG by virtue of reading a pile others build. Every other EA firmware is self-gated.
2. **The splash body's job is not damage.** It loses STAB on most of what it casts and it is the
   element the majority beats. Give the splash the OS that reads the party (kraken_v1's draw
   trigger, jormungandr_v2's Poison reader, kraken_v2's Energy bank).
3. **Bridge cards are priced for width, under curve at 1v1.** Every card above is a bad 1v1 card
   on purpose — that is what makes "the 3v3 OP deck is harder to build" true without making
   the 1v1 starter worse.
4. **Two of a species is legal and sometimes right.** ratatoskr_v1 + ratatoskr_v2 is the purest zoo
   in the game (the same 0-cost fuel feeds both OSes). Not proposed above because it has no answer
   to Fire at all.
