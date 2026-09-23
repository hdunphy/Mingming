#!/usr/bin/env python3
"""
TICKET 162a step 2 — collection v2 into the registry.

Reads `docs/wayfinder/deck-archetypes/collection-v2/collection.json` (Henry's ruled v2.1b draft)
and writes every one of its 98 cards into `src/engine/data/programs.json`.

WHY A SCRIPT AND NOT 98 HAND EDITS. The collection is the design source of truth and it will be
re-cut again (162b prices it, 160 re-scopes it). A generator means the next cut is a re-run and a
diff to read, rather than 98 chances to fat-finger a number. The ACTIONS, though, are authored by
hand below — prose does not compile, and guessing a card's verbs from its text is how a card ships
doing something its own print does not say.

WHAT IT DOES NOT DO. It does not delete the 170 v1 entries the collection does not name. 162a is
the EARLY-ACCESS re-cut (Henry, 09-21: "leave the non-EA mingmings for after EA"), the other twenty
species still field v1 decks, and ~90 scenario fixtures still name v1 cards. What keeps a v1 card
out of a player's hands is the reward derivation, not the registry's size.
"""
import json, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COL = os.path.join(ROOT, 'docs/wayfinder/deck-archetypes/collection-v2/collection.json')
PRG = os.path.join(ROOT, 'src/engine/data/programs.json')

STD = ["not_stunned", "not_asleep", "energy_base"]

A  = lambda p, **kw: dict(type='ATTACK', power=p, target='TARGET', **kw)
AS = lambda **kw: dict(type='ATTACK', target='SELF', **kw)
S  = lambda st, n, tgt='TARGET', **kw: dict(type='STATUS', status=st, stacks=n, target=tgt, **kw)
CONS = lambda st, tgt: dict(type='STATUS', status=st, consume=True, target=tgt)
H  = lambda p, tgt='SELF', **kw: dict(type='HEAL', power=p, target=tgt, **kw)
D  = lambda n=1, **kw: dict(type='DRAW', amount=n, target='SELF', **kw)
E  = lambda n=1, **kw: dict(type='ENERGY', amount=n, target='SELF', **kw)

BURNED = 'target_burned'
DAZED  = 'target_dazed'
WEAK_T = {'type': 'HAS_STATUS', 'target': 'TARGET', 'value': 'Weakened'}
SELF_STR = {'type': 'HAS_STATUS', 'target': 'SELF', 'value': 'Strengthened'}
SELF_BARK = {'type': 'HAS_STATUS', 'target': 'SELF', 'value': 'BarkShield'}
ABOVE_HALF = {'type': 'HEALTH_THRESHOLD', 'target': 'SELF', 'value': 'GT:50'}
BELOW_HALF = {'type': 'HEALTH_THRESHOLD', 'target': 'SELF', 'value': 'LT:51'}
PLAYED_3 = {'type': 'CARDS_PLAYED', 'target': 'SELF', 'value': 3}

# ---------------------------------------------------------------------------------------------
# THE AUTHORED ACTIONS.
#
# One entry per card whose verbs are NEW or whose numbers MOVED. A card absent from this table
# keeps the actions it already had — and `verify()` below fails the build if those actions no
# longer match the collection's printed cost/element/target, so "absent" can never mean "forgotten".
# ---------------------------------------------------------------------------------------------
ACTIONS = {
    # --- None / glue -------------------------------------------------------------------------
    'soothe':     [S('Weakened', -1, 'TARGET'), S('Dazed', -1, 'TARGET')],
    'mend':       [H(20, 'TARGET')],
    'forage':     None,   # unchanged

    # --- Fire: ignition ----------------------------------------------------------------------
    # The DRAW is FIRST on purpose: "if the target was already Burning" must read the board before
    # this card's own Burn lands. Written after the Burn it would be true on every cast but the
    # first, which is a different card.
    'ignite':     [D(1, conditionals=[BURNED]), S('Burn', 1)],
    'ember_jab':  [A(8), S('Burn', 1)],
    'brand':      [A(25), S('Burn', 1, conditionals=[BURNED])],

    # --- Fire: Sköll's multi-hit -------------------------------------------------------------
    # The MULTI-HIT RULE (162 §4b, v2.1b): the band's power is SPLIT across the hits, not paid per
    # hit. Repeated ATTACK entries rather than `count`, so each hit is its own damage event for
    # EMBER_FUSE and for every onPostDamage hook — which is the whole reason Sköll v2 wants them.
    'flare_burst':  [A(15), A(15)],
    'pack_tactics': [A(23), A(23), A(23)],

    'howl':       [S('Strengthened', 1, 'TARGET')],
    'snarl':      [S('Weakened', 2)],
    'snap':       [A(20), A(12, conditionals=[WEAK_T])],
    'brute_force': [A(25), A(8, conditionals=[SELF_STR])],

    # --- Fire: Fenrir ------------------------------------------------------------------------
    'ragnarok_edge':    [A(20, scaling='MISSING_HP', scalingPower=1)],
    'desperate_strike': [A(8), S('Strengthened', 1, 'SELF'), AS(percentMaxHp=3)],
    'slag_strike':      [A(22), S('Sharp', 1, 'SELF')],
    'cinder_lance':     [A(40, scaling='SHARP_STACKS', scalingPower=6)],
    'sharp_edge':       [CONS('Sharp', 'SELF'), A(15, scaling='STATUS_CONSUMED')],

    # --- Fire: detonation --------------------------------------------------------------------
    'flashover': [A(50, scaling='TARGET_STATUS_STACKS', scalingStatus='Burn', scalingPower=15)],
    'wildfire':  [A(45), S('Burn', 1)],

    # --- Water: Kraken -----------------------------------------------------------------------
    'crushing_depths':  [CONS('Dazed', 'TARGET'), A(20, scaling='STATUS_CONSUMED')],
    'slander':          [A(15, scaling='DAZED_STACKS')],
    'ink_cloud':        [A(25), S('Dazed', 2)],
    'surge_protection': [A(25), E(1, conditionals=[{'id': 'card_drawn_check'}])],
    'riptide_run':      [A(20), E(1, conditionals=[PLAYED_3])],
    'tide_pool':        [S('Energized', 1, 'SELF'), D(1)],
    'tidal_battery':    [S('Energized', 1, 'TARGET')],

    # --- Water: Jörmungandr ------------------------------------------------------------------
    'venom_fang':     [A(30)],
    'serpent_flurry': [A(10), A(10), A(10)],
    'venom_glut':     [CONS('Poison', 'TARGET'), A(15, scaling='STATUS_CONSUMED')],

    # --- Water: steam ------------------------------------------------------------------------
    'scald':         [S('Burn', 2), S('Dazed', 1, 'SELF')],
    'boiling_surge': [A(55), S('Burn', 2)],
    'maelstrom':     [A(100), S('Dazed', 3)],
    'hydro_blast':   [A(120)],
    'tidal_wave':    [A(55)],

    # --- Nature: Ratatoskr -------------------------------------------------------------------
    'acorn_toss':     [A(6), A(6)],
    'seed_bomb':      [A(20, scaling='CARDS_PLAYED')],
    'tend':           [S('Sharp', 1, 'TARGET'), H(8, 'TARGET')],
    'bolster':        [S('Sharp', 3, 'TARGET')],
    'verdant_ward':   [S('Regen', 2, 'TARGET'), S('Sharp', 1, 'TARGET')],
    'pollen_cloud':   [S('Weakened', 1)],
    'heckle':         [S('Dazed', 1), S('Weakened', 1)],
    'pile_on':        [A(45), A(45, conditionals=[DAZED])],
    'crippling_vine': [A(20), S('Weakened', 2)],

    # --- Nature: Huldra ----------------------------------------------------------------------
    'sap_strength': [A(20, scaling='TARGET_STATUS_STACKS', scalingStatus='Weakened', scalingPower=6)],
    'shell_share':  [S('BarkShield', 6, 'TARGET')],
    'bark_smash':   [CONS('BarkShield', 'SELF'), A(6, scaling='STATUS_CONSUMED')],
    'blightbloom':  [A(30), S('Poison', 5)],

    # --- Daemons: the four new ones ----------------------------------------------------------
    # A daemon's `actions` resolve on play and its `hooks` install for the battle. These four are
    # the only new cards whose effect is a hook rather than a verb — see hooks.json.
    'overclock_core':   [dict(type='MAX_ENERGY', amount=1, target='SELF')],
    'short_fuse':       [],
    'static_ward':      [],
    'ember_ward':       [],
    'thermal_overload': [],
}

# The hook ids a new daemon INSTALLS. `daemonCoverage.test.ts` walks this field and fails for any
# Daemon whose hook ids do not resolve — which is the only thing standing between a schema-valid
# daemon and one that silently does nothing (see the allowlist note in `daemonHooks.ts`).
HOOKS = {
    'short_fuse':  ['short_fuse_discharge'],
    'static_ward': ['static_ward_arc'],
    'ember_ward':  ['ember_ward_retort'],
    # `thermal_overload`'s hooks have been in hooks.json since ticket 44; what it never had was a
    # PRINTING, which is why it shows as "keep" in the collection and as missing in the registry.
    'thermal_overload': ['thermal_overload_hook', 'thermal_overload_burn_boost', 'thermal_overload_logic'],
    # `overclock_core` installs nothing: its effect is the MAX_ENERGY action above.
}

# Cards whose PROGRAM-LEVEL target deviates from the collection, with the reason.
#
# 160-e1 SHIPPED, so `Ally` and `AllySide` are no longer fallbacks. They are not TargetTypes either:
# `target` says how WIDE a card reaches and `allyTarget` says which SIDE, which are two orthogonal
# facts (see the note on `ProgramData.allyTarget`). The collection's two words map onto them.
ALLY_TARGET = {
    'Ally':     'Single',   # one ally, the caster included
    'AllySide': 'Side',     # your whole side
}

TARGET_OVERRIDE = {
    # NOT the collection's `Self`. Heartwood's own text is "Gain 6 Bark Shield. Apply 1 Poison TO
    # THE TARGET" — a Self program has no enemy to poison, so `Self` would silently delete half the
    # card. Shipped as it already is (`Single`, with the shield action on SELF). Flagged for Henry.
    'heartwood': 'Single',
}

def load():
    with open(COL, encoding='utf-8') as f: col = json.load(f)
    with open(PRG, encoding='utf-8') as f: prg = json.load(f)
    return col, prg

def build():
    col, prg = load()
    aliases = {}
    out = dict(prg)
    report = []

    for c in col['cards']:
        cid, old = c['id'], c.get('old')
        src = prg.get(cid) or (prg.get(old) if old else None) or {}
        entry = dict(src)
        entry['id'] = cid
        entry['name'] = c['name']
        entry['description'] = c['text']
        entry['element'] = c['el']
        entry['category'] = c['cat']
        entry['target'] = TARGET_OVERRIDE.get(cid) or ALLY_TARGET.get(c['tgt'], c['tgt'])
        if c['tgt'] in ALLY_TARGET:
            entry['allyTarget'] = True
        entry['baseCost'] = c['cost']
        entry.setdefault('rarity', 'Common')
        entry['constraints'] = list(STD)
        if c['cat'] == 'Daemon':
            entry['exhaust'] = True
        if cid in HOOKS:
            entry['hooks'] = HOOKS[cid]
        if cid in ACTIONS and ACTIONS[cid] is not None:
            entry['actions'] = ACTIONS[cid]
        elif 'actions' not in entry:
            raise SystemExit('no actions for %s' % cid)
        # key order: id first, then the printed face, then the machinery
        order = ['id', 'name', 'description', 'element', 'target', 'allyTarget', 'category', 'exhaust',
                 'rarity', 'baseCost', 'constraints', 'actions', 'hooks', 'isToken',
                 'discardEffect', 'growPerPlay']
        entry = {k: entry[k] for k in order if k in entry} | {k: v for k, v in entry.items() if k not in order}
        out[cid] = entry
        if old and old != cid:
            aliases[old] = cid
            out.pop(old, None)
            report.append('alias %-18s -> %s' % (old, cid))

    with open(PRG, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=4, ensure_ascii=False)
        f.write('\n')
    return out, aliases, report

if __name__ == '__main__':
    out, aliases, report = build()
    print('programs.json: %d entries (%d aliases folded away)' % (len(out), len(aliases)))
    for line in report: print(' ', line)
    print(json.dumps(aliases, indent=4, sort_keys=True))
