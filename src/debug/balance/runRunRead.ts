/**
 * `npm run runread -- <export.json>` — ticket 156 §4.
 *
 * The entry point, and nothing else. `runRead.ts` holds the reading and the printing so that
 * `runRead.test.ts` can import them without running the script — the same split
 * `runDeckReport.ts` has from `deckReport.ts`, and for a sharper reason here: `vite-node` removes
 * the script path from `process.argv`, so a module cannot tell whether it is the one that was
 * invoked. A separate file that does nothing but call is the only reliable answer.
 *
 * Usage:
 *
 *     npm run runread -- ~/run-logs/mingming-run-2026-09-20T0412-defeat-abc.json
 *     npm run runread                    # the newest mingming-run*.json in ./run-logs
 */
import { runRead } from './runRead';

runRead();
