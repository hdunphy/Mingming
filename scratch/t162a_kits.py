#!/usr/bin/env python3
"""
TICKET 162a step 3 — collection v2's twelve kits and five-card start kits into the registry.

Rewrites ONLY the twelve Early-Access `decks` and `startKits` arrays in `mingmingRegistry.ts`. The
twenty non-EA species are not touched: Henry, 2026-09-21, *"Lets leave the non-EA mingmings for
after EA. Focus only on fire, water and nature."*

Each `os[]` entry in `collection.json` carries `(id, copies, lane, startCopies)`. The deck is the
multiset of `copies`; the start kit is the multiset of `startCopies`, which the collection
guarantees is a sub-multiset of the deck and exactly five cards — `startKits.test.ts` proves both
again on the registry side, so a bad cut fails the gate rather than the playtest.
"""
import json, io, re, os as _os

ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
COL = _os.path.join(ROOT, 'docs/wayfinder/deck-archetypes/collection-v2/collection.json')
REG = _os.path.join(ROOT, 'src/engine/data/mingmingRegistry.ts')

def arrays():
    col = json.load(io.open(COL, encoding='utf-8'))
    out = {}
    for o in col['os']:
        deck, kit = [], []
        for cid, copies, _lane, start in o['kit']:
            deck += [cid] * copies
            kit += [cid] * start
        out[o['id']] = (deck, kit)
    return out

def render(ids, indent):
    return '[' + ', '.join('"%s"' % i for i in ids) + ']'

def main():
    data = arrays()
    s = io.open(REG, encoding='utf-8').read()
    changed = []
    for osid, (deck, kit) in data.items():
        pat = re.compile(r'(^[ \t]*"%s":\s*)\[[^\]]*\]' % re.escape(osid), re.M)
        hits = list(pat.finditer(s))
        assert len(hits) == 2, '%s: expected 2 arrays, found %d' % (osid, len(hits))
        # second first, so the first match's offsets stay valid
        for m, ids in ((hits[1], kit), (hits[0], deck)):
            s = s[:m.start()] + m.group(1) + render(ids, 0) + s[m.end():]
        changed.append('%-16s deck %d  start %d' % (osid, len(deck), len(kit)))
    io.open(REG, 'w', encoding='utf-8', newline='\n').write(s)
    for line in changed: print(line)

if __name__ == '__main__':
    main()
