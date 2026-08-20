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

## Feel calibration (Henry's hands, playtest round 3)

Piloting AGAINST sleipnir_v1: 10 Str by turn 2, momentum_crash 24 -> wiped turn 2 = TOO
FAST. Piloting him: the 4 -> 14 Str arc over 5 turns 'felt fun although a little OP',
won turn 5 at 22 Str. Read: the problem is EARLY VELOCITY, not the ceiling - size the
mint cap to kill the turn-2 spike while preserving the late climb. Start the sweep at
**3-4 Str minted per turn** (arms 3/4/5); success = no 10-stack turn-2 opener AND the
turn-5 pile can still reach the teens.
