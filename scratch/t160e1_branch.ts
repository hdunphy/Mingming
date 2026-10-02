/*
 * TICKET 160-e1's beam gate, answered directly.
 *
 * The ticket predicted "candidate count grows; re-run the beam gate". The question is not really
 * about battles — it is about ONE branch in `TacticalAI`'s enumeration: how many targets does each
 * ally card offer, before the flag and after it. Reproducing the old branch here beside the new one
 * answers it exactly, in a second, instead of approximately over an hour of 3v3 beamless search.
 */
import { GetProgramData } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

const PARTY = 3;

/** The enumeration branch as it stood BEFORE 160-e1 (TacticalAI, pre-flag). */
function before(p: ProgramData): number {
    if (p.target === 'Self') return PARTY;
    if (p.actions.some((a) => a.type === 'HEAL')
        && !p.actions.some((a) => a.type === 'ATTACK' && a.target === 'TARGET')
        && p.target !== 'Side') return PARTY;
    if (p.target === 'Side' || p.target === 'All') return PARTY * 2;
    return PARTY;
}

/** And AFTER: the flag is the first branch. */
function after(p: ProgramData): number {
    if (p.allyTarget) return PARTY;
    return before(p);
}

const CARDS = ['soothe', 'mend', 'tend', 'bolster', 'shell_share', 'howl', 'verdant_ward', 'tidal_battery'];
let b = 0;
let a = 0;
for (const id of CARDS) {
    const p = GetProgramData(id);
    const x = before(p);
    const y = after(p);
    b += x;
    a += y;
    console.log(`${id.padEnd(16)} target=${String(p.target).padEnd(7)} before ${x}  after ${y}  ${y > x ? 'GREW' : y < x ? 'shrank' : 'same'}`);
}
console.log(`\ntotal targets enumerated for the eight: before ${b}, after ${a}  (${a - b >= 0 ? '+' : ''}${a - b})`);
