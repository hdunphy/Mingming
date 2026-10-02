/**
 * TICKET 158-r1 — **WHAT THIS OS BANKS, HOW FAST IT PLAYS, AND WHO IN YOUR PARTY IT ALREADY WANTS.**
 *
 * Henry's ruling (158 §5.3): *"the recruit screen shows currency and tempo — yes."* This is that
 * row, and it is one component because the two places it is needed ask the same question at
 * different moments — the workshop asks it about a body you are about to take, the loadout editor
 * about the ones you already have.
 *
 * # WHY THE PARTNER MARK IS THE POINT
 *
 * Currency and tempo are facts about ONE firmware, and a player can read those off the OS text in
 * time. The thing they cannot work out at the assembly bay is whether the body in front of them
 * fits the party they are already running — that needs the authored web in `osGrammar`, joined
 * against `partyIds`. `partnersInParty` does the join, so a hint only appears once it is a FACT
 * about the field rather than advice about a hypothetical party.
 *
 * Before 158-r1 it could not be drawn at all: the design file named partners as `'Rat v1'`, and
 * nothing could join that to `ratatoskr_v1`.
 *
 * # WHY A SILENT ABSENCE RATHER THAN AN EMPTY ROW
 *
 * `grammarFor` returns undefined for every post-EA OS, because no grammar has been WRITTEN for
 * them — not because they have no currency. Drawing "currency: —" would be the screen asserting
 * something nobody has decided. It draws nothing, and the OS description above it still reads.
 */
import type { ReactNode } from 'react';

import { grammarFor, partnersInParty } from '../../engine/data/osGrammar';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { STATUS_COLORS } from '../../engine/data/statusGlossary';
import type { StatusType } from '../../engine/types';

/**
 * A currency token's colour, when the token IS a status the player already knows by colour.
 *
 * `Strength` and `Bark` are the two the design file shortens — the statuses are `Strengthened` and
 * `BarkShield` — and `cards`, `HP` and `Energy` are resources rather than statuses, so they take
 * the neutral chip. Deliberately a table and not a fuzzy match: a chip in the wrong colour teaches
 * the player a wrong association, which is worse than a grey one.
 */
const CURRENCY_STATUS: Record<string, StatusType> = {
    Strength: 'Strengthened',
    Bark: 'BarkShield',
    Burn: 'Burn',
    Poison: 'Poison',
    Sharp: 'Sharp',
    Dazed: 'Dazed',
    Weakened: 'Weakened',
    Regen: 'Regen',
    Energy: 'Energized',
};

const NEUTRAL = 'var(--text-mute)';

const colourFor = (token: string): string => {
    const status = CURRENCY_STATUS[token];
    return status ? STATUS_COLORS[status] ?? NEUTRAL : NEUTRAL;
};

export interface OSGrammarRowProps {
    readonly osId: string;
    /** The firmware ids on the field right now. A partner among them is marked. */
    readonly partyOS: ReadonlyArray<string>;
    /** `compact` drops the partner list and keeps the chips — for a roster row rather than a panel. */
    readonly compact?: boolean;
}

export function OSGrammarRow({ osId, partyOS, compact = false }: OSGrammarRowProps): ReactNode {
    const grammar = grammarFor(osId);
    if (!grammar) return null;

    const held = partnersInParty(osId, partyOS);

    return (
        <div className={`os-gram${compact ? ' compact' : ''}`}>
            <div className="og-line">
                <span className="og-label">banks</span>
                {grammar.currency.map((token) => (
                    <span
                        key={token}
                        className="og-chip"
                        style={{ ['--og' as string]: colourFor(token) }}
                        // The designed line, parentheticals and all: the chips say WHAT, the title
                        // says which — "ramp (Str consume)" is a different plan from "ramp (HP as fuel)".
                        title={grammar.currencyText}
                    >
                        {token}
                    </span>
                ))}
                <span className="og-label og-tempo-label">plays</span>
                <span className="og-tempo" title={grammar.tempoText}>{grammar.tempo.join(' · ')}</span>
            </div>

            {!compact && (
                held.length > 0 ? (
                    <ul className="og-partners">
                        {held.map((partner) => (
                            <li key={partner.osId}>
                                <b>{getOSBehavior(partner.osId)?.name ?? partner.osId}</b> is already on the field — {partner.why}
                            </li>
                        ))}
                    </ul>
                ) : null
            )}

            {compact && held.length > 0 && (
                <span className="og-mark" title={held.map((p) => p.why).join(' · ')}>
                    ◆ {held.length} partner{held.length === 1 ? '' : 's'} on the field
                </span>
            )}
        </div>
    );
}
