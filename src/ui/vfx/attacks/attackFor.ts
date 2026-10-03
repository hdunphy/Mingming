/**
 * TICKET 190d — WHICH ATTACK AN ELEMENT AND A CARD SHAPE GET.
 *
 * | Card shape | Fire | Water | Nature |
 * | Single target | flame beam | water jet | vine |
 * | Side / All | fire wall | tidal wave | pollen cloud |
 *
 * Earth, Ice, Air, Light and Dark keep their tinted streak (ticket 146d's reserved slot), and so does
 * a card with no element: `attackFor` answers `null` and the cast sequence sends the old trail.
 */

import type { AttackMaker } from './AttackEffect';
import { fireWall } from './fireWall';
import { flameBeam } from './flameBeam';
import { pollenCloud } from './pollenCloud';
import { tidalWave } from './tidalWave';
import { vine } from './vine';
import { waterJet } from './waterJet';

export type AttackShape = 'single' | 'spread';

const MAKERS: Readonly<Record<string, Readonly<Record<AttackShape, AttackMaker>>>> = {
    Fire: { single: flameBeam, spread: fireWall },
    Water: { single: waterJet, spread: tidalWave },
    Nature: { single: vine, spread: pollenCloud },
};

export function attackFor(element: string, shape: AttackShape): AttackMaker | null {
    return MAKERS[element]?.[shape] ?? null;
}
