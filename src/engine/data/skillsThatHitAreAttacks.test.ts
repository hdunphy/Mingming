/**
 * TICKET 185 follow-up (Henry's ruling 3 on the 185 report) — a card that deals damage to an enemy
 * is an Attack.
 *
 * Henry: *"Attacks are something that deals damage to an enemy. If so [they were mislabeled] then
 * [they are] to be attached, otherwise leave them."* Five cards were printed as Skills while doing
 * exactly that: Overdrive, Hamstring, Adrenaline, Feather Cache and War Molt. After 185a made
 * fenrir_v1 read the Attack CATEGORY they stopped feeding it, which is how the mislabel showed.
 *
 * The rule is pinned over the whole registry, not the five ids, so the next Skill that gains an
 * enemy-targeted damage action fails here instead of drifting. Forage and Dark Pact are Skills on
 * purpose: their ATTACK action is aimed at SELF (that is the cost, not the effect).
 * Hexbloom+ is a STATUS card that deals damage per Weakened; the rule is about Skills, so it is not
 * covered here — it is listed in the 185 outcome note for Henry to rule.
 */
import { describe, it, expect } from 'vitest';
import PROGRAMS from './programs.json';
import { GetProgramData } from './programRegistry';

type Action = { type: string; power?: number; percentMaxHp?: number; target?: string; scalingPower?: number };
type Card = { id: string; category: string; actions?: Action[] };

const cards = (Array.isArray(PROGRAMS) ? PROGRAMS : Object.values(PROGRAMS)) as unknown as Card[];

const hitsAnEnemy = (c: Card): boolean =>
    (c.actions ?? []).some(a =>
        a.type === 'ATTACK' && a.target !== 'SELF' && ((a.power ?? 0) > 0 || (a.percentMaxHp ?? 0) > 0));

describe('a Skill never deals damage to an enemy', () => {
    it('no Skill card has an enemy-aimed damage action', () => {
        const offenders = cards.filter(c => c.category === 'Skill' && hitsAnEnemy(c)).map(c => c.id);
        expect(offenders).toEqual([]);
    });

    it.each(['overdrive', 'hamstring', 'adrenaline', 'feather_cache', 'war_molt'])('%s is an Attack', (id) => {
        expect(GetProgramData(id).category).toBe('Attack');
    });

    it.each(['forage', 'forage+', 'dark_pact'])('%s stays a Skill (its damage is aimed at the caster)', (id) => {
        expect(GetProgramData(id).category).toBe('Skill');
    });
});
