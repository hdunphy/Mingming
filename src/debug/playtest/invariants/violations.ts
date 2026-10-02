/** TICKET 180e — one thing that should never be true, found by an invariant check. */
import type { InvariantName } from '../findings';

export interface Violation {
    readonly name: InvariantName;
    readonly detail: string;
}
