/** TICKET 196a — which shop moves are off the Draught shelf, by the playtester's own move key (`macroShelf`). */
export const isDraughtMove = (moveKey: string): boolean => moveKey.startsWith('market:macro:');
