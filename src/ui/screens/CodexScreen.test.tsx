/**
 * Ticket 31. What the codex screen shows, and — the part that matters — what it does not.
 *
 * `renderToStaticMarkup`, the house pattern, so this asserts markup on a given page; the counting is
 * `engine/codex.test.ts`'s and the recording is `gameSlice.ranch.test.ts`'s. `initialPage` is the
 * same test seam `RanchScreen.initialSection` established, for the same reason: a tab cannot be
 * clicked in a static render.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CodexScreen, { type CodexPage } from './CodexScreen';
import { CODEX_MILESTONES, codexCardIds, codexSpeciesIds } from '../../engine/codex';
import { GetProgramData } from '../../engine/data/programRegistry';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import type { ICodex } from '../../engine/runTypes';

const empty: ICodex = { seen: [], played: [], species: [], assembled: [], os: [] };

function render(codex: Partial<ICodex> = {}, page: CodexPage = 'overview', fired: string[] = []): string {
    return renderToStaticMarkup(
        <CodexScreen codex={{ ...empty, ...codex }} firedMilestones={fired} initialPage={page} />,
    );
}

describe('CodexScreen', () => {
    it('says out loud that it grants nothing', () => {
        // `economy-session.md`: "collection as achievement layer, ZERO power attached". A collection
        // screen that does not say so invites the player to look for the upgrade.
        expect(render()).toMatch(/Nothing here makes you stronger/);
    });

    it('reports zero of a real total on a fresh codex', () => {
        const markup = render();
        expect(markup).toContain(`0 / ${codexCardIds().length}`);
        expect(markup).toContain(`0 / ${codexSpeciesIds().length}`);
    });

    it('shows every card slot but names only the ones seen', () => {
        // The design decision, asserted: an unfound card is a numbered blank, not an absence. There
        // is no advantage in knowing a card exists when the codex grants nothing, and a player who
        // cannot see the target cannot pursue it.
        const first = codexCardIds()[0];
        const markup = render({ seen: [first] }, 'cards');

        expect(markup).toContain(GetProgramData(first).name);
        expect(markup).toContain('— — —');
        // One cell per countable card, found or not.
        expect(markup.match(/class="codex-cell /g) ?? []).toHaveLength(codexCardIds().length);
    });

    it('marks a played card as cast, and an unplayed one not', () => {
        const [a, b] = codexCardIds();
        const markup = render({ seen: [a, b], played: [a] }, 'cards');
        expect(markup).toContain('cast');
        expect(markup.match(/codex-cell-flag/g) ?? []).toHaveLength(1);
    });

    it('keeps met and built apart on the species page', () => {
        const [first] = codexSpeciesIds();
        const met = render({ species: [first] }, 'species');
        expect(met).toContain(GetMingmingData(first).name);
        expect(met).not.toContain('built');

        const built = render({ species: [first], assembled: [first] }, 'species');
        expect(built).toContain('built');
    });

    it('flags the species that are not in the launch set', () => {
        // Two denominators exist; the screen has to say which one it is counting against or a
        // player reads "6 of 16" as being 10 short of something they can reach today.
        expect(render({}, 'species')).toContain('post-launch');
        expect(render()).toMatch(/ship at\s+Early Access|Early Access/);
    });

    it('lists every milestone and marks only the fired ones', () => {
        const fired = [CODEX_MILESTONES[0].id];
        const markup = render({}, 'overview', fired);
        for (const milestone of CODEX_MILESTONES) expect(markup).toContain(milestone.label);
        expect(markup.match(/codex-milestone done/g) ?? []).toHaveLength(1);
    });

    it('says the milestones pay nothing yet', () => {
        // The flag, on screen rather than only in a docblock — a starred milestone that silently
        // paid nothing would read as a bug.
        expect(render()).toMatch(/pay nothing yet/);
    });

    it('reuses the status glossary and the type chart as reference pages', () => {
        // Reused, not rewritten: the glossary text for the duality statuses is derived from
        // `STATUS_MODEL` at import time, so a second copy here could disagree with combat.
        const markup = render({}, 'statuses');
        expect(markup).toContain('Burn');
        expect(markup).toContain('Poison');
        // `TypeChartPanel` renders collapsed; its toggle is the thing that is always present.
        expect(markup).toContain('type-chart');
    });

    it('never prints a power figure on the pages it authors', () => {
        /*
         * The standing law (map § Notes), held over everything this screen writes itself.
         *
         * **The two reference pages are excluded, and the reason is a finding rather than an
         * exemption.** `statusGlossary`'s four duality entries read "+N POWER per stack" because
         * deck-archetypes ticket 102 re-denominated the status economy in power and DERIVED that
         * text from `STATUS_MODEL`; two OS descriptions (`gullinbursti_v1`, `control_v1`) use the
         * word too. That is the game's own vocabulary for a mechanic, authored elsewhere and
         * deliberately — not a card leaking its pricing figure, which is what the law is about.
         * Asserting over those pages here would be this screen failing a test for somebody else's
         * copy, and the honest fix would be to rewrite text the codex exists to quote verbatim.
         */
        const seen = codexCardIds();
        for (const page of ['overview', 'cards', 'species'] as CodexPage[]) {
            expect(render({ seen, played: seen, species: codexSpeciesIds() }, page)).not.toMatch(/\bpower\b/i);
        }
    });
});
