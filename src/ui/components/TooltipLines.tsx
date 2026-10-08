/**
 * TICKET 205 - the pieces of a card's hover tooltip that began with a symbol character, drawn as
 * Tabler icons instead: one effect line, the Requirements heading and the "this conditional holds"
 * tick. Each is the icon, a space, and the same words it had before; the icon takes the colour of the
 * text around it, so a met conditional's green still reaches its tick.
 *
 * The words live in `cardEffectText.ts`, the icon choices in `cardEffectIcons.ts` and `markIcons.ts`.
 */

import type { ReactElement } from 'react';

import type { ProgramAction } from '../../engine/types';
import { InlineIcon } from '../theme/InlineIcon';
import { MARK_ICON } from '../theme/markIcons';
import { EFFECT_ICON } from './cardEffectIcons';
import { describeAction } from './cardEffectText';

/** One effect line: the action's icon, then its words. */
export function EffectLine({ action, allyTarget = false }: { readonly action: ProgramAction; readonly allyTarget?: boolean }): ReactElement {
    return (
        <>
            <InlineIcon name={EFFECT_ICON[action.type]} />{' '}{describeAction(action, allyTarget)}
        </>
    );
}

/** The tooltip's "Requirements" heading, with its warning triangle. */
export function RequirementsLabel(): ReactElement {
    return (
        <>
            <InlineIcon {...MARK_ICON.warning} />{' '}Requirements
        </>
    );
}

/** The tick on a conditional effect that holds right now. */
export function MetMark(): ReactElement {
    return <InlineIcon {...MARK_ICON.tick} />;
}
