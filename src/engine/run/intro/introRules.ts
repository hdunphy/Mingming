/**
 * TICKET 182c — THE ONE QUESTION THE REST OF THE GAME ASKS ABOUT THE INTRO.
 *
 * `introRules(run)` says what this run allows. Nothing outside this folder reads `run.mode` and no
 * screen says `if (intro)`: a screen asks `introRules(run).showMacros` (or whichever line it needs)
 * and gets the same answer shape for an ordinary run as for the intro. That is what keeps the intro
 * removable (R10): delete this folder, make this function return `NORMAL_RULES`, and every caller
 * keeps working with the ordinary game's answers.
 *
 * Why the intro is not part of the tier ladder: it is a gate before the game, not a rung in it. It
 * does not count toward `runsCompleted`, `gymsCleared`, `tierClears` or the gym's blueprint payout
 * (`countsAsProgress`), and it ends the same way whether it is won, lost or abandoned.
 */

import { COUNTERED_BY } from '../gyms';
import { GetMingmingData } from '../../data/mingmingRegistry';
import type { EventDefinition } from '../events/eventSchema';
import type { IRunEncounter } from '../encounter';
import type { IRegionNode, IRunState } from '../../runTypes';
import { introRecruitEvent } from './introEvent';
import { rollIntroLeader } from './introLeader';

/** What a market shows. The card stall and the upgrade bench are in every market, so they are not here. */
export interface IMarketRules {
    readonly macros: boolean;
    readonly patchBench: boolean;
    readonly blueprint: boolean;
    /** The sell panel, which is also where junk is removed. */
    readonly sell: boolean;
    readonly refresh: boolean;
    readonly editLoadout: boolean;
}

export interface IRecruitOption {
    readonly speciesId: string;
    readonly osId: string;
}

export interface IRunRules {
    readonly intro: boolean;
    /** Counts toward `runsCompleted`, `gymsCleared`, `tierClears` and the gym's blueprint payout. */
    readonly countsAsProgress: boolean;
    /** How many fights the run's last node is. The ordinary gauntlet is three; the intro's leader is one. */
    readonly gauntletFights: number | null;
    /** The macro rack, the macro shelf and the gate's macro list. */
    readonly showMacros: boolean;
    readonly showPatches: boolean;
    /** The combat log and the enemy-hand tab: absent, not just closed. */
    readonly showBattleLogs: boolean;
    readonly market: IMarketRules;
    /** The last node's fight, when the run authors its own. `null` means the ordinary gauntlet. */
    readonly leader: ((run: IRunState, node: IRegionNode, seed: string) => IRunEncounter) | null;
    /** The event on a node, when the run authors it. `null` means the ordinary weighted draw. */
    readonly eventFor: ((run: IRunState, node: IRegionNode) => EventDefinition | null) | null;
    /** What the recruit event offers, when the run authors it. `null` means whatever the vault holds. */
    readonly recruitOptions: ((run: IRunState) => ReadonlyArray<IRecruitOption>) | null;
    /** The recruit's blueprint is granted at the moment it is built, so the vault ends where it began. */
    readonly grantsRecruitBlueprint: boolean;
}

const OPEN_MARKET: IMarketRules = {
    macros: true, patchBench: true, blueprint: true, sell: true, refresh: true, editLoadout: true,
};

export const NORMAL_RULES: IRunRules = {
    intro: false,
    countsAsProgress: true,
    gauntletFights: null,
    showMacros: true,
    showPatches: true,
    showBattleLogs: true,
    market: OPEN_MARKET,
    leader: null,
    eventFor: null,
    recruitOptions: null,
    grantsRecruitBlueprint: false,
};

/** The three starters, in the order the starter screen shows them. */
export const INTRO_STARTERS: ReadonlyArray<string> = ['kraken', 'fenrir', 'ratatoskr'];

/** The starter whose element beats the intro biome: the biome's element is countered by it. */
function starterOf(run: IRunState): string | undefined {
    const biomeElement = run.biomes[0]?.elements[0];
    if (!biomeElement) return undefined;
    const starterElement = COUNTERED_BY[biomeElement];
    return INTRO_STARTERS.find((id) => GetMingmingData(id).primaryElement === starterElement);
}

/** "The two starters the player did not pick", each on its v1 firmware. */
export function introRecruitOptions(run: IRunState): ReadonlyArray<IRecruitOption> {
    const picked = starterOf(run);
    return INTRO_STARTERS
        .filter((id) => id !== picked)
        .map((speciesId) => ({ speciesId, osId: GetMingmingData(speciesId).availableOS[0] }));
}

export const INTRO_RULES: IRunRules = {
    intro: true,
    countsAsProgress: false,
    gauntletFights: 1,
    showMacros: false,
    showPatches: false,
    showBattleLogs: false,
    market: {
        macros: false, patchBench: false, blueprint: false, sell: false, refresh: false, editLoadout: false,
    },
    leader: rollIntroLeader,
    eventFor: () => introRecruitEvent(),
    recruitOptions: introRecruitOptions,
    grantsRecruitBlueprint: true,
};

/** What `run` allows. A missing run (the debug launcher's battle) is an ordinary one. */
export function introRules(run: Pick<IRunState, 'mode'> | null | undefined): IRunRules {
    return run?.mode === 'intro' ? INTRO_RULES : NORMAL_RULES;
}
