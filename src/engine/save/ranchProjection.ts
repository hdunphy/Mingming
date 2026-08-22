/**
 * The seam between the game's in-memory slice shape and save v4's ranch — ticket 23.
 *
 * # WHY THIS FILE EXISTS, AND WHY IT IS TEMPORARY
 *
 * Ticket 06 ratified the destination: a **ranch** that survives (assembled individuals, blueprint
 * counts, codex, gyms/tier cleared) and a **run** that does not (cards, deck, scrap, gauntlet
 * progress, macros). Ticket 23 lands that as the persisted format.
 *
 * The game does not have runs yet — tickets 09–15 build them. What it has is
 * `IPlayerSave`, the pre-roguelike blob that ~40 files read, including the whole balance harness
 * and the scenario system. Rewriting the slice to `IRanchState` today would rewrite all of them,
 * and tickets 09–15 would rewrite them again. So the slice shape is left alone and the **save
 * boundary** does the translating: `toRanchState` on the way out, `applyRanchState` on the way in.
 *
 * Ticket 09 deletes this file. When the run loop exists, the slice becomes ranch + run directly and
 * there is nothing left to project.
 *
 * # WHAT STOPS PERSISTING, AND WHY THAT IS CORRECT
 *
 * `cardInventory`, `activeDeck`, `scrapCount`, `relics`, `gauntlet` and `baseDecksGranted` are not
 * in `IRanchState`, so they are **not written and not restored**. That is ticket 06's ruling, not
 * an accident of this translation: every one of those fields is run-scoped in the ratified model
 * ("if a field is in `IRunState`, it cannot inflate the next run"). Preserving them under some
 * extra transitional key would re-persist exactly the things the design says must not persist.
 *
 * The consequence to be honest about: **between this ticket and ticket 09, a reload keeps your
 * roster and your blueprints and drops your cards, deck and scrap.** The ranch — the only
 * irreplaceable half — is intact.
 *
 * # THE ONE LOSSY EDGE
 *
 * **`gymsCleared` ↔ `unlockedSectors`.** In the pre-roguelike game, clearing a Gym unlocks that
 * element's sector (`gameSlice.completeGauntlet`), so the two lists hold the same information under
 * different names. The three starting sectors are *not* a clear and are re-seeded by
 * `createDefaultSave`, so only elements beyond those defaults round-trip as gym clears.
 *
 * (Blueprints used to be the second lossy edge — v3's dedup'd `IBlueprint[]` against v4's counts.
 * Ticket 20 moved the slice to counts as well, so that half is now the identity.)
 */

import { MingmingRegistry } from '../data/mingmingRegistry';
import type { IPlayerSave } from '../gameTypes';
import { createDefaultSave } from '../gameTypes';
import type { IRanchMember, IRanchState } from '../runTypes';
import { legalParty } from '../party';

/** The sectors a new player starts with. Unlocks, not gym clears — see the header. */
const DEFAULT_SECTORS: ReadonlyArray<string> = createDefaultSave().unlockedSectors;

/**
 * Slice → ranch.
 *
 * `activeOS` is optional on `IMingmingState` and required on `IRanchMember`, because "which
 * firmware is this individual running" has no meaningful absent state once OS swapping is a
 * spendable action (ticket 15). Absent resolves to the definition's first OS — the same fallback
 * `gameSlice.addToRoster` uses when it grants a starting kit, so the two never disagree.
 *
 * A roster member whose `definitionId` is not in the registry keeps a `${definitionId}_v1` OS
 * rather than being dropped: losing an individual is worse than carrying an unresolvable OS
 * string, and `RanchMemberSchema` only requires that it *be* a string.
 */
export function toRanchState(save: IPlayerSave): IRanchState {
    const roster: IRanchMember[] = save.roster.map((member) => ({
        id: member.id,
        definitionId: member.definitionId,
        ...(member.nickname === undefined ? {} : { nickname: member.nickname }),
        activeOS:
            member.activeOS
            ?? MingmingRegistry[member.definitionId]?.availableOS[0]
            ?? `${member.definitionId}_v1`,
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
    }));

    return {
        roster,
        // Ticket 20 made the slice hold counts too, so this half of the projection is now the
        // identity. It stays spelled out rather than spread, because `IRanchState` is the ratified
        // shape and this file is the thing that must keep matching it, not the other way round.
        blueprints: { ...save.blueprints },
        // The codex is a ticket-06 field with no pre-roguelike equivalent — nothing in the current
        // game logs cards as seen or played. Emitting empty sets is the honest projection; ticket
        // 30 (events) and the reward flow are what start filling it.
        codex: { seen: [], played: [] },
        gymsCleared: save.unlockedSectors.filter((element) => !DEFAULT_SECTORS.includes(element)),
        // No tier concept exists before ticket 09. Held at 0 rather than guessed at.
        highestTierCleared: 0,
    };
}

/**
 * Ranch → slice, layered onto a base (normally `createDefaultSave()`).
 *
 * Deliberately a *merge* and not a replacement: everything the ranch does not carry keeps the
 * base's value, so a load produces a legal, playable slice rather than one with an undefined deck
 * or a negative scrap count. Cards, deck and scrap therefore come back at their fresh-start values
 * — see the header for why that is the intended behaviour and not a bug to patch here.
 */
export function applyRanchState(base: IPlayerSave, ranch: IRanchState): IPlayerSave {
    const roster = ranch.roster.map((member) => ({
        id: member.id,
        definitionId: member.definitionId,
        ...(member.nickname === undefined ? {} : { nickname: member.nickname }),
        activeOS: member.activeOS,
        // Not a ranch field: v4 tracks blueprints as a ranch-level count, so the per-individual
        // tally is a pre-roguelike display counter with nothing behind it. Starts at 0.
        blueprintsCollected: 0,
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
    }));

    return {
        ...base,
        roster,
        // `reconcileLoadedState` already guarantees the *run's* party ids exist and hold no
        // duplicate species. The slice's own `activeParty` is not part of the ranch, so it gets the
        // same two guarantees here rather than being inherited blindly from the base — otherwise a
        // save written before ticket 20 could load a party that `setActiveParty` now refuses to
        // produce, and the species clause would be true of every path except this one.
        activeParty: legalParty(base.activeParty, roster),
        blueprints: { ...ranch.blueprints },
        unlockedSectors: [
            ...DEFAULT_SECTORS,
            ...ranch.gymsCleared.filter((element) => !DEFAULT_SECTORS.includes(element)),
        ],
    };
}
