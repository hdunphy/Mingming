import json, collections, html
from collection import CARDS, OS, RUN_ONLY

C = {c['id']: c for c in CARDS}
assert len(C) == len(CARDS), 'duplicate id'
# ---- validation ----
problems = []
for o in OS:
    n = sum(k[1] for k in o['kit']); starts = sum(k[3] for k in o['kit'])
    if not (8 <= n <= 9): problems.append(f"{o['id']} kit has {n} cards")
    if starts != 5: problems.append(f"{o['id']} start kit has {starts} cards")
    for k in o['kit']:
        assert k[0] in C, (o['id'], k[0])
        if C[k[0]]['shape'] == 'consume' and k[3]: problems.append(f"{o['id']} start kit holds a consume ({k[0]})")
    for p in o['pool']: assert p in C, (o['id'], p)
    for name, ids in o['builds']:
        ids = ids.split(); cnt = collections.Counter(ids)
        for i in ids: assert i in C, (o['id'], name, i)
        if len(ids) != 8: problems.append(f"{o['id']} build '{name}' has {len(ids)} cards")
        if any(v > 2 for v in cnt.values()): problems.append(f"{o['id']} build '{name}' has >2 copies")
    pays = [(C[k[0]]['shape'], C[k[0]]['cur']) for k in o['kit'] if C[k[0]]['shape'] in ('scalar','consume','converter')]
    if (len(pays) < 2 or len({p[1] for p in pays}) < 2) and not any(p[1]=='Energy' for p in pays): problems.append(f"{o['id']} kit payoffs share one currency: {pays}")
    if all(p[0] != 'consume' for p in pays): problems.append(f"{o['id']} kit has no consume (warning)")
print('\n'.join(problems) or 'kits valid')
used = collections.Counter()
for o in OS:
    for k in o['kit']: used[k[0]] += 1
    for p in o['pool']: used[p] += 1
unused = [c['id'] for c in CARDS if used[c['id']] == 0 and c['id'] not in RUN_ONLY]
print('unused:', unused)

COL = {'Fire': '#e05d43', 'Water': '#3d9be0', 'Nature': '#43b45f', 'None': '#8fa0b3'}
TYP = {'Attack': ('#ff9d8f', '<path d="M4 20l6-6M14 4l6 6-9 9-6-6z"/><path d="M3 21l3-3"/>'), 'Skill': ('#8fc7f5', '<path d="M12 3l2.5 5.5L20 10l-4.5 3.5L17 20l-5-3-5 3 1.5-6.5L4 10l5.5-1.5z"/>'),
       'Status': ('#8fc7f5', '<path d="M12 3l2.5 5.5L20 10l-4.5 3.5L17 20l-5-3-5 3 1.5-6.5L4 10l5.5-1.5z"/>'), 'Heal': ('#7fd6a4', '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'), 'Daemon': ('#c9a2f0', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')}
SHAPE = {'enabler': '#7dd3fc', 'scalar': '#ffd479', 'consume': '#f472b6', 'glue': '#9fb4c8', 'hate': '#f87171', 'converter': '#c4b5fd'}
STAT = {'keep': ('#7fd6a4', 'KEEP'), 'revise': ('#ffd479', 'REVISE'), 'new': ('#22d3ee', 'NEW')}
def svg(p): return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{p}</svg>'
def e(s): return html.escape(str(s))

def tile(cid, copies=1, start=False, lane=None, small=False):
    c = C[cid]; el = COL[c['el']]; tc, tp = TYP[c['cat']]
    pips = ''.join('<i></i>' for _ in range(c['cost'])) or '<i class="off"></i>'
    sc, sl = STAT[c['status']]
    why = f' data-why="{e(c.get("why",""))}"' if c.get('why') else ''
    badges = ''
    if start: badges += f'<span class="bd start" title="in the 5-card start kit">★ START{" ×%d"%start if start>1 else ""}</span>'
    if copies > 1: badges += f'<span class="bd x">×{copies}</span>'
    return (f'<div class="rs{" sm" if small else ""}" style="--el:{el}" data-id="{cid}" data-el="{c["el"]}" data-shape="{c["shape"]}" data-status="{c["status"]}" data-cur="{e(c["cur"])}" data-cost="{c["cost"]}"{why}>'
            f'<span class="pipsq">{pips}</span><span class="typ" style="color:{tc}">{svg(tp)}</span>'
            f'<div class="art"></div><div class="cnm">{e(c["name"])}</div><div class="tgt">{e(c["tgt"])}</div><div class="desc">{e(c["text"])}</div>'
            f'<div class="tags"><span class="shape" style="color:{SHAPE[c["shape"]]}">{c["shape"]}</span> · <span class="cur">{e(c["cur"])}</span><span class="st" style="color:{sc};border-color:{sc}">{sl}</span></div>'
            f'<div class="elbar"></div>{badges}</div>')

def build_row(name, ids):
    ids = ids.split(); cnt = collections.Counter(ids); cost = sum(C[i]['cost'] for i in ids)
    curve = collections.Counter(C[i]['cost'] for i in ids)
    shapes = collections.Counter(C[i]['shape'] for i in ids)
    rows = ''.join(f'<div class="rr" style="--el:{COL[C[i]["el"]]}" data-id="{i}"><span class="g">{C[i]["cost"]}</span><span class="nm">{e(C[i]["name"])}</span><span class="sh" style="color:{SHAPE[C[i]["shape"]]}">{C[i]["shape"]}</span>{"<span class=x>×%d</span>"%n if n>1 else ""}</div>' for i, n in sorted(cnt.items(), key=lambda kv: (C[kv[0]]['cost'], C[kv[0]]['name'])))
    cv = ' '.join(f'<span><b>{curve.get(k,0)}</b>{k}e</span>' for k in range(4))
    sh = ' · '.join(f'{v} {k}' for k, v in shapes.most_common())
    return f'<div class="build"><h4>{e(name)}<span class="meta">{cv} · {sh}</span></h4><div class="rows">{rows}</div></div>'

nav = ''; main = ''
for o in OS:
    el = COL[o['el']]
    nav += f'<a href="#{o["id"]}" class="nv" style="--el:{el}"><b>{e(o["sp"])}</b> {e(o["os"])}</a>'
    laneA = [k for k in o['kit'] if k[2] == 'A']; laneB = [k for k in o['kit'] if k[2] == 'B']; glue = [k for k in o['kit'] if k[2] == 'G']
    def lane(title, sub, ks):
        return f'<div class="lane"><h3>{e(title)}<span>{e(sub)}</span></h3><div class="tiles">{"".join(tile(k[0], k[1], k[3]) for k in ks)}</div></div>'
    pool = ''.join(tile(p, small=True) for p in o['pool'])
    partners = ''.join(f'<li><b>{e(a)}</b> — {e(b)}</li>' for a, b in o['partners'])
    builds = ''.join(build_row(n, ids) for n, ids in o['builds'])
    kitn = sum(k[1] for k in o['kit'])
    main += f'''<section id="{o['id']}" class="os" style="--el:{el}">
<header><div class="sp">{e(o['sp'])} <i>· {e(o['el'])}</i></div><h2>{e(o['os'])}</h2><p class="ostext">{e(o['text'])}</p>
<div class="facts"><span><em>currency</em>{e(o['cur'])}</span><span><em>tempo</em>{e(o['tempo'])}</span><span><em>ally output</em>{e(o['ally'])}</span><span><em>kit</em>{kitn} cards · start kit ★ 5</span></div></header>
<div class="lanes">{lane('Lane A · '+o['laneA'][0], o['laneA'][1], laneA)}{lane('Lane B · '+o['laneB'][0], o['laneB'][1], laneB)}<div class="lane glue"><h3>Glue<span>castable from any hand</span></h3><div class="tiles">{"".join(tile(k[0],k[1],k[3]) for k in glue)}</div></div></div>
<div class="pool"><h3>Found in the run<span>seeded into this species’ reward pool and shop — the consumes and the second lane live here</span></h3><div class="tiles">{pool}</div></div>
<div class="two"><div class="builds"><h3>Possible decks<span>8 cards, ≤2 copies; the third is the party build</span></h3>{builds}</div><div class="partners"><h3>Plug and play<span>who feeds, who reads</span></h3><ul>{partners}</ul></div></div>
</section>'''

runonly = ''.join(tile(i) for i in RUN_ONLY)
# ---- collection tab ----
allt = ''.join(tile(c['id']) for c in sorted(CARDS, key=lambda c: (['None','Fire','Water','Nature'].index(c['el']), c['cost'], c['name'])))
# ---- census ----
def table(title, counter, cols):
    rows = ''.join(f'<tr><td>{e(k)}</td>' + ''.join(f'<td>{v.get(c,0)}</td>' for c in cols) + f'<td><b>{sum(v.values())}</b></td></tr>' for k, v in sorted(counter.items(), key=lambda kv: -sum(kv[1].values())))
    return f'<div class="cen"><h3>{e(title)}</h3><table><tr><th></th>{"".join(f"<th>{c}</th>" for c in cols)}<th>all</th></tr>{rows}</table></div>'
by_cur = collections.defaultdict(collections.Counter); by_el = collections.defaultdict(collections.Counter); by_status = collections.Counter(); by_cost = collections.defaultdict(collections.Counter)
for c in CARDS:
    by_cur[c['cur']][c['shape']] += 1; by_el[c['el']][c['shape']] += 1; by_status[c['status']] += 1; by_cost[c['el']][c['cost']] += 1
kit_use = collections.defaultdict(collections.Counter)
for o in OS:
    for k in o['kit']: kit_use[C[k[0]]['cur']]['kits'] += 1
    for p in o['pool']: kit_use[C[p]['cur']]['run pool'] += 1
shapes = ['enabler', 'scalar', 'consume', 'converter', 'glue', 'hate']
census = (table('Cards per currency, by shape', by_cur, shapes) + table('Cards per element, by shape', by_el, shapes)
          + table('Where each currency appears (kit slots vs run pool)', kit_use, ['kits', 'run pool'])
          + table('Cost curve per element', by_cost, [0, 1, 2, 3]))
dup = collections.Counter()
for o in OS:
    for k in o['kit']: dup[k[0]] += 1
dups = ', '.join(f'{C[i]["name"]} ×{n}' for i, n in dup.most_common() if n > 1)
totals = f'<p class="tot"><b>{len(CARDS)} cards</b> — {by_status["keep"]} kept, {by_status["revise"]} revised, {by_status["new"]} new · 12 kits · cards in more than one kit: {e(dups) or "none"} (generics excepted) · unused: {e(", ".join(unused)) or "none"}</p>'

page = f'''<title>Mingming Collection v2</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap">
<style>
:root{{--bg:#07080c;--ink:#dfe4ea;--mute:#7d8ea1;--cyan:#22d3ee;--panel:#0f131a;--line:#232a35;--row:#131820;--rowline:#2b3441;--gold:#ffd479;color-scheme:dark}}
html,body{{background:var(--bg);color:var(--ink);margin:0}}
body{{font-family:'Outfit',system-ui,Avenir,Helvetica,Arial,sans-serif;font-size:14px}}
.top{{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:rgba(7,8,12,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding-block:10px;padding-inline:16px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}}
.top h1{{font-size:14px;letter-spacing:.16em;text-transform:uppercase;margin:0;color:#9fb4c8}} .top h1 b{{color:var(--cyan);font-weight:600}}
.tabs{{display:inline-flex;border:1px solid #2c3745;border-radius:6px;overflow:hidden}}
.tabs button{{background:#12171f;color:#8fa0b3;border:0;border-right:1px solid #2c3745;padding:6px 12px;font:inherit;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}}
.tabs button:last-child{{border-right:0}} .tabs button[aria-pressed="true"]{{background:#1b2431;color:#fff}} .tabs button:focus-visible{{outline:2px solid var(--cyan);outline-offset:-2px}}
.hint{{font-size:11px;color:var(--mute)}}
.wrap{{display:grid;grid-template-columns:230px 1fr;gap:18px;padding-block:16px;padding-inline:16px;max-width:1500px;margin:0 auto}}
.nav{{position:sticky;top:64px;align-self:start;display:flex;flex-direction:column;gap:4px;max-height:calc(100vh - 80px);overflow:auto}}
.nv{{display:block;border:1px solid var(--rowline);border-left:4px solid var(--el);border-radius:3px;background:var(--row);padding:5px 8px;font-size:11.5px;color:var(--ink);text-decoration:none}}
.nv b{{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#9fb4c8}} .nv:hover,.nv:focus-visible{{border-color:#3d9be0;outline:0}}
.os{{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding-block:14px;padding-inline:16px;margin-bottom:22px;scroll-margin-top:70px}}
.os header .sp{{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--el)}} .os header .sp i{{color:var(--mute);font-style:normal}}
.os h2{{margin:2px 0 6px;font-size:22px;letter-spacing:.04em;text-wrap:balance}}
.ostext{{margin:0 0 10px;color:#c6ccd4;max-width:70ch;line-height:1.45}}
.facts{{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;color:#c6ccd4}} .facts em{{font-style:normal;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);display:block}}
h3{{font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#9fb4c8;margin:16px 0 8px;font-weight:600}} h3 span{{display:block;letter-spacing:0;text-transform:none;font-weight:400;color:var(--mute);font-size:11px;margin-top:2px}}
.lanes{{display:grid;grid-template-columns:1fr 1fr auto;gap:14px}} @media(max-width:1100px){{.lanes{{grid-template-columns:1fr}}}}
.lane{{border:1px solid var(--line);border-radius:6px;padding-block:2px 12px;padding-inline:12px;background:#0b0f15}}
.tiles{{display:flex;flex-wrap:wrap;gap:12px 10px}}
.rs{{width:152px;height:200px;border:1px solid #303a48;border-radius:8px;background:linear-gradient(180deg,#171d27 0%,#10151d 100%);position:relative;padding:8px;display:flex;flex-direction:column;box-shadow:0 3px 10px #0007;text-align:center;box-sizing:border-box;flex:none}}
.rs.sm{{width:128px;height:172px}} .rs.sm .cnm{{font-size:11px}} .rs.sm .desc{{font-size:9px}} .rs.sm .art{{height:32px;margin-top:14px}}
.rs .pipsq{{position:absolute;top:7px;left:7px;display:flex;gap:3px}} .rs .pipsq i{{width:9px;height:9px;border-radius:2px;background:var(--el);box-shadow:0 0 5px var(--el);display:block}} .rs .pipsq i.off{{background:#2a323d;box-shadow:none}}
.rs .typ{{position:absolute;top:4px;right:7px;line-height:1}} .rs .typ svg{{width:14px;height:14px}}
.rs .art{{height:44px;border-radius:5px;margin:16px 0 5px;background:repeating-linear-gradient(45deg,transparent 0 6px,#ffffff08 6px 12px),linear-gradient(135deg,var(--el) 0%,#0c0e12 130%);opacity:.85;flex:none}}
.rs .cnm{{font-size:12.5px;font-weight:700;line-height:1.1;margin-bottom:2px}} .rs .tgt{{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#9fb4c8;margin-bottom:3px}}
.rs .desc{{font-size:10px;color:#aeb9c6;line-height:1.3;flex:1;overflow:hidden}}
.rs .tags{{font-size:8.5px;color:#7d8ea1;letter-spacing:.3px;display:flex;gap:3px;align-items:center;justify-content:center;flex-wrap:wrap}} .rs .tags .st{{border:1px solid;border-radius:3px;padding:0 4px;font-weight:700;font-size:7.5px;margin-left:3px}}
.rs .elbar{{position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0 0 8px 8px;background:var(--el)}}
.bd{{position:absolute;font-size:8.5px;font-weight:800;letter-spacing:.08em;border-radius:3px;padding:2px 6px;border:2px solid #0c0e12}} .bd.start{{top:-9px;left:50%;transform:translateX(-50%);background:var(--gold);color:#0c0e12;white-space:nowrap}} .bd.x{{bottom:-10px;right:-8px;background:var(--gold);color:#0c0e12;border-radius:11px;font-size:11px}}
.rs[data-why]{{cursor:help}} .rs[data-why]:hover::after{{content:attr(data-why);position:absolute;left:0;right:0;top:100%;margin-top:6px;z-index:9;background:#0b0d11;border:1px solid var(--cyan);border-radius:6px;padding:6px 8px;font-size:10.5px;color:#9fb4c8;text-align:left;line-height:1.35}}
.pool .tiles{{gap:14px 10px;padding-top:6px}}
.two{{display:grid;grid-template-columns:1fr 320px;gap:18px}} @media(max-width:1000px){{.two{{grid-template-columns:1fr}}}}
.build{{margin-bottom:10px}} .build h4{{font-size:12px;margin:8px 0 4px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}} .build h4 .meta{{font-weight:400;font-size:10.5px;color:var(--mute)}} .build h4 .meta b{{color:var(--gold);margin-right:2px}}
.rows{{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:3px}}
.rr{{display:flex;align-items:center;gap:7px;border:1px solid var(--rowline);border-left:4px solid var(--el);border-radius:3px;background:var(--row);padding:3px 7px;height:27px;font-size:11.5px;box-sizing:border-box}}
.rr .g{{width:17px;height:17px;border-radius:50%;background:var(--el);color:#0c0e12;font-weight:700;font-size:10.5px;display:flex;align-items:center;justify-content:center;flex:none}} .rr .nm{{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}} .rr .sh{{font-size:8.5px;letter-spacing:.06em;text-transform:uppercase}} .rr .x{{color:var(--gold);font-weight:700;font-size:11px}}
.partners ul{{margin:0;padding-left:16px;font-size:12px;line-height:1.5;color:#c6ccd4}} .partners b{{color:var(--ink)}}
.filters{{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}} .chip{{border:1px solid #2c3745;background:#12171f;color:#8fa0b3;border-radius:999px;padding:3px 10px;font:inherit;font-size:11px;cursor:pointer}} .chip[aria-pressed="true"]{{background:#1b2431;color:#fff;border-color:#3d9be0}} .chip:focus-visible{{outline:2px solid var(--cyan)}}
.cen{{margin-bottom:18px}} table{{border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}} th,td{{border:1px solid var(--line);padding:4px 9px;text-align:right}} td:first-child,th:first-child{{text-align:left}} th{{color:#9fb4c8;font-weight:600;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase}}
.tot{{color:#c6ccd4;font-size:12.5px;line-height:1.5;max-width:90ch}}
.legend{{font-size:11px;color:var(--mute);display:flex;flex-wrap:wrap;gap:12px}} .legend i{{font-style:normal;font-weight:700}}
[hidden]{{display:none!important}}
@media(max-width:900px){{.wrap{{grid-template-columns:1fr}} .nav{{position:static;max-height:none;flex-direction:row;flex-wrap:wrap}} .nv{{flex:1 1 140px}}}}
@media(prefers-reduced-motion:reduce){{*{{scroll-behavior:auto}}}}
</style>
<div class="top"><h1>Mingming · <b>Collection v2</b> — the EA twelve</h1>
<div class="tabs" role="tablist"><button id="tDecks" aria-pressed="true">Decks by OS</button><button id="tCards" aria-pressed="false">Collection</button><button id="tCensus" aria-pressed="false">Census</button></div>
<span class="legend"><i style="color:{SHAPE['enabler']}">enabler</i><i style="color:{SHAPE['scalar']}">scalar</i><i style="color:{SHAPE['consume']}">consume</i><i style="color:{SHAPE['converter']}">converter</i><i style="color:{SHAPE['glue']}">glue</i><i style="color:{SHAPE['hate']}">hate</i> · ★ = start kit · hover a NEW/REVISE card for why</span></div>
<div class="wrap" id="vDecks"><nav class="nav">{nav}<a href="#runonly" class="nv" style="--el:#c9a2f0"><b>Run only</b> daemons &amp; party ramp</a></nav><main>{main}<section id="runonly" class="os" style="--el:#c9a2f0"><header><div class="sp">Run only</div><h2>Never in a kit — found in the run</h2><p class="ostext">The hate daemons, the two ramp daemons (160-r1/r2) and Tidal Battery: reward-pool and shop cards any party can take, chosen against the enemy hand 159 shows you.</p></header><div class="tiles" style="padding-top:8px">{runonly}</div></section></main></div>
<div class="wrap" id="vCards" hidden style="grid-template-columns:1fr"><div>
<div class="filters" id="filters">
<span class="hint">element:</span><button class="chip" data-k="el" data-v="Fire" aria-pressed="false">Fire</button><button class="chip" data-k="el" data-v="Water" aria-pressed="false">Water</button><button class="chip" data-k="el" data-v="Nature" aria-pressed="false">Nature</button><button class="chip" data-k="el" data-v="None" aria-pressed="false">None</button>
<span class="hint">shape:</span>{"".join(f'<button class="chip" data-k="shape" data-v="{s}" aria-pressed="false">{s}</button>' for s in shapes)}
<span class="hint">status:</span><button class="chip" data-k="status" data-v="new" aria-pressed="false">new</button><button class="chip" data-k="status" data-v="revise" aria-pressed="false">revise</button><button class="chip" data-k="status" data-v="keep" aria-pressed="false">keep</button>
<span class="hint">currency:</span>{"".join(f'<button class="chip" data-k="cur" data-v="{e(k)}" aria-pressed="false">{e(k)}</button>' for k in sorted(by_cur))}
</div>{totals}<div class="tiles" id="allTiles">{allt}</div></div></div>
<div class="wrap" id="vCensus" hidden style="grid-template-columns:1fr"><div>{totals}{census}</div></div>
<script>
const views={{tDecks:vDecks,tCards:vCards,tCensus:vCensus}};
for(const id in views) document.getElementById(id).addEventListener('click',()=>{{for(const k in views){{views[k].hidden=k!==id;document.getElementById(k).setAttribute('aria-pressed',String(k===id));}} try{{localStorage.setItem('cv2-tab',id)}}catch(e){{}}}});
try{{const t=localStorage.getItem('cv2-tab'); if(t&&views[t]) document.getElementById(t).click();}}catch(e){{}}
const active={{}};
document.querySelectorAll('#filters .chip').forEach(b=>b.addEventListener('click',()=>{{const k=b.dataset.k,v=b.dataset.v; active[k]=active[k]===v?null:v; document.querySelectorAll(`#filters .chip[data-k="${{k}}"]`).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===active[k]))); document.querySelectorAll('#allTiles .rs').forEach(t=>{{t.hidden=Object.entries(active).some(([kk,vv])=>vv&&t.dataset[kk]!==vv)}});}}));
</script>'''
open('browser.html', 'w', encoding='utf-8').write(page)
json.dump({'cards': CARDS, 'os': OS, 'run_only': RUN_ONLY}, open('collection.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
print(len(page)//1024, 'KB', len(CARDS), 'cards')
