p='scratch/offenders.ts'
s=open(p).read()

# --- 1. extend the fenrir OS block: recoil can be RE-ADDED (ticket 82 removed the HP action)
a = """    if (f && knob.recoil !== undefined) {
        if (knob.recoil === '0') f.do = (f.do ?? []).filter(x => x.type !== 'HP');
        else {
            const hpAct = f.do?.find(x => x.type === 'HP') as { percentMaxHP?: number } | undefined;
            if (hpAct) hpAct.percentMaxHP = -Number(knob.recoil);
        }
    }"""
assert s.count(a)==1, 'recoil block'
s = s.replace(a, """    if (f && knob.recoil !== undefined) {
        if (knob.recoil === '0') f.do = (f.do ?? []).filter(x => x.type !== 'HP');
        else {
            const hpAct = f.do?.find(x => x.type === 'HP') as { percentMaxHP?: number } | undefined;
            // Ticket 82 REMOVED the HP action, so a recoil arm has to put one back.
            if (hpAct) hpAct.percentMaxHP = -Number(knob.recoil);
            else (f.do ?? []).unshift({ type: 'HP', target: 'SELF', percentMaxHP: -Number(knob.recoil) } as unknown as { type: string });
        }
    }
    // Ticket 83, Henry's suggestion: give the recoil a PRODUCT - "Fire attacks deal X% more".
    if (knob.firepct) {
        H.fenrir_v1.hooks.push({
            id: 'fenrir_v1_fire_bonus', trigger: 'onDamageCalculated', priority: 40,
            when: { source: 'SELF', programElement: 'Fire' },
            multiplier: 1 + Number(knob.firepct) / 100,
        } as unknown as { id: string });
    }""", 1)

# --- 2. berserk-scaled bonus: the OWNER's missing HP, which no data scaling key can read
#        (MISSING_HP resolves the TARGET). Injected as firmware, the hel/ymir precedent.
a2 = "const SPECIES = DECK.replace(/_v[12]$/, '');"
assert s.count(a2)==1
s = s.replace(a2, """// `berserk=N` - Fire attacks deal up to N% more damage, scaled by how much max HP is MISSING.
// At N=50 that is +25% at half health and +50% at death's door. This is the shape the recoil was
// always supposed to be buying: the price and the product are the same quantity.
if (DECK === 'fenrir_v1' && knob.berserk) {
    const rate = Number(knob.berserk) / 100;
    (CF as Record<string, unknown[]>).fenrir_v1 = [
        ...((CF as Record<string, unknown[]>).fenrir_v1 ?? []),
        {
            id: 'fenrir_v1_berserk',
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: { source?: { id: string }; program?: { element?: string } }, owner: { id: string; currentHp: number; maxHp: number }): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Fire') {
                    const missing = 1 - owner.currentHp / Math.max(1, owner.maxHp);
                    return currentDamage + Math.floor(currentDamage * rate * missing);
                }
                return currentDamage;
            },
        },
    ];
}

const SPECIES = DECK.replace(/_v[12]$/, '');""", 1)

# --- 3. card-level arms: blood_rite's branches, and a NEW berserker enabler
a3 = """// ---- 1. field win rate against all 31 other decks ----"""
assert s.count(a3)==1
s = s.replace(a3, """// `bloodflip` - blood_rite currently LOSES half its damage below 50% and heals you back over the
// threshold, which is the berserk payoff running in reverse on two of nine cards. This flips it:
// the heal is the HEALTHY mode, the extra 15 power is the HURT mode.
// `feralbite` - injects a new 0e card, the accelerator the kit has never had: nothing in the pool
// lets a Mingming spend HP on purpose except hel, and she does it through her OS.
{
    const PR = (await import('../src/engine/data/programRegistry')).ProgramRegistry as unknown as
        Record<string, { actions: Array<{ conditionals?: Array<{ value: string }> }> }>;
    if (knob.bloodflip) {
        for (const act of PR.blood_rite.actions)
            for (const c of act.conditionals ?? [])
                c.value = c.value === 'GT:50' ? 'LT:51' : 'GT:50';
    }
    if (knob.feralbite) {
        (PR as unknown as Record<string, unknown>).feral_bite = {
            id: 'feral_bite', name: 'Feral Bite',
            description: 'Lose 8% of your max HP. Gain 2 Strengthened.',
            element: 'Fire', target: 'Self', category: 'Skill', rarity: 'Common', baseCost: 0,
            constraints: ['not_stunned', 'not_asleep', 'energy_base'],
            actions: [
                { type: 'HP', target: 'SELF', percentMaxHP: -8 },
                { type: 'STATUS', status: 'Strengthened', stacks: 2, target: 'SELF' },
            ],
        };
    }
}

// ---- 1. field win rate against all 31 other decks ----""", 1)

open(p,'w').write(s)
print('offenders extended for the berserker arms')
