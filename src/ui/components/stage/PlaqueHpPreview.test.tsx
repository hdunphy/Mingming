// @vitest-environment jsdom
/**
 * TICKET 194e — the HP preview has a place that cannot be clipped.
 *
 * Henry, 2026-10-04: "The HP damage preview is hidden in the overflow." At 1140/1140 with a
 * 1,007 preview the inline `(-1007)` ran past a 168px plaque and the panel's clip-path cut it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { setServerViewport } from '../../hooks/useStageAnchors';
import type { DamagePreview } from '../../utils/damagePreview';
import { PLAQUE_W, REF_HEIGHT, REF_WIDTH } from '../stageGeometry';
import { UnitPlaque } from './UnitPlaque';

const huldra = {
    id: 'e1', name: 'HULDRA', definitionId: 'huldra', maxHp: 1140, currentHp: 1140,
    maxEnergy: 2, currentEnergy: 2, primaryElement: 'Nature', activeOS: 'huldra_v1',
    daemons: [], statusEffects: [],
} as unknown as IBattleEntity;

const battleState = {
    playerParty: [], enemyParty: [huldra], counters: {}, turn: 1,
    playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
} as unknown as IBattleState;

const preview = (damage: number): DamagePreview => ({
    damage, absorbed: 0, hpDamage: damage, lethal: false, hitCount: 1, stab: false, effectiveness: 1,
    element: 'Nature', powerBonus: 0, powerBonusLabel: '', scalingMultiplier: 1, statusChanges: [],
} as unknown as DamagePreview);

function plaque(previewValue: DamagePreview | null): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
        <UnitPlaque
            entity={huldra} isEnemy plaque={{ x: 0, y: 0, w: PLAQUE_W, h: 0 }} scale={0.5}
            isActive={false} preview={previewValue} battleState={battleState}
        />,
    );
    return host;
}

beforeEach(() => setServerViewport(REF_WIDTH, REF_HEIGHT));

describe('194e — the HP preview is not behind the panel', () => {
    it('1140/1140 with a 1,007 preview: the number is in the DOM, outside the clipped panel', () => {
        const host = plaque(preview(1007));
        const line = host.querySelector('[data-testid="plaque-hp-preview"]');
        expect(line?.textContent).toContain('1007');
        // The slanted panel is the clip-path; the preview line must not be inside it, nor inside
        // the HP value that sits in it.
        expect(line?.closest('.k-panel')).toBeNull();
        expect(line?.closest('.stage-plaque-value')).toBeNull();
        expect(line?.closest('.stage-plaque-preview')).not.toBeNull();
    });

    it('the HP value no longer carries the number inline', () => {
        const host = plaque(preview(1007));
        expect(host.querySelector('.stage-plaque-value')?.textContent).toBe('1140/1140');
    });

    it('no preview, no line', () => {
        expect(plaque(null).querySelector('[data-testid="plaque-hp-preview"]')).toBeNull();
        expect(plaque(preview(0)).querySelector('[data-testid="plaque-hp-preview"]')).toBeNull();
    });

    it('no rule in the stylesheet clips the preview block or its line', () => {
        const css = readFileSync(resolve(process.cwd(), 'src/ui/components/stage/stage.css'), 'utf8');
        for (const selector of ['.stage-plaque-preview', '.stage-plaque-preview-hp']) {
            const rule = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
            expect(rule, selector).not.toBeNull();
            expect(rule![1]).not.toMatch(/overflow\s*:\s*hidden|clip-path/);
        }
    });
});
