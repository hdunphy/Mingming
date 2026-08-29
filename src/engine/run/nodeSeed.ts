/**
 * THE ONE DERIVATION FOR "WHAT IS IN THIS NODE, THIS TIME" — extracted by ticket 13.
 *
 * Ticket 07, RULED: *"Entering a node triggers it again, always."* A node's contents are rolled at
 * entry from **run seed + node id + visit count**, never stored, so a second visit is honestly a
 * second roll and a resumed run (ticket 23) shows exactly what it showed before the app closed.
 *
 * Ticket 11 wrote that rule as `encounter.encounterSeed`, when a fight was the only thing a node
 * could contain. Ticket 13 adds a second thing — a marketplace's stock — that has to obey the
 * *identical* rule for the identical reasons, and Henry's 2026-08-21 amendment says so in the
 * marketplace's own words: *"revisiting a market is allowed (node re-entry), so stock re-rolls per
 * visit."*
 *
 * Two hand-written copies of one seed derivation is how two subsystems quietly stop agreeing about
 * what a visit is, so the derivation lives here once and both call it. `purpose` is what keeps the
 * fight roll and the stock roll on a re-entered node from drawing the same numbers: `SeedStream.fork`
 * labels the child seed, and the label is the whole of the separation.
 *
 * **The string this produces is byte-identical to ticket 11's** — `encounterSeed` is now
 * `nodeSeed(run, node, 'encounter')` — so every encounter already rolled from a stored seed still
 * rolls the same fight. `encounter.test.ts`'s determinism cases are the check on that.
 *
 * Engine module: no React, no Redux, no `Math.random()`, no `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import type { IRegionNode, IRunState } from '../runTypes';

/**
 * The seed one subsystem rolls a node's contents from: **run seed + purpose + node id + visit
 * count**.
 *
 * All four parts are load-bearing. The run seed makes a whole run replayable from one string. The
 * purpose keeps two subsystems reading the same node from drawing the same numbers. The node id
 * keeps two nodes entered at the same moment from producing the same contents. The **visit count**
 * is ticket 07's re-roll — `visited` is a count and not a flag precisely so that walking back in
 * rolls something genuinely different.
 *
 * `node` must already be visit-incremented: the count that identifies *this* entry is the one after
 * the increment. `runSlice.enterNode` does the increment, and callers read the node back out of the
 * updated run.
 */
export function nodeSeed(run: IRunState, node: IRegionNode, purpose: string): string {
    return new SeedStream(run.seed).fork(`${purpose}:${node.id}:${node.visited}`);
}
