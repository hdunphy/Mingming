#!/usr/bin/env python3
"""
TICKET 162b, the correction — split the ledger by whether the auditor can READ a card.

Henry, 2026-09-23: *"I'm not sure I understand what you're asking here. What is under?"* Answering
that question is what found the error in the first reading of this row.

`powerscale` prices a card that CONSUMES, SCALES ON or MULTIPLIES a pile against an ASSUMED three
stacks (`ASSUMED_STATUS_COUNT`). That is a guess about a board, not a measurement of a card. A
daemon's hooks it cannot price at all. Pooling either kind with the cards it prices properly
produces a median that describes the AUDITOR rather than the pool — which is exactly what the
"-36% at 2e" headline turned out to be.

Run: python3 scratch/t162b_split.py
"""
import csv, json, os, re, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, 'results', 't162', 'LEDGER.tsv')
PROGRAMS = os.path.join(ROOT, 'src', 'engine', 'data', 'programs.json')

def live_bands():
    """
    The bands the scorer is ACTUALLY using, read out of `powerscale.ts`.

    Hardcoded until 2026-09-23, as two tables: the repo's curve and Henry's v2.1 slot tax, printed
    side by side because they disagreed. Henry then ruled *"keep my numbers"* and `BUDGET_BANDS`
    became the slot tax, at which point a hardcoded "repo" column was a second copy of a number
    that had moved — a script whose whole job is to correct a misreading, misreading something.
    """
    src = open(os.path.join(ROOT, 'src', 'debug', 'balance', 'powerscale.ts'), encoding='utf-8').read()
    block = src[src.index('export const BUDGET_BANDS'):src.index(']', src.index('export const BUDGET_BANDS'))]
    return {int(c): float(o) * 10 for c, o in re.findall(r'cost:\s*(\d+),\s*over:\s*([\d.]+)', block)}

BAND = live_bands()

def reads_a_pile(card):
    """The card's value depends on a board the auditor cannot see."""
    for a in card['actions']:
        if a.get('consume') or a.get('scaling') or a['type'] == 'MULTIPLY_STATUS':
            return True
    return False

def main():
    rows = list(csv.DictReader(open(LEDGER, encoding='utf-8'), delimiter='\t'))
    programs = json.load(open(PROGRAMS, encoding='utf-8'))
    power = lambda r: float(r['score']) * 10

    print("Henry's slot tax, ruled 2026-09-23, is the band: " + ' / '.join(f'{BAND[c]:.0f}' for c in (0, 1, 2, 3)) + ' power.\n')
    print('cost   auditor can read        it only guesses        daemons        band')
    for cost in (0, 1, 2, 3):
        at = [r for r in rows if int(r['cost']) == cost]
        daemons = [r for r in at if programs[r['id']]['category'] == 'Daemon']
        rest = [r for r in at if programs[r['id']]['category'] != 'Daemon']
        flat = [r for r in rest if not reads_a_pile(programs[r['id']])]
        pile = [r for r in rest if reads_a_pile(programs[r['id']])]
        med = lambda xs: f'{statistics.median(power(x) for x in xs):5.0f} (n={len(xs):2d})' if xs else '      —    '
        print(f'  {cost}e   {med(flat)}        {med(pile)}       {med(daemons)}   {BAND[cost]:4.0f}')

    print('\nFlat cards more than 10% under band — see REDLINE.md for the filtered review list:')
    for cost in (0, 1, 2, 3):
        for r in sorted((r for r in rows if int(r['cost']) == cost
                         and programs[r['id']]['category'] != 'Daemon'
                         and not reads_a_pile(programs[r['id']])
                         and power(r) < BAND[cost] * 0.9), key=power):
            print(f'  {r["id"]:<18} {power(r):5.0f} power vs {BAND[cost]:3.0f}   {programs[r["id"]]["description"][:56]}')

if __name__ == '__main__':
    main()
