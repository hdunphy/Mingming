/**
 * TICKET 205 - the card tooltip's lines draw Tabler icons where the emoji used to be.
 *
 * The tooltip only renders on hover, which a static render never reaches, so the lines are their own
 * components (`TooltipLines.tsx`) and this renders them directly. Each action type draws the icon its
 * map names at the START of the line, and the words after it are exactly the words the line had
 * before, minus the symbol (this is a swap, not a rewrite).
 *
 * Tests moved on purpose (ticket 205): none here existed for the effect lines; `CardHand.test.tsx`
 * reads the hand's markup, which never contained the tooltip.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ProgramAction } from '../../engine/types';
import { iconsIn } from '../theme/iconMarkup';
import { hasPictograph } from '../theme/pictographs';
import { EFFECT_ICON } from './cardEffectIcons';
import { EffectLine, GlossaryStatusIcon, MetMark, RequirementsLabel } from './TooltipLines';

const act = (a: Record<string, unknown>): ProgramAction => a as unknown as ProgramAction;

/** The text of some markup: the svgs and tags gone, whitespace squeezed. */
const words = (markup: string): string => markup.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** One row per action type: the action, and the words the line said before, without its symbol. */
const LINES: ReadonlyArray<readonly [ProgramAction, string]> = [
    [act({ type: 'ATTACK', power: 30 }), '30 power'],
    [act({ type: 'ATTACK', power: 30, count: 2 }), '30 power ×2 hits'],
    [act({ type: 'ATTACK', power: 12, target: 'SELF' }), 'Recoil onto the caster — 12 power'],
    [act({ type: 'HEAL', power: 20 }), 'Heals with 20 power'],
    [act({ type: 'HEAL' }), 'Restores HP'],
    [act({ type: 'STATUS', status: 'Burn', stacks: 2 }), '2× Burn → the target'],
    [act({ type: 'CLEANSE', status: 'Burn' }), 'Clears Burn'],
    [act({ type: 'ENERGY', amount: 2 }), '+2 Energy'],
    [act({ type: 'MAX_ENERGY', amount: 1 }), '+1 max Energy for the battle'],
    [act({ type: 'DRAW', count: 2 }), 'Draw 2'],
    [act({ type: 'DISCARD', count: 1 }), 'Discard 1'],
    [act({ type: 'FORCE_DISCARD', count: 1 }), 'The target discards 1'],
    [act({ type: 'EXHAUST', count: 1 }), 'Exhausts 1 — gone for the fight'],
    [act({ type: 'RETURN', count: 1 }), 'Returns 1 from the discard'],
    [act({ type: 'SEARCH' }), 'Search the deck for a card'],
    [act({ type: 'GENERATE_CARD' }), 'Adds a card to your hand'],
    [act({ type: 'MULTIPLY_STATUS', status: 'Poison' }), 'Doubles Poison on the target'],
    [act({ type: 'TRIGGER_STATUS', status: 'Burn' }), 'Makes Burn tick now'],
    [act({ type: 'PLAY_LAST_CARD' }), 'Replays the last card you cast'],
    [act({ type: 'TAUNT' }), 'Forces the target to attack the caster'],
    [act({ type: 'BUFF_NEXT_PROGRAM' }), 'Strengthens the next card you play'],
    [act({ type: 'REDIRECT_TARGET' }), 'Redirects the incoming attack'],
    [act({ type: 'SHIFT_STANCE' }), 'Shifts stance'],
    [act({ type: 'REVIVE' }), 'Revives a fallen ally'],
];

describe('an effect line draws its icon first, then the same words (205)', () => {
    it.each(LINES)('%j', (action, text) => {
        const markup = renderToStaticMarkup(<EffectLine action={action} />);
        expect(markup.startsWith('<svg'), 'the icon comes first').toBe(true);
        expect(iconsIn(markup)).toEqual([{ name: EFFECT_ICON[action.type], variant: 'outline' }]);
        expect(words(markup)).toBe(text);
    });

    it('covers every action type there is', () => {
        expect(new Set(LINES.map(([action]) => action.type))).toEqual(new Set(Object.keys(EFFECT_ICON)));
    });

    it('says "an ally" for an ally card, as it did', () => {
        expect(words(renderToStaticMarkup(<EffectLine action={act({ type: 'HEAL', power: 5 })} allyTarget />))).toBe('Heals an ally with 5 power');
    });

    it('has no emoji or symbol character left in the words', () => {
        for (const [action] of LINES) {
            expect(hasPictograph(words(renderToStaticMarkup(<EffectLine action={action} />)))).toBe(false);
        }
    });
});

describe('the Requirements heading and the met tick (205)', () => {
    it('Requirements draws the warning triangle then the word', () => {
        const markup = renderToStaticMarkup(<RequirementsLabel />);
        expect(iconsIn(markup)).toEqual([{ name: 'alert-triangle', variant: 'outline' }]);
        expect(words(markup)).toBe('Requirements');
    });

    it('a met conditional draws the tick', () => {
        expect(iconsIn(renderToStaticMarkup(<MetMark />))).toEqual([{ name: 'check', variant: 'outline' }]);
    });
});

/**
 * 206 item B10 (Henry, 2026-10-09): the tooltip's icons were too small. They draw at 1.25em, which is
 * 14 px on a 0.7rem effect line at the default text size and still follows the Text size setting.
 * The glossary's status icons are fixed px, so they go from 11 to 14.
 */
describe('the tooltip icons are bigger: 1.25em, and 14 px for the status glossary (206 B10)', () => {
    const sized = (markup: string): boolean => /style="[^"]*width:1\.25em;height:1\.25em/.test(markup);

    it('every effect line draws its icon at 1.25em', () => {
        for (const [action] of LINES) expect(sized(renderToStaticMarkup(<EffectLine action={action} />)), action.type).toBe(true);
    });

    it('the Requirements triangle and the met tick match it', () => {
        expect(sized(renderToStaticMarkup(<RequirementsLabel />))).toBe(true);
        expect(sized(renderToStaticMarkup(<MetMark />))).toBe(true);
    });

    it('a glossary status icon is 14 px', () => {
        const markup = renderToStaticMarkup(<GlossaryStatusIcon status="Burn" />);
        expect(markup).toContain('data-status-icon="Burn"');
        expect(markup).toMatch(/<svg[^>]* width="14" height="14"/);
    });
});
