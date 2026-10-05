/**
 * TICKET 168d — what the player answered for an outcome that asks a question.
 *
 * One small shape per kind of question. `applyChoice` is told the outcome's type, so it reads each
 * answer through the guard for that type rather than trusting a cast.
 */

/** A card pick: which card, and whether it goes to the deck or the run collection. */
export interface CardPickResult {
    readonly cardId: string;
    readonly toCollection: boolean;
    /** Ticket 185e: the cards the pick SHOWED, remembered so the next two offers leave them out. */
    readonly offered?: ReadonlyArray<string>;
}

/** A blueprint pick (Wild Tracks): the species, banked to the ranch at once. */
export interface BlueprintPickResult { readonly speciesId: string }

/** A macro pick (Macro Crate). `replaceSlot` is the rack slot to overwrite when the rack is full. */
export interface MacroPickResult { readonly macroId: string; readonly replaceSlot?: number }

/** A recruit (Stray Mingming): the species and the firmware it is built on. */
export interface RecruitPickResult { readonly speciesId: string; readonly osId: string }


export const isCardPick = (pick: OutcomePick): pick is CardPickResult => 'cardId' in pick;
export const isMacroPick = (pick: OutcomePick): pick is MacroPickResult => 'macroId' in pick;
export const isRecruitPick = (pick: OutcomePick): pick is RecruitPickResult => 'speciesId' in pick && 'osId' in pick;
export const isBlueprintPick = (pick: OutcomePick): pick is BlueprintPickResult => 'speciesId' in pick && !('osId' in pick);

/** Cards given up, trade-in cards and cards to copy (168e): the instance ids the player chose. */
export interface GiveCardsResult { readonly instanceIds: ReadonlyArray<string> }

/** A Driver picked at the Driver Shrine. */
export interface DriverPickResult { readonly driverId: string }

/** The body picked for the Black-Market Patch. */
export interface PatchPickResult { readonly memberId: string }

/** The body picked for the Firmware Reflash. A different key from `PatchPickResult` so the two never read as each other. */
export interface ReflashPickResult { readonly reflashMemberId: string }

export const isGivePick = (pick: OutcomePick): pick is GiveCardsResult => 'instanceIds' in pick;
export const isDriverPick = (pick: OutcomePick): pick is DriverPickResult => 'driverId' in pick;
export const isPatchPick = (pick: OutcomePick): pick is PatchPickResult => 'memberId' in pick;
export const isReflashPick = (pick: OutcomePick): pick is ReflashPickResult => 'reflashMemberId' in pick;

export type OutcomePick =
    | CardPickResult | BlueprintPickResult | MacroPickResult | RecruitPickResult
    | GiveCardsResult | DriverPickResult | PatchPickResult | ReflashPickResult;
