/**
 * TICKET 184d — a patch that does nothing on a body is never offered for it.
 *
 * Henry, 2026-10-01: *"Hide them I think."* Checked at every door a patch comes through: the elite
 * offer, the gate's choice of two, the shop's stock patch, and the event pick (which is the elite
 * offer). A `firmware` patch is a no-op when it changes none of the OS's hooks; OVERCLOCK changes
 * what a card's scaler counts on the body, so it is never a no-op by this test.
 */
import { describe, expect, it } from 'vitest';

import { LAUNCH_SPECIES, MingmingRegistry } from './mingmingRegistry';
import { PATCHES, PATCH_IDS, patchDoesNothing, type PatchId } from './patchRegistry';
import { bestPatchFor, gatePatchChoices, offerablePatchIds } from './patchRanking';
import { rawFirmwareHooks } from './firmwareRegistry';
import { elitePatchOffer } from '../RewardSystem';
import { choosePatches } from '../../debug/balance/runWalker';
import type { IMingmingState } from '../types';

const LAUNCH_OS = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

describe('184d - no-op patches are hidden', () => {
    it('no door offers a patch that changes nothing on that firmware', () => {
        for (const os of LAUNCH_OS) {
            const hooks = rawFirmwareHooks(os);
            const doors = [
                bestPatchFor(os).id,
                ...gatePatchChoices(os, []),
                ...elitePatchOffer([{ id: 'm1', definitionId: os.replace(/_v\d$/, ''), activeOS: os }]).map((o) => o.patchId),
            ];
            for (const id of doors) expect(patchDoesNothing(PATCHES[id as PatchId], os, hooks), `${os} offered ${id}`).toBe(false);
        }
    });

    it('huldra_v2 (hand-written firmware, no hook data) can use only OVERCLOCK', () => {
        expect(offerablePatchIds('huldra_v2')).toEqual(['overclock']);
        expect(bestPatchFor('huldra_v2').id).toBe('overclock');
    });

    it('OVERCLOCK is never a no-op; the others are a no-op exactly when they touch nothing', () => {
        for (const os of LAUNCH_OS) expect(patchDoesNothing(PATCHES.overclock, os, rawFirmwareHooks(os))).toBe(false);
        expect(patchDoesNothing(PATCHES.repeater, 'kraken_v1', rawFirmwareHooks('kraken_v1'))).toBe(true);
        expect(patchDoesNothing(PATCHES.amplifier, 'kraken_v1', rawFirmwareHooks('kraken_v1'))).toBe(false);
    });

    it('the shop stock (AMPLIFIER) is not offered to huldra_v2, in the game or the walker', () => {
        expect(offerablePatchIds('huldra_v2')).not.toContain('amplifier');
        const party = [
            { id: 'a', activeOS: 'huldra_v2' },
            { id: 'b', activeOS: 'kraken_v1' },
        ] as unknown as IMingmingState[];
        expect(choosePatches(party, {}, 'shop')).toEqual([{ memberId: 'b', patchId: 'amplifier' }]);
    });

    it('how many cells are hidden — the number the 184d report quotes', () => {
        const hidden = LAUNCH_OS.flatMap((os) => PATCH_IDS.filter((id) => patchDoesNothing(PATCHES[id], os, rawFirmwareHooks(os))));
        // 39 no-ops, plus fenrir_v1's RELAY, which Henry ruled out (184d, 2026-10-01).
        expect(hidden).toHaveLength(40);
    });
});
