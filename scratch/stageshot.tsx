import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import pw from '/tmp/node_modules/playwright/index.js';

/*
 * THE IMPORT PREFIX IS LOAD-BEARING — `../src/...`, not `./src/...`.
 *
 * The first version of this file used `./src/...`, which vite-node resolves from the CWD rather
 * than from `scratch/`, and the result is a SECOND instance of the whole module graph. Everything
 * renders; nothing errors; `setServerViewport` writes to a copy of the module `BattleStage` is not
 * reading, so both screenshots came out at 1280 and the 1920 one looked like a scaling bug in
 * `stageGeometry`. Same family as ticket 144's dead arms: the instrument was wrong, not the thing
 * it measured. `A === B` is false for the two spellings — check it before believing an output.
 */
import BattleStage from '../src/ui/components/BattleStage';
import { setServerViewport } from '../src/ui/hooks/useStageAnchors';
import type { IBattleEntity, IBattleState, Element } from '../src/engine/types';

const unit = (id: string, name: string, el: string, hp: number, max: number, ep = 2): IBattleEntity => ({
    id, name, definitionId: name.toLowerCase(), blueprintsCollected: 0,
    attackIV: 0, defenseIV: 0, hpIV: 0, maxHp: max, currentHp: hp,
    cardDraw: 3, maxEnergy: 2, currentEnergy: ep, attack: 45, defense: 30, speed: 10,
    primaryElement: el as Element, secondaryElement: 'None' as Element,
    speciesId: name.toLowerCase(), level: 15, activeOS: `${name.toLowerCase()}_v1`,
    daemons: [], statusEffects: [],
} as unknown as IBattleEntity);

const state = {
    playerParty: [unit('p1','FENRIR','Fire',414,1125), unit('p2','SKOLL','Fire',900,1000), unit('p3','RATATOSKR','Nature',900,1000)],
    enemyParty: [unit('e1','KRAKEN','Water',1080,1080), unit('e2','HULDRA','Nature',900,1020), unit('e3','RATATOSKR','Nature',53,1080,0)],
    activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
    playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 2,
} as unknown as IBattleState;

const css = fs.readFileSync('src/index.css','utf8');
const render = (w: number, h: number) => {
    setServerViewport(w, h);
    return renderToStaticMarkup(React.createElement(BattleStage as never, {
        battleState: state, selectedSourceId: 'p1', selectedTargetId: null, selectedCardId: null,
        hoveredEntityId: null, isTargeting: false, unitFx: {},
        onEntityClick: () => undefined, onEntityPointerUp: () => undefined, onEnemyHoverChange: () => undefined,
    } as never));
};

const browser = await (pw as never as {chromium:{launch:(o?:unknown)=>Promise<never>}}).chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h, tag] of [[1280, 800, '1280x800'], [1920, 1080, '1920x1080']] as [number, number, string][]) {
    const page = await (browser as never as {newPage:(o:unknown)=>Promise<never>}).newPage({ viewport: { width: w, height: h } });
    const p = page as never as { setContent:(s:string)=>Promise<void>; screenshot:(o:unknown)=>Promise<void>; close:()=>Promise<void> };
    await p.setContent(`<style>${css}
      html,body{margin:0;height:100%;background:radial-gradient(circle at 50% 42%,#1b1b3a 0%,#050508 100%);font-family:system-ui}
      .band{position:fixed;left:0;right:0;background:rgba(255,255,255,.02);border-block:1px dashed rgba(124,58,237,.35);pointer-events:none}
      .lbl{position:fixed;font:600 10px system-ui;letter-spacing:.2em;color:#7c3aed88;text-transform:uppercase}
    </style><body>
      <div class="band" style="top:0;height:44px"></div>
      <div class="band" style="bottom:0;height:210px"></div>
      <div class="lbl" style="left:8px;top:14px">top bar 44</div>
      <div class="lbl" style="left:8px;bottom:196px">console 210</div>
      <div class="lbl" style="right:8px;top:52px">${tag}</div>
      ${render(w, h)}</body>`);
    await p.screenshot({ path: `/mnt/user-data/outputs/stage-${tag}.png` });
    await p.close();
}
await (browser as never as {close:()=>Promise<void>}).close();
