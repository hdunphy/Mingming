/**
 * TICKET 146g — the twelve authored tells, and the thirty-nine that are not.
 *
 * The interesting assertions here are about COVERAGE and DATA rather than about pictures. §2g's
 * whole design is two layers so that nothing ships without a tell; a test that only checked the
 * twelve would miss the failure the layering exists to prevent.
 */
import { describe, expect, it } from 'vitest';

import { FIRMWARE_REGISTRY, getOSBehavior } from '../../engine/data/firmwareRegistry';
import type { OSVfxShape } from '../../engine/data/firmwareRegistry';

/** §2g's roster, by the OS name Henry used, mapped to the firmware id that carries it. */
const EARLY_ACCESS_TWELVE: Record<string, string> = {
    UNBOUND_KERNEL: 'fenrir_v1',
    TREACHERY_KERNEL: 'skoll_v1',
    ALLURE_PROXY: 'huldra_v1',
    ABYSSAL_INK: 'kraken_v1',
    TOXIN_FANG: 'jormungandr_v2',
    OUROBOROS: 'jormungandr_v1',
    GOSSIP_NODE: 'ratatoskr_v1',
    REBIRTH_CYCLE: 'valkyrie_v2',
    SOLAR_OVERDRIVE: 'skoll_v2',
    CINDER_WALL: 'fenrir_v2',
    INSTIGATOR: 'ratatoskr_v2',
    BARK_SHIELD: 'huldra_v2',
};

const SHAPES: OSVfxShape[] = ['pulse', 'rise', 'arc', 'crack', 'swirl', 'drain', 'spark', 'ring'];

describe('146g — the Early Access twelve are authored', () => {
    it.each(Object.entries(EARLY_ACCESS_TWELVE))('%s (%s) has a signature', (_name, id) => {
        expect(getOSBehavior(id)?.vfx).toBeDefined();
    });

    it('spells every signature out of the vocabulary, so none needs its own renderer', () => {
        // §2g's list is a vocabulary of MOTIONS, not of new particles. A thirteenth shape would be
        // a rendering path nobody wrote, and it would fail silently — `playShape` falls through to
        // a ring, which looks like a working tell for the wrong effect.
        for (const id of Object.values(EARLY_ACCESS_TWELVE)) {
            expect(SHAPES).toContain(getOSBehavior(id)!.vfx!.shape);
        }
    });

    it('gives the two directional tells a direction', () => {
        // ALLURE_PROXY reaches OUT and TOXIN_FANG pulls IN. Direction is the meaning, which is the
        // only reason `at` exists in the data at all — an arc drawn the wrong way says the
        // opposite of what happened.
        expect(getOSBehavior('huldra_v1')!.vfx!.at).toBe('owner-to-target');
        expect(getOSBehavior('jormungandr_v2')!.vfx!.at).toBe('target-to-owner');
    });

    it('gives every signature a readable colour', () => {
        for (const id of Object.values(EARLY_ACCESS_TWELVE)) {
            const color = getOSBehavior(id)!.vfx!.color;
            expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});

describe('146g — everything else still gets a tell', () => {
    it('leaves the rest of the roster on the family default rather than on nothing', () => {
        /*
         * The layering, asserted from the other side. Thirty-nine firmware entries have no
         * signature and that is correct — but "no signature" must mean "family default", not "no
         * tell". `emitHookTell` guarantees that by construction (an undefined `vfx` takes the
         * default branch), and this is the test that says the gap is expected rather than a
         * forgotten twelve.
         */
        const authored = new Set(Object.values(EARLY_ACCESS_TWELVE));
        const unauthored = Object.keys(FIRMWARE_REGISTRY).filter((id) => !authored.has(id));

        expect(unauthored.length).toBeGreaterThan(0);
        for (const id of unauthored) {
            expect(getOSBehavior(id)?.vfx).toBeUndefined();
        }
    });

    it('reads the signatures from hooks.json rather than from a UI switch', () => {
        // §2g: *"so it is data, not code"*. The registry is loaded from the JSON, so a signature
        // arriving here at all is proof the data path works — and adding an OS is a JSON edit
        // rather than a component edit, which is the difference between remembering and not
        // having to.
        expect(getOSBehavior('fenrir_v1')!.vfx!.shape).toBe('spark');
        expect(getOSBehavior('fenrir_v1')!.vfx!.note).toContain('UNBOUND_KERNEL');
    });
});
