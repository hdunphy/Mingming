# The v1 card pool, archived — ticket 162a

Henry, 2026-09-22: *"I think we need to revisit the card pool. My latest playtest showed they were
not exciting and it is still hard to build decks. Can we archive the current card collection and
start a new one."*

## What is in here

- **`programs-v1.json`** — `src/engine/data/programs.json` exactly as it stood at commit `7bbfcd5`,
  the last build before collection v2 landed. 243 entries.
- **`ea-kits-v1.json`** — the twelve Early-Access decks and their five-card start kits as
  `mingmingRegistry.ts` held them on the same commit, dumped through the registry's own accessor
  rather than re-parsed out of the source, so it records what the game shipped rather than what a
  regex thought the file said.

## What this is NOT

**Nothing in this folder is loaded by the game.** It is history, for the card browser and for the
59 orphan annotations that point at cards no kit runs any more. Neither file is imported by
`programRegistry.ts`, `mingmingRegistry.ts` or anything under `src/engine`; a test asserts that
(`archive.test.ts`).

## Why `programs.json` did not shrink

162a rebuilt the **Early-Access** pool — Fire, Water and Nature, the six launch species, twelve
OS — because that is the scope Henry ruled on 2026-09-21: *"Lets leave the non-EA mingmings for
after EA. Focus only on fire, water and nature."*

The other twenty species still field their v1 decks, and roughly ninety scenario fixtures under
`src/debug/scenarios` still name v1 cards. Deleting those entries would have broken the calibration
corpus to no gameplay benefit, so the live registry is the **union**: collection v2's 98 cards
overwrite or add, and everything else stays addressable.

What stops a player meeting a v1 card is not the registry's size, it is `RewardSystem`'s
`OFF_POOL` derivation — a card is offerable only if some *playable* species' deck or species pool
names it. The v2 kits and pools name 98 cards; the ex-EA leftovers (`overdrive`, `all_in`,
`pyre_sacrifice`, `berserk_rush` and the rest) name none, so they fall out of every shop and every
reward screen the day this lands. See `RewardSystem.ts`.
