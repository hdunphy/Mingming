import type { IconName } from '../../theme/icons';

/** TICKET 182a: who a card aims at, as an icon. The label stays as the hover. */
export function targetIconOf(label: string): IconName | null {
    if (label === 'SELF' || label === 'ALLY' || label === 'ALLIES') return 'target-self';
    if (label === '—') return null;
    return 'target-enemy'; // ENEMY, ENEMIES, ENEMY*, ANY
}
