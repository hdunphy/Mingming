/** Ticket 17: shard 1/4 of the Mirror Test - see mirrorSuite.ts. */
import { shardSpecies } from './balanceScenarios';
import { defineMirrorSuites } from './mirrorSuite';

defineMirrorSuites(shardSpecies(0, 4));
