/** Ticket 17: shard 2/2 of the OS Variance Audit - see osVarianceSuite.ts. */
import { shardSpecies } from './balanceScenarios';
import { defineOsVarianceSuite } from './osVarianceSuite';

defineOsVarianceSuite(shardSpecies(1, 2));
