# Ticket 158 — Rules for building a party that plays as one deck

> **Status: CLOSED 2026-09-24 — 158-r1 shipped: `cur`, `tempo` and `partners` live in `src/engine/data/osGrammar.ts`, the design file no longer carries them, and the recruit and loadout screens read them. R1–R7 stand as the design law and are not "open work" — collection v2 is their first application, and the next one reopens a row here rather than the ticket.**

**Type:** design session, **Henry designs**; this ticket is the rulebook draft he asked for and the
measurements that check a rule. **Status:** OPEN, asked by Henry 2026-09-20: *"I do think I need to
have more synergies between the mingmings and look for better interplay between them. I want to
design some rules for OS and card building so I can accomplish easier synergies when party building.
It is a challenge to build a fun deck with all the cards — it often feels like 3 decks in one. I'd
like to take a crack at this myself first, although I'd need some help with some rules or
guidelines."* **Relates to:** 151 (two paths per deck — this sits above it: two paths per *party*),
141 (ally-triggered OS — the one bridge that exists), steam-release 78 (synergy tags + the pair
matrix — HELD, this unblocks it), 140 (comp grid), 04 (deck rulebook), 157 (the walker measures
these rules), 159.

**Research:** [single-player-card-games.md](../research/single-player-card-games.md) §2 and §5.2 — how Cobalt Core, Roguebook, Chrono Ark, Across the Obelisk and Monster Train glue characters into one deck. **Henry, 2026-09-21:** the Roguebook alternate-body discount is NOT a rule for this game — at most a daemon or a Driver; the glue is the currencies (R2).

## 1. Why it feels like three decks in one — from the engine, not the feeling

- **The pile is one pile.** In 3v3 the party's cards are shuffled together; the hand is
  `sum(cardDraw) − (N−1)`, discarded each turn. A ten-card hand holds ~3 cards from each body's
  engine. An engine tuned as 8 cards for one body (ticket 04) never sees its own 8 together again.
- **Any body can cast anything; only STAB and the OS care who.** So two-thirds of every hand is
  cast off-STAB or off-OS — legal, weaker, and it *reads* as the wrong deck's card.
- **No card touches an ally.** 141-GYM-CHECK: *"there are no ally-target cards in the game — every
  Nature buff is Self."* The only channel between bodies is the enemy's status bar (78's title) and,
  since 141, an OS that reads an ally's action. Everything else is three solitaires.
- **Enablers and payoffs live in the same body.** Fenrir makes Strength and spends Strength.
  Nothing in another body wants Fenrir's Strength, so a hand with Fenrir's enabler and Kraken's
  payoff has nothing to do.

So the 1v1 decks are not bad decks; they are the wrong unit. The unit is the party.

## 2. The grammar (Henry + assistant, 2026-09-21) — currency · enabler · consume · scalar · glue

Henry's aim: *"building blocks where each OS shares a design language so it's easier to plug and play
with each other mingming. The OS should enable multiple play styles."* His first cut was the three
Magic archetypes — **zoo, ramp, control** — and the lines blurred because they were being drawn by
*card shape* (0e cards, status appliers), and card shapes overlap. Zoo, ramp and control are not card
shapes. They are answers to one question: **what does the deck accumulate, and when does it spend it?**
Henry's own observation — *"the status consume or scalar fits regardless"* — is the key: consume and
scalar are *payoff shapes*, and they are universal. What differs between archetypes is the currency.

### 2.1 Archetype = currency

| archetype | currency (what grows) | tempo | 3v3 note |
|---|---|---|---|
| **Zoo** | *cards cast* this turn, and **Strength** (a per-hit multiplier is what pays off many small hits) | wins early; every turn is the payoff turn | naturally strong at 3v3 — the shared hand is `sum(cardDraw) − 2` wide |
| **Ramp** | **Energy** — banked (Capacitor), borrowed (Energized), or the *cost* of big cards | wins late; turns 1–2 are enablers, turn 3+ is the consume | the archetype 3v3 hurts: Energy is per unit. Ramp must ramp the **side** (Tidal Battery) or the **cost** (TIDAL_CRUSH), never one body's pool |
| **Control** | **stacks on the enemy** (Weakened, Poison, Burn, Dazed) and the **turns** they buy | wins on a clock; the stall is the plan | side-target statuses (Spreading Rot, Inferno, Toxic Cloud) are control's 3v3 form |

**Sustain is not left out — it is control's other half.** Magic's control is *deny* + *inevitability*.
Weakened, Bark Shield, Regen and heals are the deny half; Poison and Burn are the clock; Sharp is the
deny half turning into damage without spending cards. A control OS grows turns and stacks. What stays
outside the three is the **keeper role** in the party (R1): every party needs sustain in proportion to
how slow it is — ramp most, zoo least — but that is a composition rule, not a fourth archetype.

**Dazed** is a control tax on the enemy (and Kraken's currency via ABYSSAL_INK / Crushing Depths), not a
zoo enabler — unless a card makes it do something for the caster.

### 2.2 Every card is one of three shapes

- **Enabler** — puts currency on the board. Zoo: 0e attacks, draw (Undertow, Keen Edge), Fury Strike.
  Ramp: Capacitor, Tidal Battery, Corrosive Leak. Control: Pollen Cloud, Ignite, Poison Injection.
- **Payoff**, in one of two universal shapes:
  - **Consume** — spend every stack now, big and once. Sun Devourer (Strength), Crushing Depths
    (Dazed), Ash Reclamation (Burn → heal), Hexbloom (Weakened → Poison). The path that wins a good turn.
  - **Scalar** — per stack, stacks stay. Spike Launch (Sharp), Serpent's Coil / Seed Bomb (cards cast),
    Ink Stream (draws), TOXIN_FANG (Poison), CORE_OVERCLOCK (Strength). The path that survives a bad turn.
- **Glue** — Tackle, plain draw, plain Energy: castable well from any hand (R7).

**A 5-card kit is 2 enablers + 1 consume + 1 scalar + 1 glue.** The consume/scalar pair is *required*,
not chosen — it is 151's two paths for free.

### 2.3 An OS is one currency and one trigger on it

That is the whole identity, and it is what makes two OSes plug-and-play: **they share a currency, or
one's payoff reads the other's currency.** The EA twelve on the grid:

| OS | currency | shape | reads an ally? |
|---|---|---|---|
| fenrir UNBOUND_KERNEL | Strength | enabler (per attack) | yes — allies' attacks feed Fenrir |
| fenrir CINDER_WALL | Burn → Sharp | converter (control → deny) | yes — any ally's Burn |
| skoll TREACHERY_KERNEL | Strength | enabler (on ally damage) | yes |
| skoll SOLAR_OVERDRIVE | Strength | scalar + enabler on ally Fire attacks | yes |
| ratatoskr GOSSIP_NODE | cards cast (0e) | zoo → sustain converter | yes — any ally's 0e |
| ratatoskr INSTIGATOR | cards cast (0e) → Dazed | zoo → control converter | yes |
| kraken ABYSSAL_INK | draws → Dazed | zoo (draw) → control converter | side draws |
| kraken TIDAL_CRUSH | Energy (cost ≥ 2) | ramp scalar | no |
| jormungandr OUROBOROS | cards cast (Water) → draw | zoo enabler | side |
| jormungandr TOXIN_FANG | Poison | control scalar | reads the target, so yes — any ally's Poison |
| huldra ALLURE_PROXY | buffs → Weakened | sustain → control converter | yes |
| huldra BARK_SHIELD | Bark (deny) | sustain enabler | gives to allies |

Read down the *currency* column and the parties write themselves: Strength (fenrir, skoll), cards-cast
(ratatoskr, jormungandr, kraken v1), Poison/Weakened (jormungandr v2, huldra, ratatoskr v2 via Dazed).
Read the *shape* column and the gap shows: the twelve have **many enablers and converters and almost
no consumes** — the consume is the card-level thing 151 must print for each currency.

### 2.4 Daemons are where the hate cards live

Anti-archetype cards belong in daemons, not kits — a card that is only good against one enemy archetype
is a dead draw two fights in three. The ones that work punish a *behaviour*, so they are fine against
anyone and sharp against the archetype: **RIPTIDE** (8 per enemy card — anti-zoo) and **SHORT_CIRCUIT**
(15 per off-phase draw — anti-draw) already exist; "an enemy that ends its turn with unspent Energy takes
X" is anti-ramp; "whenever an enemy applies a status to your side, it takes X" is anti-control. With 159's
face-up hand the player can *see* the enemy's archetype and pick the daemon — which is the argument for
daemons as the hate slot. (The Roguebook alternate-body discount lives here too, if anywhere.)


### 2.6 The counter rule (Henry's hesitation, 2026-09-21)

One currency per OS reproduces 151's hard counter: `power + (Str − Weak) + (Dazed − Sharp)`, floored at 0, means a stack cancels a stack and a Sharp-only deck against 0e Dazed hits for nothing. Every currency has one cheap answer — Strength ↔ Weakened, Sharp ↔ Dazed, Poison/Burn ↔ cleanse, cards-cast ↔ RIPTIDE, Energy ↔ nothing yet — so **a kit's two payoffs must not share an answer.** The second payoff takes one of three shapes: (a) it reads a **party currency** another body makes; (b) it is **flat power with a rider**, which cannot be zeroed; (c) it **reads the counter itself** ("X per Dazed on you", CORRUPTED_GOLD's Strength per debuff, Pressure Point's "if Dazed, draw") so the answer becomes fuel. Corollaries: cancelling a stack must cost at least what making one cost (a 149c ledger rule); the consume is also the counter-dodge (spent the turn it is built, no window to answer) while the scalar survives a partial answer — another reason the pair is required. **An OS has a currency, a trigger, and one ally-facing output** — it reads allies' actions or gives allies something.

**Henry's OS directions (2026-09-21):** `../research/os-directions-2026-09-21.md` — the two-direction table for the EA twelve, the question marks answered, the status census (Poison ×7 → 3 owners; Str consume ×4 → consume/multi-hit split; draw as glue), two teams per gym, distance from current decks (one rework: Sköll v2), and the print list.

### 2.5 The rules that follow from the grammar (the draft R1–R7, condensed)

**R1 — A species is a role, not a deck.** Three roles: *opener* (puts a resource on the board:
a status on an enemy, a stack on self, Energy), *closer* (converts a resource into damage), *keeper*
(sustain, shields, tempo). A party is one of each; a species' base kit is 5 cards of its role and
3 that touch another role. Three closers is a legal but weak party, and the recruit screen says so.

**R2 — Every engine pays into a shared currency (= §2.1).** Pick a small set of *party currencies* the
whole roster speaks — the candidates already exist: Strength (self, Fire), Sharp (self, Nature),
Weakened / Poison / Burn / Wet (enemy). Rule: an opener's cards *make* a currency; a closer's
payoffs read *any* instance of it, not "your own". "Deal 10 + 5 per Burn on the target" is a party
card; "deal 10 + 5 per Burn you applied" is a solitaire card. The 141 OSes are this rule at the OS
level; extend it to the card level.

**R3 — Cross-body payoffs, never cross-body enablers.** A card that needs a partner to be *good*
is fine (it is a payoff). A card that needs a partner to be *castable* is a dead card two hands in
three. Ally-target cards (heal ally, shield ally, give ally Strength) break the "no ally-target"
gap and are the cheapest bridge to print; they are enablers *for* an ally, cast by anyone.

**R4 — The one-hand test.** Shuffle the three base kits together; in any ten-card hand there must
be at least one live opener→closer pair across two *different* bodies. This is countable (§3);
below ~70% of hands, the party is three decks.

**R5 — STAB is the tax, not the wall.** Off-STAB casting stays legal at ×1.0. But a body's OS
should reward *its* element being cast by *anyone* (Solar Overdrive already flares on every Fire
attack) so a Fire card in a Water body's turn still feeds the Fire body's engine.

**R6 — Two paths per party (= the consume/scalar pair, §2.2).** Path A lives inside one body (solo-viable, the
1v1 deck). Path B crosses bodies (the party payoff). A hard counter to one body must not close both.

**R7 — Generics are glue.** Elementless cards (Tackle, draw, Energy) are the only cards every hand
can use well; keep them at ≥ 3 of 8 in the start kit and price them as glue (149c's DRAW ruling),
not as filler.

## 3. What the machine measures while Henry designs

- **Shape census** — every registry card tagged `enabler(currency)` / `consume(currency)` / `scalar(currency)` / `glue`; the table of counts per currency is the first output, because §2.3 says consumes are missing and a count settles it.


- **Live-pair rate** (R4) — for each 3-species comp, sample 1,000 hands from the merged pile,
  count hands with a cross-body opener→closer pair. Needs each card tagged `makes:[currency]` /
  `spends:[currency]` — the 78 tags, ratified here.
- **Off-STAB share** — fraction of casts in the 140 grid where caster element ≠ card element; today's
  number is the baseline R5 moves.
- **Currency utilisation** — statuses applied by body A and consumed by body B, per game
  (156's `STATUS_APPLIED.source` + `DAMAGE_TAKEN.cause` already carry both ends).
- **Solitaire score** — per species, win rate in a party minus win rate alone, normalised. A species
  whose party win rate does not beat its solo rate is contributing nothing to the other two.

## 4. Session shape

Henry drafts the rules (§2 is a starting point, not a ruling). One session per rule set: the
assistant runs §3 on the EA twelve, Henry re-cuts a kit against the rule, the grid re-runs. The
first pass is the 151 Nature corner, because 141-GYM-CHECK already showed Fire×2 + Nature is the
pair with no bridge.

## 5. RULED by Henry, 2026-09-24

1. **Currencies are statuses AND Energy.** (Tidal Battery, Overclock Core and the refund cards are Energy ramp for the party.)
2. **Ally-target cards: already implemented** (160-e1).
3. **The recruit screen shows currency and tempo — yes.** → **158-r1 (Legion):** move `cur`, `tempo` and `partners` from
   `collection-v2/collection.json` into the registry (per OS: `currency: string[]`, `tempo: 'zoo'|'ramp'|'control'[]`,
   `partners: { osId, why }[]`), so the walker (157), the recruit screen readout (78) and the browser read one source; the
   collection browser's `registry_source.apply` then stops carrying them from the design file. Readout: on the recruit and
   loadout screens, the OS row shows its currency chips and tempo, and a partner already in the party is marked.

The rules themselves (R1–R7) stand as the design law; collection v2 is their first application.

---

## 6. Write-back (2026-09-24) — 158-r1 shipped

### What moved, and where it lives now

`src/engine/data/osGrammar.ts` holds `currency`, `tempo` and `partners` for the EA twelve.
`collection.py`'s OS dicts no longer define them; `collectionExport.ts` writes them into
`registry.json`; `registry_source.apply` sets them on the page's copy exactly as it already does for
`kit`, `pool` and `text`. One source, three readers, which is the whole of §5.3.

**Both the tokens and the designed line are carried, and neither is redundant.** Henry writes these
as prose — `'cards (0e) → Dazed'`, `'zoo (binary Dazed riders) · control (Weakened riders)'` — and
the ruling asks for arrays. The tokens are what a machine matches (157's walker, a chip row); the
line is the only place the parentheticals live, and *"ramp (push piles past 4)"* is a different plan
from *"ramp (Str consume)"*. Dropping them to satisfy a type would have been the implementation
editing the design.

**Partners are firmware ids now.** The design file said `'Rat v1'`, and nothing could join that to
`ratatoskr_v1` — which is precisely why the readout could not mark *"this partner is already in your
party"* before today. Resolved once, through a hand-written name table in `scratch/t158r1_build.py`,
because a fuzzy matcher is a silent way to attach a hint to the wrong body.

### Two things the transcription found

- **`keeper` is a fourth tempo.** §5.3 names `'zoo'|'ramp'|'control'`, and the data has `keeper` on
  `ratatoskr_v1` (*"keeper (heal + draw)"*) and `huldra_v1` (*"keeper (ally buffs)"*). The DATA is
  the design, so the type is four wide. Flagged rather than dropped: if Henry meant three, two OS
  need re-tagging, and that is a design call.
- **One partner entry names two bodies.** `huldra_v1`'s first is `'Fenrir v1 / Sköll v1'`. The ruled
  shape is `{osId, why}[]`, so it becomes two rows carrying the same sentence. The sentence was NOT
  split to match — its two clauses do not divide along the slash (the second names Cinder Lance,
  which is `fenrir_v2`'s card). Left as Henry wrote it.

### What the grammar actually looks like, now that it can be counted

Measured and pinned in `osGrammar.test.ts` rather than described:

- **Eleven distinct currencies across twelve firmware**, of which five are shared and six are banked
  by exactly one body. **`cards` alone is banked by four** — both ratatoskrs, `jormungandr_v1` and
  `kraken_v1`, all counting the same thing. That concentration is the census §3 wanted.
- **Tempo: ramp 7, control 7, zoo 7, keeper 2.** The three ruled tempos are evenly spread.
- **The partner web is 37 rows and overwhelmingly mutual — five are one-way.** Symmetry is NOT
  asserted (a one-way hint is legitimate design; `huldra_v1` feeds far more decks than feed it), but
  the exact five are pinned so a design pass that makes a pairing one-way fails and gets read. The
  one worth an eye is `ratatoskr_v1 → ratatoskr_v2`: a species pointing at its own other firmware,
  unreturned.

### The readout

`OSGrammarRow` is one component at three sites — the workshop's OS choice at assembly, both sides of
the reflash comparison, and the loadout editor's party and bench rows. `compact` drops the partner
prose to a count for the list surfaces.

**The partner mark is the part that needed the move.** Currency and tempo are facts about one
firmware and a player can read them off the OS text in time. What they cannot work out at the
assembly bay is whether the body in front of them fits the party they are already running —
`partnersInParty` joins the authored web against `run.partyIds`, so a hint only appears once it is a
FACT about the field. Read from the PARTY, not the roster: a benched body is not feeding anybody's
currency.

**An OS with no grammar recorded draws nothing**, not `currency: —`. `grammarFor` is undefined for
every post-EA firmware because nobody has written its currency down, which is a different statement
from "it has none", and a dash would be the screen making the call for them.

### The browser

The page reads the registry for these three fields now, so **a `--design` run has no grammar to
show**. It says so — *"from the registry — run `npm run decks`"* — rather than printing three blank
facts, which is the one regression this row accepts and the reason it is named here.

The partner list renders the OS's own NAME (`TREACHERY_KERNEL`) where it used to render Henry's
shorthand (`Sköll v1`), because ids are what is stored now and the name is what the page's own
headings use. If the shorthand read better, the fix is a display table in `build.py`, not a second
copy of the grammar.

### Gate

`npm run gate`: eslint 0, `tsc -b` 0, **3,024 vitest across 212 files**, build clean.
`collectionBrowser.test.ts` still passes — `build.py` still imports and calls `registry_source.apply`
and still refuses to rewrite `collection.json` from a registry-sourced run.

`registry.json` was regenerated in the container (`npm run decks` needs vite-node, which the machine
still cannot run), with a full md5 manifest comparison of `src`, `scripts` and `collection-v2` run
first — the only differences were this row's own edits. **`browser.html` was then rebuilt ON THE
MACHINE** with `python build.py`, and came out byte-identical to the container's build.

**That comparison earned its keep immediately: the container's `collection.py` was STALE** — the
machine's copy carried 162e's new EMBER_FUSE sentence and a `skoll_v1` kit swap (`brute_force` into
the kit, `snarl` into the pool) that matches the shipped registry. The edit was re-applied to the
machine's copy instead, and the twelve grammar values were then verified equal between
`collection.json` and the machine's `collection.py` before anything was written.
