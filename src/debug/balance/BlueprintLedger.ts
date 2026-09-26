/**
 * Ticket 164g — Blueprint ledger for runWalker.
 *
 * Tracks per-species blueprint counts so the walker only recruits a species
 * when a blueprint for that specific species is held.
 */
export class BlueprintLedger {
    private readonly counts = new Map<string, number>();

    /** Add one blueprint for the given species. */
    add(species: string): void {
        const current = this.counts.get(species) ?? 0;
        this.counts.set(species, current + 1);
    }

    /** Returns true if at least one blueprint for the given species is held. */
    has(species: string): boolean {
        return (this.counts.get(species) ?? 0) > 0;
    }

    /** Spend one blueprint for the given species. Returns true if spent, false if none held. */
    spend(species: string): boolean {
        const current = this.counts.get(species) ?? 0;
        if (current <= 0) return false;
        if (current === 1) {
            this.counts.delete(species);
        } else {
            this.counts.set(species, current - 1);
        }
        return true;
    }

    /**
     * Returns species that have at least one blueprint held and are not in excludingHeld.
     */
    recruitable(excludingHeld: ReadonlySet<string> | ReadonlyArray<string>): string[] {
        const held = excludingHeld instanceof Set ? excludingHeld : new Set(excludingHeld);
        const result: string[] = [];
        for (const [species, count] of this.counts.entries()) {
            if (count > 0 && !held.has(species)) {
                result.push(species);
            }
        }
        return result.sort();
    }

    /** Total count of all blueprints held in the ledger. */
    get total(): number {
        let sum = 0;
        for (const count of this.counts.values()) sum += count;
        return sum;
    }
}
