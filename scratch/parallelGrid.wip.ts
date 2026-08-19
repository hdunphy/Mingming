/**
 * Worker-thread grid runner - ticket 97, piece 2. **PARKED IN scratch/, NOT SHIPPED.**
 *
 * The runner and its determinism proof are written and the logic is sound, but `worker_threads`
 * does not inherit the parent's TypeScript loader and every route to registering one inside a
 * worker fails in THIS sandbox: `--import tsx` resolves against the repo (tsx is a global install
 * here, not a dependency), and registering the hooks from a plain-JS shim trips tsx's own
 * deprecated-`--loader` guard. On a machine where tsx is a devDependency the first route just
 * works, which is why this is parked rather than deleted - it needs ten minutes on Henry's box,
 * not a redesign. Piece 1 (the cache) carries the whole measured win in the meantime.
 *
 * The cache (piece 1) makes an UNCHANGED pass nearly free, but every pass that edits an engine file
 * invalidates all 960 cells by design, and those are exactly the passes worth running. That cost is
 * what this removes: the cells are independent pure computations over a fixed seed, so they
 * parallelise perfectly across cores.
 *
 * DETERMINISM IS THE CONSTRAINT, not a nice-to-have. The ticket's rule - "results must not depend
 * on scheduling" - is satisfied structurally rather than by discipline:
 *
 *   - each cell carries its own seed, already derived from the two deck ids, so a cell's result is
 *     a pure function of its inputs and never of what ran before it in the same process;
 *   - work is handed out by INDEX and results are written back into a pre-sized array at that same
 *     index, so the output order is the input order whatever order the workers finish in;
 *   - each worker builds its own engine registries from the same source files, and the firmware
 *     registry's init-once-lazily behaviour therefore happens per worker exactly as it happens in a
 *     single-process run (HANDOFF: an arm that edits an OS needs one process per arm - here every
 *     worker is that process).
 *
 * Falls back to running in-process when `WORKERS=1`, which keeps a single-threaded path available
 * for debugging and for the bit-identity proof.
 */
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The TypeScript loader a worker needs, because `worker_threads` does not inherit the parent's ESM
 * loader. `tsx` is usually a global install here rather than a dependency, so a bare `--import tsx`
 * resolves against the REPO and fails; the candidates below cover both layouts and `TSX_IMPORT`
 * overrides for anything else.
 */
function tsxImportSpecifier(): string {
    if (process.env.TSX_IMPORT) return process.env.TSX_IMPORT;
    const roots = [
        'node_modules',                                    // tsx as a devDependency - the normal case
        ...(process.env.NODE_PATH ?? '').split(':').filter(Boolean),
        '/usr/local/lib/node_modules',
        '/usr/lib/node_modules',
        `${process.env.HOME ?? ''}/.npm-global/lib/node_modules`,
        '/home/claude/.npm-global/lib/node_modules',        // this sandbox's global install
    ];
    const candidates = roots.flatMap(root => [
        `${root}/tsx/dist/loader.mjs`,
        `${root}/tsx/dist/esm/index.mjs`,
    ]);
    for (const candidate of candidates) if (candidate && existsSync(candidate)) return pathToFileURL(candidate).href;
    return 'tsx';
}

export interface CellRequest {
    index: number;
    playerSpecies: string;
    playerOS: string;
    enemySpecies: string;
    enemyOS: string;
    seed: string;
    iterations: number;
}

export interface CellResult {
    index: number;
    iterations: number;
    decisive: number;
    decisiveWinRate: number;
    averageTurns: number;
    ftkCount: number;
    deadCardRatio: number;
}

/**
 * Default worker count. Leaves two cores for the parent process and the OS - a fully saturated box
 * measures slower per cell, and a balance pass is usually running next to an editor and a test
 * watcher.
 */
export function defaultWorkerCount(): number {
    const env = Number(process.env.WORKERS);
    if (Number.isFinite(env) && env > 0) return Math.floor(env);
    return Math.max(1, Math.min(16, (cpus().length || 4) - 2));
}

/**
 * Run every request across N workers and return results IN REQUEST ORDER.
 *
 * `onProgress` fires per completed cell for the caller's progress line; it is deliberately given
 * the completed count rather than the result, because a progress line that depends on which cell
 * happened to finish first is a determinism bug waiting to be copied.
 */
export async function runCellsParallel(
    requests: readonly CellRequest[],
    workerScript: string,
    workerCount: number = defaultWorkerCount(),
    onProgress?: (done: number, total: number) => void,
): Promise<CellResult[]> {
    const results = new Array<CellResult | undefined>(requests.length);
    if (requests.length === 0) return [];

    const workers = Math.max(1, Math.min(workerCount, requests.length));
    let next = 0;
    let done = 0;

    await Promise.all(Array.from({ length: workers }, () => new Promise<void>((resolve, reject) => {
        const worker = new Worker(workerScript, { execArgv: ['--import', tsxImportSpecifier()] });

        const pump = (): void => {
            if (next >= requests.length) { worker.postMessage({ type: 'done' }); return; }
            const request = requests[next++];
            worker.postMessage({ type: 'cell', request });
        };

        worker.on('message', (message: { type: string; result?: CellResult; error?: string }) => {
            if (message.type === 'result' && message.result) {
                results[message.result.index] = message.result;
                done++;
                onProgress?.(done, requests.length);
                pump();
                return;
            }
            if (message.type === 'error') {
                reject(new Error(`[parallelGrid] worker failed: ${message.error}`));
                return;
            }
            if (message.type === 'ready') pump();
        });
        worker.on('error', reject);
        worker.on('exit', code => {
            if (code !== 0) reject(new Error(`[parallelGrid] worker exited with ${code}`));
            else resolve();
        });
    })));

    const missing = results.findIndex(r => r === undefined);
    if (missing !== -1) throw new Error(`[parallelGrid] cell ${missing} never returned a result`);
    return results as CellResult[];
}
