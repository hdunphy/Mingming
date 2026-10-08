/**
 * TICKET 205 - THE SMALL MARKS: the warning, the tick, the TERMINATED mark, the absorbed float and
 * the Codex stars. One name map for the banners and marks that are not part of a bigger family (the
 * card effects, the intents and the type chart have their own maps beside their surfaces).
 *
 * Each pick is a Tabler name, so a pick Henry dislikes is a one-word change here plus `npm run icons`
 * (add the new name to `scripts/tabler-icons.names.json`). `inlineIconMaps.test.ts` holds that every
 * name exists in the generated file and pins the picks.
 *
 * - `terminated` is the GRAVE. The skull is Poison's (ticket 200); the chrome "lost" icon is already
 *   the grave, so a dead unit's stamp matches it.
 * - `absorbed` is the shield, the same one the defence stat uses.
 * - `milestoneDone` is the FILLED star and `milestoneOpen` the outline one: the shape says reached or
 *   not, as the filled and empty stars did.
 */

import type { InlineIconRef } from './InlineIcon';

export type MarkKey = 'warning' | 'tick' | 'terminated' | 'absorbed' | 'milestoneDone' | 'milestoneOpen';

export const MARK_ICON = {
    warning: { name: 'alert-triangle' },
    tick: { name: 'check' },
    terminated: { name: 'grave-2' },
    absorbed: { name: 'shield' },
    milestoneDone: { name: 'star', filled: true },
    milestoneOpen: { name: 'star' },
} as const satisfies Readonly<Record<MarkKey, InlineIconRef>>;
