"""Ticket 07 prototype: seeded region-graph generator + SVG dump. Parameters are the knobs Henry rules."""
import random, json, sys

PARAMS = dict(
    biomes=["Fire", "Water", "Nature"],
    layers_per_biome=5,          # entry, mid, mid, exit (exit of biome 3 = the gym)
    width=3,                     # max nodes per middle layer
    pocket_per_biome=1,          # dead-end side nodes (farm / alpha), return to where you came from
    mix=dict(wild=0.60, elite=0.10, market=0.08, event=0.14, workshop=0.08),
    see_ahead=2,                 # layers of node TYPES visible ahead of the player's layer
    workshop_guarantee=True,     # exactly one workshop per biome, placed in a middle layer
    market_guarantee=True,       # exactly one market per biome
)

ICON = dict(wild="W", elite="E", market="$", event="?", workshop="K", gym="G", entry="S", alpha="A", ambush="X")

def gen(seed, P=PARAMS):
    rng = random.Random(seed)
    nodes, edges = [], []
    nid = 0
    def add(biome, layer, kind, x):
        nonlocal nid
        n = dict(id=nid, biome=biome, layer=layer, kind=kind, x=x); nodes.append(n); nid += 1; return n
    prev_layer = None
    glayer = 0
    for bi, biome in enumerate(P["biomes"]):
        # layer 0 of biome: entry (biome 0) or single connector node
        entry = add(biome, glayer, "entry" if bi == 0 else "wild", 1)
        if prev_layer:
            for p in prev_layer: edges.append((p["id"], entry["id"]))
        prev_layer = [entry]; glayer += 1
        mids = []
        for li in range(P["layers_per_biome"] - 2):
            w = rng.randint(2, P["width"])
            layer = [add(biome, glayer, "wild", x) for x in range(w)]
            # connect: each prev node -> 1-2 next nodes, each next node has >=1 incoming
            for p in prev_layer:
                for t in rng.sample(layer, min(len(layer), rng.randint(1, 2))): edges.append((p["id"], t["id"]))
            for t in layer:
                if not any(e[1] == t["id"] for e in edges): edges.append((rng.choice(prev_layer)["id"], t["id"]))
            # lateral edge (explorable, not lanes)
            if len(layer) >= 2 and rng.random() < 0.6:
                a, b = rng.sample(layer, 2); edges.append((a["id"], b["id"]))
            mids += layer; prev_layer = layer; glayer += 1
        # assign kinds to middle nodes
        kinds = []
        if P["workshop_guarantee"]: kinds.append("workshop")
        if P["market_guarantee"]: kinds.append("market")
        pool = [k for k in P["mix"] for _ in range(int(P["mix"][k] * 20))]
        while len(kinds) < len(mids): kinds.append(rng.choice(pool))
        rng.shuffle(kinds)
        for n, k in zip(mids, kinds): n["kind"] = k
        # pockets: dead-end farm nodes hanging off a middle node
        for _ in range(P["pocket_per_biome"]):
            host = rng.choice(mids)
            pk = add(biome, host["layer"], rng.choice(["wild", "wild", "alpha", "ambush"]), -1)
            pk["pocket"] = True; edges.append((host["id"], pk["id"])); edges.append((pk["id"], host["id"]))
        # exit: biome boss-gate node (wild) or the gym
        ex = add(biome, glayer, "gym" if bi == len(P["biomes"]) - 1 else "elite", 1)
        for p in prev_layer: edges.append((p["id"], ex["id"]))
        prev_layer = [ex]; glayer += 1
    return dict(seed=seed, params=P, nodes=nodes, edges=edges)

FIGHT = {"wild", "elite", "alpha", "ambush"}
def fight_envelope(g):
    """min and max fights on any entry->gym path (pockets excluded from min, included once each in max)."""
    from functools import lru_cache
    out = {}
    for a, b in g["edges"]: out.setdefault(a, []).append(b)
    gym = [n for n in g["nodes"] if n["kind"] == "gym"][0]["id"]
    byid = {n["id"]: n for n in g["nodes"]}
    @lru_cache(None)
    def mn(i):
        c = 1 if byid[i]["kind"] in FIGHT else 0
        if i == gym: return c
        nxt = [j for j in out.get(i, []) if not byid[j].get("pocket") and byid[j]["layer"] > byid[i]["layer"]]
        return c + min(mn(j) for j in nxt)
    @lru_cache(None)
    def mx(i):
        c = 1 if byid[i]["kind"] in FIGHT else 0
        if i == gym: return c
        nxt = [j for j in out.get(i, []) if not byid[j].get("pocket") and byid[j]["layer"] > byid[i]["layer"]]
        return c + max(mx(j) for j in nxt)
    pockets = sum(1 for n in g["nodes"] if n.get("pocket") and n["kind"] in FIGHT)
    return mn(0), mx(0) + pockets

COLOR = dict(Fire="#c0392b", Water="#2980b9", Nature="#27ae60")
def svg(g, player_layer=0):
    P = g["params"]; W, H = 1100, 480; ly = max(n["layer"] for n in g["nodes"]) + 1
    sx = W / (ly + 1); sy = 90
    pos = {n["id"]: (sx * (n["layer"] + 1), 140 + sy * n["x"]) for n in g["nodes"]}
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" style="background:#111;font-family:monospace">']
    for a, b in g["edges"]:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#555" stroke-width="2"/>')
    for n in g["nodes"]:
        x, y = pos[n["id"]]; vis = n["layer"] <= player_layer + P["see_ahead"]
        fill = COLOR.get(n["biome"], "#888") if vis else "#333"
        lab = ICON[n["kind"]] if vis else "·"
        r = 22 if n["kind"] in ("gym", "elite", "alpha") else 17
        o.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{"#fff" if n.get("pocket") else "#000"}" stroke-width="2"/>')
        o.append(f'<text x="{x}" y="{y+5}" text-anchor="middle" fill="#fff" font-size="15" font-weight="bold">{lab}</text>')
    mn, mx = fight_envelope(g)
    o.append(f'<text x="10" y="{H-12}" fill="#ccc" font-size="13">seed {g["seed"]} · fights to gym: min {mn} / max {mx} (+3 gauntlet) · W wild, E elite, $ market, ? event, K workshop, A alpha, X ambush (white ring = pocket/dead-end), G gym · grey = beyond visibility ({P["see_ahead"]} layers)</text>')
    o.append("</svg>"); return "\n".join(o)

if __name__ == "__main__":
    seeds = [int(s) for s in sys.argv[1:]] or [1, 2, 3]
    for s in seeds:
        g = gen(s); open(f"/root/sr/proto07/graph_{s}.svg", "w").write(svg(g))
        print(s, "nodes", len(g["nodes"]), "fights", fight_envelope(g))
