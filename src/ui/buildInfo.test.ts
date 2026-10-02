/**
 * TICKET 181a — the REAL `BUILD_INFO`, with no mock: whatever the test run was built with.
 *
 * `vite.config.ts` bakes `__BUILD_LABEL__` and `__BUILD_COMMIT__` in. `buildLabel.test.tsx` mocks
 * this module; this file is the one that proves the unmocked module still hands the UI a usable
 * label and commit, so a broken `define` shows up as an empty footer here and not at release.
 */
import { describe, expect, it } from 'vitest';
import { BUILD_INFO, buildText } from './buildInfo';

describe('the real build info', () => {
    it('always has a label and a commit, whatever the build was given', () => {
        expect(BUILD_INFO.label.length).toBeGreaterThan(0);
        expect(BUILD_INFO.commit.length).toBeGreaterThan(0);
        expect(buildText(BUILD_INFO)).toBe(`${BUILD_INFO.label} · ${BUILD_INFO.commit}`);
    });
});
