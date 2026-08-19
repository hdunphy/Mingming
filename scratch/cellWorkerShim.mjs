/**
 * Worker entry shim - ticket 97, piece 2.
 *
 * `worker_threads` does not inherit the parent process's ESM loader, so a worker whose module graph
 * is TypeScript cannot resolve its own imports. Passing `--import tsx` through `execArgv` is the
 * documented route and it depends on how tsx happens to be installed, which is exactly the sort of
 * environment coupling that breaks on somebody else's machine.
 *
 * This shim removes the coupling: plain `.mjs`, so Node loads it with no help, and it registers
 * tsx's hooks itself before importing the real worker. `TSX_IMPORT` overrides the module it
 * registers if a future tsx moves its entry point.
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

const ROOTS = [
    'node_modules',
    ...(process.env.NODE_PATH ?? '').split(':').filter(Boolean),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
    `${process.env.HOME ?? ''}/.npm-global/lib/node_modules`,
    '/home/claude/.npm-global/lib/node_modules',
];

function tsxHooks() {
    if (process.env.TSX_IMPORT) return process.env.TSX_IMPORT;
    for (const root of ROOTS) {
        for (const entry of ['tsx/dist/esm/index.mjs', 'tsx/dist/loader.mjs']) {
            const candidate = `${root}/${entry}`;
            if (existsSync(candidate)) return pathToFileURL(candidate).href;
        }
    }
    throw new Error('[cellWorkerShim] could not find tsx to register - set TSX_IMPORT');
}

register(tsxHooks(), pathToFileURL('./'));
await import(new URL('./cellWorker.wip.ts', import.meta.url).href);
