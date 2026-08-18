/** Ticket 17: shard 1/2 of the OS Variance Audit - see osVarianceSuite.ts. */
import { shardSpecies } from './balanceScenarios';
import { defineOsVarianceSuite } from './osVarianceSuite';

defineOsVarianceSuite(shardSpecies(0, 2));
