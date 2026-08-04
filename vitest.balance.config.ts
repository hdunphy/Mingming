import { defineConfig } from 'vitest/config';

/**
 * Config for `npm run balance` only.
 *
 * The balance suite is a batch simulator, not a unit-test suite: one test is thousands of
 * battles and takes tens of seconds. It is kept on its own config so `npm test` and
 * `npm run build` never see it - they use `vite.config.ts`, whose vitest defaults match
 * `*.{test,spec}.*` and therefore cannot pick up a `*.balance.ts` file. That separation was
 * an explicit requirement (see docs/wayfinder/debug-toolkit/tickets/08-batch-sim-auditor-design.md
 * section 2), so the include pattern here is deliberately narrow rather than an addition
 * to the default one.
 *
 * No react plugin and no jsdom: nothing under test renders. Environment stays `node`,
 * matching the default config.
 */
export default defineConfig({
    test: {
        include: ['src/**/*.balance.ts'],
        // A batch is minutes, not milliseconds. The default 5s timeout would fail every
        // test here before it produced a number.
        testTimeout: 30 * 60 * 1000,
        hookTimeout: 30 * 60 * 1000,
        // Batches are CPU-bound and each file is one long test, so reporting per-test
        // rather than per-file is the only progress signal available.
        reporters: ['verbose'],
    },
});
