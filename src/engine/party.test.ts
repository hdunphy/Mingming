/**
 * The party rules — the species clause and the size cap.
 *
 * WHY THESE ASSERTIONS ARE HERE RATHER THAN ON A SLICE. Ticket 20 wrote them against
 * `gameSlice.setActiveParty`, the reducer that maintained the ranch's persistent party. Ticket 11
 * deleted both the field and the reducer: `IRanchState` has no `activeParty`, because the party is
 * chosen at run start and lives in `IRunState.partyIds`. The *rule* did not go anywhere — it is
 * still the standing law from the map's Notes, still enforced by `reconcileLoadedState` at load and
 * by `RunStart` at pick time — so the tests moved to the module that owns it. That is the whole
 * point of `party.ts` existing as its own file: three hand-written copies of one rule is how a rule
 * rots, and one test file is what keeps the single copy honest.
 */

import { describe, expect, it } from 'vitest';

import { PARTY_SIZE, legalParty, partyBlockFor, type PartyMember } from './party';

const member = (id: string, definitionId: string): PartyMember => ({ id, definitionId });

const ROSTER: ReadonlyArray<PartyMember> = [
    member('a1', 'kraken'),
    member('a2', 'kraken'),
    member('b1', 'fenrir'),
    member('c1', 'ratatoskr'),
    member('d1', 'huldra'),
];

describe('legalParty', () => {
    it('keeps the first of a species and drops the later duplicate', () => {
        expect(legalParty(['a1', 'a2', 'b1'], ROSTER)).toEqual(['a1', 'b1']);
    });

    it('caps at PARTY_SIZE and rejects ids that are not in the roster', () => {
        expect(legalParty(['a1', 'b1', 'ghost', 'c1', 'd1'], ROSTER)).toEqual(['a1', 'b1', 'c1']);
        expect(PARTY_SIZE).toBe(3);
    });

    it('lets a duplicate in once the first one is out — the clause is about the party, not the roster', () => {
        // Two separate calls, because there is no stored party to mutate any more. The rule is
        // stateless: each call is judged on the list it is handed.
        expect(legalParty(['a1', 'b1'], ROSTER)).toEqual(['a1', 'b1']);
        expect(legalParty(['a2', 'b1'], ROSTER)).toEqual(['a2', 'b1']);
    });

    it('trims rather than rejects, so a reducer with no error channel still produces a legal party', () => {
        expect(legalParty(['ghost1', 'ghost2'], ROSTER)).toEqual([]);
    });
});

describe('partyBlockFor', () => {
    it('names the duplicate species so a screen can say it out loud', () => {
        expect(partyBlockFor(member('a2', 'kraken'), [member('a1', 'kraken')])).toBe('duplicate-species');
    });

    it('names a full party', () => {
        const full = [member('a1', 'kraken'), member('b1', 'fenrir'), member('c1', 'ratatoskr')];
        expect(partyBlockFor(member('d1', 'huldra'), full)).toBe('party-full');
    });

    it('never blocks a member already in the party — that click removes it', () => {
        const full = [member('a1', 'kraken'), member('b1', 'fenrir'), member('c1', 'ratatoskr')];
        expect(partyBlockFor(member('a1', 'kraken'), full)).toBeNull();
    });

    it('allows a fresh species into a party with room', () => {
        expect(partyBlockFor(member('b1', 'fenrir'), [member('a1', 'kraken')])).toBeNull();
    });
});
