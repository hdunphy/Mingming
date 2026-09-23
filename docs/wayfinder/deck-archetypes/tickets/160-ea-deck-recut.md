# Ticket 160 — The EA re-cut: twelve OSes, two directions each, one grammar
> **2026-09-23 — SUPERSEDED by [162](162-collection-v2.md)** except **160-e1** (ally-target cards — Legion's first row, before 162a) and **§5** (the before/after numbers — now 162c). 160-r1/r2 ship inside 162a as Overclock Core and Short Fuse. The nine sessions were done in one pass as collection v2.

**Type:** design sessions (Henry designs, assistant costs and measures) → registry commits per deck.
**Status:** OPEN — ruled to proceed by Henry 2026-09-21 (*"Should we go ahead with this direction?
… Sounds good, add a new ticket"*). **Supersedes the per-deck half of 151** (151's frame — two damage
paths — is kept as §2's counter rule; its per-deck sessions become these). **Relates to:** 158 (the
grammar this applies), `research/os-directions-2026-09-21.md` (Henry's directions, reviewed), 149c
(the scorer prices the prints), 140 (the comp grid that measures before/after), 78 (tags/readout).

## 1. The model — two axes, not one

Henry, 2026-09-21: *"Ramp feels very restricted, although ramp is really build early then payoff late.
Fenrir berserker is kind of ramp."* Right — so the archetype word is a **tempo**, and the thing an OS
owns is a **currency**. Every OS direction is a cell of currency × tempo:

| tempo \ currency | Strength | Burn | Sharp / Bark | Dazed / Weakened | Poison | cards | Energy | HP |
|---|---|---|---|---|---|---|---|---|
| **zoo** — every turn is the payoff turn | Sköll v1 (multi-hit) | Sköll v2 (cheap riders) | — | Rat v2 (0e → Dazed) | Jorm v2 (riders) | Rat v1, Jorm v1, Kraken v1 | — | — |
| **ramp** — build early, cash once | Fenrir v1 (consume) | Sköll v2 (detonation), Fenrir v2 | Fenrir v2 (Sharp consume), Huldra v2 (bark smash) | Kraken v1 (Dazed consume) | Jorm v2 (Contagion → Toxic Surge) | — | Kraken v2 (Energized → big), Jorm v1 (refund) | Fenrir v1 |
| **control** — deny + clock | Sköll v1 (deny/battery) | Fenrir v2 (side Burn), Kraken v2 (steam) | Huldra v1 keeper (to allies), Huldra v2 (shield allies) | Huldra v1 (Weakened scalar/consume), Kraken v1 | Huldra v2 (Bark → Poison), Huldra v1 (Hexbloom) | — | — | — |

Read across a row and no two cells share a currency *and* a shape; read down a column and every
currency has a maker, a reader on another body, and (§2) an answer. Empty cells are fine — they are
what later species fill.

## 2. Rules carried in (from 158 §2, binding here)

- A 5-card kit is **2 enablers + 1 consume + 1 scalar + 1 glue**; the consume/scalar pair is required.
- The two payoffs **must not share an answer** (158 §2.6): Str ↔ Weakened, Sharp ↔ Dazed, Poison/Burn ↔
  cleanse, cards ↔ RIPTIDE, Energy ↔ *the anti-ramp daemon this ticket prints*.
- Payoffs read **the target's / the side's** stacks, not "yours", wherever the currency is one an ally
  can make (TOXIN_FANG is the model; "you hold" is the solitaire tell).
- An OS has a currency, a trigger, and **one ally-facing output**.
- Cancelling a stack costs at least what making one cost (a 149c ledger check on every print).

## 3. Ramp, catalogued — so it stops feeling restricted

Energy ramp is one row, and it is the one currency with no counter, so tempo is its only tax. The
shapes, all but one already in the registry:

| shape | exists | who owns it |
|---|---|---|
| one-shot | Energized; Capacitor (2e: 3 next turn) | Kraken v2 |
| permanent | Battery Pack (**4e** daemon: Max Energy +1); UPDRAFT / GENESIS as OS triggers | nobody at EA — the 4e price is why |
| refund | Surge Protection (refund 1 if you drew this turn) | Jorm v1 |
| side | Tidal Battery (2e: side +1 next turn) — the only *party* ramp | keep it in a Water kit |
| conversion | Feather Cache (discard → Energy), UNDERWORLD_GATEWAY (HP for Energy) | Air / Hel, not EA |
| cost reduction | — | nobody; where the Roguebook discount would live, as a daemon, if ever |

**160-r1 — the ramp daemon (Henry's proposal).** *Daemon, 2e, exhaust (all daemons exhaust): at each
of your energy refills, gain 1 Energized.* Battery Pack at half price with a one-turn delay: nothing
the turn it is cast, pays back on the third turn after, net +3 to +5 over a fight, caster only (a third
of the party). Rulings: **no Dazed rider** — Dazed on yourself is an invisible cost that your own
Sharp cancels and Huldra's gifts erase, and it muddles two currencies; the tax is tempo. **Price 2e
first**; the scorer's hook formula (149c-6, expected procs × 35 per Energized) and the grid say whether
it is egregious; go to 3e only if it is (3e at a 2-EP cap needs a Capacitor first — the two-card ramp,
which is a design, not the opening price).
**160-r2 — its answer.** *Daemon: an enemy that ends its turn with unspent Energy takes 10 power per
point.* Anti-ramp that is fine against anyone. Printed in the same pass so Energy has a counter before
the ramp daemon ships.

## 4. The sessions — cheapest drift first, Sköll v2 last

One session per deck; Henry sketches, the assistant costs against 149c and runs the cell check. Each
session ends with the kit's 5 cards named by shape, the OS's ally-facing output named, and the
`makes:` / `spends:` tags (78) written.

| order | deck | the change | prints |
|---|---|---|---|
| 1 | **Jorm v1** | remove Ink Stream ×2 (it is Kraken's); refund-ramp is the second lane | +1 refund card |
| 2 | **Rat v1 / v2** | Poison out entirely (Seed Spit, Nettle Sting, Pollen Cloud's Poison half); v2 drops ramp, keeps binary Dazed riders; Slander → Kraken | Dazed / heal riders to replace |
| 3 | **Kraken v1 / v2** | +Slander; v2 keeps steam Burn as its second lane | 0 |
| 4 | **Fenrir v2** | Sharp consume; Burn-when-attacked daemon | 2 |
| 5 | **Huldra v1** | keeper lane = ally-target buffs (needs §6's decision) | 2 ally-target Nature cards |
| 6 | **Huldra v2** | bark smash consume | 1 |
| 7 | **Sköll v1** | Str multi-hit scalar + deny/battery; drop the Str consume | 1 Fire multi-hit, 1 deny |
| 8 | **Fenrir v1** | as is — the reference kit (HP + Str consume) | 0 |
| 9 | **Sköll v2** | **the rework**: OS = detonation (attacks on a Burning target +1 Burn); cheap-Burn zoo + Heat Wave | new OS, Burn scalar, ~6 cards |
| — | glue | one None-element draw (0e/1e "draw 1"; Squirrel Away is the template) in every kit | 1 |
| — | ramp | 160-r1 (Max Energy +1, 2e, exhaust) + 160-r2 | 2 |
| — | engine | **160-e1 ally-target cards** (before session 5) | — |

Sköll v2 is last on purpose: it is the only expensive item, and if sessions 1–8 alone move the
numbers in §5, it may not be needed.

## 5. Measured, before and after — so "did it drift enough" is a number

Run on the current registry **this week**, before session 1, and again after session 8:

- **Live-pair rate** (158 §3, R4): per 3-species comp, share of ten-card hands holding a cross-body
  enabler → payoff pair. Needs the 78 tags; session output writes them.
- **Off-STAB share** and **currency utilisation** (applied by A, consumed by B) from the 140 grid with
  156's `STATUS_APPLIED.source` / `DAMAGE_TAKEN.cause`.
- **Solitaire score**: per species, party win rate − solo win rate.
- **Duplicate count**: cards appearing in more than one EA kit (today: Ink Stream ×2 decks, Tackle ×8,
  Echo Chamber ×2, Nettle Sting ×2, Battle Rhythm ×2).
- The **140 comp grid** and the **run gate** (61), so nothing here moves a ruled win rate silently.

Gate for the ticket: live-pair rate up, duplicate count down, solitaire score positive for every
species, gym check (141) still passes with the two teams per gym in the research doc §4.

## 6. Decisions — RULED by Henry 2026-09-22

1. **Ally-target cards exist.** → **160-e1 (Legion, engine + UI):** an `Ally` target for programs — the reducer accepts a friendly `targetId` for `Single`-target Skills/Status/Heal flagged `allyTarget`, the hand's target picker offers allies for those cards, the AI enumerates ally targets (candidate count grows; re-run the beam gate), `formatAction`/tooltips read "an ally". Huldra v1's keeper lane and Sköll v1's battery lane depend on it; build it before session 5.
2. **Tidal Battery is a run card, not a kit card.** Side-Energy ramp lives in the reward pool / shop (161 §2 seeds it), so party ramp is something you *find*.
3. **160-r1 at 2e, and it is a permanent +1 max Energy** (not Energized per refill): *Daemon, 2e, exhaust: Max Energy +1 for the rest of the battle.* Battery Pack at half price; 149c prices the hook, the grid decides whether 2e holds.

## 7. Not in this ticket

Redirect / taunt (written down in the research doc; post-EA). The Roguebook discount (daemon or Driver
only, if ever). Any deck outside the EA twelve.
