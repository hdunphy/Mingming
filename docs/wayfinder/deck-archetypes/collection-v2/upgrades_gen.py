# 163a — the + generator. Henry's rules (2026-09-23):
#   status stacks: +(1 + energy cost)  → 0e +1, 1e +2, 2e +3, 3e +4
#   raw numbers (flat power, per-stack scalars/consumes, daemon numbers): +40%, band-rounded to 5 (min +3)
#   draw / Energized: +1 card / +1 stack (unchanged from the first draft)
#   multi-hit: +1 hit at the same per-hit power
#   ally-target: also the caster · side buffs: +1 stack per ally
import re, json
from collection import CARDS
RATE = 1.40
def up(v, mn=3): return max(v + mn, int(round(v * RATE / 5.0) * 5))
def stacks(cost): return 1 + cost
STATUS = r'(Burn|Weakened|Dazed|Poison|Strength|Sharp|Bark Shield|Regen)'
out = []
for c in CARDS:
    t = c['text']; sh = c['shape']; cat = c['cat']; cost = c['cost']; k = stacks(cost)
    new = None; rule = None
    m_multi = re.search(r'(\d+) power, (twice|three times)', t) or re.search(r'Three strikes of (\d+) power', t)
    if m_multi:
        if 'Three strikes' in t: new = t.replace('Three strikes', 'Four strikes')
        elif m_multi.group(2) == 'twice': new = t.replace('power, twice', 'power, three times')
        else: new = t.replace('power, three times', 'power, four times')
        rule = 'multi-hit: +1 hit'
    elif cat == 'Daemon':
        m = re.search(r'(\d+) power', t)
        if 'Max 3 per turn' in t: new = t.replace('Max 3 per turn', 'Max 5 per turn'); rule = 'daemon: cap widens'
        elif 'Max Energy +1' in t: new = 'Daemon (exhaust): Max Energy +1 for the rest of the battle, and gain 1 Energized now.'; rule = 'daemon: adds an immediate effect'
        elif '+20% damage per stack' in t: new = t.replace('+20%', '+30%'); rule = 'daemon: number +40%'
        elif '50% more damage' in t: new = t.replace('50% more damage', '75% more damage'); rule = 'daemon: number +50%'
        elif 'also add 1 Sharp' in t: new = t.replace('1 Sharp', f'{1+k} Sharp'); rule = f'daemon: +{k} stacks (1 + cost)'
        elif 'the attacker gains 1 Burn' in t: new = t.replace('1 Burn', f'{1+k} Burn'); rule = f'daemon: +{k} stacks (1 + cost)'
        elif 'Feedback token' in t: new = 'Daemon (exhaust): whenever you play a 0-cost card, generate a 0-cost Feedback token in your hand — two the first time each turn.'; rule = 'daemon: trigger widens'
        elif m: new = t.replace(f'{m.group(1)} power', f'{up(int(m.group(1)))} power'); rule = 'daemon: number +40%'
    elif sh == 'scalar' and re.search(r'\+(\d+) power per', t):
        v = int(re.search(r'\+(\d+) power per', t).group(1)); new = t.replace(f'+{v} power per', f'+{up(v, 2)} power per'); rule = 'scalar: per-stack +40%'
    elif sh in ('scalar', 'consume') and re.search(r'(\d+) power per', t):
        v = int(re.search(r'(\d+) power per', t).group(1)); new = t.replace(f'{v} power per', f'{up(v, 2)} power per'); rule = f'{sh}: per-stack +40%'
    elif sh == 'consume' and 'lose half of them' in t: new = t.replace('lose half of them', 'lose a third of them'); rule = 'consume: keeps more of the pile'
    elif sh == 'consume' and 'trigger Poison damage immediately' in t: new = t.replace('Apply 1 Poison', f'Apply {1+k} Poison'); rule = f'consume: +{k} stacks (1 + cost)'
    elif sh == 'consume' and 'per Weakened on the target' in t: new = 'Apply 1 Poison per Weakened on the target and deal 7 power per Weakened, then remove the Weakened.'; rule = 'consume: damage rider per stack'
    elif c['tgt'] == 'Ally':
        new = {'tend': 'An ally and you each gain 1 Sharp and heal with 8 power.', 'mend': 'Heal an ally with 20 power, and yourself with 10.',
               'soothe': 'Remove 1 stack of a debuff from an ally, and 1 from yourself.', 'bolster': 'An ally and you gain 3 Sharp.', 'shell_share': 'An ally and you gain 6 Bark Shield.'}[c['id']]; rule = 'ally-target: also the caster'
    elif c['tgt'] == 'AllySide' and 'gains' in t:
        new = re.sub(r'gains? (\d+)', lambda m: 'gains %d' % (int(m.group(1)) + 1), t, count=1); rule = 'side buff: +1 stack per ally'
    elif re.search(r'Apply (\d+) ' + STATUS, t) and sh in ('enabler', 'converter'):
        new = re.sub(r'Apply (\d+) ' + STATUS, lambda m: f'Apply {int(m.group(1))+k} {m.group(2)}', t, count=1); rule = f'status: +{k} stacks (1 + cost)'
    elif re.search(r'[Gg]ain (\d+) ' + STATUS, t) and sh == 'enabler' and 'Energized' not in t:
        new = re.sub(r'([Gg]ain) (\d+) ' + STATUS, lambda m: f'{m.group(1)} {int(m.group(2))+k} {m.group(3)}', t, count=1); rule = f'status: +{k} stacks (1 + cost)'
    elif 'Energized' in t and sh == 'enabler':
        new = re.sub(r'(\d+) Energized', lambda m: f'{int(m.group(1))+1} Energized', t, count=1); rule = 'Energized: +1'
    elif 'Draw 1. Take damage equal to 15 power' in t: new = t.replace('15 power', '8 power'); rule = 'draw: drawback halves'
    elif t.startswith('Draw a card. You gain 1 Weakened'): new = 'Draw 2 cards. You gain 1 Weakened.'; rule = 'draw: +1 card'
    elif t.startswith('Draw 2.'): new = 'Draw 3.'; rule = 'draw: +1 card'
    elif 'Draw a Water card' in t: new = 'Draw 2 Water cards.'; rule = 'draw: +1 card'
    elif re.search(r'(\d+) power', t):
        v = int(re.search(r'(\d+) power', t).group(1)); new = t.replace(f'{v} power', f'{up(v)} power', 1); rule = 'flat: +40%'
    if c['id'] == 'heat_wave': new = f"Double the enemy side's Burn stacks, then apply {k} more to each."; rule = f'consume: +{k} stacks after (1 + cost) — past the cap of 4 it detonates, which is the point (Henry: upgrades are supposed to be broken)'
    if c['id'] == 'contagion': new = f"Double the target's Poison stacks, then apply {k} more."; rule = f'enabler: +{k} stacks after (1 + cost)'
    if c['id'] == 'bark_lash': new = '2 power per point of Bark Shield you hold.'; rule = 'scalar: per-point +1 (0e; +40% of 1 rounds to nothing)'
    if c['id'] == 'ragnarok_edge': new = '30 power. +1 power per 1% of your max HP missing (max 50%).'; rule = 'scalar: base +40% (the per-1% is capped)'
    if c['id'] == 'heartwood': new = f'Gain {6+k} Bark Shield. Apply 1 Poison to the target.'; rule = f'status: +{k} Bark (its currency; 1 + cost)'
    if c['id'] == 'war_pact': new = f'Above half HP: gain {2+k} Strength and 2 Dazed. Below half: heal with 15 power.'; rule = f'status: +{k} Strength (1 + cost), the Dazed does not grow'
    if c['id'] == 'corrosive_leak': new = 'Poison yourself 2 stacks. Gain 2 Energized.'; rule = 'Energized: +1'
    out.append(dict(id=c['id'], name=c['name'], cost=cost, text=t, plus=new or '(review)', rule=rule or 'REVIEW'))
json.dump(out, open('upgrades.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(out), 'lines;', sum(1 for o in out if o['rule'] == 'REVIEW'), 'to review')
