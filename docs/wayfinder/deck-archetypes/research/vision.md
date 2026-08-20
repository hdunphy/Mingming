# MINGMING - THE VISION (Henry + designer, 2026-08-19 evening session; north-star doc)

## The game: an expedition roguelike that feeds a collection

- **A run = an expedition into a REGION**: a branching node map (fights, wild encounters,
  events, the region boss = the GYM). **The type chart is the ROUTING layer** - regions
  have elemental character, you see what is coming and build/route for it (the 'routed'
  meta-layer, now structural).
- **Start with ONE mingming from the ranch** (starter + its OS = the seed deck). **Catching
  grows the team 1 -> 2 -> 3 mid-run**; a recruit joins with its cards (merged into the
  SHARED deck per the 3v3 ruling), its energy pool, and its OS - **recruiting IS drafting**.
  Mono-element STAB vs coverage is decided by who you catch.
- **The run arc IS the balance program**: early fights 1v1 (the tuned foundation), midgame
  2v2, the gym is full 3v3. The draw formula (sum of members' cardDraw - (N-1)) already
  handles the growing team. Nothing built so far is discarded; it is the run's chapters.
- **The RANCH persists between runs**: caught mingmings keep their individual stat rolls
  (IV jitter becomes collection depth - two krakens are not the same kraken). Starters
  widen horizontally; no vertical meta-progression creep. **PvP 3v3 (Steam) draws teams
  from the ranch** - PvE runs and the ladder are one collection, two uses.
- **Acquisition = BLUEPRINTS + SCRAP (Henry's existing system, ruled 2026-08-19 late).**
  Defeat a wild -> recover its BLUEPRINT (banks to the ranch PERMANENTLY, run outcome
  irrelevant - dead runs still pay forward). Mid-run growth: route to a WORKSHOP node and
  spend SCRAP to assemble a blueprint into the team. Fits the fiction (OS/firmware/programs
  world - you assemble constructs, not trap creatures) and decouples acquiring from
  winning (no weaken-don't-kill play pattern). Economy knobs: drop rate + scrap cost.
  **RULED (Henry, 2026-08-19): BLUEPRINTS ARE CONSUMABLE.** One blueprint is SPENT to
  assemble a mingming; **stats roll at first assembly** - farming more blueprints of a
  species = assembling more individuals chasing better rolls (the opt-in horizontal grind
  that replaces leveling; dupes are never dead). **Reflashing an individual's OS also
  costs a blueprint** - experimentation cheap but not free. One resource, three uses:
  assemble / re-roll via re-assembly / reflash. Scrap's exact role beside it -> economy
  session.
- **Gyms** = handcrafted 3v3 boss teams with signature firmware (boss/moves machinery
  exists in the registry).

## Why it is not Slay the Spire

Spire: one body, fixed climb, the deck is you. Mingming: the deck is a TEAM'S merged kit;
growth is recruiting; the type chart routes the map; catching is combat; the run feeds a
persistent collection with a PvP horizon. The differentiators are the mingming fantasy
expressed as roguelike systems.

## The overworld is STAGED, not dead

The region node-graph and a walkable overworld are the same data structure with different
rendering. Ship the expedition as a node map; if the game earns it, render the same graph
as walkable places (nodes -> locations, encounter nodes -> wild grass, the gym -> a
building). Systems never change; the original vision stays reachable without betting the
ship date on level design.

## Open questions (future sessions, none blocking current tickets)

EXPLORATION MAP design session (PARKED, Henry 2026-08-19): node types + mix, biome-to-element mapping, branch width + route visibility (how far ahead you see IS the routing decision), workshop/gym placement, events. Also: catching-fight thresholds n/a (blueprint drops replaced weaken-to-catch); faint rules mid-run (revive economy?); node economy + run
length target; OS choice at catch vs at ranch; region count for 1.0; ~~how levels work in-run~~ **LEVELING REMOVED (Henry, 2026-08-19 late): the engine freezes
at the level-15 calibration point.** No XP, no grind - progression IS acquisition (species,
OS, cards, rolls). Difficulty = enemy team design, never stat inflation; PvP fair by
construction; the entire balance corpus becomes the game permanently. The denomination law
(%maxHp / power units) STAYS - it is frame-proofing across the 58-95 HP spread now.

## What this changes about current work: NOTHING

The tuning program, the fun program, the status economy, the team sim - all of it is the
content of this game. Every future ticket can check itself against this doc.
