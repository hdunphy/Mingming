"""Apply one ticket-143 card arm. Usage: python3 scratch/row143.py <arm>  (base|a1|a2|b|off_b)"""
import json, collections, sys

P = 'src/engine/data/programs.json'
BASE = {
    'ragnarok_edge': {'baseCost': 2, 'power': 30,
                      'desc': '30 power. +0.7 power per 1% of your max HP missing (max 50%).'},
}

def load():
    return json.loads(open(P, encoding='utf-8').read(), object_pairs_hook=collections.OrderedDict)

def save(d):
    open(P, 'w', encoding='utf-8').write(json.dumps(d, indent=4, ensure_ascii=False) + '\n')

def od(*p):
    return collections.OrderedDict(p)

def set_edge(d, cost, power):
    c = d['ragnarok_edge']
    c['baseCost'] = cost
    c['description'] = f'{power} power. +0.7 power per 1% of your max HP missing (max 50%).'
    for a in c['actions']:
        if a['type'] == 'ATTACK':
            a['power'] = power

def fang_half(d):
    """Read the whole pile, then keep half of it.

    `consume: true` is all-or-nothing and there is no half-consume in the action schema — but
    `consume` RECORDS what it took in `lastStatusConsumed`, and `scaling: 'STATUS_CONSUMED'` with a
    fractional `stacks` floors (ticket 69 built that for `discharge`'s "1 Burn per 2 removed"). So
    strip the pile and hand back floor(n/2). No engine row.
    """
    c = d['unbound_fang']
    c['description'] = 'Deal 5 power for each stack of Strengthened you hold, then lose half of them.'
    c['actions'] = [
        od(('type', 'ATTACK'), ('power', 5), ('scaling', 'STRENGTH_STACKS'), ('target', 'TARGET')),
        od(('type', 'STATUS'), ('status', 'Strengthened'), ('consume', True), ('target', 'SELF')),
        od(('type', 'STATUS'), ('status', 'Strengthened'), ('stacks', 0.5),
           ('scaling', 'STATUS_CONSUMED'), ('target', 'SELF')),
    ]

def fang_base(d):
    c = d['unbound_fang']
    c['description'] = 'Deal 5 power for each stack of Strengthened you hold.'
    c['actions'] = [od(('type', 'ATTACK'), ('power', 5), ('scaling', 'STRENGTH_STACKS'), ('target', 'TARGET'))]

arm = sys.argv[1]
d = load()
if arm == 'base':
    set_edge(d, 2, 30); fang_base(d)
elif arm == 'a1':
    set_edge(d, 1, 20); fang_base(d)
elif arm == 'a2':
    set_edge(d, 2, 50); fang_base(d)
elif arm == 'b':
    set_edge(d, 2, 30); fang_half(d)
elif arm == 'a1b':
    set_edge(d, 1, 20); fang_half(d)
elif arm == 'a2b':
    set_edge(d, 2, 50); fang_half(d)
else:
    raise SystemExit(f'unknown arm {arm}')
save(d)
print('arm', arm, '->', d['ragnarok_edge']['baseCost'], 'e', d['ragnarok_edge']['description'][:12], '|', d['unbound_fang']['description'][:60])
