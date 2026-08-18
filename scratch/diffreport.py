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
# card budget redlines
ra={r.get('cardId') or r.get('id') for r in a['cardBudget']['redlines']}
rb={r.get('cardId') or r.get('id') for r in b['cardBudget']['redlines']}
print('\ncard redlines ADDED:', sorted(rb-ra))
print('card redlines REMOVED:', sorted(ra-rb))
