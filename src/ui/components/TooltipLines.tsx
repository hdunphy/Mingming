/**
 * TICKET 205 - the pieces of a card's hover tooltip that began with a symbol character, drawn as
 * Tabler icons instead: one effect line, the Requirements heading and the "this conditional holds"
 * tick. Each is the icon, a space, and the same words it had before; the icon takes the colour of the
 * text around it, so a met conditional's green still reaches its tick.
 *
 * The words live in `cardEffectText.ts`, the icon choices in `cardEffectIcons.ts` and `markIcons.ts`.
 *
 * 206 item B10 (Henry, 2026-10-09): the icons were too small at 1em. They draw at 1.25em, 14 px on a
 * 0.7rem effect line at the default text size, and still follow the Text size setting (the icons on
 * the smaller lines take 0.875rem instead, so they are 14 px too). Then thicker lines, not filled:
 * the icons draw at stroke 2, the weight the status glossary's icons already had.
 * The glossary's status icon was a fixed-px `StatusIcon`; it draws through `InlineIcon` too now.
 */

import type { ReactElement } from 'react';

import type { ProgramAction, StatusType } from '../../engine/types';
import { InlineIcon } from '../theme/InlineIcon';
import { STATUS_ICON_NAMES } from '../theme/kit/statusIconPaths';
import { MARK_ICON } from '../theme/markIcons';
import { EFFECT_ICON } from './cardEffectIcons';
import { describeAction } from './cardEffectText';

/** An effect line's icon: a quarter bigger than its 0.7rem text, so 14 px at the default text size. */
const ICON_SIZE = '1.25em';

/**
 * The icons on the tooltip's smaller lines (the 0.55rem Requirements label, the 0.62rem conditional
 * and glossary lines), where 1.25em came out 11 or 12.4 px. In rem they are 14 px on the default
 * 16 px root, the same as an effect line's, and still follow the Text size setting, which scales the
 * root (`applySettings` sets `<html>` font-size).
 */
const SMALL_LINE_ICON_SIZE = '0.875rem';

/** And a heavier line than the kit's 1.7, so the small outlines read. */
const ICON_WEIGHT = 2;

/** One effect line: the action's icon, then its words. */
export function EffectLine({ action, allyTarget = false }: { readonly action: ProgramAction; readonly allyTarget?: boolean }): ReactElement {
    return (
        <>
            <InlineIcon name={EFFECT_ICON[action.type]} size={ICON_SIZE} weight={ICON_WEIGHT} />{' '}{describeAction(action, allyTarget)}
        </>
    );
}

/** The tooltip's "Requirements" heading, with its warning triangle. */
export function RequirementsLabel(): ReactElement {
    return (
        <>
            <InlineIcon {...MARK_ICON.warning} size={SMALL_LINE_ICON_SIZE} weight={ICON_WEIGHT} />{' '}Requirements
        </>
    );
}

/** The tick on a conditional effect that holds right now. */
export function MetMark(): ReactElement {
    return <InlineIcon {...MARK_ICON.tick} size={SMALL_LINE_ICON_SIZE} weight={ICON_WEIGHT} />;
}

/**
 * The icon in front of a status's name in the "Statuses & keywords" glossary: the status's own Tabler
 * icon (the one its chip draws), through `InlineIcon` so it sits on the line and follows the Text
 * size setting, where the fixed-px `StatusIcon` sat on the baseline above its words.
 */
export function GlossaryStatusIcon({ status }: { readonly status: StatusType }): ReactElement {
    return <InlineIcon name={STATUS_ICON_NAMES[status]} size={SMALL_LINE_ICON_SIZE} weight={ICON_WEIGHT} />;
}
