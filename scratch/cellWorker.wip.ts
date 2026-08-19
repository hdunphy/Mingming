/**
 * The worker half of ticket 97's parallel runner.
 *
 * One cell per message. Everything this file touches is a pure function of the request, so a cell's
 * result cannot depend on which worker ran it or on what that worker ran before - which is the
 * determinism guarantee `parallelGrid.ts` documents, made structural.
 *
 * The engine imports happen once per worker at module load, so each worker pays the firmware
 * registry's lazy init exactly once, exactly as a single-process run does.
 */
import { parentPort } from 'node:worker_threads';

import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import type { CellRequest, CellResult } from './parallelGrid.wip';

if (!parentPort) throw new Error('[cellWorker] must be run as a worker thread');
const port = parentPort;

port.on('message', (message: { type: string; request?: CellRequest }) => {
    if (message.type === 'done') { port.close(); return; }
    if (message.type !== 'cell' || !message.request) return;

    const request = message.request;
    try {
        const r = runPairedBatch(
            matchupScenario({
                player: request.playerSpecies,
                enemy: request.enemySpecies,
                playerOS: request.playerOS,
                enemyOS: request.enemyOS,
                seed: request.seed,
            }),
            { iterations: request.iterations },
        );
        const result: CellResult = {
            index: request.index,
            iterations: r.pooled.iterations,
            decisive: r.pooled.decisive,
            decisiveWinRate: r.pooled.decisiveWinRate,
            averageTurns: r.pooled.averageTurns,
            ftkCount: r.pooled.ftkCount,
            deadCardRatio: r.pooled.deadCardRatio,
        };
        port.postMessage({ type: 'result', result });
    } catch (error) {
        port.postMessage({ type: 'error', error: String(error) });
    }
});

port.postMessage({ type: 'ready' });
