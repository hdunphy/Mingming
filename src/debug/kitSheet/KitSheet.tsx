/**
 * THE KIT SHEET — ticket 183a's review picture: every piece of the Slant kit, rendered by the real
 * components and the real stylesheet, in every state a screen will put it in. Compare it with
 * `research/183-mocks/183-kit.html`, which is the same pieces drawn by hand.
 *
 * Dev only (see `main.tsx`). Open `/Mingming/kit.html` under `npm run dev`; the screenshots in
 * `research/183-screens/183a/` are this page at 1280x800 and 1920x1080.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { HandCardPreviewFace } from '../../ui/components/HandCardFace';
import { ElementBadge } from '../../ui/theme/kit/ElementBadge';
import { ElementMark } from '../../ui/theme/kit/ElementMark';
import { EnergyHex } from '../../ui/theme/kit/EnergyHex';
import { HpBar } from '../../ui/theme/kit/HpBar';
import { ReadoutStrip } from '../../ui/theme/kit/ReadoutStrip';
import { SlantPanel } from '../../ui/theme/kit/SlantPanel';
import { StatusChip } from '../../ui/theme/kit/StatusChip';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="k-display" style={{ margin: 0, fontSize: 16 }}>{title}</h2>
            {children}
        </section>
    );
}

const preview = (over: Partial<HandCardPreviewFace>): HandCardPreviewFace => ({
    damage: 0, healing: 0, absorbed: 0, lethal: false, hitCount: 1, effectiveness: 1, measuredOn: null, ...over,
});

function Plaque({ name, element, cur, max, shield }: {
    name: string; element: string; cur: number; max: number; shield?: number;
}): ReactElement {
    return (
        <SlantPanel slash="right" element={element} style={{ width: 176 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '6px 14px 6px 8px' }}>
                <div style={{ ...row, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <div className="k-display" style={{ fontSize: 15 }}>{name}</div>
                    <ElementBadge element={element} />
                </div>
                <div style={{ ...row, flexWrap: 'nowrap', gap: 6 }}>
                    <HpBar cur={cur} max={max} width={88} shield={shield} />
                    <div className="k-display" style={{ fontSize: 13 }}>
                        {cur}<span style={{ color: 'var(--text-mute)' }}>/{max}</span>
                    </div>
                </div>
                <div style={{ ...row, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <EnergyHex n={2} max={2} size={20} />
                    <div style={{ ...row, gap: 4, flexWrap: 'nowrap' }}>
                        <StatusChip status="Strengthened" count={19} />
                        <StatusChip status="Burn" count={3} />
                    </div>
                </div>
            </div>
        </SlantPanel>
    );
}

function CardStrip({ element, p }: { element: string; p: HandCardPreviewFace }): ReactElement {
    return (
        <div style={{ width: 150, background: 'var(--card-body)', color: 'var(--card-text)' }}>
            <div style={{ height: 28, padding: '6px 8px', fontSize: 11 }}>{element} card</div>
            <ReadoutStrip element={element} preview={p} />
        </div>
    );
}

export function KitSheet(): ReactElement {
    return (
        <div
            style={{
                boxSizing: 'border-box',
                width: '100vw',
                height: '100vh',
                padding: 28,
                background: 'var(--panel-2)',
                color: 'var(--text)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gridAutoRows: 'min-content',
                gap: 22,
                alignContent: 'start',
                overflow: 'hidden',
            }}
        >
            <h1 className="k-display" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 22 }}>
                Slant kit: every piece, rendered by the real components
            </h1>

            <Section title="Energy hexagon">
                <div style={row}>
                    {[0, 1, 2, 3].map((n) => <EnergyHex key={n} n={n} />)}
                    <EnergyHex n={2} max={2} size={20} />
                    <EnergyHex n={0} max={3} size={20} />
                </div>
            </Section>

            <Section title="Element marks and badges">
                <div style={row}>
                    <ElementMark element="Fire" />
                    <ElementMark element="Water" />
                    <ElementMark element="Nature" />
                    <ElementMark element="None" />
                    <ElementMark element="Fire" size={24} />
                </div>
                <div style={row}>
                    <ElementBadge element="Fire" label="FIRE" />
                    <ElementBadge element="Water" label="WATER" />
                    <ElementBadge element="Nature" label="NATURE" />
                    <ElementBadge element="Dark" label="DARK" />
                </div>
            </Section>

            <Section title="Status chips">
                <div style={row}>
                    <StatusChip status="Strengthened" count={19} />
                    <StatusChip status="Burn" count={4} />
                    <StatusChip status="Poison" count={3} />
                    <StatusChip status="Regen" count={2} />
                    <StatusChip status="Dazed" count={1} />
                </div>
            </Section>

            <Section title="HP bar: green, yellow, red, and Bark Shield">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <HpBar cur={80} max={100} width={220} />
                    <HpBar cur={50} max={100} width={220} />
                    <HpBar cur={19} max={100} width={220} />
                    <HpBar cur={5} max={100} width={220} />
                    <HpBar cur={60} max={100} width={220} shield={20} />
                    <HpBar cur={100} max={100} width={220} shield={30} />
                </div>
            </Section>

            <Section title="Plaque, built from the kit">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Plaque name="Fenrir" element="Fire" cur={414} max={1125} />
                    <Plaque name="Kraken" element="Water" cur={870} max={900} shield={150} />
                </div>
            </Section>

            <Section title="Slant panel: edge, slash side, cut">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <SlantPanel style={{ width: 200 }}><div style={{ padding: '8px 14px' }} className="k-display">No slash</div></SlantPanel>
                    <SlantPanel slash="left" element="Nature" style={{ width: 200 }}><div style={{ padding: '8px 14px' }} className="k-display">Slash left</div></SlantPanel>
                    <SlantPanel slash="right" element="Water" cut={5} style={{ width: 200 }}><div style={{ padding: '8px 14px' }} className="k-display">Cut 5, slash right</div></SlantPanel>
                </div>
            </Section>

            <Section title="Readout strip">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CardStrip element="Fire" p={preview({ damage: 142, measuredOn: 'Huldra', effectiveness: 1.5 })} />
                    <CardStrip element="Water" p={preview({ damage: 30, measuredOn: 'Skoll', effectiveness: 0.5, hitCount: 3 })} />
                    <CardStrip element="Nature" p={preview({ healing: 15, measuredOn: 'Fenrir' })} />
                    <CardStrip element="Fire" p={preview({ damage: 400, measuredOn: 'Ratatoskr', absorbed: 60, lethal: true })} />
                </div>
            </Section>
        </div>
    );
}
