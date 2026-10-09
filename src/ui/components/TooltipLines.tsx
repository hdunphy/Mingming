/**
 * TICKET 205 - the pieces of a card's hover tooltip that began with a symbol character, drawn as
 * Tabler icons instead: one effect line, the Requirements heading and the "this conditional holds"
 * tick. Each is the icon, a space, and the same words it had before; the icon takes the colour of the
 * text around it, so a met conditional's green still reaches its tick.
 *
 * The words live in `cardEffectText.ts`, the icon choices in `cardEffectIcons.ts` and `markIcons.ts`.
 *
 * 206 item B10 (Henry, 2026-10-09): the icons were too small at 1em. They draw at 1.25em, 14 px on a
 * 0.7rem effect line at the default text size, and still follow the Text size setting. The status
 * glossary's icon is fixed px (`StatusIcon`), so it goes from 11 to 14 to match.
 */

import type { ReactElement } from 'react';

import type { ProgramAction, StatusType } from '../../engine/types';
import { InlineIcon } from '../theme/InlineIcon';
import { StatusIcon } from '../theme/kit/StatusIcon';
import { MARK_ICON } from '../theme/markIcons';
import { EFFECT_ICON } from './cardEffectIcons';
import { describeAction } from './cardEffectText';

/** Every tooltip line's icon: a quarter bigger than its text. */
const ICON_SIZE = '1.25em';

/** The status glossary's icon, px: 14, what `ICON_SIZE` gives an effect line at the default text size. */
const STATUS_ICON_PX = 14;

/** One effect line: the action's icon, then its words. */
export function EffectLine({ action, allyTarget = false }: { readonly action: ProgramAction; readonly allyTarget?: boolean }): ReactElement {
    return (
        <>
            <InlineIcon name={EFFECT_ICON[action.type]} size={ICON_SIZE} />{' '}{describeAction(action, allyTarget)}
        </>
    );
}

/** The tooltip's "Requirements" heading, with its warning triangle. */
export function RequirementsLabel(): ReactElement {
    return (
        <>
            <InlineIcon {...MARK_ICON.warning} size={ICON_SIZE} />{' '}Requirements
        </>
    );
}

/** The tick on a conditional effect that holds right now. */
export function MetMark(): ReactElement {
    return <InlineIcon {...MARK_ICON.tick} size={ICON_SIZE} />;
}

/** The icon in front of a status's name in the "Statuses & keywords" glossary. */
export function GlossaryStatusIcon({ status }: { readonly status: StatusType }): ReactElement {
    return <StatusIcon status={status} size={STATUS_ICON_PX} />;
}
