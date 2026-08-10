# Ymir decks (ticket 50) — Ice completes: the wall is the weapon

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: [48-draugr-decks](48-draugr-decks.md) (closed)

*Designed with Henry 2026-08-09. Baselines read at **`5b4e1e0`, registryHash `1:5fa91002`** — i.e.
AFTER ticket 48 landed, so `glacial_slam` is already 15 power + Stun and `glacier_wall` is already
8 BarkShield. Scores from a Python port of `calculatePowerscale` validated **31/33** against that
report's `cardBudget.redlines` (misses: `fertile_ground_daemon`, daemon hooks not ported, and
`ash_communion`, a `consume` card — **no card here uses `consume`**). Re-score every new card with the
real scorer and report the numbers.*

---

## 1. What is actually wrong with Ymir

**Ymir is not weak. It is unkillable, and it cannot kill itself.**

| row | value | |
|---|---|---|
| `gauntlet:control-vs-ymir:ymir_v1` | **0.000** (100/100, 18.4 turns) | it beats the on-curve control every game |
| `gauntlet:control-vs-ymir:ymir_v2` | **0.000** (100/100, 15.3 turns) | same |
| `gauntlet:control-overall:slot1 / slot2` | 0.185 / 0.321 | the aggregates |
| `mirror:ymir` | **60.0 turns, 72/400 decided** | **the worst mirror in the roster** — TURN_COUNT + MIRROR_WIN_RATE redlines |
| `os:ymir` (§2.3) | **0.030**, 45.1 turns, 96/100 decided | **OUT OF BAND** (0.30–0.70): v2 wins 97% |
| dead cards | 0.000 / 0.000 | nothing is dead because the games never end |
| `flash_freeze` | 5.5 / 3.0 | Ice's last open card redline |

So this pass is **not** a power pass. It has three jobs, in order:

1. **Give the mirror a clock.** 60 turns at 72/400 decided is the standing redline.
2. **Make v1 a real deck** so §2.3 comes off 0.030.
3. **Do not raise absolute power** — and probably lower it (§5).

---

## 2. Species change: cardDraw 2 → 3

`mingmingRegistry.ts:445`. Henry: at draw 2 the hand size is the same constraint the OS already
imposes, so "pick 2 of 3" is a better decision than "play what you drew".

**Read §5 before assuming this fixes GLACIAL_PACE — it does not.**

---

## 3. `RIME_HEART_SYS` → `GLACIER_HEART_SYS`

Replace the whole `ymir_v1` entry in `src/engine/data/lib/hooks.json` (edit as **text** — that file
does not round-trip through `json.dumps`):

```json
    "ymir_v1": {
        "id": "ymir_v1",
        "name": "GLACIER_HEART_SYS",
        "description": "At the start of Ymir's turn, it gains 5 Bark Shield.",
        "hooks": [
            {
                "id": "ymir_v1_hook",
                "trigger": "onTurnStart",
                "priority": 40,
                "when": {
                    "source": "SELF"
                },
                "do": [
                    {
                        "type": "STATUS",
                        "target": "SELF",
                        "status": "BarkShield",
                        "stacks": 5
                    },
                    {
                        "type": "LOG",
                        "text": "{owner}'s GLACIER_HEART thickens. +5 Bark Shield."
                    }
                ]
            }
        ]
    },
```

**Why `onTurnStart` and not turn end — this is load-bearing.** On Ymir's 92 HP frame 1 BarkShield
stack absorbs **0.92 HP**, and the enemy deals **~16 HP a turn**; on-curve a 1-energy card buys 8
stacks = 7.4 HP. **Shields mitigate, they never accumulate.** A shield granted at end of turn is eaten
before Ymir acts, and the payoff card in §4 would read zero. Granting at turn start means he acts
holding this turn's 5 plus whatever survived, which is the number `avalanche` scales on.

**Why 5.** The 20%/turn decay self-caps the pile at 5× the grant, so there is no runaway even unhit:

| grant/turn | steady state unhit | HP absorbed/turn | power/game | mitigation of a 60-power turn |
|---|---|---|---|---|
| 3 | 15 stacks | 2.8 | 62 | 17% |
| 4 | 20 | 3.7 | 83 | 23% |
| **5** | **25** | **4.6** | **104** | **29%** |
| 6 | 30 | 5.5 | 124 | 34% |
| 8 | 40 | 7.4 | 166 | 46% |

104 power a game is where the other reworked OSes sit (PERMAFROST_WAKE ~150, the reworked BLOOD_SCENT
~100), and 29% mitigation reads as the strongest defensive OS in the roster without being a different
category — GRAVE_CHILL is a flat 20% and the Weakened cap is 25%.

**Two side effects worth recording.** Dropping RIME_HEART removes ymir_v1 from **H3 Retaliation**,
which `skoll_v1` owns — an archetype duplicate the catalog has flagged since ticket 08. And it creates
a *new* adjacency with **huldra_v2's BARK_SHIELD_OS**; the differentiator Henry accepted is
**huldra endures inside the shield's life, Ymir spends the shield as ammunition.** If the two decks
measure as the same deck, the lever is making `avalanche` consume the shield (§4).

---

## 4. `BARKSHIELD_STACKS` — a new source-side scaler

`avalanche` reads Ymir's **own** standing BarkShield. Clone the `DAZED_STACKS` branch in
`getEffectiveAttackPower` (`ActionExecutors.ts:~56`) but read `source` instead of `target`, uncapped
(Henry's law: cap only after measurement). Add the key to the `scaling` union (`types.ts:253`) and
price it at `ASSUMED_STATUS_COUNT` in powerscale's ATTACK branch alongside `DAZED_STACKS`.

**The trap: BarkShield stacks are FRACTIONAL.** `BarkShieldBehavior.onPostDamage` stores
`remainingPercent = shieldPercent − absorbedPercent` (`StatusBehaviors.ts:487-496`) and the end-of-turn
decay multiplies by 0.8, so a live shield is routinely something like 7.36 stacks. **`Math.floor` the
stack count inside the scaler**, or this reproduces ticket 36's fractional-product bug, where the
first fractional factor put 22.5 HP of damage into an entity.

`avalanche` does **not** consume the shield (Henry). The 20% decay and the enemy's damage already cap
the pile, and the AI eval prices BarkShield linearly at 80% of face
(`TacticalAI.ts:158-160`), so there is no eval blocker in either direction.

Static score is a **floor, not a price** — powerscale assumes 3 stacks:

| | 5 stacks | 8 | 12 | 20 |
|---|---|---|---|---|
| 9 power/stack (**2.7 / 6.5 static**) | 45 power | 72 | 108 | 180 |

Realistic cast is 7–10 stacks (the OS's 5 plus survivors) for **63–90 power**. Same caveat class as
`slander` and `rimebreaker`.

---

## 5. GLACIAL_PACE's cap is inert — and cardDraw 3 does not change that

**At 2 Energy with no 0-cost cards, the maximum number of cards Ymir can play in a turn is already
2** (two 1e, or one 2e). `maxCardsPerTurn: 2` is exactly the energy cap. **The drawback does not
exist**, which is the whole reason v2 wins **97% of 96 decided games** against v1 today on an
identical placeholder deck.

cardDraw 3 makes "pick 2 of 3" a real choice and starts accumulating +1 card a turn toward the 9-card
hand cap — that is *card* pressure, and it is worth having. It is not an *energy* trade, and the cap
still never binds. The only way to make it bind is 0-cost cards, which v2 deliberately does not run
(Henry). Capping at 1 card/turn was considered and rejected: at draw 3 he would shed two cards a turn,
the hand would be full by turn 4, and the dead-card ratio would blow past 0.35.

**So GLACIAL_PACE is a straight damage buff with a flavour cap.** Keep the cap — it is a guard against
a future 0e-heavy build — and price the OS honestly as a pure bonus.

**Ship at +25%, not +35%.** Henry pre-authorised 15–35. The evidence for starting at the lower end:
ymir beats the control **100/100 in both slots**, and §2.3 reads **0.030** over 96 decided games,
which is a much stronger signal than the 37-decided sample this was last judged on. +25% on ~60
power/turn is ~90 power/game, which is a normal OS size; +35% is ~126 and is being paid for by
nothing.

The multiplier is **hardcoded TypeScript, not data** — `src/engine/core/CustomFirmware.ts:198-210`:

```ts
                if (context.source?.id === owner.id && context.program?.element === 'Ice') {
                    // Ticket 09: softened from 50%. Ticket 50: 0.35 -> 0.25, and see the ticket for
                    // why the maxCardsPerTurn drawback that was supposed to pay for it is inert.
                    return currentDamage + Math.floor(currentDamage * 0.25);
                }
```

Update the `description` string in `hooks.json` to match. **powerscale cannot see this multiplier** —
it is firmware, not card data — so every Ice card in v2 is worth 25% more than its printed score says.

---

## 6. `shatter` is structurally dead, and Henry called it before the code did

Henry: *"we should also replace shatter, it will never be used since the stun is 2e."* Confirmed:

`StunnedBehavior.endTurn` always returns `updatedInstance: null` (`StatusBehaviors.ts:320-329`), and
the end-of-turn status loop processes the **active** side — so a Stun applied on Ymir's turn T ticks
off at the end of the *enemy's* turn and is **gone before Ymir's turn T+1**. `shatter`'s
"+15 power if the target is Stunned" therefore requires the stun and the payoff **in the same turn**,
which after ticket 48 costs 2e + 1e = **3 energy**. No Ice species has it.

`shatter` leaves both decks and joins `frost_jab`, `hoarfrost`, `cold_snap` and `winters_grasp` as
drop-only collection cards. **Do not re-cost it in this ticket.** If it is ever wanted back, the fix
is to make it 0-cost at reduced numbers (2e stun + 0e payoff fits a 2-Energy turn) — recorded, not
actioned.

---

## 7. `flash_freeze` — Ice's last open card redline

**1e, "Apply Stun", 5.5 / 3.0 → 2e, "10 power + Stun", 6.5 / 6.5.**

Stun is priced at 55 power and cannot fit a 30-power band; this is the third and last of the three
Ice cards that were all "stop the game" effects sold at half price. Rewrite the description to match
the new actions.

---

## 8. New cards — `src/engine/data/programs.json`

```json
{
    "id": "frost_ward",
    "name": "Frost Ward",
    "description": "Gain 3 Bark Shield.",
    "element": "Ice",
    "target": "Self",
    "category": "Skill",
    "rarity": "Common",
    "baseCost": 0,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "STATUS", "status": "BarkShield", "stacks": 3, "target": "SELF" }
    ]
}
```
**1.1 / 1.0 — 0.1 over, deliberate** (Henry: the bands are a target, not a law). The exactly-on-band
alternative is "3 power. Gain 2 Bark Shield", which is a worse card for the same slot.

```json
{
    "id": "rimeguard",
    "name": "Rimeguard",
    "description": "12 power. Gain 5 Bark Shield.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 12, "target": "TARGET" },
        { "type": "STATUS", "status": "BarkShield", "stacks": 5, "target": "SELF" }
    ]
}
```
**3.0 / 3.0.**

```json
{
    "id": "thaw",
    "name": "Thaw",
    "description": "8 power. Gain 3 Strengthened and 3 Sharp.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Uncommon",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 8, "target": "TARGET" },
        { "type": "STATUS", "status": "Strengthened", "stacks": 3, "target": "SELF" },
        { "type": "STATUS", "status": "Sharp", "stacks": 3, "target": "SELF" }
    ]
}
```
**3.1 / 3.0.** **This is the "targeted cleanse" slot, and it needs no cleanse.** `DUALITY_MAP`
(`effectHandlers.ts:407`) pairs `Strengthened ↔ Weakened` and `Sharp ↔ Dazed`, and
`handleApplyStatus` cancels one stack for one stack **before** the behaviour runs (`:444-462`). So
this removes up to 3 Weakened and 3 Dazed from Ymir, and any surplus accrues as the buff instead —
it is never a dead draw. Strictly better than CLEANSE for this job, which is a flat 10 power (ticket
46) and removes things you might want to keep.

```json
{
    "id": "avalanche",
    "name": "Avalanche",
    "description": "9 power for each stack of Bark Shield you hold.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Rare",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 9, "target": "TARGET", "scaling": "BARKSHIELD_STACKS" }
    ]
}
```
**2.7 / 6.5 static — a floor** (§4). Realistic 63–90 power.

```json
{
    "id": "bracing_cold",
    "name": "Bracing Cold",
    "description": "15 power. Gain 3 Strengthened.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Common",
    "baseCost": 1,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 15, "target": "TARGET" },
        { "type": "STATUS", "status": "Strengthened", "stacks": 3, "target": "SELF" }
    ]
}
```
**2.9 / 3.0.** Deliberately Ice rather than the existing neutral `adrenaline` (1e, 18 power + 2
Strengthened, 2.7): a None-element card gets **neither STAB nor GLACIAL_PACE's bonus**, so in v2 a
neutral card is worth about 40% less than the same card in Ice. **v2 therefore has no neutral tier and
deviates from the ticket-04 three-tier rulebook on purpose** — the same design-principle-(4) shape as
draugr_v2, recorded rather than papered over.

```json
{
    "id": "glacial_maul",
    "name": "Glacial Maul",
    "description": "65 power.",
    "element": "Ice",
    "target": "Single",
    "category": "Attack",
    "rarity": "Uncommon",
    "baseCost": 2,
    "constraints": ["not_stunned", "not_asleep", "energy_base"],
    "actions": [
        { "type": "ATTACK", "power": 65, "target": "TARGET" }
    ]
}
```
**6.5 / 6.5.** The "2e straight damage" slot — deliberately vanilla, because GLACIAL_PACE's whole
point is that one big card is the turn.

---

## 9. Deck lists — `mingmingRegistry.ts:448-451`

```ts
        decks: {
            "ymir_v1": ["frost_ward", "frost_ward", "rimeguard", "rimeguard", "thaw", "ice_spear", "ice_spear", "avalanche", "avalanche", "flash_freeze"],
            "ymir_v2": ["bracing_cold", "bracing_cold", "thaw", "ice_spear", "ice_spear", "numbing_gale", "numbing_gale", "glacial_maul", "glacial_maul", "glacial_slam"]
        },
```

Delete the `// Ticket 13: both slots hold the legacy shared deck` comment above it.

**ymir_v1 — GLACIER_HEART · the wall is the weapon.** 10 cards, curve **0e×2 / 1e×5 / 2e×3**. The
line: turn start grants 5 shield → `rimeguard` adds 5 → next turn `avalanche` casts off ~8–10 stacks
for 72–90 power. `thaw` undoes the Weakened that Ice mirrors pile on.

**ymir_v2 — GLACIAL_PACE · two big cards a turn.** 10 cards, **no 0-cost cards**, curve **1e×7 /
2e×3**. Three 2-energy instances is the ceiling per ticket 31 — with no 0e cards a 2e card is the
entire turn. `numbing_gale` is reused from ticket 48 (draugr_v2 runs it too): sharing enabler cards is
allowed, the payoffs differ (draugr cashes distinct debuff *count*, Ymir just wants the enemy taking
more damage from one big hit).

`shatter` appears in neither list (§6).

---

## 10. Gates

Scoped first: `set BALANCE_ONLY=ymir&& npm run balance`. Full committed run only once in band.

| gate | band | ymir baseline at `5b4e1e0` |
|---|---|---|
| **`mirror:ymir` avg turns** | **≤ 30** | **60.0 — the roster's worst, must close** |
| **`mirror:ymir` decided** | **≥ 60%** | **72/400 (18%)** |
| **§2.3 `os:ymir`** | **0.30–0.70** | **0.030 — OUT OF BAND** |
| `os:ymir` avg turns | ≤ 30 | 45.1 |
| `gauntlet:control-vs-ymir:ymir_v1` | must not fall; report it | 0.000 (aggregate 0.185) |
| `gauntlet:control-vs-ymir:ymir_v2` | must not fall; report it | 0.000 (aggregate 0.321) |
| dead cards, **per side** | ≤ 0.35 | 0.000 / 0.000 |
| FTK | 0 | 0 |
| card redlines | `flash_freeze` closes; `avalanche` scores 2.7 (a floor, not a breach) | 34 total |

**On the control rows:** ymir is at the *strong* extreme, not the weak one, so 0.000 is not itself a
failure — half the roster sits below the aggregate. What would be a failure is the mirror still not
resolving. If both slots stay at 0.000 **and** the mirror closes, that is a pass; note it and let the
+25% knob come down in a later polish pass.

`npx tsc -b`, `npx vitest run`, `npx vite build` green before any balance run.

---

## 11. Blast radius outside ymir

- `flash_freeze` is in **no draugr deck** — the re-cost is ymir-only.
- `ice_spear` and `numbing_gale` are shared with draugr but **unchanged**; only ymir's copy counts move.
- `GLACIAL_PACE`'s multiplier and `GLACIER_HEART` are firmware, ymir-only.
- `BARKSHIELD_STACKS` is additive: **no existing card uses it, so no committed card score may move.**
  If one does, STOP.
- Draugr's rows should be byte-identical. `mirror:draugr` 6.7 turns / 400 decided, `os:draugr` 0.530,
  control 0.000 / 0.070 — quote them as unchanged in the report or explain why not.

---

## 12. Pre-authorised knobs — max two rounds, ONE change per sim

1. **GLACIAL_PACE multiplier** 0.25 → 0.20 / 0.30 / 0.15 / 0.35 (Henry's authorised range is 15–35).
2. **GLACIER_HEART grant** 5 → 4 / 6 / 3 / 8 per turn.
3. **`avalanche`** 9 → 7 / 11 power per stack (6–12 is the range).
4. **`rimeguard`** 12 power / 5 shield ↔ 20 power / 3 shield (both 3.0-ish).
5. **`thaw`** Strengthened/Sharp 3/3 → 4/4 (3.1) or 2/2.
6. **`frost_ward`** 3 → 2 Bark Shield (drops it to exactly 1.0).
7. **`flash_freeze`** 10 → 0 power (5.5, comfortably in band) if the stun turn is too strong.

**If the mirror still does not resolve after two rounds, STOP and report** — the cause is structural
(two shield decks with the same clock), not a knob, and it is the same shape as huldra's ticket-33
finding that the clock, not the card, was the imbalance.

---

## 13. STOP and report

- `avalanche` deals damage that does not match `floor(stacks) × 9` — the fractional-stack floor in §4
  is wrong or missing.
- `BARKSHIELD_STACKS` reads as a no-op: check the `scaling` union and the powerscale branch, and log
  the resolved stack count before tuning anything.
- The mirror is still over 30 turns after knobs 1–3.
- ymir_v1 and ymir_v2 measure as the same deck (both shield-heavy) — that is a design problem, report
  it rather than tuning.
- ymir_v1 reads as huldra_v2 (§3) — same.
- Any committed card score outside this ticket's cards moves (§11).
- Anything that would require touching draugr's lists.

---

## 14. Deliverables

- Commit hash and `registryHash`.
- Every gate in §10 with its baseline beside it, plus draugr's four rows as an unchanged-check.
- **Real `calculatePowerscale` scores for all six new cards**, flagged where they differ from §8 by
  more than 0.3.
- **`avalanche`: play rate, damage per play, and BarkShield stacks at cast** — the design assumes 7–10.
  If it casts at 3, the OS grant is being eaten before he acts and §3's `onTurnStart` choice needs
  re-examining.
- **Standing BarkShield per turn on ymir_v1**, to check the 5×-grant steady state against reality.
- Mirror turn count before/after each knob round.
- Knob rounds used and any deviation.

Docs on close: this file's `## Resolution`, a `map.md` decision line, and a **HANDOFF.md refresh** —
**Ice completes at 24/32 decks, 12 of 16 species tuned**, plus the `shatter` finding (§6) and the
GLACIAL_PACE inert-cap finding (§5), which are both general rather than ymir-specific.

CRLF for `docs/wayfinder` and engine `.ts`; LF for tests, `src/debug` and JSON. `programs.json` must
round-trip byte-exact under `json.dumps(d, indent=4, ensure_ascii=False)` with no trailing newline;
`hooks.json` does NOT round-trip — edit it surgically as text. A whole-file diff means the line
endings were converted.

One commit, author `Henry Dunphy <hdunphy15@gmail.com>` via
`git -c user.name=... -c user.email=... commit --author=...`. Never stage `package-lock.json` or
`node_modules`. Git locks that cannot be unlinked go to `_to_delete/git-locks/`.
