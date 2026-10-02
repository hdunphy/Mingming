/**
 * TICKET 184d (step 2) — every patch the game offers on a launch firmware has its own sentence,
 * and no sentence exists for a patch the game hides. Henry, 2026-10-01: "For now we hand write them
 * per OS."
 */
import { describe, expect, it } from 'vitest';

import { LAUNCH_SPECIES, MingmingRegistry } from './mingmingRegistry';
import { PATCHES } from './patchRegistry';
import { offerablePatchIds } from './patchRanking';
import { PATCH_TEXT, describePatchOn } from './patchText';

const LAUNCH_OS = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

describe('184d - per-firmware patch text', () => {
    it('every offered launch cell has its own line, and it is not the generic sentence', () => {
        for (const os of LAUNCH_OS) {
            for (const id of offerablePatchIds(os)) {
                const line = PATCH_TEXT[os]?.[id];
                expect(line, `${os} + ${id}`).toBeTruthy();
                expect(line, `${os} + ${id}`).not.toBe(PATCHES[id].text);
            }
        }
    });

    it('has no line for a cell the game hides — the table cannot drift from what is offered', () => {
        for (const [os, lines] of Object.entries(PATCH_TEXT)) {
            const offered = new Set(offerablePatchIds(os));
            for (const id of Object.keys(lines)) expect(offered.has(id as never), `${os} + ${id} is hidden but has text`).toBe(true);
        }
    });

    it('covers exactly the launch twelve', () => {
        expect(Object.keys(PATCH_TEXT).sort()).toEqual([...LAUNCH_OS].sort());
    });

    it('says the ruled numbers', () => {
        expect(describePatchOn('jormungandr_v1', 'amplifier')).toContain('draws 2 cards');
        expect(describePatchOn('jormungandr_v1', 'repeater')).toContain('3rd and the 5th');
        expect(describePatchOn('jormungandr_v1', 'splitter')).toContain('Any card counts');
        expect(describePatchOn('ratatoskr_v1', 'amplifier')).toContain('3% of max HP');
    });

    it('falls back to the generic sentence off the table, and to the id for an unknown patch', () => {
        expect(describePatchOn('hel_v2', 'amplifier')).toBe(PATCHES.amplifier.text);
        expect(describePatchOn(undefined, 'relay')).toBe(PATCHES.relay.text);
        expect(describePatchOn('fenrir_v1', 'not_a_patch')).toBe('not_a_patch');
    });
});
