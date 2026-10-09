# Flavour names that still sound like computers: current, and a Norse proposal (for Henry's review)

**Approved by Henry 2026-10-07 with three changes (they are applied below):** Overkill Recovery becomes EINHERJAR FEAST (was VICTORY FEAST), Corrupted Data becomes FORGE SLAG (was Dross) and the Junk Start modifier reads "Start with two Forge Slag in your deck.", Surge Protection becomes URÐARBRUNNR (was Breakwater). Everything else in this list is approved as written. **Built 2026-10-08** (ticket 195 row 195e-2, one commit on `first-impressions`): every name and line below is now in the game.

Decision D1 of ticket 195 (row 195e-2). **All of it is applied (2026-10-08).** One commit applied the lot. Ids, saves and the walker's output never change; only the shown name and line do. A line that says "keep" is already fine.

Pattern: the same as 183i (Instincts) and 192 (Auras and Runes). Each table gives what the player sees now (after the label words, so "scrap" is already "amber"), what I propose, and one line of why. Where the mechanics are fixed (the number of cards, the price, the odds), only the flavour moves; the option labels that name a game word (Retrain, Fit, Pick 1 of 3) stay as they are.

How the names were checked: none of the proposed names is used by another card, Instinct, Aura, Rune, Draught or Totem today (searched in `programs.json`, `hooks.json`, the registries and the label files). Two I wanted were already taken (Mead Horn is the old Battery Pack card; Norns' Gift is a card), so I picked others.

## 1. Events (`events.json`): 20 events

Fifteen are the ones on your list. The last five (marked +) are not on it but carry the same machine words ("terminal", "compiler", "construct", "archive"), so they are here for you to take or drop.

| Event id | Now | Proposed | Line now | Proposed line | Why |
|---|---|---|---|---|---|
| scrap_cache | Amber Cache | **Barrow Gold** | A sealed maintenance locker, still humming. | A barrow, half-opened. The gold inside still gleams. | Digging a burial mound for gold is the Norse version of a cache. "Dig deeper" now reads right, and the debuff it can bring is renamed Barrow Mist (section 3). |
| abandoned_terminal + | Abandoned Terminal | **The Norns' Loom** | An old compiler, still warm. It will take one card. | A loom hung with glowing thread. It will rework one card. | The three Norns weave fate; reworking a card (a free upgrade) is weaving it again. |
| data_fragments | Data Fragments | **Scattered Verses** | Loose code drifts through the static. | Half-remembered verses drift on the wind. | Pick 1 of 3 cards: scraps of a skald's verses. |
| wild_tracks | Wild Tracks | **Wild Tracks** | Fresh signal trails lead off the path. | Fresh paw-prints lead off the path. | Keep the name. Only "signal trails" is machine. |
| relay_tower | Relay Tower | **Heimdall's Watch** | A survey relay, half-buried. It still has power for one sweep. | A watchman's post, half-buried. Its horn can still be sounded once. | Heimdall watches every road and sounds the Gjallarhorn. "Survey" (see who waits in each fight) is the horn; "Strip it" becomes "Plunder it". |
| corrupted_stream | Corrupted Stream | **Gjöll Ford** | The path runs through a torn data stream. It will cost you to cross. | The path runs through a black, churning river. It will cost you to cross. | Gjöll is the river at the edge of Hel's realm, and crossing it costs you. The debuff it hands out is renamed Gjöll Chill (section 3). |
| rare_vault + | Rare Vault | **Dragon's Barrow** | A locked archive. The lock is already broken. | A sealed barrow. The seal is already broken. | "Archive" is a library word. Pick 1 of 3 Rare cards from a dragon's grave. |
| macro_crate | Draught Crate | **Brewer's Cask** | A crate of single-use routines, factory-sealed. | A cask of single-use draughts, sealed with wax. | "Routines" and "factory" are the machine words. |
| trader + | Trader | **Trader** | A construct offers to swap. It only trades up. | A hooded peddler offers to swap. They only trade up. | Keep the name; "construct" is the leftover. |
| overclock_rig | Overclock Rig | **Brokk's Forge** | An overclock rig. It works, mostly. | A dwarf's forge. It works, mostly. | The dwarf Brokkr forged Mjölnir while Loki pestered him, and "works, mostly" and the junk card it leaves behind (Forge Slag, section 5) are exactly that story. |
| data_broker | Data Broker | **The Skald's Price** | A broker with a price list. | A skald who sells verses by the line. He has a price list. | Pay 15 or 40 for a pick of 3 cards. |
| stray_mingming | Stray Mingming | **Stray Mingming** | A lost Mingming is following your signal. | A lost Mingming is following your trail. | Keep the name. "Signal" to "trail". |
| ambush_bait + | Ambush Bait | **Ambush Bait** | Something is nesting in the wreckage, guarding a cache. | Something is nesting in the ruins, guarding a hoard. | Keep the name; the line loses "wreckage" and "cache". |
| mirror_protocol | Mirror Protocol | **Loki's Mirror** | A copier. It charges by the job. | A shapeshifter's pool that copies whatever it is shown. It charges by the job. | Loki copies and tricks; the price is the joke. Duplicate a card for 25. |
| driver_shrine | Totem Shrine | **Totem Shrine** | An old Totem, still humming, cradled in a data shrine. It wants an offering. | An old Totem, still warm, cradled in a mossy shrine. It wants an offering. | Keep the name (the word Totem is already the new one). "Data shrine" goes. |
| black_market_patch | Black-Market Rune | **The Runecarver** | A rune dealer, no questions asked. | A rune-carver, no questions asked. | "Black market" is modern; a carver who fits the best Rune to one body is not. |
| corrupted_cache | Corrupted Cache | **Cursed Hoard** | A cache wrapped in corrupted code. Maybe it's fine. | A hoard wrapped in a curse. Maybe it's fine. | Andvari's gold was cursed. The bad half of the coin flip hands out Forge Slag and costs 15 amber. |
| the_toll | The Toll | **The Toll** | A construct blocks the path. It wants payment. | A troll blocks the path. It wants payment. | Keep the name: a troll under the bridge. |
| firmware_reflash | Instinct Retrain | **Well of Urd** | A retrain station. One body can be rewritten. | A still pool beneath the roots. One body can be remade. | Urd's well is where the Norns shape fates; an instinct is a fate. (Not the Well of Mimir card.) |
| recompiler + | Recompiler | **Seiðr Cauldron** | A recompiler. What goes in is not what comes out. | A cauldron on the boil. What goes in is not what comes out. | Seiðr is Norse sorcery. Give up a card, get a random card of the same element and rarity. |

## 2. Draughts (`macroRegistry.ts`)

Surge, Mend, Venom Shot, Kindle, Rally, Cripple, Salve, Revive and Echo are plain words and stay. Four still read like software.

| Now | Proposed | Why | What it does |
|---|---|---|---|
| Free Exec | **Swift Hand** | "Exec" is a command | The next card this unit plays this turn costs nothing. |
| Cache Pull | **Raven's Draw** | Huginn and Muninn bring knowledge back to Odin | Draw 2 cards. |
| Ping Sweep | **Heimdall's Gaze** | Heimdall sees everything on every road | Shows which Mingmings wait in every fight in the biome you are standing in. Fires from the map. |
| Recharge | **Second Wind** | a battery word, and "Second Wind" says what it does | Gives one unit +1 Energy right now. |
| Echo | keep | a mountain echo works in any age | Replays the last card you played, free, at a target you choose. |
| Surge | keep | a surge of force | A burst of damage at one enemy. |

## 3. Event debuffs (the two temporary Totems)

| Now | Proposed | Why | What it does |
|---|---|---|---|
| FRAYED SIGNAL | **GJÖLL CHILL** | handed out by Gjöll Ford | At the start of your first turn, each member loses 25% of its max HP. |
| STATIC HAZE | **BARROW MIST** | handed out by digging deeper at Barrow Gold | At the start of your first turn, each member gains 2 Weakened. |

The event option reads "Gjöll Chill next fight: At the start of your first turn, each member loses 25% of its max HP." The rule text comes from the same place it does now (195f).

## 4. Totems: the five you asked me to check, and three more

Your five. FIRST BLOOD, TENTH STRIKE and ROOT ROT are fine as they are (a blood-feud idiom, a count, and Níðhöggr gnawing at Yggdrasil's roots). ANTIVENOM is plain English and fine. BULWARK REFLEX is the only one that sounds mechanical.

The table has BULWARK REFLEX and then three more Totems with computer words that were not on your list (the last three rows):

| Now | Proposed | Why | What it does |
|---|---|---|---|
| BULWARK REFLEX | **SHIELDWALL** | the viking battle line; "reflex" is a machine word | The first time each member drops below 50% HP in a fight, it gains 15 Bark Shield. |
| DEEP CACHE | **RAVEN'S BOON** | a bonus draw is a raven bringing news (matches Raven's Draw) | The first bonus (non-natural) draw this side makes each turn grants the drawer 1 Strengthened. |
| STATIC FIELD | **STORMSPARK** | static is electricity; storm keeps the sky and the strike | Every card this side plays deals 6 power to a random enemy. |
| OVERKILL RECOVERY | **EINHERJAR FEAST** | the einherjar feast after battle | Whenever an enemy faints, every living member of this side heals 8% of max HP. |

Keep: FIRST BLOOD, TENTH STRIKE, ANTIVENOM, ROOT ROT, the eight element Totems (FIRE TOTEM ... DARK TOTEM), and the gym boss rules WAR FOOTING and TIDAL SURGE.

### 4b. The battle-log lines that go with these Totems (added 2026-10-07)

Henry's 2026-10-07 playtest flagged the battle log's machine words. Every other log line was reworded that day; these six belong to the Totems above, so they wait for this list and change with the names. Ids do not change. When this lands, drop the `WAITING_FOR_195` exception in `src/ui/labels/battleLogWords.test.ts`.

| Now (`hooks.json` text) | With the renames |
|---|---|
| 💾 DEEP CACHE hits: {target} is Strengthened. | 🪶 RAVEN'S BOON: {target} is Strengthened. (💾 is a floppy disk) |
| ⚡ STATIC FIELD arcs off {owner}'s card. | ⚡ STORMSPARK leaps from {owner}'s card. |
| 💚 OVERKILL RECOVERY: {owner} recovers. | 💚 EINHERJAR FEAST: {owner} recovers. |
| 🪵 BULWARK REFLEX: {owner} braces behind bark. | 🪵 SHIELDWALL: {owner} braces behind bark. |
| FRAYED SIGNAL: {owner} loses a quarter of its HP to the torn stream. | GJÖLL CHILL: {owner} loses a quarter of its HP to the icy ford. |
| STATIC HAZE: {owner} is clouded by static. | BARROW MIST: the mist saps {owner}'s strength. |

## 5. Cards (`programs.json`)

Each name keeps its `+` suffix for the upgraded card.

| Now | Proposed | Why | What it does |
|---|---|---|---|
| Corrupted Data | **Forge Slag** | slag from a forge; matches Brokk's Forge and Cursed Hoard | Does nothing. Exhaust. |
| Scavenge Data | **Fisher's Haul** | the Water card draw, a haul from the water | Draw a Water card. |
| Deep Scan | **Völva's Sight** | the seeress who sees ahead | Draw 2. |
| Capacitor | **Warhorn** | a blast of the horn stores up and releases energy | Gain 3 Energized. |
| Discharge | **Thunderclap** | Thor's thunder strips a buff and leaves a burn | Remove up to 4 Strengthened from the target. Apply 1 Burn per 2 removed. |
| Tidal Battery | **Ægir's Feast** | the sea-giant hosts the gods' feast, and every ally is fed | Every ally gains 1 Energized. |
| Surge Protection | **Urðarbrunnr** | Urðarbrunnr, the well at the root of Yggdrasil; a water card that gives energy back | 25 power. If an effect drew your team a card this turn, refund 1 Energy. |

## 6. Modifiers (`modifiers.json`)

Two lines change, and one of them is a label word rather than a Norse one.

| Now | Proposed | Why |
|---|---|---|
| Junk Start: "Start with 2 Corrupted Data in your deck." | "Start with two Forge Slag in your deck." | follows the card |
| Tight Budget: "Marketplace and workshop prices +25%." | "Shop and den prices +25%." | the game's words are Shop and Den; not Norse, just the leftover from 195e-1 |

## What applying it touches

The strings in `events.json`, the Draught names and descriptions in `macroRegistry.ts`, the Totem names in `hooks.json` and the two temporary Totems in `driverRegistry.ts`, the card names in `programs.json`, and the two modifier lines. The tests that pin any of these old names move with them. Ids do not change, so saves, the walker and the replayed sessions are untouched, and the on-screen word swap in `plain()` is not involved.

## What I need from you

Mark any line you want changed, kept or dropped. The five plus-rows in section 1 and the last three Totems in section 4 are mine; say "drop" and they stay as they are. Say "apply" and it goes in as one commit with the golden text tests moved with it.
