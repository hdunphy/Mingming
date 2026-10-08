/**
 * THE STATUS ICONS, AS NAMES - ticket 183b, swapped to Tabler by ticket 200d. Fourteen flat,
 * single-colour glyphs, one per status, stroked in `currentColor` so a chip tints them.
 *
 * They replace the emoji `statusGlossary` once carried, and then the paths an agent typed in: the
 * standing rule is that no AI-generated art ships, so each status is now a human-drawn Tabler icon
 * (MIT), named here and drawn from `tabler.generated.ts`. Henry ruled every pick (2026-10-05/06).
 * StableOS reads "Alert" in the game (`labels.ts`); the key stays `StableOS`.
 *
 * A separate `.ts` file from the component because `react-refresh/only-export-components` is an
 * error in this repo, and `StatusIcon.test.tsx` sweeps these keys against the glossary without
 * rendering anything.
 */
import type { StatusType } from '../../../engine/types';
import type { TablerOutlineName } from '../tabler.generated';

/** A chip draws its icon at 12px, where Tabler's own weight of 2 reads and 2.5 turns to mud. */
export const STATUS_STROKE = 2;

export const STATUS_ICON_NAMES: Readonly<Record<StatusType, TablerOutlineName>> = {
    Burn: 'flame',
    Poison: 'skull',
    Asleep: 'zzz',
    Weakened: 'arrow-big-down',
    Strengthened: 'arrow-big-up',
    Dazed: 'spiral',
    Sharp: 'shield-up',
    Stunned: 'ban',
    Regen: 'heart-plus',
    Energized: 'recharging',
    StableOS: 'eye',
    BarkShield: 'wood',
    DarkStance: 'moon',
    LightStance: 'sun',
};
