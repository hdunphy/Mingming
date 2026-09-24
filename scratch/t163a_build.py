#!/usr/bin/env python3
"""
TICKET 163a — THE `+` REGISTRY. Every card's upgraded form, built from the ruled table.

§4: *"163a — the `+` registry. Read `collection-v2/upgrades.json`; for every entry add a
`programs.json` card `id: "<id>+"`, `name: "<name>+"`, same cost/element/category/target/shape,
`upgradeOf: "<id>"`, text = `plus`."*

# THE PROBLEM THIS SCRIPT EXISTS TO SOLVE

`upgrades.json` is a TEXT table. `upgrades_gen.py` produced it by regex over each card's printed
text, which is the right instrument for a table Henry reads and rules on — and completely the wrong
one for a card that has to resolve in a battle. A `+` card whose text says 20 and whose action says
15 is worse than no upgrade at all: it is a card that lies, and nothing in the suite would notice.

So this script does not read the `plus` TEXT and try to write actions from prose. It reads the
BASE CARD'S ACTIONS and moves the same numbers the text moved, then **proves the two agree**:
`verify()` walks every `+` card, pulls the numbers out of its printed text, and fails the build if
a number in the text has no matching number in the actions. That check is the whole point of the
file. It is why the generic path below is allowed to be clever — it cannot be quietly wrong.

# THE THREE PATHS

1. **Generic** (66 cards). The text moved N numbers; the actions move the same N. Each number is
   matched to an action FIELD by what the text calls it — "20 power" to a `power`, "3 Burn" to a
   Burn `stacks`, "Draw 3" to a DRAW `amount`. Ambiguity is not guessed at: if a number matches no
   field, or two, the card is REJECTED into the hand-authored table rather than picked between.
2. **Hand-authored** (`PLUS_ACTIONS`, 20 cards). Every card whose `+` ADDS a verb rather than
   moving a number — the five "and you" ally cards, Heat Wave's and Contagion's second application,
   Hexbloom's damage rider, Overclock Core's Energized. Prose does not compile; these are written.
3. **Hooks** (12 daemons). A daemon's number lives in `lib/hooks.json`, not in its actions, so its
   `+` needs its own hook entries. `<id>+` gets hooks `<hookid>+`, and `daemonHooks.ts` registers
   any `<key>+` beside its base key — see the note there.

# WHAT A `+` CARD IS NOT

It is not reachable. `upgradeOf` makes it unrewardable (`RewardSystem.isRewardable`), and until
163b builds the workshop tab there is no other way into a deck. That is deliberate: this row puts
the cards in the registry so Henry can read them, price them and cast them, and shipping them into
reward pools is a separate decision on a separate row.

Run: python3 scratch/t163a_build.py            (build + verify + report)
     python3 scratch/t163a_build.py --dry      (verify and report; write nothing)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPG = os.path.join(ROOT, 'docs/wayfinder/deck-archetypes/collection-v2/upgrades.json')
PRG = os.path.join(ROOT, 'src/engine/data/programs.json')
HKS = os.path.join(ROOT, 'src/engine/data/lib/hooks.json')

# The collection prints statuses the way a player reads them; the engine spells two of them
# differently. One table, so a rename lands in one place.
STATUS_WORD = {
    'Burn': 'Burn', 'Poison': 'Poison', 'Dazed': 'Dazed', 'Weakened': 'Weakened',
    'Sharp': 'Sharp', 'Regen': 'Regen', 'Energized': 'Energized',
    'Strength': 'Strengthened', 'Strengthened': 'Strengthened',
    'Bark Shield': 'BarkShield', 'BarkShield': 'BarkShield',
}
STATUS_RE = '|'.join(sorted(STATUS_WORD, key=len, reverse=True))

A  = lambda p, **kw: dict(type='ATTACK', power=p, target='TARGET', **kw)
S  = lambda st, n, tgt='TARGET', **kw: dict(type='STATUS', status=st, stacks=n, target=tgt, **kw)
H  = lambda p, tgt='SELF', **kw: dict(type='HEAL', power=p, target=tgt, **kw)


# =================================================================================================
# PATH 2 — THE HAND-AUTHORED `+` ACTIONS.
#
# One entry per card whose `+` is a new VERB. Everything else goes through `generic()`, and a card
# that appears here is skipped by it entirely — so this table is a statement that the generic path
# CANNOT do this card, not a nudge to help it along.
# =================================================================================================
PLUS_ACTIONS = {
    # --- the five ally cards: "also the caster" -------------------------------------------------
    # 160-e1's `allyTarget` picks ONE friendly body, and the caster is a legal pick. So "an ally and
    # you" is the aimed action plus a SELF copy, and aiming a `+` at yourself pays twice. That is a
    # real wrinkle and it is NOT resolved here — the engine has no "a DIFFERENT ally" target, and
    # inventing one inside an upgrade row is how a targeting rule gets decided by accident. Flagged
    # for Henry in the write-up; the double is measurable and not silent.
    'soothe+':      [S('Weakened', -1), S('Dazed', -1), S('Weakened', -1, 'SELF'), S('Dazed', -1, 'SELF')],
    'mend+':        [H(20, 'TARGET'), H(10, 'SELF')],
    'tend+':        [S('Sharp', 1), H(8, 'TARGET'), S('Sharp', 1, 'SELF'), H(8, 'SELF')],
    'bolster+':     [S('Sharp', 3), S('Sharp', 3, 'SELF')],
    'shell_share+': [S('BarkShield', 6), S('BarkShield', 6, 'SELF')],

    # --- doublers that then apply more ----------------------------------------------------------
    # The order is the text's order and it matters: double FIRST, then add. Adding first would
    # double the addition, which is a different (and much larger) card.
    #
    # Heat Wave+ is a Side card, so the 3 lands on each enemy — past Burn's cap of 4 it detonates.
    # RULED INTENDED (Henry, 09-23: *"upgrades are supposed to be broken"*), and the detonation is
    # the reason this line is not quietly capped.
    'heat_wave+':   [dict(type='MULTIPLY_STATUS', status='Burn', factor=2, target='TARGET'),
                     S('Burn', 3)],
    'contagion+':   [dict(type='MULTIPLY_STATUS', status='Poison', factor=2, target='TARGET'),
                     S('Poison', 3)],

    # --- Hexbloom+: the same read, twice ---------------------------------------------------------
    # "Apply 1 Poison per Weakened AND deal 7 power per Weakened, THEN remove the Weakened." Both
    # riders have to resolve before the consume, or the second one reads an empty pile. The damage
    # is `TARGET_STATUS_STACKS` off a base of 0, which is 7 x stacks and nothing on a clean target.
    'hexbloom+':    [S('Poison', 1, scaling='WEAKENED_STACKS'),
                     A(0, scaling='TARGET_STATUS_STACKS', scalingStatus='Weakened', scalingPower=7),
                     dict(type='STATUS', status='Weakened', consume=True, target='TARGET')],

    # --- Overclock Core+: the permanent slot, plus a charge now ----------------------------------
    'overclock_core+': [dict(type='MAX_ENERGY', amount=1, target='SELF'), S('Energized', 1, 'SELF')],

    # --- Scavenge Data+: a SEARCH, not a DRAW ----------------------------------------------------
    # The text reads "Draw 2 Water cards" because that is what a player sees; the verb is SEARCH
    # with an element criterion, and `amount` is the count. `verify()` knows about this pairing.
    'scavenge_data+': [dict(type='SEARCH', amount=2, criteria={'element': 'Water'}, target='SELF')],

    # --- the four the generic path REFUSED, and it was right to ----------------------------------
    # Each of these prints a number twice, or prints a number no single field holds. The generic
    # path reported "matches 2 action fields" / "matches 0" rather than picking one, which is the
    # behaviour that makes its other 68 cards worth trusting.
    #
    # Blood Rite: the base swing grows, the conditional rider does NOT — "+15 power above half HP"
    # is the same 15 in both printings, and the +40% is on the 15 that is always paid.
    'blood_rite+':  [A(20),
                     A(15, conditionals=[{'type': 'HEALTH_THRESHOLD', 'target': 'SELF', 'value': 'GT:50'}]),
                     H(40, 'SELF', conditionals=[{'type': 'HEALTH_THRESHOLD', 'target': 'SELF', 'value': 'LT:51'}])],
    # Pile On: BOTH swings are the printed 45, so both become 65. The second is the Dazed re-hit and
    # it is the same attack — a `+` that grew only the first would quietly halve the upgrade in the
    # deck that actually sets up the condition.
    'pile_on+':     [A(65), A(65, conditionals=['target_dazed'])],
    # Molten Core: the printed 6 is a SUM. The card is 2 Burn always plus 2 more while you hold
    # Sharp; the rule moves the conditional half (2 -> 4) so the two printings read 6 and 2.
    'molten_core+': [S('Burn', 2), S('Burn', 4, conditionals=['self_sharp'])],
    # Thorn Whip: the per-stack number is `scalingPower`, which overrides the shared
    # SHARP_STACKS_POWER_PER_STACK. Before 162a added that override the three +5/Sharp cards shared
    # one constant, and moving this one would have moved Spike Launch and Cinder Lance with it.
    'thorn_whip+':  [A(15, scaling='SHARP_STACKS', scalingPower=7)],
}

# The one place a `+` card's printed number is NOT a field, with the reason written down. An
# exemption costs a line here and is read in review; a `verify()` loose enough to pass this card
# by accident would pass the next twenty by accident too.
VERIFY_EXEMPT = {
    ('molten_core+', ('status', 6, 'Burn')):
        'the printed 6 is 2 always + 4 while Sharp, which is how the base card already reads its 4',
}

# Cards whose `+` is one more swing of the same attack. Written as a rule rather than four hand
# entries because the rule is the thing Henry ruled ("+1 hit at the same per-hit power") and a hand
# copy would let the per-hit power drift on one of them without the table saying so.
MULTI_HIT = {'flare_burst', 'pack_tactics', 'serpent_flurry', 'acorn_toss'}


# =================================================================================================
# PATH 3 — THE DAEMON HOOKS.
#
# `<field>` is the path into the hook's `do` action (or the hook itself, for a modifier hook), and
# the value is what the `+` makes it. Anything shaped differently is written out in full below.
# =================================================================================================
HOOK_NUMBERS = {
    # daemon id      hook id                     field             base -> plus
    'short_fuse':    [('short_fuse_discharge',    'power',          15)],
    'riptide':       [('riptide_undertow',        'power',          11)],
    'short_circuit': [('short_circuit_discharge', 'power',          20)],
    'static_ward':   [('static_ward_arc',         'power',          11)],
    'feedback_loop': [('daemon_draw_damage_proc', 'power',          10)],
    'hoofbeat':      [('hoofbeat_daemon_hook',    'power',          11)],
    'cinder_armor':  [('daemon_burn_sharp_synergy', 'stacks',        4)],
    'ember_ward':    [('ember_ward_retort',       'stacks',          4)],
    # Modifier hooks carry their number on the hook itself rather than in a `do` action.
    'core_overclock':   [('daemon_double_strength',        'multiplier', 1.3)],
    'thermal_overload': [('thermal_overload_burn_boost',   'multiplier', 1.75)],
}

# Reactive Plating+ raises its own per-turn cap, and it gets its OWN COUNTER KEY. Sharing the base
# key would make two different daemons argue about whose ceiling is in force; a separate key means
# a body holding both gets 3 from one and 5 from the other, which is what holding two daemons has
# always meant everywhere else in the game.
PLUS_HOOKS = {
    'reactive_plating+': [
        {'id': 'reactive_plating_proc+', 'trigger': 'onPostDamage', 'priority': 40,
         'when': {'source': 'OPPONENT', 'target': 'ALLY',
                  'counter': {'key': 'reactive_plating_plus_grants', 'operator': 'LT', 'value': 5, 'scope': 'SIDE'}},
         'do': [{'type': 'COUNTER', 'target': 'SELF', 'key': 'reactive_plating_plus_grants',
                 'operator': 'ADD', 'amount': 1, 'scope': 'SIDE'},
                {'type': 'STATUS', 'target': 'TARGET', 'status': 'Sharp', 'stacks': 1},
                {'type': 'LOG', 'text': '  \U0001f6e1️ {owner}\'s REACTIVE_PLATING+ hardens {target}!'}]},
        {'id': 'reactive_plating_reset+', 'trigger': 'onTurnStart', 'priority': 90,
         'when': {'source': 'SELF'},
         'do': [{'type': 'COUNTER', 'target': 'SELF', 'key': 'reactive_plating_plus_grants',
                 'operator': 'RESET', 'scope': 'SIDE'}]},
    ],
    # Echo Chamber+ — "two the FIRST time each turn". The base hook is unchanged and a second,
    # counter-gated hook fires beside it once a turn, reset at turn start: the same shape Reactive
    # Plating already uses for a per-turn allowance, so the `+` adds no new engine concept.
    'echo_chamber+': [
        {'id': 'echo_chamber_daemon_hook+', 'trigger': 'onActionStart', 'priority': 40,
         'when': {'source': 'SELF', 'baseCost': 0, 'isToken': False},
         'do': [{'type': 'GENERATE_CARD', 'dataId': 'feedback_token', 'target': 'SELF'},
                {'type': 'LOG', 'text': "{owner}'s ECHO_CHAMBER_DAEMON+ generates Feedback!"}]},
        {'id': 'echo_chamber_encore+', 'trigger': 'onActionStart', 'priority': 41,
         'when': {'source': 'SELF', 'baseCost': 0, 'isToken': False,
                  'counter': {'key': 'echo_chamber_plus_encore', 'operator': 'LT', 'value': 1, 'scope': 'OWNER'}},
         'do': [{'type': 'COUNTER', 'target': 'SELF', 'key': 'echo_chamber_plus_encore',
                 'operator': 'ADD', 'amount': 1, 'scope': 'OWNER'},
                {'type': 'GENERATE_CARD', 'dataId': 'feedback_token', 'target': 'SELF'},
                {'type': 'LOG', 'text': "{owner}'s ECHO_CHAMBER_DAEMON+ echoes twice!"}]},
        {'id': 'echo_chamber_encore_reset+', 'trigger': 'onTurnStart', 'priority': 90,
         'when': {'source': 'SELF'},
         'do': [{'type': 'COUNTER', 'target': 'SELF', 'key': 'echo_chamber_plus_encore',
                 'operator': 'RESET', 'scope': 'OWNER'}]},
    ],
}


# =================================================================================================
# PATH 1 — THE GENERIC TRANSFORM.
# =================================================================================================
def tokens(text):
    """
    Every number in a printed card text, tagged with what the card CALLS it.

    ('power', n)      — "20 power", "+15 power per Burn"
    ('status', n, S)  — "3 Burn", "gain 2 Strength"
    ('draw', n)       — "Draw 3"

    A number the card does not name this way (Ragnarok's "1%", Thermal Overload's "50% more") is
    left out on purpose: the generic path must not move a number it cannot place, and a card whose
    numbers it cannot fully account for is rejected to the hand table.
    """
    out = []
    for m in re.finditer(r'(\d+)\s+(power|%s)\b|[Dd]raw\s+(\d+)' % STATUS_RE, text):
        if m.group(3):
            out.append(('draw', int(m.group(3))))
        elif m.group(2) == 'power':
            out.append(('power', int(m.group(1))))
        else:
            out.append(('status', int(m.group(1)), STATUS_WORD[m.group(2)]))
    return out


def slots(actions):
    """Every numeric field in a card's actions that a printed number could be naming."""
    out = []
    for i, a in enumerate(actions):
        if 'power' in a:
            out.append((('power', a['power']), i, 'power'))
        if 'scalingPower' in a:
            out.append((('power', a['scalingPower']), i, 'scalingPower'))
        if a.get('type') == 'STATUS' and 'stacks' in a:
            out.append((('status', a['stacks'], a['status']), i, 'stacks'))
            # A REMOVAL is a negative stack, and a card prints it as "Remove 1 Weakened". Without
            # this alias `shrug_off+` reads as a card whose text names a number it does not have.
            if a['stacks'] < 0:
                out.append((('status', -a['stacks'], a['status']), i, 'stacks'))
        if a.get('type') in ('DRAW', 'SEARCH') and 'amount' in a:
            out.append((('draw', a['amount']), i, 'amount'))
    return out


def generic(base_actions, text, plus):
    """
    Move the numbers the text moved, or say why it cannot.

    Returns `(actions, None)` on success and `(None, reason)` when the card belongs in the hand
    table. It never guesses: an unmatched or doubly-matched number is a refusal, not a coin flip.
    """
    was, now = tokens(text), tokens(plus)
    if len(was) != len(now):
        return None, 'the text names %d numbers and the + names %d' % (len(was), len(now))
    actions = json.loads(json.dumps(base_actions))
    available = slots(actions)
    used = set()
    moved = 0
    for old, new in zip(was, now):
        if old == new:
            continue
        hits = [s for s in available if s[0] == old and (s[1], s[2]) not in used]
        if len(hits) != 1:
            return None, '"%s" matches %d action fields' % (' '.join(map(str, old)), len(hits))
        _, idx, field = hits[0]
        actions[idx][field] = new[1]
        used.add((idx, field))
        moved += 1
    if moved == 0:
        return None, 'no number moved'
    return actions, None


# =================================================================================================
# THE CHECK THAT MAKES THE REST TRUSTWORTHY.
# =================================================================================================
def verify(entry, hooks):
    """
    Does this `+` card DO what it SAYS?

    Every number the printed text names must appear in a matching action field (or, for a daemon,
    in its hook). This is deliberately one-directional: an action may hold numbers the text does
    not name (a conditional's threshold, a consume's half), but a number a PLAYER READS and cannot
    find in the card's behaviour is the exact failure this row could otherwise ship silently.
    """
    problems = []
    want = tokens(entry['description'])
    have = {s[0] for s in slots(entry['actions'])}
    # A daemon's numbers live in its hooks. Flatten every number the hook can produce.
    for hid in entry.get('hooks', []):
        for block in hooks.values():
            for h in block.get('hooks', []):
                if h.get('id') != hid:
                    continue
                if 'multiplier' in h:
                    have.add(('pct', h['multiplier']))
                for d in h.get('do', []):
                    if 'power' in d: have.add(('power', d['power']))
                    if d.get('type') == 'STATUS' and 'stacks' in d: have.add(('status', d['stacks'], d['status']))
                if 'counter' in h.get('when', {}): have.add(('draw', h['when']['counter']['value']))
    for t in want:
        if t in have or (entry['id'], t) in VERIFY_EXEMPT:
            continue
        problems.append('text says "%s" and no action or hook does' % ' '.join(map(str, t)))
    return problems


# =================================================================================================
def build():
    upg = json.load(open(UPG, encoding='utf-8'))
    prg = json.load(open(PRG, encoding='utf-8'))
    hooks = json.load(open(HKS, encoding='utf-8'))

    out = {k: v for k, v in prg.items() if not k.endswith('+')}
    new_hooks = {k: v for k, v in hooks.items() if not k.endswith('+')}
    report, rejected = [], []

    # A daemon's hooks.json block carries a `description` of its own, and `descriptionData.test.ts`
    # holds it to the numbers in the block. Copying the base block's text onto a `+` whose numbers
    # moved is how a daemon ends up printing 10 while dealing 15 — which is the exact defect that
    # test was written for (it caught `hoofbeat_daemon` printing 10 against a hook re-priced to 8).
    plus_text = {row['id']: row['plus'] for row in upg}

    # --- the hook library first, so the cards can point at it ------------------------------------
    for daemon, moves in HOOK_NUMBERS.items():
        block = json.loads(json.dumps(hooks[daemon]))
        block['id'] = daemon + '+'
        block['name'] = block['name'] + '+'
        block['description'] = plus_text[daemon]
        for hook_id, field, value in moves:
            h = next(x for x in block['hooks'] if x['id'] == hook_id)
            if field == 'multiplier':
                h['multiplier'] = value
            else:
                for d in h['do']:
                    if field in d:
                        d[field] = value
            h['id'] = hook_id + '+'
        for h in block['hooks']:
            if not h['id'].endswith('+'):
                h['id'] = h['id'] + '+'
        new_hooks[daemon + '+'] = block
    for daemon_plus, hook_list in PLUS_HOOKS.items():
        base = hooks[daemon_plus[:-1]]
        new_hooks[daemon_plus] = {'id': daemon_plus, 'name': base['name'] + '+',
                                  'description': plus_text[daemon_plus[:-1]],
                                  'hooks': json.loads(json.dumps(hook_list))}

    # --- the cards --------------------------------------------------------------------------------
    for row in upg:
        cid = row['id']
        base = prg.get(cid)
        if base is None:
            raise SystemExit('163a: %s is in upgrades.json and not in the registry' % cid)
        pid = cid + '+'
        entry = json.loads(json.dumps(base))
        entry['id'] = pid
        entry['name'] = base['name'] + '+'
        entry['description'] = row['plus']
        entry['upgradeOf'] = cid

        if pid in PLUS_ACTIONS:
            entry['actions'] = json.loads(json.dumps(PLUS_ACTIONS[pid]))
            how = 'hand'
        elif cid in MULTI_HIT:
            hits = [a for a in entry['actions'] if a.get('type') == 'ATTACK']
            entry['actions'] = json.loads(json.dumps(entry['actions'])) + [json.loads(json.dumps(hits[-1]))]
            how = 'multi-hit'
        elif cid in new_hooks or cid + '+' in new_hooks:
            entry['hooks'] = [h['id'] for h in new_hooks[pid]['hooks']]
            how = 'hook'
        else:
            actions, why = generic(base['actions'], row['text'], row['plus'])
            if actions is None:
                rejected.append('%-18s %s' % (cid, why))
                continue
            entry['actions'] = actions
            how = 'generic'

        order = ['id', 'name', 'description', 'element', 'target', 'allyTarget', 'category', 'exhaust',
                 'rarity', 'baseCost', 'upgradeOf', 'constraints', 'actions', 'hooks', 'isToken',
                 'discardEffect', 'growPerPlay']
        entry = {k: entry[k] for k in order if k in entry} | {k: v for k, v in entry.items() if k not in order}
        out[pid] = entry
        report.append((pid, how))

    problems = []
    for pid, _ in report:
        for p in verify(out[pid], new_hooks):
            problems.append('%-20s %s' % (pid, p))
    return out, new_hooks, report, rejected, problems


if __name__ == '__main__':
    out, new_hooks, report, rejected, problems = build()
    by_how = {}
    for pid, how in report:
        by_how.setdefault(how, []).append(pid)
    print('163a — %d + cards built (%d entries in programs.json now)' % (len(report), len(out)))
    for how, ids in sorted(by_how.items()):
        print('  %-10s %d' % (how, len(ids)))
    if rejected:
        print('\nREJECTED by the generic path — these need a PLUS_ACTIONS entry:')
        for r in rejected: print('  ', r)
    if problems:
        print('\nTEXT AND ACTIONS DISAGREE:')
        for p in problems: print('  ', p)
    if rejected or problems:
        sys.exit('163a: not written — %d rejected, %d disagreements' % (len(rejected), len(problems)))
    if '--dry' in sys.argv:
        print('\n--dry: nothing written.')
        sys.exit(0)
    with open(PRG, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=4, ensure_ascii=False); f.write('\n')
    with open(HKS, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(new_hooks, f, indent=4, ensure_ascii=False); f.write('\n')
    print('\nwritten: programs.json (%d), lib/hooks.json (%d)' % (len(out), len(new_hooks)))
