"""
TICKET 158-r1 — LIFT THE OS GRAMMAR OUT OF THE DESIGN FILE AND INTO THE REGISTRY.

Henry ruled (158 §5.3) that `cur`, `tempo` and `partners` move from
`collection-v2/collection.json` into the registry, so the walker (157), the recruit readout and the
browser read ONE source instead of three copies of a design file.

This script is the transcription, run once, exactly as `t162a_build.py` was for the cards. It reads
the design file and writes `src/engine/data/osGrammar.ts`. After it has run, the TypeScript file is
the source and this script is the record of where the values came from — re-running it against a
design file that no longer carries the fields is a no-op by design (it refuses rather than emitting
twelve empty entries).

# WHAT IT HAS TO DECIDE, AND WHAT IT REFUSES TO DECIDE

Henry's fields are PROSE: `cur='cards (0e) → Dazed'`, `tempo='zoo (binary Dazed riders) · control
(Weakened riders)'`. The ruling asks for `currency: string[]` and `tempo: kind[]`, which a machine
can use. Both are emitted, AND the original line is carried verbatim beside them:

  - the TOKENS are what the walker matches and what the readout draws as chips;
  - the LINE is what Henry wrote, and it is the only place the parentheticals live — "ramp (Str
    consume)" says WHICH ramp, and throwing that away to satisfy a type would be the script
    editing the design.

Parsing rules, deliberately dull so that the output is checkable by eye against the source:

  - currency: split on `·`, `→` and `/`; drop any `(parenthetical)`; trim; keep order; dedupe.
  - tempo:    the word before each `(`, in order, deduped. Anything else is a hard failure.
  - partners: the display name is resolved through `NAMES` below. A name that is not in the table
              stops the script — inventing an id here would put a partner hint on the wrong body.

`verify()` then re-reads what it wrote: twelve entries, every currency token non-empty, every tempo
one of the four kinds actually used, every partner an id the registry knows, and no partner pointing
at its own OS.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COL = os.path.join(ROOT, 'docs/wayfinder/deck-archetypes/collection-v2/collection.json')
OUT = os.path.join(ROOT, 'src/engine/data/osGrammar.ts')

# The display names Henry writes in `partners`, and the firmware ids they mean. Hand-written on
# purpose: `Rat v1` is not a slug of `ratatoskr_v1` by any rule, and a fuzzy matcher would be a
# silent way to attach a partner hint to the wrong body.
NAMES = {
    'Fenrir v1': 'fenrir_v1', 'Fenrir v2': 'fenrir_v2',
    'Sköll v1': 'skoll_v1', 'Sköll v2': 'skoll_v2',
    'Rat v1': 'ratatoskr_v1', 'Rat v2': 'ratatoskr_v2',
    'Jorm v1': 'jormungandr_v1', 'Jorm v2': 'jormungandr_v2',
    'Kraken v1': 'kraken_v1', 'Kraken v2': 'kraken_v2',
    'Huldra v1': 'huldra_v1', 'Huldra v2': 'huldra_v2',
}

TEMPO_KINDS = ('zoo', 'ramp', 'control', 'keeper')


def currency_tokens(line):
    out = []
    for part in re.split(r'[·→/]', line):
        token = re.sub(r'\([^)]*\)', '', part).strip()
        if token and token not in out:
            out.append(token)
    return out


def tempo_tokens(line):
    out = []
    for part in line.split('·'):
        kind = part.strip().split('(')[0].strip()
        if kind not in TEMPO_KINDS:
            sys.exit('unknown tempo kind %r in %r' % (kind, line))
        if kind not in out:
            out.append(kind)
    return out


def partner_rows(pairs):
    """
    One row per NAMED OS. Henry writes one entry naming two bodies — `Fenrir v1 / Sköll v1` on
    huldra_v1 — and the ruling's shape is `{osId, why}[]`, so it becomes two rows carrying the same
    sentence. The sentence is NOT split to match: it is Henry's, and its two clauses do not divide
    cleanly along the slash (the second names Cinder Lance, which is fenrir_v2's card). Recorded in
    the write-back rather than tidied here.
    """
    rows = []
    for name, why in pairs:
        for one in [n.strip() for n in name.split('/')]:
            if one not in NAMES:
                sys.exit('partner name %r is not in NAMES — add it rather than guessing' % one)
            rows.append({'osId': NAMES[one], 'why': why})
    return rows


def ts_string(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    design = json.load(open(COL, encoding='utf-8'))
    entries = []
    for o in design['os']:
        for field in ('cur', 'tempo', 'partners'):
            if field not in o:
                sys.exit('%s has no `%s` — the design file has already been moved off these fields; '
                         'osGrammar.ts is the source now (158-r1).' % (o['id'], field))
        entries.append({
            'id': o['id'],
            'currency': currency_tokens(o['cur']),
            'currencyText': o['cur'],
            'tempo': tempo_tokens(o['tempo']),
            'tempoText': o['tempo'],
            'partners': partner_rows(o['partners']),
        })

    body = []
    for e in entries:
        cur = ', '.join(ts_string(c) for c in e['currency'])
        tempo = ', '.join(ts_string(t) for t in e['tempo'])
        partners = ',\n'.join(
            '            { osId: %s, why: %s }' % (ts_string(p['osId']), ts_string(p['why']))
            for p in e['partners'])
        body.append(
            '    %s: {\n'
            '        currency: [%s],\n'
            '        currencyText: %s,\n'
            '        tempo: [%s],\n'
            '        tempoText: %s,\n'
            '        partners: [\n%s,\n        ],\n'
            '    },' % (e['id'], cur, ts_string(e['currencyText']), tempo, ts_string(e['tempoText']), partners))

    src = HEADER + '\n'.join(body) + FOOTER
    open(OUT, 'w', encoding='utf-8', newline='\n').write(src)
    verify(entries)
    print('wrote %s — %d OS, %d currency tokens, %d partner rows' % (
        os.path.relpath(OUT, ROOT), len(entries),
        len({c for e in entries for c in e['currency']}),
        sum(len(e['partners']) for e in entries)))


def verify(entries):
    ids = {e['id'] for e in entries}
    assert len(entries) == 12, len(entries)
    for e in entries:
        assert e['currency'], e['id']
        assert all(c.strip() for c in e['currency']), e['id']
        assert e['tempo'] and all(t in TEMPO_KINDS for t in e['tempo']), e['id']
        for p in e['partners']:
            assert p['osId'] in ids, (e['id'], p['osId'])
            assert p['osId'] != e['id'], ('%s lists itself as a partner' % e['id'])
    print('verify: 12 OS, every token non-empty, every partner a known id, nobody partnered with themselves')


HEADER = '''/**
 * TICKET 158-r1 — **THE OS GRAMMAR, IN THE REGISTRY, ONCE.**
 *
 * 158 §2 defines an archetype as a CURRENCY and a TEMPO, and §5.3 is Henry's ruling that the three
 * fields describing them stop living in `collection-v2/collection.json`:
 *
 * > *"move `cur`, `tempo` and `partners` from `collection-v2/collection.json` into the registry
 * > ... so the walker (157), the recruit screen readout (78) and the browser read one source."*
 *
 * Three readers, and before this they read three copies: the browser rendered the design file
 * directly, the walker had nothing to read at all, and the recruit screen showed a firmware id.
 * A design file is a RECORD of what was ruled; it is not a runtime source, and the browser proved
 * that twice over (162d) by silently describing a collection the game no longer shipped.
 *
 * # WHY BOTH THE TOKENS AND THE LINE
 *
 * Henry writes these as prose — `'cards (0e) → Dazed'`, `'zoo (binary Dazed riders) · control
 * (Weakened riders)'` — and the ruling asks for arrays. Both are here, and neither is redundant:
 *
 *   - `currency` / `tempo` are what a MACHINE matches on. 157's walker recruits toward a gym's
 *     counter element and wants to know that kraken_v1 banks `cards` and pays in `Dazed`; a chip
 *     row wants four short words, not a sentence.
 *   - `currencyText` / `tempoText` are what HENRY WROTE, verbatim. The parentheticals are the part
 *     that says WHICH ramp — *"ramp (push piles past 4)"* is a different plan from *"ramp (Str
 *     consume)"* — and dropping them to satisfy a type would be this file editing the design.
 *
 * # PARTNERS ARE FIRMWARE IDS NOW, NOT DISPLAY NAMES
 *
 * The design file says `'Rat v1'`. Nothing can join that to `ratatoskr_v1` by a rule, which is why
 * the readout could not mark "this partner is already in your party" until now. Resolved once, by
 * a hand-written table in `scratch/t158r1_build.py`, and asserted here by `osGrammar.test.ts`.
 *
 * GENERATED by `scratch/t158r1_build.py` from the design file, then owned here. Edit this file;
 * the script is the record of where the values came from, not a build step.
 */

/** 158 §2's four tempos. `keeper` is in the data and was not in §5.3's list — see the write-back. */
export type TempoKind = 'zoo' | 'ramp' | 'control' | 'keeper';

export interface OSPartner {
    /** The firmware id, resolved from the design file's display name. */
    readonly osId: string;
    /** Henry's sentence, verbatim. */
    readonly why: string;
}

export interface OSGrammar {
    /** Atomic currency tokens, in the order Henry wrote them. What the walker matches on. */
    readonly currency: ReadonlyArray<string>;
    /** The designed line, parentheticals and all. What a reader is shown. */
    readonly currencyText: string;
    /** The tempos this OS plays, deduped, in order. */
    readonly tempo: ReadonlyArray<TempoKind>;
    /** The designed line. */
    readonly tempoText: string;
    /** Who feeds it and who reads it — by firmware id, so a party can be checked against it. */
    readonly partners: ReadonlyArray<OSPartner>;
}

/**
 * The EA twelve. An OS absent from this table has no grammar recorded — `grammarFor` returns
 * undefined rather than an empty one, because "no currency" and "nobody has written the currency
 * down" are different answers and the readout says so differently.
 */
export const OS_GRAMMAR: Readonly<Record<string, OSGrammar>> = {
'''

FOOTER = '''
};

/** The grammar for `osId`, or undefined when none has been recorded (every post-EA OS). */
export function grammarFor(osId: string): OSGrammar | undefined {
    return OS_GRAMMAR[osId];
}

/**
 * The partners of `osId` that are ALREADY on the field, as firmware ids.
 *
 * The readout's whole job on the recruit screen: a partner hint is advice until it is a fact about
 * the party in front of you. Order follows `partners`, so the strongest-authored hint reads first.
 */
export function partnersInParty(osId: string, partyOS: ReadonlyArray<string>): ReadonlyArray<OSPartner> {
    const held = new Set(partyOS);
    return grammarFor(osId)?.partners.filter((p) => held.has(p.osId)) ?? [];
}
'''

main()
