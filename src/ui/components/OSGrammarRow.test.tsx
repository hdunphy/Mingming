/**
 * TICKET 158-r1 — THE READOUT, and the three things it must not do.
 *
 * Henry ruled the row (158 §5.3: *"the recruit screen shows currency and tempo — yes"*), and the
 * interesting cases are all about what it says when it does NOT know something:
 *
 *  - an OS with no grammar recorded draws NOTHING, not "currency: —";
 *  - a partner is marked only when it is on the FIELD, because a hint about a hypothetical party is
 *    the advice the design file already gave and could not act on;
 *  - the designed line survives as the title, so the parentheticals Henry wrote are still reachable.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { OSGrammarRow } from './OSGrammarRow';
import { grammarFor } from '../../engine/data/osGrammar';

const render = (osId: string, partyOS: string[], compact = false): string =>
    renderToStaticMarkup(<OSGrammarRow osId={osId} partyOS={partyOS} compact={compact} />);

describe('158-r1 — what the row draws', () => {
    it('prints a chip per currency and the tempo, from the registry', () => {
        const markup = render('fenrir_v1', []);
        const grammar = grammarFor('fenrir_v1')!;
        for (const token of grammar.currency) expect(markup).toContain(`>${token}</span>`);
        expect(markup).toContain(grammar.tempo.join(' · '));
    });

    it('carries the DESIGNED line as the title, parentheticals and all', () => {
        // The chips say what; the line says which. "ramp (Str consume)" is a different plan from
        // "ramp (HP as fuel)", and both are on fenrir_v1.
        const markup = render('fenrir_v1', []);
        expect(markup).toContain('ramp (Str consume)');
        expect(markup).toContain('ramp (HP as fuel)');
    });

    it('draws NOTHING for an OS with no grammar recorded', () => {
        // Not an empty row. `grammarFor` is undefined for every post-EA OS because nobody has
        // written its currency down — which is a different statement from "it has none", and
        // printing a dash would be the screen making it for them.
        expect(render('gullinbursti_v2', ['fenrir_v1'])).toBe('');
        expect(render('not_an_os', [])).toBe('');
    });
});

describe('158-r1 — the partner mark is a fact about the field', () => {
    it('names a partner that is on the field, with the reason', () => {
        const markup = render('fenrir_v1', ['huldra_v1']);
        expect(markup).toContain('already on the field');
        expect(markup).toContain('Weakens the attackers so the recoil deck survives');
    });

    it('says plainly when none of them is, rather than showing an empty list', () => {
        const markup = render('fenrir_v1', ['kraken_v2']);
        expect(markup).toContain('Nobody on the field is an authored partner');
        expect(markup).not.toContain('already on the field');
    });

    it('never marks a partner that is merely authored — only one that is present', () => {
        // The whole difference between this and the design file: fenrir_v1 lists three partners,
        // and an empty party marks none of them.
        expect(grammarFor('fenrir_v1')!.partners.length).toBe(3);
        expect(render('fenrir_v1', [])).not.toContain('already on the field');
    });

    it('compact keeps the chips and reduces the partners to a count', () => {
        // The roster row and the picker are lists; a three-line partner panel in a list is a wall.
        const markup = render('fenrir_v1', ['huldra_v1', 'skoll_v1'], true);
        expect(markup).toContain('2 partners on the field');
        expect(markup).toContain('>Strength</span>');
        expect(markup).not.toContain('already on the field');
    });

    it('says "partner" rather than "partners" for one', () => {
        expect(render('fenrir_v1', ['huldra_v1'], true)).toContain('1 partner on the field');
    });
});
