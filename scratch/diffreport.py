import json, sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
ma={m['id']:m for m in a['matchups']}; mb={m['id']:m for m in b['matchups']}
print(f"summary before {a['summary']}\nsummary after  {b['summary']}\n")
moved=[]
for k in sorted(set(ma)|set(mb)):
    x,y=ma.get(k),mb.get(k)
    if not x or not y: print('ONLY IN ONE:',k); continue
    dw=(y['winRate']-x['winRate'])*100
    if abs(dw)>=0.5: moved.append((abs(dw),k,x['winRate']*100,y['winRate']*100,dw,x['deadCardRatio'],y['deadCardRatio'],x['ftkCount'],y['ftkCount']))
moved.sort(reverse=True)
print(f"{len(moved)} matchup rows moved >= 0.5 points (of {len(ma)})")
print(f"{'row':<52}{'before':>8}{'after':>8}{'delta':>8}{'dead b/a':>14}{'ftk':>8}")
for _,k,x,y,d,db,da,fb,fa in moved:
    print(f"{k:<52}{x:>7.1f}%{y:>7.1f}%{d:>+8.1f}{db:>7.3f}/{da:<6.3f}{fb:>4}/{fa:<4}")

# Card budget. Ticket 149c-5 split section 1.3 in two: `redlines` is past the +/-15% tolerance,
# `watchlist` is inside it plus the MANUAL REVIEW tail. A report written before schemaVersion 3
# has no watchlist, so it reads as empty rather than crashing the diff — an old report is still
# worth diffing against, it just has nothing to say about the split.
def ids(report, key):
    return {r.get('cardId') or r.get('id') for r in report['cardBudget'].get(key, [])}

for key, label in (('redlines', 'card redlines'), ('watchlist', 'watchlist')):
    ra, rb = ids(a, key), ids(b, key)
    print(f'\n{label} ADDED:', sorted(rb-ra))
    print(f'{label} REMOVED:', sorted(ra-rb))

# And the one movement the two lists hide between them: a card that stopped being a violation and
# became merely watched, or the reverse. Neither set-difference above says which happened.
def verdicts(report):
    out = {}
    for key in ('redlines', 'watchlist'):
        for r in report['cardBudget'].get(key, []):
            out[r.get('cardId') or r.get('id')] = (r.get('verdict', key), r.get('pctVsBand'))
    return out
va, vb = verdicts(a), verdicts(b)
changed = [(k, va[k], vb[k]) for k in sorted(set(va) & set(vb)) if va[k] != vb[k]]
if changed:
    print('\nverdict or percentage changed:')
    for k, x, y in changed:
        print(f'  {k:<24} {x[0]} {x[1]}%  ->  {y[0]} {y[1]}%')
