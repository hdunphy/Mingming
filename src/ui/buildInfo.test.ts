/**
 * TICKET 181a — the REAL `BUILD_INFO`, with no mock: whatever the test run was built with.
 *
 * `vite.config.ts` bakes `__BUILD_LABEL__` and `__BUILD_COMMIT__` in. `buildLabel.test.tsx` mocks
 * this module; this file is the one that proves the unmocked module still hands the UI a usable
 * label and commit, so a broken `define` shows up as an empty footer here and not at release.
 */
import { describe, expect, it } from 'vitest';
import { BUILD_INFO, buildText } from './buildInfo';
import packageJson from '../../package.json';

describe('the real build info', () => {
    it('always has a label and a commit, whatever the build was given', () => {
        expect(BUILD_INFO.label.length).toBeGreaterThan(0);
        expect(BUILD_INFO.commit.length).toBeGreaterThan(0);
        expect(buildText(BUILD_INFO)).toBe(`${BUILD_INFO.label} · v${BUILD_INFO.version} · ${BUILD_INFO.commit}`);
    });

    // TICKET 181e: `package.json` is the only place the version is written; the build reads it there.
    it('carries the version package.json holds', () => {
        expect(BUILD_INFO.version).toBe(packageJson.version);
        expect(BUILD_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
