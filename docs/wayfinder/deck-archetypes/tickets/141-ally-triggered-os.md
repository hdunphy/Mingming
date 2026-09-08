# Ticket 141 — Ally-triggered firmwares for the Early Access twelve

> **Status: CLOSED 2026-09-08** — done — shipped 2026-09-05; gym check PASS (141-GYM-CHECK.md), ship read in 141-SHIP-READ.md. Closed in the ticket audit (`../TICKET-AUDIT-2026-09-07.md`).

**Status:** approved by Henry 2026-09-04, ready for Legion
**Branch:** `legion/ai-perf`, one commit per lettered row, authored as Henry
**Grounded in:** ticket 140's comp grid, round 1 (`results/compgrid/`, 144 comps × 10 battles, panel round robin at 40 battles a cell)

---

## 1. Why

Round 1 of the 3v3 comp grid split the field on a single firmware. Comps containing kraken_v1
average **68**; the other 108 comps average **27**. All twelve comps scoring 80+ contain kraken_v1,
the three best pairs in the game are kraken_v1 + a Water partner, and the field beats the two
kraken_v1 panel comps 18% and 25% of the time against 43–55% for the other three.

It is not the ally trigger by itself. ABYSSAL_INK stacks three things: it fires on **any ally's**
effect-draw, it pays out on **every enemy**, and the payout is Dazed — a duality status, +1 power a
stack, uncapped. TREACHERY (skoll_v1) is ally-triggered with a self payoff and averages 42;
GOSSIP_NODE (ratatoskr_v1) is side-wide with a self trigger and averages 32. Either half alone
measures as a normal firmware. Both halves together on an uncapped status is the outlier.

Meanwhile the width findings (ticket 112) say per-card firmwares fire at ×0.25–×0.55 their 1v1 rate
at 3v3 because the shared hand splits plays three ways. That is the mechanical reason "adding a
second Mingming feels bad": every OS but two goes quiet. Ally triggers multiply the fire rate back
by roughly three, so an OS fires at about its 1v1 rate again — and the deck-building question
becomes *which three firmwares read each other's cards*, which is the question we want players
asking.

**The rule (Henry, 2026-09-04): any ally can pull the trigger; the OS pays its owner.** Nothing
side-wide and ally-triggered survives. Kraken_v1 is pulled into the rule from the payoff side;
everything else is pulled in from the trigger side.

**The engine fact that makes this cheap:** `when.source: "ALLY"` matches *same side*, owner
included (`ConditionValidator.ts:42`; kraken_v1 already fires on his own draws in 1v1 through it).
So a SELF → ALLY swap changes nothing at 1v1 — the ally set is the owner — and only changes 3v3.
Seven of the nine rows below are 1v1-invariant by construction. Two (141c, 141d) are not and carry
a 1v1 gate.

Hook vocabulary used below, all existing: `when.source` ∈ SELF/ALLY/OPPONENT/ANY;
`when.statusAppliedNotIn`; action `target` ∈ SELF/TARGET/**SOURCE**/ALLIES/ENEMIES/RANDOM_ENEMY
(`SOURCE` = the acting unit, `HookFactory.ts:353`); `NEGATIVE_STATUSES` =
Burn, Poison, Asleep, Weakened, Dazed, Stunned, Bleed (`ConditionValidator.ts:10`). No engine
changes are needed for any row.

---

## 2. The rows

Every description below is the card-visible text; every number in it is visible on the OS. No
hidden math, no caps, no turn gates — the ticket-136 rulings apply.

### 141a — kraken_v1 ABYSSAL_INK_SYS: every enemy → one random enemy

The payoff shrinks; the ally trigger stays (it is the synergy we want to keep).

```json
"kraken_v1": {
  "id": "kraken_v1", "name": "ABYSSAL_INK_SYS",
  "description": "Whenever Kraken's side draws a card outside the draw phase, apply 2 Dazed to a random enemy.",
  "hooks": [{
    "id": "kraken_v1_hook", "trigger": "onCardDraw", "priority": 40,
    "when": { "source": "ALLY", "isNaturalDraw": false },
    "do": [
      { "type": "STATUS", "target": "RANDOM_ENEMY", "status": "Dazed", "stacks": 2 },
      { "type": "LOG", "text": "Abyssal Ink blinds an enemy!" }
    ]
  }]
}
```

1v1: unchanged (one enemy is every enemy). Draws have no target, so random is the only honest
single-target version.

### 141b — fenrir_v1 UNBOUND_KERNEL: allies' attacks feed him, without the recoil

Split the hook. The self hook keeps the recoil and drops to 1 Strengthened; a new ally hook adds
1 Strengthened with no recoil. Because ALLY includes Fenrir, his own attacks match both hooks and
still net **2 Strengthened + 2% recoil** — 1v1 is unchanged to the decimal. Ally attacks are
+1 Strengthened, no self-damage.

```json
"fenrir_v1": {
  "id": "fenrir_v1", "name": "UNBOUND_KERNEL",
  "description": "Attack programs apply 2 Strengthened and deal 2% Max HP recoil damage. Allies' attacks apply 1 Strengthened to Fenrir. Fire attacks deal up to 50% more damage, scaled by how much of your max HP is missing.",
  "hooks": [
    {
      "id": "fenrir_v1_hook", "trigger": "onActionStart", "priority": 40,
      "when": { "source": "SELF", "actionType": "ATTACK" },
      "do": [
        { "type": "STATUS", "target": "SELF", "status": "Strengthened", "stacks": 1 },
        { "type": "HP", "target": "SELF", "percentMaxHP": -2 },
        { "type": "LOG", "text": "{owner} pushes its core to the limit!" }
      ]
    },
    {
      "id": "fenrir_v1_ally_hook", "trigger": "onActionStart", "priority": 41,
      "when": { "source": "ALLY", "actionType": "ATTACK" },
      "do": [{ "type": "STATUS", "target": "SELF", "status": "Strengthened", "stacks": 1 }]
    }
  ]
}
```

The 50% missing-HP scaler is code, not a hook; untouched. Henry's concern on record: uncapped Str
from three attacking bodies could be hot at width — which is why the ally half is 1, not 2, and why
§4 watches average turns.

### 141c — fenrir_v2 CINDER_WALL_OS: any ally's Burn

```json
"fenrir_v2": {
  "id": "fenrir_v2", "name": "CINDER_WALL_OS",
  "description": "Whenever an ally applies the Burn status to any unit - including themselves - Fenrir gains a stack of Sharp.",
  "hooks": [{
    "id": "fenrir_v2_hook", "trigger": "onStatusApplied", "priority": 40,
    "when": { "source": "ALLY", "statusApplied": "Burn" },
    "do": [
      { "type": "STATUS", "target": "SELF", "status": "Sharp", "stacks": 1 },
      { "type": "LOG", "text": "{owner} feeds on the flames!" }
    ]
  }]
}
```

1v1 unchanged. Two Burn bodies stop competing for the 4-stack cap and start feeding him instead.
He is the weakest body at width (27) and the one I expect this to move most.

### 141d — skoll_v2 SOLAR_OVERDRIVE_OS: allies' Fire attacks charge her

SOLAR_OVERDRIVE is code (`CustomFirmware.ts`, `SKOLL_V2_DAMAGE_PER_STRENGTH = 0.15`); it stays.
Add a **data hook** in `hooks.json` alongside the empty `hooks: []` (the code firmware and the data
hook coexist the way skoll_v1's do):

```json
"skoll_v2": {
  "id": "skoll_v2", "name": "SOLAR_OVERDRIVE_OS",
  "description": "Skoll's attacks deal +15% damage per stack of Strength she holds. No cap. Whenever an ally plays a Fire attack, Skoll gains 1 Strengthened.",
  "hooks": [{
    "id": "skoll_v2_solar_charge", "trigger": "onActionStart", "priority": 40,
    "when": { "source": "ALLY", "actionType": "ATTACK", "programElement": "Fire" },
    "do": [{ "type": "STATUS", "target": "SELF", "status": "Strengthened", "stacks": 1 }]
  }]
}
```

**Not 1v1-invariant** — her own Fire attacks now charge her. She is 52 at 1v1. **Gate:** run her
single-deck row; if she lands above 60, drop `SKOLL_V2_DAMAGE_PER_STRENGTH` to 0.10 and update the
text to "+10%". Report both numbers. Why this shape: her OS *is* the payoff and her only Str source
was her own cards, a third of the pile at width (31, 11th of 12). This makes her the Fire pair's
payoff (fenrir_v1 + skoll_v1 is already the best Fire pair at 54) and gives all_in /
reckless_charge / desperate_strike a comp to live in.

### 141e — skoll_v1 TREACHERY_KERNEL: 1v1 row only, no 3v3 change

Already ally-triggered. She is **34.4, out of band** at 1v1, 42 at width. Two arms, single-deck
rows, ship whichever lands in 45–60 and is closer to 50:

- **e1:** `stacks: 2` — "Whenever an allied Mingming takes damage from an enemy attack, Sköll gains 2 stacks of Strengthened."
- **e2:** stacks stay 1; `sun_devourer` 20 → 25 per stack (card text updated).

Henry's earlier ruling not to push her was about the round-three grid; he re-opened it 2026-09-04.
If e1 overshoots (enemy attacks 2–3 a turn is +4–6 uncapped Str a turn), e2 is the answer.

### 141f — huldra_v1 ALLURE_PROXY: any ally's buff, one random enemy

Trigger opens to the side; the payoff stays single-target. With `source: ALLY` the hook would also
see self-debuffs (kraken_v2's Scald, fenrir's Pyre Sacrifice), so it takes the ticket-107 guard:
any status *except* the negative list.

```json
"huldra_v1": {
  "id": "huldra_v1", "name": "ALLURE_PROXY",
  "description": "Whenever an ally applies a buff to an ally, Huldra mirrors it by applying 1 stack of Weakened to a random enemy.",
  "hooks": [{
    "id": "huldra_v1_hook", "trigger": "onStatusApplied", "priority": 40,
    "when": { "source": "ALLY", "target": "ALLY",
              "statusAppliedNotIn": ["Burn", "Poison", "Asleep", "Weakened", "Dazed", "Stunned", "Bleed"] },
    "do": [{ "type": "STATUS", "target": "RANDOM_ENEMY", "status": "Weakened", "stacks": 1 }]
  }]
}
```

1v1: the guard is a no-op for her own deck (she applies no self-debuffs), so unchanged; confirm
with a row anyway since the hook shape changed. Weakened is uncapped like Dazed — §4 watches it.

### 141g — huldra_v2 BARK_SHIELD_OS: the wall covers the side

Code firmware (`CustomFirmware.ts` `huldra_v2_bark_end`). Keep the timing (end of her first turn,
Henry's 2026-08-24 ruling) and extend the grant. Two arms, measured in §4 as g1 / g2:

- **g1:** Huldra `HULDRA_V2_SHIELD_PERCENT` (50) on herself, **25** on each other ally.
- **g2:** 50 on every ally.

Implementation: after the owner grant, iterate the owner's side (excluding the owner) and apply
`BarkShield` with the ally percent; same once-per-battle guard. Text (g1): "At the end of Huldra's
first turn, she raises a massive Bark Shield, and a smaller one around each ally." (g2: "…around
every ally.") 1v1 unchanged either way. This is the turn-one tempo control lacked in round 1 —
everything that lost to the zoo lost in the first three turns.

### 141h — ratatoskr_v1 GOSSIP_NODE: any ally's free card heals that ally

Flipping the trigger with the side-wide heal kept would be the kraken shape (zoo comps play 6–9
0-costs a turn at width → 15–20% max HP a turn to every body). The rule version:

```json
"ratatoskr_v1": {
  "id": "ratatoskr_v1", "name": "GOSSIP_NODE",
  "description": "Whenever an ally plays a 0-cost program, that ally heals 2.5% of their max HP.",
  "hooks": [{
    "id": "ratatoskr_v1_hook", "trigger": "onActionStart", "priority": 40,
    "when": { "source": "ALLY", "baseCost": 0 },
    "do": [
      { "type": "HEAL", "target": "SOURCE", "power": 10 },
      { "type": "LOG", "text": "{owner} spreads positive rumors!" }
    ]
  }]
}
```

1v1: the only ally is Ratatoskr, so "that ally" is him and "all allies" was him — unchanged.

### 141i — ratatoskr_v2 INSTIGATOR_OS: any ally's free card at an enemy

```json
"ratatoskr_v2": {
  "id": "ratatoskr_v2", "name": "INSTIGATOR_OS",
  "description": "Whenever an ally plays a 0-cost card at an enemy, apply 1 stack of Dazed to the target.",
  "hooks": [{
    "id": "ratatoskr_v2_hook", "trigger": "onActionStart", "priority": 40,
    "when": { "source": "ALLY", "target": "OPPONENT", "baseCost": 0 },
    "do": [{ "type": "STATUS", "target": "TARGET", "status": "Dazed", "stacks": 1 }]
  }]
}
```

1v1 unchanged.

### 141j — jormungandr_v1 OUROBOROS_LOOP: the side's fifth Water card

All three hooks' `when.source` SELF → ALLY (`jorm_v1_count`, `jorm_v1_trigger`, `jorm_v1_reset`);
counters stay on `target: SELF` so the count is Jörmungandr's and the draw is his.
Text: "Each turn, the 5th Water card your side plays draws 1 card."

1v1 unchanged (he is 71, the top of the 1v1 roster — nothing to give back). At width a Water pair
reaches five Water cards easily, and the draw feeds kraken_v1 — the jorm_v1 + kraken_v1 pair (78)
is the point.

### Left alone, on purpose

- **jormungandr_v2 TOXIN_FANG** — already reads the party's Poison; it is the reader, not a trigger.
- **kraken_v2 TIDAL_CRUSH** — an aura on cards, not a trigger; the non-Water bodies lose STAB on
  those cards anyway. 58 at 1v1, leave it.

---

## 3. Order and packaging

Ship in two commits so the grid can separate them:

- **Arm A = 141a alone** (the kraken fix). Commit first.
- **Arm B = 141a–141j** (the package). 141e ships whichever arm lands; 141g ships g1 unless g2
  measures better *and* keeps average turns ≥ 4 (see §4).

Each row: hooks.json (or CustomFirmware.ts for 141g), the OS description text, and the
`OSSystem.test.ts` / `OSReworks.test.ts` cases that assert the old shape updated to the new one.
Add one test per ally-triggered hook that an **ally's** action fires it and an **enemy's** does not
(`teamScenario` gives you three bodies a side). Do not touch card files — no card changes in this
ticket.

---

## 4. Acceptance — the two-arm comp grid

`scratch/compgrid.mjs` grew a `--comps <file>` flag (one comp id per line) and now writes
`ranked.txt` beside `SUMMARY.md`. The screen list is the **top 30 of the ticket-140 grid after
round 2**: `head -30 results/compgrid/ranked.txt > scratch/top30.txt` once round 2 has landed
(it is running now; do not start this before it finishes — the top 30 is noise at round 1).

Per arm, from a clean checkout of that arm's commit:

```
node scratch/compgrid.mjs --comps scratch/top30.txt --rounds 1 --panel-iters 20 --lanes 4 --outdir results/compgrid_armA
node scratch/compgrid.mjs --comps scratch/top30.txt --rounds 1 --panel-iters 20 --lanes 4 --outdir results/compgrid_armB
```

That is 400 panel battles + 300 screen battles an arm — about 7 hours an arm on 4 lanes at the
measured 137 s a battle, or half that overnight on 8. The panel comps are the ticket-140 five and
are unchanged; note that the panel's own firmwares change under arm B, which is intended — the
question is whether the *structure* holds.

Report, for baseline (round-1 numbers below), arm A and arm B:

| | field mean of the 30 | sd | kraken_v1 comps' mean vs the rest | avg turns | panel round robin |
|---|---|---|---|---|---|
| baseline (t.140 round 1) | see ranked.txt | — | 68 vs 27 (all 144) | 4.98 | zoo 79 / refA 68 / ctrl 47 / ramp 36 / refB 20 |

**Ship arm B if:** the kraken_v1 gap closes to within 10 points, the sd of the 30 falls, and average
turns stay **≥ 4.0**. If turns drop under 4, the package is too hot and the uncapped-status rows are
trimmed first, in this order: 141b's ally hook (drop, keep the self hook at 2 + recoil), 141f
(back to `source: SELF`), then 141d. Re-run arm B once after the trim.

**Ship arm A alone if:** arm B fails the turn floor after one trim, or B's field mean rises by more
than 15 points over A (that is power creep, not balance — both sides get it, but five-turn games
getting shorter is the thing Henry does not want).

Also run the 1v1 gates before either arm's grid: single-deck rows for skoll_v2 (141d), skoll_v1
e1 and e2 (141e), huldra_v1 (141f) — `node scratch/rebaseline.mjs --only skoll_v2,skoll_v1,huldra_v1`
on the arm-B commit, with the e1/e2 pair as two runs. Everything else in the package is
1v1-invariant by the ALLY-includes-self fact; a full 1v1 grid is not required, but if you run one,
zero cells should move outside skoll_v1, skoll_v2 (and huldra_v1 by ±2 noise).

---

## 5. What to write back

The usual: per-row commits, the gate rows with numbers, the three grid tables, and the ship
decision with its reason. If any hook does not match the way §2 assumes (in particular: that
`onActionStart` sees `programElement` for 141d, and that `target: "SOURCE"` resolves the acting
ally for 141h), say so before working around it — those two are the assumptions I did not run.
