# OS build directions — Henry's notes, 2026-09-21, organised and reviewed

**Source:** two handwritten pages (Henry, 2026-09-21). §1 is the transcription, organised; §2–§6 answer
his five questions. Grammar per 158 §2: an archetype is a *currency*, every card is *enabler / consume
/ scalar / glue*, an OS is one currency + one trigger, and (§2.6, ruled the same day) a kit's two payoffs
must not share a counter. Current deck lists are read off `mingmingRegistry.ts`; gym comps off `gyms.ts`.

---

## 1. The notes, organised

**The three archetypes as Henry drew them** (page 1, top): *zoo → ramp → control.*

| | zoo | ramp | control |
|---|---|---|---|
| Henry's list | small-cost cards · multi-hit · draw · Str · Dazed | payoff/consume cards · add Energy · big cards | statuses: Weakened · Sharp · Poison · Burn · daemons |

**Per OS — the two (or three) build directions.** *(?)* marks Henry's own question marks.

| OS | direction A | direction B | notes / (?) |
|---|---|---|---|
| **Fenrir v1** — Str + recoil | **Ramp:** deplete health → increase damage | **Zoo:** build Str + consume | (crossed out: a Str-consume ramp) |
| **Fenrir v2** — Burn → self Sharp | **Ramp:** low-cost Burns + Sharp; Sharp consume | **Control:** Burn-focused with daemons — *when attacked apply Burn*, *Burn whole side* | |
| **Sköll v1** — +1 Str when ally takes damage | **Ramp:** build Str + consume | **Zoo:** build Str + multi-hit *(?)* | "same shape as Fenrir v1" |
| **Sköll v2** — *change to Burn* | OS **option A:** Overburn — Burn deals 2× / triggers twice *(?)* | OS **option B:** add Burn when attacked — *does Sköll need to become a tank? (?)* | **Control:** redirect attacks to self *(new engine change)* + build Sharp + apply Burn · **Zoo:** lots of Burns + Burn scalar |
| **Huldra v1** — buffs → Weakened | **Control:** Weaken enemies with self-buff riders; scale on Weakened stacks | **Control:** sustain — heals + buffs while Weakening; *enable other decks* | (crossed out: "add some sustain maybe?") |
| **Huldra v2** — Bark Shield | **Ramp:** "bark smash" — build shield, damage scalars/consume with shield | **Control:** Poison + sustain/shield allies | |
| **Rat v1** — 0e → heal | **Zoo:** multi-hit + Dazed statuses; scalar on cards played | **Control:** sustain with Poison | |
| **Rat v2** — 0e at enemy → Dazed | **Zoo:** like v1, heal → more damage/Dazed; scale on Dazed + cards played | **Ramp:** 0e gets cheap statuses but play around X-Energy cards that add Poison or scale on Dazed *(?)* | |
| **Jorm v1** — 5th Water card draws | **Zoo:** Water draw cards; scale on cards played *(or drawn too? (?))* | **either** Zoo on card draw **or Ramp:** grow Energy so draw feeds Energy; permanent Energy from a daemon or two, then 3e Water cards | |
| **Jorm v2** — +10/Poison on attacks | **Zoo:** quick/cheap Poison + damage riders; cards-played scalar | **Control:** Weaken/Daze enemy, big Poison piles, Poison-when-attacked daemons **or Ramp:** Energized → big Poison piles with Xe Poison cards; trigger Poison with cards (Toxic Surge) | control *or* ramp — undecided |
| **Kraken v1** — off-phase draw → Dazed | **Zoo:** draw cards, low-cost Dazed; damage scales on cards drawn | **Control:** Dazed + Weakened + some draw; consume enemy stacks; *mostly enable allies* | |
| **Kraken v2** — Water ≥ 2e +30% | **Ramp:** Energized → big attacks | **Ramp:** permanent daemons grow Energy, then hit hard | two ramps |

---

## 2. Thoughts on the directions, and the question marks

The principle is right — two directions per OS, one of them pointed at a partner — and about two thirds
of the table survives as written. Where it feels forced is where the same direction is written under two
OSes, and the table makes that visible: **"build Str + consume" appears four times** (Fenrir v1 ×1,
Sköll v1 ×1, and the crossed-out Fenrir ramp was a third), **Kraken v2's two ramps are one ramp**, and
**Jörmungandr v2 has three Poison directions**. Those are the forced ones. Everything else is a re-cut.

The question marks, one by one:

**Sköll v1 — "build Str + multi-hit?"** Yes, and it is the *distinction* between Sköll and Fenrir, not
a variant of it. `combatUtils` adds the status power **per hit**, so a 3-hit card with 4 Str is three
+4s; multi-hit is the Str *scalar* by engine math, the way Unbound Fang / Sun Devourer are the Str
*consume*. So: Fenrir v1 = Str **consume** (+ HP as a resource, which nobody else has); Sköll v1 = Str
**multi-hit scalar**. Then drop Sköll's "ramp: build Str + consume" — it is Fenrir's — and give Sköll
v1 its second direction from its OS: TREACHERY grows when *allies* take damage, so Sköll wants allies
to survive chip damage. Second direction = **deny** (Sharp on self, Weakened on the attackers) and
**battery**: Sköll's Str is a party currency, because UNBOUND_KERNEL already reads allies' attacks.
Needs one printed card: a Fire multi-hit (Pebble Flurry is Earth, Serpent Flurry is Water).

**Sköll v2 — 2× Burn or triggers twice?** Neither, as it turns out: Burn in this engine is **permanent
and capped at 4** (1.5/3/5/8% max HP a tick, no decay, and going past the cap *detonates*). With no
decay, "triggers twice" and "2×" are the same number, and that number is THERMAL_OVERLOAD's daemon
(+50% Burn damage). So option A is a reskin. The mechanic nobody owns is the **detonation**: an OS that
pushes piles past 4 — *"Sköll's attacks on a Burning target apply +1 Burn"* — makes a cheap-Burn zoo into
a detonation deck, and it is distinct from Fenrir v2 (Burn → Sharp) and Kraken v2 (steam). **Option B
(Burn when attacked)** duplicates Fenrir v2's control daemon *and* Sköll v1's shape (grow on being hit).
Skip it. **Does Sköll need to become a tank?** No. Fire's tank is Fenrir v1 spending HP; the party's tank
is Huldra v2 (Bark). **Redirect** is real engine work (a taunt: targeting rules + the AI's target choice
+ every measurement) — it is the one deny tool that is not a status, which is a good reason to want it
*someday*, and a bad reason to build it into the twelfth EA deck. Sköll v2 = **detonation** (attacks add
Burn to Burning targets; Heat Wave doubles a side's pile) + **Zoo** (cheap Burn riders, a Burn scalar).
That is a full rework of the current Str deck — the only one on the page (§5).

**Rat v2 — ramp with X-Energy cards?** Drop it. INSTIGATOR fires on **0e** casts; ramp wants big casts;
a hand cannot serve both and the OS will sit idle on the ramp turns. Rat v2's second direction is the one
its OS already points at: **Dazed as a binary rider** — Nagging Bite's "+20 if the target is Dazed",
Pressure Point's "if Dazed, draw". That is *distinct* from Kraken v1's per-stack Dazed consume (Crushing
Depths / Slander): Rat asks "is it Dazed?", Kraken asks "how Dazed?". Slander (10 per Dazed stack) should
move to Kraken; Rat keeps the binaries.

**Jorm v1 — cards played, or drawn too?** *Played.* "Cards drawn" is Kraken v1's currency (ABYSSAL_INK,
Ink Stream); "cards played" is OUROBOROS's (the 5th Water card). Today both decks run **Ink Stream ×2**,
which is exactly why they feel like the same deck — move Ink Stream out of Jorm v1. Between "zoo on draw"
and "ramp", take **ramp**: Surge Protection (*refund 1 Energy if you drew this turn*) is already in the
deck and it is a ramp shape nobody else has — cards that *refund*. So Jorm v1 = cards-played scalar
(Serpent's Coil) + refund-ramp (Surge Protection, Corrosive Leak's Energized). No permanent-Energy
daemon needed.

**Jorm v2 — control or ramp?** *Ramp.* The control direction (Weaken/Daze + big Poison piles) is Huldra
v1's Hexbloom lane and Rat v2's rider lane wearing a Poison hat. Jorm v2's unique thing is the
**multi-hit × per-Poison scalar** (Serpent Flurry's three hits each +10 per Poison — the same per-hit
math as Sköll's Str), and its ramp is **Contagion + Toxic Surge**: double the pile, then trigger it —
a consume. That is the current deck almost card for card.

**Kraken v2 — two ramps.** One ramp (Capacitor/Energized → Maelstrom/Hydro Blast). The second
direction is already in the deck and was not on the page: Boiling Surge and Scald are **Burn** — Kraken
v2 is a *steam* deck. Keep it: Burn is a Water body's bridge to CINDER_WALL (which reads *any* ally's
Burn) and to Sköll v2's detonation. Kraken v2 = ramp + steam-Burn control.

**Huldra v1 — two controls.** Both are control by name; the difference is real, so rename it: A is
**control** (Weakened scalar — Thorn Tithe — and the Hexbloom consume), B is **keeper** (Sharp/Regen/
Bark *to allies*, which ALLURE_PROXY converts into Weakened for free). B is the ally-target card the game
does not have yet (158 R3) and the cheapest bridge on the page.

**Huldra v2 — Bark ramp + Poison.** Bark as a currency with Bark Lash as its scalar is good and unique.
The Poison half is the one Poison direction outside Jörmungandr worth keeping, because Thornguard's
"3 Poison *if you are shielded*" is a **converter** (Bark → Poison), not another applier, and TOXIN_FANG
reads it. Keep; take the Poison out of Rat instead (§6).

**Fenrir v2.** As written. Two things to print: a **Sharp consume** (Cinder Lance is the scalar; there is
no "consume Sharp: X per stack"), and the "when attacked, apply Burn" daemon.

**Fenrir v1.** As written, and the strongest pair on the page: HP-as-resource is a currency no other OS
touches (Ragnarok Edge, Blood Rite, War Pact's half-HP fork all exist).

---

## 3. Status and payoff census — what is overused, what is a reskin

Counting Henry's 24 directions as written (before the §2 changes):

| currency / payoff | directions | verdict |
|---|---|---|
| **Poison** | 7 (Rat v1, Rat v2, Jorm v2 ×3, Huldra v2, + Huldra v1's Hexbloom) | **overused** — Henry's read is right. After §2/§6: Jorm v2 (scalar + consume), Huldra v2 (converter), Huldra v1 (converter). Three, each a different shape. |
| **Dazed** | 6 (Rat v1, Rat v2 ×2, Kraken v1 ×2, Jorm v2) | high, but two *shapes* survive: Kraken's per-stack consume, Rat's binary rider. Drop it from Jorm v2. |
| **Strength** | 4 — all "build + consume" | **reskin ×4** → Fenrir consume / Sköll multi-hit scalar. |
| **Energy (ramp)** | 5 (Jorm v1, Jorm v2, Rat v2, Kraken v2 ×2) | three of the five are "Energized → big card". After §2: Kraken v2 (Energized → big), Jorm v1 (refund), Jorm v2 (double-then-trigger). Three shapes. |
| **Cards played** | 4 (Rat v1, Rat v2, Jorm v1, Jorm v2) | fine — it is the zoo scalar; but it needs the *draw* enablers below to exist. |
| **Cards drawn** | 3 (Jorm v1 ?, Kraken v1 ×2) | **underused as a currency, and that is correct** — one owner (Kraken v1). Where draw is missing is as *glue* (§6). |
| **Burn** | 4 (Fenrir v2 ×2, Sköll v2 ×2) + Kraken v2 unlisted | good after Sköll's rework: converter (Fenrir), detonation (Sköll), steam (Kraken). |
| **Weakened** | 4 (Huldra v1 ×2, Kraken v1, Jorm v2) | only Huldra *reads* it (Thorn Tithe, Hexbloom). Fine as the Str counter everyone can apply, one reader. |
| **Sharp** | 2 (Fenrir v2, Sköll v2) + Huldra v1 keeper | **underused as a payoff** — two scalars (Cinder Lance, Thorn Whip), no consume. Print one. |
| **Bark** | 1 (Huldra v2) | unique. Good. |
| **HP as resource** | 1 (Fenrir v1) | unique. Good. |
| **Multi-hit** | 2 (Rat v1, Sköll v1) + Jorm v2's Serpent Flurry | the per-hit math makes multi-hit the scalar for *any* additive currency (Str, Dazed on target). Three owners, three currencies — not a reskin. |
| **Sustain** | 3 (Huldra ×2, Rat v1) | fine as control's deny half; Rat's should be the 0e-heal it already is, not Poison. |

**Consumes on the page:** Str (Fenrir), Sharp (Fenrir v2, to print), Dazed (Kraken), Weakened →
Poison (Huldra v1), Poison (Jorm v2 via Contagion + Toxic Surge), Burn → heal (Ash Communion), Bark
(to print, "bark smash"). **Every currency but cards-played and Energy has a consume** once the two
prints land — and those two are the ones that *should* be scalar-only (you cannot "consume" a turn's
cast count twice).

---

## 4. Synergies, and two teams per gym

**Who makes what, who reads what** (after §2):

| currency | makers | readers on another body |
|---|---|---|
| Strength | Sköll v1 (battery), Fenrir v1 | UNBOUND_KERNEL reads allies' attacks; Weakened cancels it (Huldra) |
| Burn | Fenrir v2, Sköll v2, Kraken v2 (steam) | CINDER_WALL (any ally's Burn → Sharp); Sköll v2's detonation |
| Sharp | Huldra v1 keeper (to allies), Fenrir v2 | Cinder Lance / Thorn Whip / KINETIC-style scalars — "Sharp *you* hold", so the keeper's gift is read by whoever holds it |
| Weakened | Huldra v1 (via any ally's buff), Kraken v1, Rat v2 riders | Thorn Tithe scalar, Hexbloom consume |
| Dazed | Kraken v1 (draw), Rat v2 (0e) | Crushing Depths / Slander (per stack), Nagging Bite (binary), and **every attack** — Dazed on the target is +power per hit for the whole side |
| Poison | Jorm v2, Huldra v2 (if shielded), Huldra v1 (Hexbloom) | TOXIN_FANG (+10/stack on Jorm's attacks — reads the target, so anyone's Poison) |
| cards played / drawn | Jorm v1, Rat v1, Kraken v1 | OUROBOROS (side's 5th Water card), ABYSSAL_INK (side draws), GOSSIP (any ally's 0e) |
| Energy | Jorm v1 refund, Kraken v2 | Tidal Battery (side), TIDAL_CRUSH |
| Bark | Huldra v2 (self + allies) | Bark Lash; Thornguard's conditional |

**The counter cycle:** Fire > Nature > Water > Fire. A gym's *counter* element is the one that beats it.

**Emberfall (Fire): fenrir_v1 · skoll_v1 · jormungandr_v1** — a Str party with a draw engine.
- *Team 1 — Weaken the wolves:* **Huldra v1 + Kraken v1 + Jorm v1.** Water STAB into Fire; Undertow
  feeds both OUROBOROS and ABYSSAL_INK (Dazed for free); Huldra's buffs on the two Water bodies become
  Weakened on Fenrir and Sköll, which cancels their Str stack for stack — the direct answer to a
  Str gym. Hexbloom converts the pile.
- *Team 2 — Daze and flurry:* **Rat v2 + Jorm v2 + Kraken v2.** Rat's 0e casts put Dazed on the
  target (INSTIGATOR); Dazed is +power *per hit*, so Serpent Flurry's three hits and TOXIN_FANG's
  per-Poison bonus stack on the same target; Kraken v2's Capacitor turn lands Hydro Blast on whatever
  is left. Two Water bodies for STAB, one Nature body Fire will punish — bench-risk noted.

**Tidewrack (Water): kraken_v1 · jormungandr_v1 · huldra_v2** — a draw zoo behind a Bark wall.
- *Team 1 — Poison through the wall:* **Huldra v2 + Jorm v2 + Rat v2.** Nature STAB into Water;
  Poison is a % of max HP through `executeStatusDamageCalculated`, not the power formula, so Sharp does not reduce it —
  the reason DoT is the answer to walls (the ticket-94 absolutes were all walls). Thornguard (Poison
  if shielded) + Contagion + TOXIN_FANG. Daemon slot: **SHORT_CIRCUIT** — 15 per off-phase draw punishes
  both Kraken v1 and Jorm v1's engines directly; with 159's face-up hand the player can see it coming.
- *Team 2 — the keeper party:* **Huldra v1 + Rat v1 + Sköll v1.** Rat's 0e zoo heals via GOSSIP;
  Huldra's ally buffs Weaken the Water zoo and Sharp keeps the chip damage small, which is exactly the
  damage TREACHERY wants — Sköll's Str comes free and Sun Devourer ends it. Nature ×2 + Fire ×1, the
  Fire body is off-STAB here but is never countered (Water beats Fire — so Sköll *is* at risk; the
  alternative third is Fenrir v2 for CINDER_WALL, same risk).

**Rootfall (Nature): kraken_v1 · ratatoskr_v1 · huldra_v1** — Sharp, Regen, Weakened; a deny gym.
- *Team 1 — the 141 comp:* **Fenrir v1 + Sköll v1 + Huldra v1.** Fire ×2 + Nature; Sköll batteries
  Str into Fenrir's consume; Huldra's buffs Weaken the gym's attackers and her Soothe clears the
  Weakened they put on the wolves (Weakened is *their* Str counter too). This is the comp 141-GYM-CHECK
  was built to pass.
- *Team 2 — burn the forest:* **Fenrir v2 + Sköll v2 + Kraken v2.** Burn is % max HP and ignores Sharp, and Regen (2%/turn) loses the race to a 3-stack pile (5%); Inferno hits the side; Sköll's attacks push the piles to 4 and detonate them; Kraken's steam Burn feeds CINDER_WALL
  so Fenrir gains Sharp against the gym's attacks. The Water body is countered by Nature — bench risk —
  but it is the party's only non-Fire body and Kraken v2's big hits are its own plan.

Every gym has one team built on **status damage** (Poison or Burn) and one on **cancelling the gym's
currency** (Weakened vs Str, Sharp/Soothe vs Weakened, SHORT_CIRCUIT vs draw). That is the two-paths
rule at party scale.

---

## 5. Distance from the current decks

| OS | current deck → the page | cards to print | rework? |
|---|---|---|---|
| Fenrir v1 | already this deck (Ragnarok Edge, Blood Rite, War Pact, Unbound Fang) | 0 | no — re-cut |
| Fenrir v2 | Ignite/Molten Core/Cinder Lance/Ash Communion are the ramp; Inferno exists for control | Sharp consume; Burn-when-attacked daemon | no |
| Sköll v1 | Sun Devourer/Fury Strike are Fenrir's shape; Crimson Draw is sustain | one Fire multi-hit; one deny card | **partial** — half the kit turns over |
| Sköll v2 | a Str deck today (Strength Burst, All In, Overdrive) | new OS; Burn scalar; ~6 cards | **full rework** — the only one |
| Rat v1 | Forage/Seed Bomb/Echo Chamber are the zoo; Seed Spit/Nettle Sting are the Poison to remove | replace 2 Poison riders with Dazed/heal riders | no |
| Rat v2 | Pollen Cloud/Nagging Bite/Crippling Vine/Slander | move Slander to Kraken; drop ramp | no |
| Jorm v1 | Undertow/Serpent's Coil/Surge Protection/Corrosive Leak | remove Ink Stream ×2; +1 refund card | no |
| Jorm v2 | Corrosive Bolt/Contagion/Toxic Surge/Serpent Flurry | 0 — the ramp direction *is* this deck | no |
| Kraken v1 | Whirlpool/Ink Stream/Crushing Depths/Undertow | + Slander from Rat | no |
| Kraken v2 | Capacitor/Maelstrom/Hydro Blast/Boiling Surge/Scald | 0 | no |
| Huldra v1 | Growth/Iron Bark/Thorn Tithe/Hexbloom/Thorn Whip | 2 ally-target cards (Sharp/Regen to an ally) | no — needs the ally-target *engine* path |
| Huldra v2 | Heartwood/Thornguard/Bark Lash/Blightbloom | Bark consume ("bark smash") | no |

So: **one rework (Sköll v2), one half-turn (Sköll v1), ten re-cuts**, roughly eight printed cards, and
one small engine feature (ally-target cards). That is much less than 151 feared.

**Will it fix "team building feels bad"? Not on its own.** Read honestly, the page is ~75% the decks you
have with better labels. What changes the *feeling* is the part of the page that is not cards:
1. **Payoffs that read anyone's stacks.** TOXIN_FANG says "on the target" and is the one payoff on the
   roster a partner can feed. Most scalars say "you hold" / "you played". The re-cut must print each
   currency's reader as *on the target* / *this side*, or the party is still three solitaires.
2. **The duplicates leaving.** Ink Stream in both Water decks, Str-consume in both Fire decks, Poison in
   five decks: those are why every party felt like the same party. The census in §3 is the fix list.
3. **The second direction being the partner's.** Sköll as Str battery, Huldra as buff-giver, Kraken as
   Dazed-maker, Huldra v2 as Bark-giver — each is a direction that only pays off *with* someone. That
   is the drift that matters, and it is on the page.
4. **The recruit screen saying the currency** (78's readout) — so a player builds toward a pair instead
   of discovering one.

---

## 6. Draw under-utilised, Poison over-utilised — confirmed, with the fix

**Poison:** seven directions on the page, five current decks carry it (Rat v1 Seed Spit/Nettle Sting,
Rat v2 Pollen Cloud/Crippling Vine, Jorm v2, Huldra v1 Hexbloom, Huldra v2). Fix: Poison stays with
**Jörmungandr v2 (owner)**, **Huldra v2 (Bark → Poison converter)** and **Huldra v1 (Weakened → Poison
consume)**; leaves Rat entirely (Seed Spit → a Dazed or heal rider; Pollen Cloud keeps Weakened, loses
Poison; Crippling Vine keeps Weakened + Dazed). Three owners, three shapes.

**Draw:** as a *currency* it is correctly rare (Kraken v1). As **glue** it is missing — 158 R7 wants
every kit to hold a draw or Energy generic, and today only the Water decks and Rat v1 (Forage) do.
Fire has none; Nature has Forage (with a 15-power self-hit tax). Fix: one plain draw per kit as the
fifth (glue) card — Undertow is Water; print a None-element "draw 1" at 0e or 1e (Squirrel Away is 1e
draw 2, None — it can be the template) so the glue is castable from any hand at ×1.0. That single card
does more for "one deck, not three" than any payoff, because it is the card every hand wants.

---

## 7. What to do with this

- 158 §2 stands; add this file's §2 rulings and §3 census as the first pass of the shape census.
- The 151 sessions run in this order, cheapest drift first: **Jorm v1** (remove Ink Stream), **Rat v1/v2**
  (Poison out), **Kraken v1/v2** (Slander in; nothing else), **Fenrir v2** (Sharp consume), **Huldra
  v1** (ally-target cards — needs the engine path), **Sköll v1** (Fire multi-hit), **Sköll v2** (the
  rework), last.
- Print list (eight): Fire multi-hit, Sharp consume, Bark consume, None-element draw glue, Burn-when-
  attacked daemon, two ally-target Nature cards, a Sköll v2 Burn scalar.
- Engine: ally-target cards (a target picker; the UI has none); Sköll v2's OS trigger (attack on a Burning target → +1 Burn) is an ordinary hook. Redirect/taunt: written down, not built.
