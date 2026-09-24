# Ticket 147 — SFX pass (v2, 2026-09-12): what the genre does, what Henry owns, and the cue list that pairs with 146

> **Status: CLOSED 2026-09-24 — signed off by Henry after playtest. 147a–e shipped (3862d5f, 6803e57, 12a5404, c1c13e0, 49a8c10).**

**Type:** audio. **Status:** ASSETS PICKED AND IN THE REPO 2026-09-19 (§8) — 147a/b/d/e ready for Legion. Earlier: REVISED for the 146 design session; sources and the pack inventory
in §1–§3 are research, the cue table in §4 is the spec, §7 is what Henry still has to answer.
**Relates to:** 146 (every row there has a cue here — the two tickets are built together),
steam-release 35 (the audio pass), 145 (the top bar's volume slider). **Branch:** current working
branch, one commit per lettered row, authored as Henry.

---

## 1. What the genre does (research)

**Slay the Spire** is the reference for the ruled palette (146 §1.1) and it is instructive how
*few* sounds it uses. Its engine keys sounds by *what kind of thing happened*, not by card: a
handful of attack families (heavy, fast, flurry, magic, fire, poison, whiff), block gain / block
break, a tiered buff and debuff set (`BUFF_1..3`, `DEBUFF_1..2`), card lifecycle (draw, play,
exhaust, burn, obtain, upgrade, select, reject), deck open/close and shuffle variants, heal
tiers, a single death sting per monster family, turn-efficiency and victory stingers, and a
sparse UI set (click, hover). Attacks are short (80–250 ms), dry, and layered as *whoosh → impact
→ body*; the *card* being played does not have a sound of its own — the *action type* does. Player
feedback on the beta forums asked for a card-draw sound precisely because draw was the one
lifecycle moment that had none. Sounds are `.ogg`, mono, small. (Sources: the STS modding docs and
beta forum threads linked at the end.)

**Pokémon** is the reference for *type effectiveness as sound*. There are exactly three hit
sounds — normal, super effective, not very effective — and they differ in pitch and weight, not in
element: super effective is sharper and higher with more crunch, not very effective is dull and
muffled. The element lives in the *move's* sound (a flame, a splash) and the *result* lives in the
hit. Each monster has one cry, played on entry and on faint. Battle UI has a distinct set of
"beeps" for menu, HP-bar tick-down (a sustained tone that stops when the bar stops, so the ear
reads the damage size), and a level-up jingle. This is the model for 146 §2c's impact: element in
the trail, effectiveness in the hit.

**Hearthstone** (the *lush* end) layers every card play as *play sound → travel → impact → target
reaction*, gives spells a per-school family (fire, frost, arcane, holy, shadow), gives minions a
voice line on play/attack/death, and mixes with heavy ducking so the impact always reads. Its
lesson for us is the *structure* (four-stage cast), not the volume of assets — 146 §2c is that
structure already.

**Balatro / Monster Train / Inscryption** (modern deckbuilders): a small set of *musical* UI
sounds (card select/drag/place are pitched notes that rise as you chain), an escalating "scoring"
tick that climbs in pitch with the combo, one big sting for the payoff, and ambience that ducks
under combat. The reusable idea: **pitch escalation within a turn** — the third card played this
turn sits a step higher than the first. That maps directly onto `Played n` in the 145 top bar.

**Commercial card-game SFX kits** (Epic Stock Media's "AAA Card Game", 503 files) sort the whole
space into twelve buckets: UI, upgrades, plays, magic, card movements, abilities/effects,
achievements, game actions, alerts, special effects, items, ambience loops — which is a useful
checklist for what a complete pass covers and roughly the shape of §4.

**What this means for Mingming:** the sound set should be keyed by *event kind and element*, not
by card; ~40 cues cover the game; three effectiveness hits do more than thirty element hits; every
cue is short and dry; escalation and ducking are mixing rules, not assets.

## 2. Henry's owned packs (Unity Asset Store) — what they are and what they are for

**Licensing first:** Unity's own support page says Asset Store assets *are not restricted to
Unity projects* — they may be used with other engines and stacks under the Asset Store EULA (no
redistribution as standalone files or in an extractable form; no monetising user-generated content
built on them). The one thing to check per pack is a "restricted" or custom licence flag on its
store page. So every pack below is usable in the React build; ship the audio as game data, not as
a browsable folder of the pack.

| pack | publisher / size | what it is | fit for 147 |
|---|---|---|---|
| **Ultimate Sound FX Bundle** (+ Ultimate Water Sounds, Fire & Flame Sounds add-ons) | Sidearm Studios, 5.9 GB, deprecated on the store but owned | the workhorse: a general-purpose library that includes the Water and Fire & Flame sub-libraries — exactly the element material for 146d (water lash/drops, flame arc/burst) and the tick sounds (burn crackle) | **primary source** for element trails, impacts, ticks, UI |
| **Monster SFX – 111518** | GWriterStudio, 25.8 MB | creature vocalisations: growls, roars, bites, hisses | **death/kill stings, the "cry" on entry and faint per species family** (Pokémon's model); a bite/hiss for Nature/Poison casts |
| **Free Sound Effects Pack Starter – All categories** | Olivier Girardot, 284 MB | a sampler across UI, impacts, whooshes, magic, ambience | UI set, whooshes for the card flight, a few magic impacts |
| **FREE Casual Game SFX Pack** | Dustyroom, 8.6 MB | bright pops, pips, coins, wins — the "musical UI" family | **card select/hover/place pips, reward claim, scrap, level-up**, the Balatro-style escalation notes |
| **Sci-Fi Small Sound Pack** | Sound Works 12, 353 MB | UI beeps, terminal blips, energy hums, glitches | **OS/daemon proc tells** (the "firmware" identity — terminal blips), energy gain, the TERMINATED glitch, breach/stance |
| **Weapons of Choice – FREE** | Komposite, 14 MB | gun/melee foley | a dry thump layer under `hitNone`; otherwise off-theme |
| **Post Apocalypse Guns Demo** | Sound Earth, 5.8 MB | gunshots | not a fit |
| **Footstep (Snow and Grass)** | MGW, 26 MB | footsteps | biome ambience beds only, if at all |
| **8-bit music free**, **Free Music Tracks For Games**, **Shooter Action Themes sample** | Cron / BraveWarrior / Escalante | music | out of scope for 147 (music is its own ticket); the 8-bit set could seed a "retro" toggle later |

**What I cannot tell from the store listing** and need from Henry (§7): the folder/file names
inside the Ultimate bundle (how the Water and Fire sub-libraries are organised, whether there is
an "impacts"/"magic"/"whoosh" category), and whether the Monster pack has per-creature sets or a
flat list. A `dir /s /b > listing.txt` of each pack's `Assets` folder is enough.

## 3. Free packs worth pulling in (all commercially usable, no attribution required unless noted)

- **Sonniss GameAudioGDC bundles** — the big one. The 2026 bundle is 7.5 GB / 347+ files,
  royalty-free, commercially usable, no attribution, unlimited projects; the community archive of
  the nine previous years is 200 GB+ under the same licence. Professional libraries (whooshes,
  impacts, magic, creature, UI, water, fire) — this is where a *consistent* element/impact set
  comes from if the Sidearm bundle is uneven. Pull the 2026 bundle plus one or two prior years and
  keep only what §4 needs.
- **Kenney** (kenney.nl) — CC0: "Impact Sounds", "UI Audio", "Casino Audio" (card flips, chips,
  shuffles), "Digital Audio", "Sci-Fi Sounds". The card-handling set (shuffle, deal, flip) is the
  cleanest free source for `shuffle`/`discard`/`cardDraw` samples, and CC0 means no bookkeeping.
- **freesound.org** — filter to CC0 for one-off gaps; anything CC-BY needs a credits entry.
- **OpenGameArt** — CC0/CC-BY; uneven, use as a last resort.

Recommendation: Sidearm bundle + Sonniss GDC for the combat layer, Kenney for card handling and
UI, Dustyroom for the musical pips, Monster SFX for cries, Sci-Fi Small for OS blips. Everything
else stays in the drawer.

## 4. The cue list — one per 146 row (the spec)

Format: `cue` · fires on · what it sounds like · which source. Recipes (the synth engine) stay as
the fallback for every cue so nothing waits on a pack; samples replace them name-for-name (§5).

**Card lifecycle (146c, the cast sequence)**

| cue | fires on | sound | source |
|---|---|---|---|
| `cardHover` | hand hover | very quiet tick | Dustyroom |
| `cardSelect` | card picked up / target mode | pitched pip, **rises a step per card played this turn** (`Played n`) | Dustyroom |
| `cardFly` | flight to the lane | short paper whoosh (120 ms) | Kenney Casino / Girardot whoosh |
| `castFire` / `castWater` / `castNature` / `castNone` | the trail leaves the caster | Fire: ignition whoosh with crackle tail; Water: rushing lash with a drip tail; Nature: leafy whip; None: plain whoosh | Sidearm Fire & Flame / Ultimate Water / Sonniss |
| `impactNormal` / `impactSuper` / `impactResisted` | `DAMAGE_TAKEN` (`cause: attack`) by effectiveness — **the Pokémon three** | normal: dry thump + short crunch; super: sharper, higher, extra crack layer; resisted: muffled, low, damped | Sonniss impacts / Kenney Impact |
| `hitBig` | the 146e hit-stop ceiling (≥35% or kill) | sub thump (50 Hz, 200 ms) + a one-frame click, layered on the impact | synth (keep the recipe — it is a layer, not a sample) |
| `cardDiscard` / `cardExhaust` | card to discard / dissolves | paper swish / a short burn-away hiss | Kenney / Sidearm Fire |
| `enemyCast` | enemy card appears at the caster | a lower, shorter version of `cardFly` | same, pitched −3 st |

**Status tells (146f)**

| cue | fires on | sound | source |
|---|---|---|---|
| `buffUp` | Strengthened / Sharp / Regen / Energized / BarkShield applied | bright ascending two-note; pitched per status (family, not thirty sounds — STS's `BUFF_1..3`) | Dustyroom / synth |
| `debuffDown` | Weakened / Dazed / Poison / Burn / Asleep / Stunned applied | dull descending two-note; pitched per status | synth / Sci-Fi |
| `statusOff` | `STATUS_REMOVED` | soft release "pop" | Dustyroom |
| `poisonTick` / `burnTick` | `DAMAGE_TAKEN` (`cause: status`) | wet drip (pitch rises with stacks) / soft crackle (pitch rises with stacks) — **never the impact sound** | Ultimate Water / Fire & Flame |
| `regenTick` | Regen heal | soft warm chime | synth |
| `shieldRaise` / `shieldCrack` / `absorbed` | BarkShield/Sharp applied / the 146f crack / an absorb | woody knock rising / short snap / the existing absorbed | Sonniss / synth |
| `recoil` | `cause: recoil` or `toll` | short self-hit thud + a wince (Monster pack, quiet) | Monster SFX |

**OS and daemon tells (146g)**

| cue | fires on | sound | source |
|---|---|---|---|
| `osProc` | `HOOK_FIRED` (family default) | terminal blip in the owner's element pitch (Fire low, Water mid, Nature high) — the firmware is a computer, it should sound like one | Sci-Fi Small |
| `osSignature:<shape>` | the 146g signature shapes (`pulse`, `rise`, `arc`, `crack`, `swirl`, `drain`, `spark`) | one cue per *shape* (seven), not per OS — the shape carries the identity, the pitch carries the element | Sci-Fi Small + Sonniss magic |
| `daemonProc` | a daemon hook | the `osProc` blip an octave up | Sci-Fi Small |

**Bodies and beats**

| cue | fires on | sound | source |
|---|---|---|---|
| `cry:<species>` | a body enters the field; on death | one short creature call per species family (wolf, serpent, squirrel, kraken, …) — Pokémon's cry; 16 species, several can share a family | Monster SFX |
| `kill` | HP → 0 | sharp sting then the existing `death` fizzle after 120 ms; the cry plays under it | synth + Monster |
| `lowHp` | a unit crosses 25% | a single heartbeat; **no loop** | synth |
| `turnStart` / `turnEnd` | player `TURN_START/END` | soft two-tone up / down — the "your move" beat that pairs with the 145 top-bar pill | Dustyroom |
| `enemyTurn` | enemy `PHASE_START` | a low pad swell (300 ms) under the stage dim | Sonniss |
| `energyGain` / `energySpend` | EP restored / paid | bright pip / soft click | Dustyroom |
| `shuffle` / `draw` | `DECK_SHUFFLED` / `CARD_DRAWN` | riffle / flick | Kenney Casino |
| `victory` / `defeat` / `gymIntro` / `runWon` | existing + the two long stings | keep; `gymIntro` and `runWon` are the only music-shaped cues | existing / Sonniss |

Roughly forty cues; a dozen are the existing recipes kept.

## 5. Rows

- **147a — sample playback.** `registerSample(name, url)` in `AudioEngine` decoding once into an
  `AudioBuffer`, played through the same bus, gain, pitch and rate-limit as recipes; a manifest
  (`src/ui/audio/sfx.manifest.ts`) maps each `SfxName` to a file or to `recipe`; missing file →
  recipe fallback, never silence. Files as `.ogg` (Vorbis, mono, 44.1 k, −1 dB peak), under
  `public/sfx/`, ≤ 60 KB each; a build check fails on anything larger.
- **147b — the mixing rules** (unchanged from v1, now with the escalation rule): rate limit 60 ms
  per cue; multi-hit plays the impact with a pitch step, never stacked; ducking −6 dB for 250 ms
  under `hitBig`/`kill`/`victory`/`defeat`; pitch by magnitude (impacts drop with damage, ticks
  rise with stacks); **cardSelect rises a semitone per card played this turn, resets at turn
  start**; never a sound per particle; a `DynamicsCompressor` limiter on the master bus. Settings:
  the existing SFX slider + a **combat sounds** switch (the 146 `vfx` switch does *not* mute).
- **147c — the pack pull.** From Henry's listings (§7) and the Sonniss/Kenney downloads, pick one
  file per §4 cue, trim to length, normalise, name-for-name into the manifest. Keep a
  `docs/audio/SOURCES.md` with pack → file → cue (the EULA needs nothing public, but we want to
  know where every sound came from). Cries: sixteen species → six or seven families.
- **147d — wiring.** `useBattleVfx` maps the events (including 146b's `cause`, `source`,
  `HOOK_FIRED`) to the cues; the 146 rows call `playSfx` at the moments their sequences say
  (trail start, impact, status, discard). Unit test: every `SfxName` in §4 exists and every listed
  event maps to one; nothing plays under vitest.
- **147e — write-back.** A 20-second capture of a 3v3 turn with 146 on and sound on; a second with
  combat sounds off; Henry listens for: can he tell super-effective from normal with his eyes
  closed; can he tell a Poison tick from a hit; can he hear an OS fire.

## 6. Not in this ticket

Music (its own ticket — the owned music packs are noted in §2 for it). Voice. Per-card unique
sounds (the genre says no). Ambience beds (later, with biome art).

## 7. Open — for Henry

1. A file listing of the **Ultimate Sound FX Bundle** (with the Water and Fire & Flame add-ons)
   and **Monster SFX** so 147c can name files rather than categories. `dir /s /b` of each pack's
   folder into a text file is enough.
2. Confirm the **Pokémon three** (normal / super / resisted hits carry effectiveness; element lives
   in the cast) — it is the one place this ticket departs from "one hit per element" in v1.
3. Cries per species: yes/no. It is the cheapest "personality" sound in the game and the Monster
   pack exists for it, but it is 16 assignments and a taste call.
4. Pull the Sonniss GDC 2026 bundle (7.5 GB) — yes/no. It is free and the licence is clean; it is
   just a download.

---

Sources: [Unity — Can I use assets from the Asset Store with other engines?](https://support.unity.com/hc/en-us/articles/34387186019988-Can-I-use-assets-from-the-Asset-Store-with-other-engines) · [Unity Asset Store EULA FAQ](https://assetstore.unity.com/browse/eula-faq) · [Sonniss GDC 2026 Game Audio Bundle](https://gdc.sonniss.com/) · [Sonniss GameAudioGDC archive](https://sonniss.com/gameaudiogdc/) · [Slay the Spire modding audio README (jorbs-spire-mod)](https://github.com/dbjorge/jorbs-spire-mod/blob/master/src/main/resources/stsjorbsmodResources/audio/README.md) · [STS beta forum — SFX for card draw](https://steamcommunity.com/app/646570/discussions/4/2590022385672942037/) · [Epic Stock Media — AAA Card Game SFX kit](https://epicstockmedia.com/product/card-game/) · [Pokémon damage sounds (Soundeffects Wiki)](https://soundeffects.fandom.com/wiki/Pok%C3%A9mon_Not_Very_Effective_Damage) · [itch.io card-game sound effects tag](https://itch.io/game-assets/tag-card-game/tag-sound-effects)

## 8. PICKED 2026-09-19 — the assets are in the repo; 147c is done, 147a/147d are Legion's

Henry chose every cue over four sampler rounds (`_sfx/` on his machine holds the packs and the
cutter scripts `sampler_r1..r4.py`, `sfx_finalize.py`; the sampler pages are the artifact "Mingming
SFX Sampler"). **61 files in `public/sfx/*.mp3`, 674 KB total, none over 18 KB**, mono 96 kbps
peak −1 dBFS, ≤1.4 s; `public/sfx/manifest.json` (cue → file, bytes, seconds) and
`docs/audio/SOURCES.md` (cue → pack file(s), layered clips list each layer). MP3 not OGG: Web
Audio decodes MP3 on every engine (Vorbis is missing in Safari), and the first OGG cut carried a
stray video stream from embedded cover art — not worth the risk for 600 KB.

**Rulings that changed the cue list (§4 is superseded where they differ):**
- Effectiveness is **normal / super-effective only** (the game has no "not very effective"); STAB is
  not a sound — it shows up as damage size through `hitBig` and pitch-by-magnitude. Ladder:
  `impactNormal` (Realistic Punch 1) → `impactSuper` (Heavy Game Punch 1) → `hitBig` layered under
  either on a ≥35% hit (Heavy Game Punch 1 + EMP).
- **Element also rides the impact** as an option: `impactFire` / `impactWater` / `impactNature`
  exist (Fighting Sounds Pro element punches). 147d wires them *instead of* `impactNormal` when the
  attack's element is one of the three and the effectiveness is normal; super-effective always
  plays `impactSuper`. Henry can flip that rule after hearing it.
- **Shields are three moments + two raises:** `sharpRaise` (Armor On), `barkRaise` (Shield block),
  `absorbedNoDamage` (a hit fully absorbed), `blockedByBark` (bark took the hit), `barkBreak` (the
  hit broke through the bark).
- `poisonTick` is a soft thud + bubbles; `burnTick` a sizzle; neither is an impact (no hit-stop).
- `kill` is a **power-down** (EMP), not a scream — they are robots.
- **OS tells: one per Early Access OS**, named `os_<species>_<OS>`; every other OS uses the family
  default (146g) with `daemonProc` as the placeholder blip. Daemons: `daemonProc` for all for now —
  **note for later: one per daemon.** SOLAR_OVERDRIVE (a passive) fires its tell on each Fire attack
  the multiplier lands on.
- **Species cries: yes, all sixteen** — on entry and on death; the three undead are distinct
  (`cry_hel` ghost, `cry_draugr` zombie, `cry_valkyrie` warrior voice).
- Dropped: `enemyTurn` (turnStart/turnEnd carry the beat), `cardHover` stays, `lowHp`/`victory`/
  `defeat` stay synthesized.

**The cue list as shipped** (`public/sfx/<cue>.mp3`):
- *Card lifecycle:* `cardHover`, `cardSelect`, `cardFly`, `cardDraw`, `cardDiscard`, `shuffle`
- *Casts:* `castFire`, `castWater`, `castNature`, `castNone`
- *Impacts:* `impactNormal`, `impactSuper`, `hitBig`, `kill`, `impactFire`, `impactWater`, `impactNature`
- *Status and shields:* `buffUp`, `debuffDown`, `statusOff`, `poisonTick`, `burnTick`, `sharpRaise`, `barkRaise`, `absorbedNoDamage`, `blockedByBark`, `barkBreak`, `recoil`
- *OS / daemon tells:* `os_fenrir_CINDER_WALL`, `os_fenrir_UNBOUND_KERNEL`, `os_huldra_ALLURE_PROXY`, `os_huldra_BARK_SHIELD`, `os_jormungandr_OUROBOROS`, `os_jormungandr_TOXIN_FANG`, `os_kraken_ABYSSAL_INK`, `os_kraken_TIDAL_CRUSH`, `os_ratatoskr_GOSSIP_NODE`, `os_ratatoskr_INSTIGATOR`, `os_skoll_SOLAR_OVERDRIVE`, `os_skoll_TREACHERY_KERNEL`, `daemonProc`
- *Beats:* `turnStart`, `turnEnd`, `energyGain`, `gymIntro`
- *Cries:* `cry_audhumbla`, `cry_draugr`, `cry_fafnir`, `cry_fenrir`, `cry_gullinbursti`, `cry_hel`, `cry_hraesvelgr`, `cry_huldra`, `cry_jormungandr`, `cry_kraken`, `cry_nidhoggr`, `cry_ratatoskr`, `cry_skoll`, `cry_sleipnir`, `cry_valkyrie`, `cry_ymir`

**147a — sample playback (Legion).** `registerSample(name, url)` → decode once via
`AudioContext.decodeAudioData` into a buffer cache; `playSfx(name, {pitch, gain})` plays the buffer
through the existing master bus (gain → compressor), falling back to the synth recipe when the
manifest has no entry or the fetch fails — never silence. Load lazily on first battle, in the
background, from `public/sfx/manifest.json`; the synth covers the first fight if the fetch is slow.
`SfxName` becomes the union of the recipe names and the manifest keys; a test asserts every
manifest key is a `SfxName` and every file exists and is ≤ 60 KB.

**147b — mixing** as §5 (rate limit 60 ms, ducking under `hitBig`/`kill`/`victory`/`defeat`,
pitch by magnitude on impacts and by stacks on ticks, `cardSelect` +1 semitone per card played
this turn, `DynamicsCompressor` limiter, the *combat sounds* switch beside the SFX slider).

**147d — wiring** (paired with the 146 rows): `PROGRAM_PLAYED` → `cardFly` (player) / `enemyCast`
(reuse `cardFly` pitched −3 st) then `cast<Element>` at trail start; `DAMAGE_TAKEN cause:attack`
→ impact per the ladder above (+`hitBig` layer at ≥35%), `cause:status` → `poisonTick`/`burnTick`,
`cause:recoil|toll` → `recoil`; fully absorbed → `absorbedNoDamage`; bark absorbed → `blockedByBark`;
bark broken → `barkBreak`; `STATUS_APPLIED` → `buffUp`/`debuffDown` (Sharp → `sharpRaise`,
BarkShield → `barkRaise`), `STATUS_REMOVED` → `statusOff`; `HOOK_FIRED` → `os_<id>` if present else
`daemonProc`; HP → 0 → `kill` then the species cry; battle start → each body's cry 120 ms apart;
`TURN_START/END` (player) → `turnStart`/`turnEnd`; Energized/EP → `energyGain`; gauntlet →
`gymIntro`; draw/shuffle/discard/hover/select as named.

**147e — write-back** as §5: the 20-second capture, and Henry's three ear-tests (super vs normal
eyes closed; a Poison tick vs a hit; an OS firing).
