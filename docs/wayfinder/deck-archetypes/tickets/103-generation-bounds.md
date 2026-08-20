# Generation bounds (ticket 103): bound the mint, not the effect

- Type: wayfinder:task - runs IMMEDIATELY after ticket 102 (Henry sequenced them apart
  knowingly; sleipnir_v1 at ~85% is a KNOWN TRANSIENT, not accept-and-watch). Branch
  archetype-web.
- Status: **open**

Grid finding 2: uncapped POWER makes stack ENGINES runaway - the fix is capping
GENERATION per turn, never the effect (capping the effect is what made statuses invisible
for a year). Audit every OS/daemon/card that MINTS combat-status stacks (sleipnir
MOMENTUM_DRIVE first - 2 Str per 0-cost on an all-0-cost deck; TREACHERY; SOLAR_OVERDRIVE
feeds; KINETIC_RAM; strength_burst-class cards exempt - a card paying energy is already
bounded). Per-turn grant caps sized by sim to bring sleipnir_v1 into band without
flattening the engines (knobs = the cap values, max 2 rounds each). Gates: band standard,
FTK 0, the fun thesis holds (close-call texture stays - do not cap engines into
choicelessness). ONE commit.
