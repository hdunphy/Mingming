/**
 * TICKET 181c — the "Tell Henry how it went" link.
 *
 * The form is pre-filled from the game, so a tester answers questions and never types the build,
 * the starter or how far they got. Two things have to hold: every placeholder in the template is
 * filled and URL-encoded, and a build with no template (local, dev) gets no link at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { feedbackTemplate, feedbackUrl } from './feedbackLink';
import { feedbackRunOf } from './feedbackRun';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { createEmptyRanch } from '../store/gameSlice';
import type { IRanchState, IRunState, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

/** The ticket's own template, verbatim. */
const TEMPLATE = 'https://docs.google.com/forms/d/e/1FAIpQLSfvGC1R9ZI6xhuUW1E2gCW9f_3moH2Iys9wnVlB9lzPWpB-1A/viewform?usp=pp_url&entry.266049503={build}&entry.1050293904={starter}&entry.563433886={reached}&entry.1982475832={run}&entry.219225348={minutes}';

const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const BASE = createRun({ seed: 'feedback-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: STARTED_AT });

const RANCH: IRanchState = {
    ...createEmptyRanch(),
    roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }],
    runsCompleted: 4,
};

function ended(outcome: RunOutcome, over: Partial<IRunState> = {}): IRunState {
    return { ...BASE, phase: 'ended', outcome, ...over };
}

/** The query value the form will read for one field id. */
function field(url: string, id: string): string | null {
    return new URL(url).searchParams.get(`entry.${id}`);
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('feedbackUrl fills the template', () => {
    it('fills each placeholder, URL-encoded', () => {
        const url = feedbackUrl(
            { starter: 'Kraken & Co', reached: 'area 2', run: '3', minutes: '41' },
            TEMPLATE,
            'PLAYTEST 2 · v0.4.0 · abc1234',
        )!;
        expect(url).not.toContain('{');
        // Encoded in the raw string: the space, the middle dot and the ampersand never reach the query bare.
        expect(url).toContain('entry.266049503=PLAYTEST%202%20%C2%B7%20v0.4.0%20%C2%B7%20abc1234');
        expect(url).toContain('entry.1050293904=Kraken%20%26%20Co');
        expect(field(url, '266049503')).toBe('PLAYTEST 2 · v0.4.0 · abc1234');
        expect(field(url, '1050293904')).toBe('Kraken & Co');
        expect(field(url, '563433886')).toBe('area 2');
        expect(field(url, '1982475832')).toBe('3');
        expect(field(url, '219225348')).toBe('41');
    });

    it('with no run (Settings) fills the build and leaves the rest blank', () => {
        const url = feedbackUrl(null, TEMPLATE, 'dev · abc1234')!;
        expect(field(url, '266049503')).toBe('dev · abc1234');
        expect(field(url, '1050293904')).toBe('');
        expect(field(url, '563433886')).toBe('');
        expect(field(url, '1982475832')).toBe('');
        expect(field(url, '219225348')).toBe('');
    });

    it('returns null when there is no template, so no button renders', () => {
        expect(feedbackUrl(null, null)).toBeNull();
        expect(feedbackUrl(null, '   ')).toBeNull();
    });

    it('reads the template from VITE_FEEDBACK_FORM_URL, and an unset one is null', () => {
        vi.stubEnv('VITE_FEEDBACK_FORM_URL', '');
        expect(feedbackTemplate()).toBeNull();
        vi.stubEnv('VITE_FEEDBACK_FORM_URL', TEMPLATE);
        expect(feedbackTemplate()).toBe(TEMPLATE);
        expect(feedbackUrl(null)).toContain('entry.266049503=');
    });
});

describe('feedbackRunOf reads the ended run', () => {
    it('fills {minutes} from the run start to the moment it ended, in whole minutes', () => {
        const info = feedbackRunOf(ended('defeat'), RANCH, STARTED_AT + 41 * 60_000 + 59_000);
        expect(info.minutes).toBe('41');
    });

    it('names the starter species, the completed-run count, and how far it got', () => {
        const info = feedbackRunOf(ended('defeat'), RANCH, STARTED_AT);
        expect(info.starter).toBe('Kraken');
        expect(info.run).toBe('4');
        expect(info.reached).toBe('area 1');

        const inBiomeThree = BASE.nodes.find((n) => n.biomeIndex === 2 && n.kind !== 'gym')!;
        expect(feedbackRunOf(ended('defeat', { currentNodeId: inBiomeThree.id }), RANCH, STARTED_AT).reached).toBe('area 3');

        const gym = BASE.nodes.find((n) => n.kind === 'gym')!;
        expect(feedbackRunOf(ended('defeat', { currentNodeId: gym.id }), RANCH, STARTED_AT).reached).toBe('gym');
        expect(feedbackRunOf(ended('victory', { currentNodeId: gym.id }), RANCH, STARTED_AT).reached).toBe('beat the gym');
    });

    it('an intro run fills {run} with "intro" and {reached} with won or lost', () => {
        const won = feedbackRunOf(ended('victory', { mode: 'intro' }), RANCH, STARTED_AT);
        expect(won.run).toBe('intro');
        expect(won.reached).toBe('intro (won)');
        const lost = feedbackRunOf(ended('defeat', { mode: 'intro' }), RANCH, STARTED_AT);
        expect(lost.run).toBe('intro');
        expect(lost.reached).toBe('intro (lost)');
    });
});
