/**
 * Card keyword data and the two derivations over it — ticket 55, step 3.
 *
 * Extracted from `CardKeywordChips.tsx` so that file exports only components
 * (`react-refresh/only-export-components`): a module mixing a component with plain functions cannot
 * hot-reload as a component, which costs component state on every edit to the chips during
 * development. Nothing else changed — same names, same behaviour, same callers.
 */

import type { ProgramData, StatusType } from '../../engine/types';
import { statusGlossary } from '../../engine/data/statusGlossary';

/** Card keyword mechanics, explained in player-facing language. */
export const KEYWORD_INFO = {
    EXHAUST: {
        label: 'EXHAUST',
        color: '#ff9944',
        description: 'Removed to the exhaust pile after playing — not shuffled back this battle.'
    },
    TOKEN: {
        label: 'TOKEN',
        color: '#8888ff',
        description: 'Temporary card generated in battle; disappears afterward.'
    },
    DAEMON: {
        label: 'DAEMON',
        color: '#00d2ff',
        description: 'Installs on the unit for the rest of the battle; its effect stays active.'
    }
} as const;

export type CardKeyword = keyof typeof KEYWORD_INFO;

export function getCardKeywords(data: ProgramData): CardKeyword[] {
    const keywords: CardKeyword[] = [];
    if (data.category === 'Daemon') keywords.push('DAEMON');
    if (data.exhaust) keywords.push('EXHAUST');
    if (data.isToken) keywords.push('TOKEN');
    return keywords;
}

/** Unique statuses this card's STATUS / SHIFT_STANCE actions apply, in action order. */
export function getAppliedStatuses(data: ProgramData): StatusType[] {
    const statuses: StatusType[] = [];
    for (const action of data.actions) {
        let status: StatusType | undefined;
        if (action.type === 'STATUS') {
            status = (action as { status?: StatusType }).status;
        } else if (action.type === 'SHIFT_STANCE') {
            // Stance shifts grant a stance status on the card's owner — surface it
            // as a chip so players see the shift at a glance.
            const stance = (action as { stance?: 'Dark' | 'Light' }).stance;
            if (stance) status = stance === 'Dark' ? 'DarkStance' : 'LightStance';
        }
        if (status && statusGlossary[status] && !statuses.includes(status)) {
            statuses.push(status);
        }
    }
    return statuses;
}
