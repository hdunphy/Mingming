// @vitest-environment jsdom
/**
 * TICKET 182b — a ranch tab whose screen would be empty is not drawn.
 *
 * Expedition is always there (it is what the ranch is for). Roster needs a Mingming, Assembly needs a
 * blueprint to build, Vault needs a Driver held by the run in progress, Codex needs something
 * recorded. The open tab always stays drawn, so assembling the last blueprint does not pull the
 * floor from under the confirmation. "Show advanced content" draws all five.
 */
import { afterEach, describe, expect, it } from 'vitest';

import RanchScreen from './RanchScreen';
import { createRanchMember } from '../../engine/gameTypes';
import { addBlueprint, addToRoster, recordCodexSeen } from '../store/gameSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { startRun } from '../store/runSlice';
import { loadSettings, saveSettings } from '../settings/settings';
import { makeStore, mount } from '../../testing/interaction';

afterEach(() => localStorage.clear());

type Setup = (store: ReturnType<typeof makeStore>) => void;

async function tabs(setup: Setup = () => {}, advanced = false, initial?: 'assembly' | 'roster'): Promise<string[]> {
    const store = makeStore();
    setup(store);
    if (advanced) saveSettings({ ...loadSettings(), showAdvancedContent: true });
    const host = await mount(store, <RanchScreen initialSection={initial} />, { keepStorage: true });
    return [...host.querySelectorAll('.ranch-nav-tab')].map((t) => (t.textContent ?? '').trim());
}

const withKraken: Setup = (s) => { s.dispatch(addToRoster(createRanchMember('kraken', 'kraken_v1'))); };

describe('182b - ranch tabs', () => {
    it('a ranch with one Mingming and nothing else shows Expedition and Roster only', async () => {
        expect(await tabs(withKraken)).toEqual(['Expedition', 'Roster']);
    });

    it('a trace to build brings the Summon tab', async () => {
        expect(await tabs((s) => { withKraken(s); s.dispatch(addBlueprint('fenrir')); })).toEqual(['Expedition', 'Roster', 'Summon']);
    });

    it('a new save holding only its starter trace shows Expedition and Summon (no roster yet)', async () => {
        expect(await tabs((s) => { s.dispatch(addBlueprint('kraken')); })).toEqual(['Expedition', 'Summon']);
    });

    it('something in the codex brings the Codex tab', async () => {
        expect(await tabs((s) => { withKraken(s); s.dispatch(recordCodexSeen(['ember_jab'])); })).toEqual(['Expedition', 'Roster', 'Codex']);
    });

    it('a Driver held by the run in progress brings the Vault tab', async () => {
        const names = await tabs((s) => {
            withKraken(s);
            const member = s.getState().game.roster[0];
            const run = createRun({
                seed: 'vault-182b', offer: offerGyms('offer-seed')[0], startedAt: 1,
                party: [{ id: member.id, definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 }],
            });
            s.dispatch(startRun({ ...run, drivers: ['driver_antivenom'] } as never));
        });
        expect(names).toContain('Vault');
    });

    it('the open tab stays drawn even when its screen is empty', async () => {
        expect(await tabs(withKraken, false, 'assembly')).toEqual(['Expedition', 'Roster', 'Summon']);
    });

    it('with Show advanced content on, all five are drawn', async () => {
        expect(await tabs(withKraken, true)).toEqual(['Expedition', 'Roster', 'Summon', 'Vault', 'Codex']);
    });
});
