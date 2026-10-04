/**
 * TICKET 193c — the report says how many differences the game explained, and keeps them out of the
 * Surprises list.
 */
import { describe, it, expect } from 'vitest';
import { explainedTally } from './tally';
import { renderReport } from './render';
import type { RunFact } from './facts';
import type { Finding } from '../findings';

const subject = { type: 'card', id: 'whirlpool', name: 'Whirlpool', text: '8 power. Draw a card. Apply 2 Dazed.' } as const;
const explained = (by: string[]): Finding => ({ kind: 'explained', atMove: 3, subject, differences: [{ key: 'status', predicted: {}, actual: {} }], by });

const run = (findings: Finding[]): RunFact => ({
    session: 'r01', header: { seed: 's', starter: 'kraken_v1', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] } as never,
    starter: 'Kraken', gym: 'Emberfall', outcome: 'unfinished', fights: 0, biome: '1 of 3', deckSize: 10, scrap: 0, decisions: 0,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false,
    findings, notes: [], choices: [], shelfOffers: [],
});

describe('193c — explained differences in the report', () => {
    it('are counted, with the firmware that explains them', () => {
        const tally = explainedTally([run([explained(['ABYSSAL_INK_SYS']), explained(['ABYSSAL_INK_SYS']), explained(['FEEDBACK_LOOP'])])]);
        expect(tally.total).toBe(3);
        expect(tally.by.get('ABYSSAL_INK_SYS')).toBe(2);
    });

    it('show as one line in the Surprises section and never as a surprise', () => {
        const text = renderReport('2026-10-06', [run([explained(['ABYSSAL_INK_SYS'])])]);
        const section = text.slice(text.indexOf('## Surprises'), text.indexOf('## Runs'));
        expect(section).toMatch(/1 explained by a firmware or Aura/);
        expect(section).toContain('ABYSSAL_INK_SYS');
        expect(section).not.toContain('Printed text:');
    });

    it('a night with none says nothing extra', () => {
        const text = renderReport('2026-10-06', [run([])]);
        expect(text.slice(text.indexOf('## Surprises'), text.indexOf('## Runs'))).not.toMatch(/explained/);
    });
});
