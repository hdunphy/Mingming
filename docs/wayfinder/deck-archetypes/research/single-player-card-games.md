# Research — what single-player card battlers do about the three things 157/158/159 ask

**Asked by Henry, 2026-09-20:** *"research what other card games do for single player games? Slay the
Spire and similar games."* Read for **159** (seeing the enemy's turn), **158** (a party that plays as
one deck), and **153/157** (what a run's rewards do to a deck). Nine games; web sources at the end.
Where a fact is from memory of playing rather than a source it says so.

---

## 1. Seeing the enemy's turn — five ways the genre does it

| pattern | games | what the player sees | what stays hidden |
|---|---|---|---|
| **Intent icon** | Slay the Spire 1/2, Cobalt Core, Chrono Ark, Griftlands | the *next* action as an icon: attack with exact damage and hit count (`3×4`), block, buff, debuff, `???` for scripted surprises | the card/move behind it; which debuff; anything past next turn |
| **Queue / spatial telegraph** | Inscryption, Monster Train | the enemy's *cards themselves*, one step before they matter: Inscryption's opponent "plays cards ahead of time into the top row, which are automatically moved into play into the middle row on the next turn"; Monster Train previews every wave before the fight and enemies climb one floor per turn | nothing about the action — it is the card; only *later* waves' order |
| **Timer** | Wildfrost | a Counter on every unit — "how many turns must pass before the card can trigger" — with attack and effects printed on the unit | which unit the enemy will *deploy* next; the exact order when several hit 0 (Wildfrost added a turn-order view after players complained) |
| **Revealed play, then respond** | Library of Ruina / Limbus, Vault of the Void | Ruina: enemy pages are assigned to their speed dice first, with targeting arrows showing which of your units each one hits and whether it will clash — you then choose what to oppose (from play; the guide confirms the arrows). Vault: the enemy acts *first* and its damage sits in a **Threat Pool** that your turn removes — "when it attacks, 5 damage will appear in your Threat Pool. Then, on your turn, you can play block cards to remove threat" | Vault hides nothing — the whole enemy turn already happened |
| **Open deck, no intent** | Across the Obelisk (early) | the enemy's deck on inspection; "eventually you'll see all the cards in the enemies 'deck' and memorize the order" | what is coming this turn — the reviewer's stated complaint: "you can't (by default) see what is coming" |

Three things fall out of the table.

**Every well-liked card battler shows the next action; the ones that don't get the thread.** Wildfrost's
"I hate that I don't know what enemies will do" and the Obelisk reviewer's "you can't see what is
coming" are the same complaint Henry made about Mingming. Nobody in the genre treats a hidden enemy turn
as the fun part — the hidden information that makes these games is the *player's own draw*, not the
enemy's.

**There are three card-native alternatives to intents, and Mingming's engine already sits next to
one.** Inscryption's queue row, Ruina's pre-assigned pages and Vault's threat pool all show *cards*, not
icons, and none of them is "moves." 159's timing change (enemy draws at the end of its own turn, so the
hand exists during the player's turn) is the Ruina shape: the enemy's options are on the table, the
choice among them is not. The Inscryption shape would be stronger — the enemy *commits* its plays a turn
early — but that is a rules change to the AI's turn, not a phase move. The Vault shape (enemy acts,
damage waits, you answer) is the biggest change and the most legible; it would make Mingming a
reaction game, which is not what the 3v3 simultaneous-actives design chose.

**Intent information design is settled: a number, a hit count, a tier, and a `???`.** StS2 shows exact
damage with the multiplier, a weapon icon scaled across five damage tiers "from dagger to scythe," and
hides only the *kind* of debuff and the scripted surprise. If 159 ever adds the AI-derived threat line,
that is the format to copy — including `???` for the turns the search is unsure about.

## 2. A party that plays as one deck — how five games glue their characters together

| game | structure | the glue |
|---|---|---|
| **Cobalt Core** | 3 crew of 8, **one shared deck**; "each character brings a set of cards related to their expertise that is added to the player's initial deck" | one *object* — the ship. Every card moves, shields or shoots the same hull from one energy pool; the crew differ in *how* they make those three things, not in what they act on. The review: "finding a trio that works together is nearly as fun as hitting randomize and finding success with a group that on paper shouldn't work at all" |
| **Roguebook** | 2 heroes, **one shared deck**, cards hero-tagged "similar to Magic's color system" | *position* — front/back with per-hero bonuses; swap-count payoffs (Blade Dance); "cards cost less when played immediately after the other hero's card"; a **collective block pool** with separate HP; talents unlock as the deck *grows* — "Roguebook rewards you for having more cards" |
| **Chrono Ark** | 4 investigators, cards **character-bound**, ~10 unique skills each plus shared generics, one combined draw | *escalating cost* — "each time a character plays a skill, it increases the cost of their subsequent skills, encouraging you to not solely rely on one character"; a fifth non-combatant (Lucy) with party-wide skills; cards per character are scarce, so decks stay small |
| **Across the Obelisk** | 4 heroes, **separate decks**, own mana pools, initiative order | *shared enemy status pools* (Burn/Poison/Bleed stacks any hero can feed or spend), role slots, one item per hero from each chest; a curse into a hero's deck when it dies |
| **Monster Train** | one deck from **two clans** (primary + allied) | *keyword crossing* — "Rage is very good on Multistrike and Sweep units," "Lifesteal triggers Rejuvenate," and explicit anti-pairs: "avoid Armor and Regen" |

What this says about 158:

- **Nobody ships three engines in one pile.** The games with a shared deck (Cobalt, Roguebook) make the
  cards act on a *shared object* (the ship, the block pool, the position) so any hand is playable; the
  games with character-bound cards (Chrono Ark, Obelisk) keep each character's pool *small* and add a
  cross-character resource (escalating mana, enemy statuses). Mingming today has the worst of both: three
  full 8-card engines (per-body) in one pile with no shared object. 158's R2 (shared currencies) is the
  Obelisk/Monster Train answer; R3 (ally-target cards) is a piece of the Cobalt answer.
- **The glue is a rule, not a card.** Roguebook's "cheaper after the other hero's card," Chrono Ark's
  escalating cost, Cobalt's single energy pool — each is one engine rule that makes *alternating bodies*
  the right play. Mingming has one such rule already: STAB. 158's R5 (an OS rewards its element cast by
  anyone) is the same idea; a "cheaper after a different body's card" discount is the cheapest single rule
  on the list and needs no card work.
- **Small per-body pools.** Chrono Ark's ~10 skills per character and Roguebook's growth-rewards-talents
  both accept that a four-body pile will be large and design the *pool* so that any 10-card hand is
  coherent. 151's deck-size tax and 04's 8-card base kit are already this instinct; the missing piece is
  R1 (a body brings a role's 5 cards + 3 that touch another role), not smaller kits.
- **Monster Train's anti-pair list is a design tool, not a warning.** "Avoid Armor and Regen" is the
  designers saying which keywords do not cross. 158 §3's live-pair rate is the same table for Mingming,
  measured instead of written.

## 3. What a run does to the deck — rewards, removal, upgrades

| game | the pick | removal / upgrade | the run-defining layer | start deck |
|---|---|---|---|---|
| Slay the Spire | 3 cards **or skip** after every fight | remove at shops (price rises), upgrade at rest sites | relics — the run's identity; the pick is judged against the relics held | deliberately weak: Strikes and Defends the run exists to replace |
| Cobalt Core | 3 cards; elites give a card **and** an artifact | NPCs between fights: heal, upgrade one, remove one | artifacts + crew choice | crew's starting cards |
| Roguebook | cards, gems socketed into cards, embellishments | none needed — bigger deck unlocks talents | talents by deck-size threshold | two heroes' bases |
| Vault of the Void | cards go to a **backpack**; the deck is fixed at 20, swapped freely outside combat | Void stones (upgrades); purge is a combat mechanic | the class's Void cards | 20 chosen from the collection |
| Across the Obelisk | a chest, one item per hero; card rewards per hero, in short supply | "make it better" or "make it worse, but cheaper" upgrade forks; pay to remove | town: buy, improve, remove before the run | customised per hero before the run |

What this says about 153/157:

- **The start deck is meant to be replaced, not diluted.** StS's Strikes and Defends exist to be removed;
  every pick is better than something in the deck, so every pick *moves* the deck. Mingming's start kit
  is the 5 best engine cards per body (`createRun.ts`) — complete on day one — so a pick can only
  dilute, which is exactly the "sent to collection" feeling. 157 §5 Q1 (seed the kit with its payoffs
  still in the reward pool) is the StS shape.
- **Removal and upgrade are half the progression.** Every game in the table lets the player make the
  deck *smaller or sharper* as often as bigger. Mingming's workshop/blueprints do neither for cards.
  153's session should price a card-remove and a card-upgrade before it prices better card rewards.
- **Skip is a pick.** StS's skip is why the three offered cards can be honest — the player is never
  forced to dilute. Mingming's "send to collection" is a skip with a consolation; Vault makes the
  consolation a *sideboard* the player swaps from outside combat. That is the cheapest way to make the
  collection feel like progress: a fixed active deck size and a backpack, so collecting *is* building.
- **The run-defining layer is not cards.** Relics, artifacts, talents, Void cards — every game gives the
  run an identity that the card picks are judged against. Mingming's OS is that layer, and it is fixed
  at recruit. 09-20's "OS patches as a reward" is the relic slot this genre expects.
- **Elites pay double.** Cobalt gives a card and an artifact; StS gives a relic. Henry's "I'm finding a
  lot of scrap" is the symptom of elites paying in the same coin as wilds.

## 4. Recommendations, by ticket

- **159:** keep the 159 §3 ruling (face-up hand + deck on plaque) — it is Ruina's shape and the genre's
  consensus that the next action is visible. If a threat line is added later, copy StS2's format exactly
  (number × hits, tiered icon, `???`). Do not adopt Vault's threat pool; it changes the game's tense.
- **158:** add one *rule* before any card: a discount or bonus for casting after a *different* body's
  card (Roguebook), or an escalating cost for the same body (Chrono Ark). Both are engine-only and
  measurable in the 140 grid in a day. Then the currency tags (Obelisk / Monster Train).
- **153:** price card remove and card upgrade first; make the collection a backpack with a fixed active
  deck size (Vault); pay elites in a second coin (OS patch / blueprint, not scrap).
- **157:** the walker's policy v0 should include *skip* and *remove* as picks, or it will measure a
  dilution curve no genre game has.

---

## 5. Each system in Mingming — pros, cons, and how it would actually work (Henry asked 2026-09-20)

The engine facts every row below leans on: 3v3 simultaneous actives, one shared pile per side, the
hand discarded at `END_TURN` and drawn at `TURN_START` (so the enemy holds nothing during the player's
turn), Energy per unit, the enemy's turn planned by `TacticalAI` (same-turn depth 3, beam 8 in the
browser) against the state *as it is when its turn starts*.

### 5.1 Enemy-turn visibility

**A. Intent icon (Slay the Spire).** In Mingming: at the start of the player's turn, run the enemy's
own search against the current state and pin its planned casts to the plaques as icons — "Kraken →
38 to Rat", "Jorm → Poison ×3 on Rat". *Pros:* the genre's proven format; smallest footprint on the
145 stage; 147's `enemyIntent` cue already exists; needs no rules change if it plans from a hand the
enemy will hold. *Cons:* StS intents are **true** because enemies follow scripts; ours would be a
**prediction** — the AI re-plans after the player shields, kills, or debuffs, so the icon is wrong
exactly when the player acted on it. Without the timing change it is also guessing the enemy's *draw*,
which is the lie intents tell. Three casters × up to three casts each is six to nine icons a turn. One
more beam search per turn in the browser. And it is moves by the back door: the player reads icons,
not cards. *Verdict:* only as a labelled "if you ended turn now" line, and only after the hand exists.

**B. Face-up hand (Library of Ruina's shape).** In Mingming: move the enemy's draw to the end of its
own turn; show the drawn hand as a fan behind the enemy row, cards readable on hover, cards no enemy
can afford greyed by the highest Energy among the three. *Pros:* every card shown is true — no
prediction, no authoring; the cards are already the content, so nothing new to design; it turns the
152 loss into a readable board (four Undertow and Ink Stream in hand → shield or kill Jorm now); it
teaches enemy decks over runs; the engine change is one phase move, the AI is untouched. *Cons:* a
seven-to-ten card fan is a reading load every turn — the player, not the game, computes what three
casters with their Energy will do with it; it shows *options*, not the *choice*, so a player can
still be surprised by targeting; it makes the enemy's draw luck visible ("he drew four Undertow"),
which is fair but feels random; it needs stage room behind the enemy row (after 155's geometry fix);
and the grid must re-baseline to prove the phase move is neutral (any `OWNER_TURN_END` hook that reads
hand size would shift). *Verdict:* the floor. Everything else stacks on it.

**C. Committed queue (Inscryption's shape).** In Mingming: at the end of the enemy's turn it draws
*and plans* with the new hand; the planned casts are laid face-up in a staging row per caster with
their targets; on its next turn it executes them as staged, re-targeting only if the target died, and
plays any leftover Energy freely. *Pros:* the strongest telegraph in the genre that is still cards, not
icons; it creates **counterplay the game does not have today** — kill or Daze the caster and the
staged card is cancelled, shield the named target and the 38 is answered — which is what makes
focus fire a decision rather than a habit; the search cost moves off the player's turn entirely.
*Cons:* the AI plays against a stale state, so it gets **measurably dumber** — every grid and gate
number moves and the enemy will need stats or a second pass of cards to compensate; a staged zone is a
real engine change (a new pile, hook timing questions: does a `PROGRAM_PLAYED` hook fire at commit or
at execution?); and it sharpens the first-KO snowball ticket 70 measured — a committed plan that
loses its caster loses the turn. *Verdict:* the ambitious option; do it only if B ships and the
playtest still says "I couldn't see it coming."

**D. Countdown timers (Wildfrost).** Units act on a counter; the card *is* the action. Mingming's
cards are the action already, so this does not map — except to the things that are not cards: an OS
proc, a daemon, a boss phase. "Solar Overdrive fires in 2" on the plaque is a timer, and it is cheap.
*Verdict:* not a system for us; a plaque badge for scripted effects, later.

**E. Threat pool (Vault of the Void).** The enemy acts first, its damage waits in a pool, the player's
turn removes it. *Pros:* perfect information, zero prediction, the cleanest "fair loss" in the
genre. *Cons:* it inverts the turn — the simultaneous-actives design, Bark Shield, Weakened, every
absorb cue in 147 and every number in `balance_report.json` assumes the player acts *then* is hit;
this is a different game with the same cards. *Verdict:* no.

**F. Open deck on the plaque + discard pile.** Hover an enemy: its deck list and what it has cast.
*Pros:* honest, static, near-free with 155's tooltip work, and it is how Pokémon players learn a
movepool. *Cons:* says nothing about this turn. *Verdict:* yes, alongside whatever else ships.

### 5.2 Party glue (158) — the four rules the genre uses, in our engine

**Shared object (Cobalt Core).** All cards act on one hull. Not available: our bodies are separate
units by design (3v3, three HP bars, three OSes). Cross off.

**Alternate-body discount (Roguebook).** "A card costs 1 less if the previous card this turn was cast
by a different body." *Pros:* one reducer rule, zero card work, measurable in the 140 grid in a day;
it makes a mixed hand the *good* hand, which is the exact inversion of "three decks in one"; the AI
already searches sequences, so it will find the discount and the grid will show what it is worth.
*Cons:* it is a tempo buff to every party, so the enemy gets it too and the gauntlet re-baselines;
a 1v1 remnant after two deaths gets nothing — but it was already losing. *Verdict (Henry, 2026-09-21):* **not as a rule** — at most a daemon or a Driver, where it is a pick, not the game.

**Escalating same-body cost (Chrono Ark).** Each cast by the same body costs +1 for the rest of the
turn. *Cons:* punishes the 1v1 and 2v2 states Henry already ends up in after benching, and punishes a
body carrying a dead partner. *Verdict:* no, for the same reason 142 §6 exists.

**Shared enemy-status currencies (Across the Obelisk, Monster Train).** Payoffs read *any* Burn, Poison,
Weakened on the target, not "yours". *Pros:* it is the design work 158 R2 already describes; no engine
change — the statuses are shared already, the *cards* are not written to read them. *Cons:* card
work per deck, i.e. the 151 pass. *Verdict:* the real fix; the discount above is what makes it
visible while it is written.

### 5.3 Recommendation

Ship **B + F** as one Legion ticket (159a): the timing change, the face-up hand greyed by
affordability, the deck list on the plaque, a Settings switch, and a grid re-baseline to prove the
phase move is neutral. Hold **A** as a labelled "if you passed now" line (159b) behind the same
switch, added only if the next playtest still asks "what is it going to do." Keep **C** as the
written-down ambitious option for after EA, because it is the only one that buys counterplay and the
only one that costs the AI its judgement. For 158, the currency rule is the design law for the 151 deck pass; the
alternate-body discount survives only as a possible daemon or Driver.

**Ruled 2026-09-21:** face-up hand + deck on plaque — 159 §5 has Legion's rows.

---

## Sources

- [Slay the Spire 2 — Intent (wiki.gg)](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Intent)
- [How to Read Enemy Intent in Slay the Spire 2 (Untapped)](https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent)
- [Reveal Enemy Intents; Or, How I Run RPG Combats Like Slay The Spire](https://gordianblade.com/reveal-enemy-intents-or-how-i-run-rpg-combats-like-slay-the-spire/)
- [Inscryption (Wikipedia)](https://en.wikipedia.org/wiki/Inscryption)
- [Wildfrost — Counter (wiki)](https://wildfrostwiki.com/Counter) · [“I hate that I don't know what enemies will do” (Steam)](https://steamcommunity.com/app/1811990/discussions/0/3826415019288259847/)
- [Monster Train — Battle (Fandom)](https://monster-train.fandom.com/wiki/Battle) · [Monster Train — Synergy (Fandom)](https://monster-train.fandom.com/wiki/Synergy)
- [Cobalt Core (Wikipedia)](https://en.wikipedia.org/wiki/Cobalt_Core) · [Cobalt Core review (PC Gamer)](https://www.pcgamer.com/cobalt-core-review/) · [Cobalt Core Starting Guide (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=3076644839)
- [Roguebook is a deckbuilder with a touch of Magic (PC Gamer)](https://www.pcgamer.com/roguebook-is-a-deckbuilder-with-a-touch-of-magic/) · [Roguebook — Team Synergy Tips (Steam)](https://steamcommunity.com/sharedfiles/filedetails/?id=2520270649)
- [Chrono Ark review (Turn Based Lovers)](https://turnbasedlovers.com/review/chrono-ark-impressions/)
- [Across the Obelisk (The Tao of Gaming)](https://taogaming.wordpress.com/2022/08/20/across-the-obelisk/)
- [Vault of the Void review (Turn Based Lovers)](https://turnbasedlovers.com/review/vault-of-the-void/)
- [Library of Ruina (Wikipedia)](https://en.wikipedia.org/wiki/Library_of_Ruina) · [How The Hell Does Combat Work? (Steam)](https://steamcommunity.com/app/1256670/discussions/0/3043858137947626102/)
