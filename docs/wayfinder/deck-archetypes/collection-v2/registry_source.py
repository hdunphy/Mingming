"""
TICKET 162d — make `collection.py`'s data the REGISTRY's data, when the registry has been exported.

# WHY THIS IS ITS OWN FILE

It was inlined at the top of `build.py` and has been lost twice in one evening (163a, twice), both
times because that script was edited from a working copy taken before 162d landed. The loss is
SILENT: the page still renders, it just describes the draft collection rather than the one in the
game — on the exact surface a pricing decision gets read off.

A separate module does not prevent that, so it is not the fix. The fix is `collectionBrowser.test.ts`,
which fails the gate if `build.py` stops calling this. The module exists so that the thing the test
guards is one line rather than fifty, and so re-applying it after a collision is an import rather
than a merge.

# WHAT IT DOES

`npm run decks` writes `registry.json` here (`src/debug/balance/collectionExport.ts`). This reads it
and overwrites the design file's per-card face (name, cost, element, category, target, text), kits,
pools and run-only list with the shipped ones. It deliberately does NOT touch 158 §2's `shape` and
`cur` tags: the engine has no field for "what job does this card do", so the design file stays their
source and they are carried across rather than invented.

`--design` forces the old behaviour, and so does a missing `registry.json` — anyone without a Node
toolchain still gets a page.
"""
import json
import os
import sys


def apply(cards, os_list, run_only, argv=None):
    """
    Returns `(cards, os_list, run_only, from_registry)`.

    Mutates the dicts inside `cards` and `os_list` in place, which is what lets the caller keep its
    own module-level names pointing at the same objects.
    """
    argv = sys.argv if argv is None else argv
    if '--design' in argv or not os.path.exists('registry.json'):
        print('source: collection.py (the design draft)')
        return cards, os_list, run_only, False

    reg = json.load(open('registry.json', encoding='utf-8'))
    by_id = {c['id']: c for c in reg['cards']}

    for card in cards:
        shipped = by_id.get(card['id'])
        if shipped:
            for key in ('name', 'cost', 'el', 'cat', 'tgt', 'text'):
                card[key] = shipped[key]

    known = {c['id'] for c in cards}
    # Design-file cards the registry does not ship are dropped; registry cards the design file has
    # never heard of are appended with whatever tags they came with (an empty `shape` renders as
    # unclassified, which is the honest picture of "somebody added a card and did not tag it").
    cards = [c for c in cards if c['id'] in by_id] + [c for c in reg['cards'] if c['id'] not in known]

    os_by_id = {o['id']: o for o in reg['os']}
    for entry in os_list:
        shipped = os_by_id.get(entry['id'])
        if shipped:
            entry['kit'] = [list(k) for k in shipped['kit']]
            entry['pool'] = list(shipped['pool'])
            entry['os'] = shipped['os'] or entry['os']
            entry['text'] = shipped['text'] or entry['text']

    print('source: registry.json (%d cards, %d OS)' % (len(cards), len(os_list)))
    return cards, os_list, list(reg['run_only']), True
