/**
 * TICKET 190f - WHICH STATUSES HAVE A LANDING OF THEIR OWN. Eight do. Asleep, Stunned, Energized,
 * StableOS and the two Stances keep today's tell (a ring and a puff in the status colour, 146f).
 */

import type { StatusType } from '../../../engine/types';
import { barkLanding } from './barkLanding';
import { burnLanding } from './burnLanding';
import { dazedLanding } from './dazedLanding';
import type { LandingMaker } from './LandingInput';
import { poisonLanding } from './poisonLanding';
import { regenLanding } from './regenLanding';
import { sharpLanding } from './sharpLanding';
import { strengthLanding } from './strengthLanding';
import { weakenedLanding } from './weakenedLanding';

const LANDINGS: Readonly<Partial<Record<StatusType, LandingMaker>>> = {
    Burn: burnLanding,
    Poison: poisonLanding,
    Dazed: dazedLanding,
    Weakened: weakenedLanding,
    Strengthened: strengthLanding,
    Sharp: sharpLanding,
    Regen: regenLanding,
    BarkShield: barkLanding,
};

export const landingFor = (status: StatusType): LandingMaker | undefined => LANDINGS[status];
