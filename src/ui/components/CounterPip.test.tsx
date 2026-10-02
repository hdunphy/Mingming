// @vitest-environment jsdom
/**
 * TICKET 184c — the pip renders beside the firmware chip and on daemon tags, and draws nothing
 * where there is nothing to count.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CounterPip } from './CounterPip';
import { DaemonTags, FirmwareChip } from './UnitReadouts';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { ProgramEntity } from '../../engine/types';

describe('CounterPip', () => {
    it('draws the text, its state as a class, and the sentence as hover text', () => {
        const markup = renderToStaticMarkup(<CounterPip reading={{ text: '4/5', state: 'ready', tooltip: 'Next one draws.' }} />);
        expect(markup).toContain('counter-pip-ready');
        expect(markup).toContain('>4/5<');
        expect(markup).toContain('title="Next one draws."');
    });

    it('draws nothing for no reading', () => {
        expect(renderToStaticMarkup(<CounterPip reading={null} />)).toBe('');
    });
});

describe('where the pip appears', () => {
    const jorm = createSparseEntity({ id: 'p1', name: 'Jormungandr', activeOS: 'jormungandr_v1' });
    const state = createSparseBattleState({
        playerParty: [jorm], enemyParty: [createSparseEntity({ id: 'e1' })], counters: { 'jorm_water:p1': 3 },
    });

    it('beside OUROBOROS_LOOP\'s chip: 3/5', () => {
        const markup = renderToStaticMarkup(<FirmwareChip entity={jorm} battleState={state} />);
        expect(markup).toContain('data-testid="counter-pip"');
        expect(markup).toContain('>3/5<');
    });

    it('not without a battle to read, and not on a firmware with no counter', () => {
        expect(renderToStaticMarkup(<FirmwareChip entity={jorm} />)).not.toContain('counter-pip');
        const skoll = createSparseEntity({ id: 'p2', name: 'Skoll', activeOS: 'skoll_v2' });
        expect(renderToStaticMarkup(<FirmwareChip entity={skoll} battleState={state} />)).not.toContain('counter-pip');
    });

    it('on a REACTIVE PLATING daemon tag: what is left this turn', () => {
        const daemon = { id: 'd1', dataId: 'reactive_plating', currentCost: 2, isPlayable: false } as ProgramEntity;
        const host = createSparseEntity({ id: 'p1', name: 'Host', daemons: [daemon] });
        const markup = renderToStaticMarkup(<DaemonTags entity={host} battleState={{ ...state, playerParty: [host] }} />);
        expect(markup).toContain('>3 LEFT<');
    });
});
