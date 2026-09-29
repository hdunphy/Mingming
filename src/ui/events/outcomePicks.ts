/**
 * TICKET 168d — what the player answered for an outcome that asks a question.
 *
 * One small shape per kind of question. `applyChoice` is told the outcome's type, so it reads each
 * answer through the guard for that type rather than trusting a cast.
 */

/** A card pick: which card, and whether it goes to the deck or the run collection. */
export interface CardPickResult { readonly cardId: string; readonly toCollection: boolean }

/** A blueprint pick (Wild Tracks): the species, banked to the ranch at once. */
export interface BlueprintPickResult { readonly speciesId: string }

/** A macro pick (Macro Crate). `replaceSlot` is the rack slot to overwrite when the rack is full. */
export interface MacroPickResult { readonly macroId: string; readonly replaceSlot?: number }

/** A recruit (Stray Mingming): the species and the firmware it is built on. */
export interface RecruitPickResult { readonly speciesId: string; readonly osId: string }

export type OutcomePick = CardPickResult | BlueprintPickResult | MacroPickResult | RecruitPickResult;

export const isCardPick = (pick: OutcomePick): pick is CardPickResult => 'cardId' in pick;
export const isMacroPick = (pick: OutcomePick): pick is MacroPickResult => 'macroId' in pick;
export const isRecruitPick = (pick: OutcomePick): pick is RecruitPickResult => 'speciesId' in pick && 'osId' in pick;
export const isBlueprintPick = (pick: OutcomePick): pick is BlueprintPickResult => 'speciesId' in pick && !('osId' in pick);
