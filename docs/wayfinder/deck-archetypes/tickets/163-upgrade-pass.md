# Ticket 163 — The upgrade pass: card `+` versions and OS patches

**Type:** design → engine + data + UI. **Status:** **RULED 2026-09-23** (§5 answers below; 163a table delivered in `collection-v2/upgrades.json` and the browser's Upgrades tab). Asked by Henry 2026-09-23 after ruling
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
element colour. The scorer prices `<id>+` as its own row; the ledger flags any `+` more than one band
above its base.

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

## 4. Order

1. **163a — card `+` data.** Generate 98 `+` lines by §2's rule; Henry reviews the table (one
   screen); 149c scores them; ship as registry entries.
2. **163b — upgrade venue.** Workshop "Upgrade" tab + gym-gate free upgrade; `CARD_UPGRADED` in the
   run log; tile `+` mark.
3. **163c — patches engine.** `patches[]` on the member; `modifies` in the firmware runner; the six
   patches in `hooks.json`; plaque chip.
4. **163d — patches in the run.** Reward pool seeding, elite payout, gym-gate choice, shop stock.
5. **163e — measure.** 157's walker with "upgrade highest-149c card when scrap ≥ price" vs never;
   deck-power curve fight 1 → gym; "sent to collection" rate.

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

**Ruling (Henry, 09-23): upgrades are supposed to be broken.** The rule is applied without cap exceptions — Inferno+, Wildfire+ and Heat Wave+ push Burn past its cap of 4 and detonate. 149c prices `+` rows for the ledger but they are exempt from the band flag.

### Original questions

1. `+` generator rule (§2) as the first draft — yes, then review the table?
2. Patches (B) now, tiers (A) never, fork (C) later — or tiers first because they read simplest?
3. One patch slot per body, a second at the gym — or one only?
4. Do `+` and patches persist to the collection across runs (meta-progression), or reset per run?
   (Research: StS resets; Obelisk persists per hero. Persisting is the stronger "my roster" feeling
   and the bigger balance surface.)
