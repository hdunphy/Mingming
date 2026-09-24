# Ticket 163 — The upgrade pass: card `+` versions and OS patches

> **Status: CLOSED 2026-09-24 — every row shipped. 163a the `+` registry, 163b the three benches, 163c the six patches, 163d patches in a run, 163e the measurement (`results/t163e/FINDINGS.md`: 54% upgrade take-rate that moves deck power +0.06, the shop patch re-priced 50 → 45 on the ordering condition, and **five of the six patches are never taken in play**), 163f the `+` in the stall at 35/45/60/70. Two decisions are open for Henry and are on the write-back, not on this ticket's status. The line below is history.**

**Type:** design → engine + data + UI. **Status:** **163a SHIPPED 2026-09-24 (`fa26724`), ruled closed (`577b577`); 163b–163e OPEN — Legion's next rows.** Asked by Henry 2026-09-23 after ruling
collection v2.1b into playtest: *"I want to start on an upgrade pass. How can we implement card
upgrades, what would OS upgrades look like?"* **Takes over** 161 §3 (card upgrades) — 161 keeps the
start-kit half. **Relates to:** 162 (the collection this upgrades), 153 (the scrap sink), 148 (the
curve), 149c (prices every `+` and patch), 157 (measures the curve), research/single-player-card-games.md
§3 (every genre game has removal + upgrade; the run-defining layer is not cards).

## 1. Two layers, one rule

The genre gives a run two progression layers: **the cards get sharper** (StS `+`, Obelisk's fork) and
**the run gets an identity that the cards are judged against** (relics, artifacts, talents). Mingming's
identity layer is the OS, and today it is fixed at recruit. So the pass is two things:

- **Card `+`** — every card has exactly one upgraded form, `<id>+`.
- **OS patches** — small, found-in-the-run modifiers that plug into any OS, one slot per body.

The rule that keeps both honest: **an upgrade never changes a card's or OS's shape** (enabler stays
enabler, the currency stays the currency); it changes a number, adds a rider in the same currency, or
widens the trigger. A `+` that turns an enabler into a payoff is a new card, not an upgrade.

## 2. Card `+` — the authoring rule, so 98 lines is a review not a blank page

One generator rule per shape, applied first, then hand-reviewed:

| shape | the `+` | example |
|---|---|---|
| flat / glue | +25% power (band-rounded to 5) | Tackle 12 → 15 · Venom Fang 30 → 38 |
| enabler (status) | +1 stack of its currency | Ignite 1 Burn → 2 · Snarl 2 Weakened → 3 · Fury Strike +1 Str → +2 |
| enabler (draw / Energy) | drawback shrinks or the amount grows | Forage 15 dmg → 8 · Capacitor 3 Energized → 4 |
| scalar | the per-stack number +25% | Flashover 15/Burn → 19 · Seed Bomb 20/card → 25 |
| consume | +25% per stack **or** keep a third of the pile | Sun Devourer 30/stack → 38 · Sharp Edge keeps 1/3 |
| multi-hit | +1 hit at the same per-hit power | Flare Burst 15×2 → 15×3 · Serpent Flurry 10×3 → 10×4 |
| ally-target | also touches the caster | Bolster: an ally **and you** gain 3 Sharp |
| daemon | trigger widens (side → any, once/turn → twice) | Riptide 8 → 10; Reactive Plating cap 3 → 5 |

Multi-hit `+` is the one that matters most under Henry's multi-hit rule: an extra hit is an extra
per-hit status bonus, which is exactly what a scalar deck wants and exactly what a flat deck doesn't
notice — the upgrade is worth more in the deck it belongs to. That is the property to protect.

**Data:** a second `programs.json` entry per card, `id: "<id>+"`, with `upgradeOf: "<id>"`. Nothing
else in the engine changes: the deck instance points at a different id. `runLog` records
`CARD_UPGRADED { from, to, price }`. The tile shows `+` after the name and the changed number in the
element colour. ~~The scorer prices `<id>+` as its own row; the ledger flags any `+` more than one band
above its base.~~ **RETIRED by Henry 2026-09-24** — *"upgrades are supposed to be broken. So no need to score them."* The ledger was built and read first; `results/t163/LEDGER-PLUS.txt` is what he ruled on.

**Where:** the **workshop** (142's static shop), one upgrade per visit, price band 25–40 scrap, and a
free upgrade at the **gym gate** (the rest-site venue). Both answer 153's "scrap is not scarce".

## 3. OS patches — what an OS upgrade looks like

Three candidate shapes, one recommended:

**A. Tiers (OS I → II → III).** Each OS has two authored steps: II bumps the number, III widens the
trigger. UNBOUND_KERNEL II: allies' attacks give 2 Str; III: no recoil. Twelve OSes × 2 = 24 authored
lines; clean to read on the plaque; but the upgrade is *the same for every run* — a ladder, not a
choice — and it does nothing for the "team building" problem because it never crosses bodies.

**B. Patches (recommended).** A patch is a **generic rider found in the run** that any OS accepts, one
slot per body (a second slot at the gym). Patches are written against the grammar, so they work on any
OS because every OS is *currency + trigger + ally output*:

| patch | what it does to the host OS | example on the twelve |
|---|---|---|
| **Amplifier** | the OS's number +1 (or +50%) | UNBOUND_KERNEL 2 Str → 3; TOXIN_FANG +10/Poison → +15; GOSSIP heal 2.5% → 4% |
| **Repeater** | the trigger fires one extra time per turn (for once-a-turn OSes) or on a second event | OUROBOROS: the 3rd *and* 5th Water card draw; BARK_SHIELD raises again at turn 3 |
| **Relay** | the trigger also counts **allies'** actions (for OSes that read only self) | TIDAL_CRUSH: allies' ≥2e Water cards +30% too; TOXIN_FANG: allies' attacks read the Poison too |
| **Splitter** | the OS's output goes to an ally instead of / as well as self | TREACHERY: the Str goes to the ally that was hit; CINDER_WALL: the Sharp goes to the Burn's caster |
| **Overclock** | the OS's currency stacks are worth one more in *every* payoff that reads them | Sharp/Str/Dazed/Poison/Bark: +1 effective stack for scalars and consumes on this body |
| **Failsafe** | the OS's drawback is removed or halved | UNBOUND_KERNEL recoil 2% → 0; Undertow's self-Weakened → none; Forage's damage → half |

Six patches cover the whole roster; each is one hook-modifier in `hooks.json` keyed by the OS's
trigger and output fields rather than by OS id. The **Relay** and **Splitter** patches are the
upgrade layer's answer to 158: they are how a run turns a solitaire OS into a party one. **Amplifier**
is the boring one every OS can take and is the workshop's default stock.

**C. Fork (Obelisk).** Two authored upgrade paths per OS ("faster" / "wider"). Best of the three to
play, twice the authoring of A. Later, when the twelve have settled.

**Data:** `IRunMember.patches: PatchId[]` (max 1, 2 after the gym); a patch is a `hooks.json` entry with
`kind: 'patch'` and a `modifies: { field, op, value }` the firmware runner applies when it resolves the
host OS's hook. The plaque shows the patch as a chip beside the OS name; hover reads the modified OS
text. The scorer prices a patch as *(host OS hook value after − before)* via 149c's hook formula, so
a Relay on a self-only OS scores high and on an ally-reading OS scores zero — which is the flag.

**Where:** patches are **reward-pool and shop** items (161 §2's seeding puts the host body's best
patch in the pool), an elite pays one (the second coin the research doc asked for), and the gym gate
offers a choice of two.

## 4. Rows for Legion (after 162a and the playtest prep)

- **163a — the `+` registry. SHIPPED 2026-09-24 (`fa26724`).** All 98 cards in `upgrades.json` are `programs.json` entries `id: "<id>+"`, `upgradeOf: "<id>"`, text = `plus`. Actions are built from the BASE card's actions by `scratch/t163a_build.py` and then PROVED against the printed text — four cards (`blood_rite`, `pile_on`, `molten_core`, `thorn_whip`) were refused by the generic path and hand-written with the reason. Twelve daemons got their own `hooks.json` blocks (`<id>+`, hook ids `<hookid>+`); `daemonHooks.ts` registers a `<key>+` beside its base, derived rather than listed, so the allowlist trap does not grow twelve new chances to fall into it. **The schema extensions the row asked about**: none were needed — the "and you" ally cards are the aimed action plus a SELF copy, Echo Chamber+'s "two the first time each turn" is Reactive Plating's counter-gate pattern, and Hexbloom+'s damage rider is `TARGET_STATUS_STACKS` off a base of 0. **Unreachable by design**: `isRewardable` false on `upgradeOf`, `EncounterGenerator` draws from base cards only (a live leak — its pools walk the whole registry), out of the codex denominator, exempt from the band flag (`powerscale.isBandExempt`). `plusRegistry.test.ts` (10 tests, mutation-tested) holds every claim; `t162_cardcheck.ts --plus` casts all 98 on a stocked and an empty board; `t163a_ledger.ts` priced each `+` against its base, once — both of the things it raised were ruled the same evening (§5 below), and nothing from this row is waiting on Henry.
- **163b — the venue.** Deck instances carry `upgraded: boolean` (the instance points at the `+` id;
  the collection entry keeps the base id so persistence can be added later without a migration —
  reserve `collectionEntry.upgrades: Record<cardId, true>` unused). Workshop gets an **Upgrade** tab:
  pick a card in the active deck, pay scrap (band 25–40, tune from the run log), one per visit. The gym
  gate offers one free upgrade. `CARD_UPGRADED { from, to, price, node }` in the run log; the tile shows
  `+` after the name and the changed number in the element colour; `LoadoutEditor`'s deck rows show `+`.
  Tests: an upgrade replaces exactly one instance; the price is deducted; the run log row round-trips.
- **163c — patches, engine.** `IRunMember.patches: PatchId[]` (max 1). A patch is a `hooks.json`
  entry `kind: 'patch'` with `modifies: { field, op, value }` applied by the firmware runner when it
  resolves the host OS's hook: `field` ∈ `amount` (Amplifier: +1 / ×1.5), `triggers` (Repeater: +1
  per turn), `actor` (Relay: `self` → `side`), `target` (Splitter: `self` → `ally`), `drawback`
  (Failsafe: removed); Overclock is a status-value modifier on the member (+1 effective stack for
  scalars/consumes on this body). Six patches authored against those fields, not against OS ids. The
  plaque shows the patch as a chip beside the OS name; hover reads the modified OS text. Tests: each
  patch on each of the twelve produces a well-formed hook (72 cells) and the AI still enumerates.
- **163d — patches in the run.** Reward pool seeding (161 §2) puts the host body's best patch in that
  run's pool; an elite pays a patch; the gym gate offers a choice of two; the shop stocks Amplifier.
  `PATCH_TAKEN` in the run log.
- **163e — measure.** 157's walker with "upgrade the highest-149c card when scrap ≥ price" vs never;
  deck-power curve fight 1 → gym; "sent to collection" rate; patch take-rate by kind.

## 5. Decisions — RULED by Henry 2026-09-23

1. **§1 two layers, one rule — good.** 2. **§2 generator rule — yes as the first draft**; *"maybe we add
reduction in price to some of the cards, but leave it for now as described"* — cost-reduction `+`
lines are a door left open, not in 163a. 3. **Patches (B). Tiers never, fork later.** 4. **One patch
slot per body** (no second at the gym). 5. **No persistence across runs to start**; the data shape
must leave the door open (an `upgrades` map on the collection entry, unused until a later ticket).

**163a delivered (rule revised by Henry, same day: *"stacks +1 plus the Energy cost, so 2e is +3; rates +40% not +25%; draw and Energized fine"*):** `collection-v2/upgrades_gen.py` is the generator, `upgrades.json` its output — status stacks +(1 + cost), raw numbers +40%, multi-hit +1 hit, draw/Energized +1; hand-overrides
(Thorn Whip +7/Sharp; Heartwood +2 Bark not +1 Poison, its currency; Ragnarok Edge base 25 since the
per-1% is capped; Contagion double then +2; Hexbloom adds 5 power per Weakened; Overclock Core +1
Energized now; Echo Chamber two tokens the first time each turn; Tend/Mend/Soothe "and you"). Henry
reviews the table in the browser; 149c prices each `+` as its own row; then it ships as registry entries.

**163a's one open printing question (2026-09-24).** The five "and you" ally upgrades (Tend+, Mend+, Soothe+, Bolster+, Shell Share+) are the aimed action plus a SELF copy, and 160-e1's ally picker lets you aim at YOURSELF — so aiming one of these at your own body pays twice. The engine has no "a DIFFERENT ally" target and inventing one inside an upgrade row would decide a targeting rule by accident, so it ships as measured and is written down here instead. Cheap to change either way once 163b makes the cards reachable.

**Ruling (Henry, 09-23): upgrades are supposed to be broken.** The rule is applied without cap exceptions — Inferno+, Wildfire+ and Heat Wave+ push Burn past its cap of 4 and detonate. 149c prices `+` rows for the ledger but they are exempt from the band flag.

**Ruling (Henry, 2026-09-24), closing 163a:** *"Leave ignite broken — upgrades are supposed to be broken. So no need to score them."* Two decisions in one line. (1) **`ignite+` stands as printed.** It was measured at 23.1% of turns above six casts against its base's 0.3% — the `+` rule doubled the Burn, and Ignite's draw is conditional on the target ALREADY burning, so at 2 Burn the condition stops being one. Three fixes were offered and none taken. Ticket 152's tripwire now drops the whole `upgradeOf` class rather than carrying an exception per card, because the next upgrade would ask the same question and get the same answer; the rule still stops the build for a BASE card nobody has measured. (2) **No `+` row is scored anywhere.** `powerscale.isBandExempt` carries it and the card budget audit passes over them; the §2 rung flag above is struck.

### Original questions

1. `+` generator rule (§2) as the first draft — yes, then review the table?
2. Patches (B) now, tiers (A) never, fork (C) later — or tiers first because they read simplest?
3. One patch slot per body, a second at the gym — or one only?
4. Do `+` and patches persist to the collection across runs (meta-progression), or reset per run?
   (Research: StS resets; Obelisk persists per hero. Persisting is the stronger "my roster" feeling
   and the bigger balance surface.)


## 6. 163f — `+` cards in the stall (RULED by Henry 2026-09-24)

An upgraded card may be found in the market stall for sale, priced below buying the base and upgrading it — Henry: *"less than buying then upgrading the card, like 10–20% discount"*. Price = (card price by energy 15/25/35/45 + bench price 25/30/35/40) × 0.85, rounded to 5: **35 / 45 / 60 / 70** by energy. `isRewardable` keeps refusing `+` cards everywhere else (rewards, enemies, the codex denominator); the stall gets a single explicit exception — at most one `+` card in stock per run, drawn from the party's V2 pool, on the 142e static stock. Codex: a `+` seen or played is a MARK on the base card's row, not a row (31a). Lands after 163e; measured by the walker's take-rate like the rest.

---

## 7. Write-back (2026-09-24) — 163e, and the ticket closes

`npm run balance:walk -- --upgrades both` runs the pair; `--patch-price N` sweeps the shelf. Report:
`results/t163e/FINDINGS.md`, raw in `arms.txt` and `price-25.txt`. Three points, 120 runs each,
**paired** — the same seeds, graphs and offers, one spending policy apart.

### The upgrade arm is used and changes almost nothing

"Upgrade the highest-149c card when scrap ≥ price" vs never: **54% take-rate** (58 upgrades at 108
benches, 1,810 scrap at a mean of 31), and deck power moves **+0.06 at fight 4** and **+0.02 at
fight 8**. Mean fights survived +0.17; deaths in biome 0 97 → 93. Every one of those is inside the
noise of 120 runs.

**That is the arithmetic working, not a disappointment.** An upgrade is +40% on ONE card in a deck
of twelve to eighteen, and 163 §1's own rule is that it never changes a card's shape. What would
make it a large effect is a run long enough to take five or six, and 157 measured that 100 of 120
runs end in biome 0.

Highest-scoring card rather than lowest, and that choice is the arm's character: upgrading the best
card COMPOUNDS what the deck already does, while upgrading the worst raises a floor the deck is
trying to draw around. §5's wording picks the first. "Upgrade the worst" is a different question and
is not this row's.

### The shop's patch price: 50 → **45**, and the take-rate is not what decided it

| shelf price | upgrades competing | take-rate |
|---|---|---|
| 50 | no | 8 of 46 — **17%** |
| 50 | yes | 3 of 47 — **6%** |
| 25 | yes | 9 of 51 — **18%** |

Halving the price triples the take-rate, so the shelf is price-sensitive and 50 sat above what a run
can pay. **But the binding constraint is the PURSE**, and pricing to hit a take-rate now would be
fitting a number to a brokenness that lives in the opening fight.

So the CONDITION sets it. A patch is permanent, run-long, one slot per body and no replacing — which
puts it between an **upgrade** (permanent, but one card: 25–40) and a **blueprint** (a whole body
and its engine: 50). `upgrade ceiling < patch < blueprint` is **45** in this economy's fives. At 50 a
patch cost the same as a body, which is the one thing it certainly is not. The slope says 45 will
read about 8%; **re-measure after 157's opening-fight ruling**, which `--patch-price` makes free.

### Five of the six patches are never taken — a finding, not a fix

Across 360 runs: **amplifier ×145, splitter ×3, and nothing else at all.** `bestPatchFor` leads the
gate's choice-of-two and the elite's offer and picks Amplifier on almost every EA firmware; the shop
stocks Amplifier by ruling. So the six riders 163c wrote against FIELDS are, in play, one rider.

Not a bug in `patchRegistry` — the 72-cell matrix says every transform is well-formed. Three things
could be true and they need different fixes: the twelve EA firmware are Amplifier-shaped;
`patchTouchCount` is the wrong ranking; or the gate should offer a SPREAD rather than the best two.
163 §3's own argument was that a random patch is a no-op on most bodies, which is why the offer is
ranked at all — so "just randomise it" is not the answer. **Henry's call.**

### And 153's number, confirmed on a second corpus

1.2% and 1.4% "sent to collection" across the two arms (408 and 370 picks) — the same ~2% 157
measured over a different 120 runs.

### Decisions

1. **The patch shelf ships at 45** on the ordering condition; re-measure after the opening-fight
   ruling.
2. **Five of six patches are dead in practice** — roster fact, ranking bug, or offer shape?
3. **The upgrade bench is a small, working effect.** Nothing to tune here; it gets large when runs
   get long, which is 157's question.

### 163f is also in (2026-09-24)

`upgradedCardPrice` + `upgradedOfferFor` in `marketplace.ts`, and `MarketSlot` gains `'upgraded'`.
One `+` per RUN, on the market node a seeded draw over the run's own market nodes picks — so it needs
no new run state and cannot be farmed by refreshing (`marketStockSeed` moves with `marketRefreshes`;
this deliberately does not read it). Drawn from the PARTY's pool, so it is an upgrade of a card this
team can use rather than a second stranger, and it is an EXTRA slot, so a run that meets it loses
nothing from the five.

**The price is derived, not tabled.** Henry's rule is *"less than buying then upgrading, like 10–20%
discount"*; buy-then-upgrade is 40/55/70/85 and 0.85 of it, to the nearest five, is
**35 / 45 / 60 / 70** — the numbers he named, and the only 5%-step multiplier that keeps all four
rungs on a multiple of five without rounding two of them the wrong way. The DISCOUNT is the ruling,
so a move to either price table carries this with it.

It is the single declared exception to `isRewardable`'s refusal of `+` cards, and 25-pre's test —
*"no card outside the EA pool reaches the stall"* — **failed when it landed**, which is exactly what
should happen when a new door opens onto a shelf a previous ticket closed. The exception is excluded
there by NAME rather than by widening the pool gate.
