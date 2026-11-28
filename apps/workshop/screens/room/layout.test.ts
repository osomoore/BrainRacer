import { describe, expect, it } from 'vitest';
import { WS_UI, WS_WALLET } from '../../config';
import { CATALOGS } from '../../content';
import { aspectIdsAt } from '../../logic/aspects';
import { rectsOverlap, roomLayout, standOf, stepToward, walkSeconds, type LayoutKind } from './layout';

const kinds: LayoutKind[] = ['wide', 'tall'];

describe('roomLayout', () => {
  for (const kind of kinds) for (const [name, workshop] of [['race', 'race'], ['dino', 'dino']] as const) {
    const ids = CATALOGS[workshop].aspects.map((a) => a.id);
    const L = roomLayout(kind, ids);
    it(`${kind}/${name}: ten stations, all inside the pane and tappable`, () => {
      expect(L.stations).toHaveLength(10);
      for (const s of [...L.stations, L.buddyStation]) {
        expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2).toBeLessThanOrEqual(L.size.w);
        expect(s.y - s.h / 2).toBeGreaterThanOrEqual(0);
        expect(s.y + s.h / 2).toBeLessThanOrEqual(L.size.h);
        expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(WS_UI.tapMin);
        expect(s.stand.x).toBeGreaterThan(0); expect(s.stand.x).toBeLessThan(L.size.w);
        expect(s.stand.y).toBeGreaterThan(0); expect(s.stand.y).toBeLessThan(L.size.h);
      }
    });
    it(`${kind}/${name}: signs, board and model area never overlap`, () => {
      const rects = [...L.stations, L.buddyStation, L.buddyBar, L.board, L.worldButton, WS_UI.roomBack];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
      const m = { x: L.model.x, y: L.model.groundY - L.model.maxH / 2, w: L.model.maxW, h: L.model.maxH };
      for (const r of rects) expect(rectsOverlap(m, r)).toBe(false);
      expect(L.board.y + L.board.h / 2).toBeLessThanOrEqual(L.size.h);
      const wallet = { ...WS_WALLET[kind === 'tall' ? 'tallRoom' : 'wide'], w: 192, h: 92 };
      expect(rectsOverlap(wallet, L.buddyBar)).toBe(false);
      expect(rectsOverlap(wallet, L.buddyStation)).toBe(false);
    });
  }

  for (const kind of kinds) {
    for (const workshop of ['race', 'dino'] as const) it(`${kind}/${workshop}: six actual Starter/Easy stations fit, stay tappable, and clear the model, Test, meter, and buddy UI`, () => {
      const ids = aspectIdsAt(CATALOGS[workshop], true);
      expect(ids).toHaveLength(6);
      expect(ids.every((id) => CATALOGS[workshop].aspects.some((a) => a.id === id))).toBe(true);
      const L = roomLayout(kind, ids);
      expect(L.stations).toHaveLength(6);
      const rects = [...L.stations, L.buddyStation, L.buddyBar, L.board, L.worldButton, WS_UI.roomBack];
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
      }
      const model = { x: L.model.x, y: L.model.groundY - L.model.maxH / 2, w: L.model.maxW, h: L.model.maxH };
      for (const rect of rects) expect(rectsOverlap(model, rect)).toBe(false);
      const wallet = { ...WS_WALLET[kind === 'tall' ? 'tallRoom' : 'wide'], w: 192, h: 92 };
      for (const rect of [...L.stations, L.buddyStation, L.buddyBar]) expect(rectsOverlap(wallet, rect)).toBe(false);
      for (const s of L.stations) {
        expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2).toBeLessThanOrEqual(L.size.w);
        expect(s.y - s.h / 2).toBeGreaterThanOrEqual(0);
        expect(s.y + s.h / 2).toBeLessThanOrEqual(L.floorY);
        expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(WS_UI.tapMin);
      }
      expect(L.board.y + L.board.h / 2).toBeLessThanOrEqual(L.size.h);
    });
  }

  it('standOf: station stand point, else the board', () => {
    const L = roomLayout('wide', CATALOGS.race.aspects.map((a) => a.id));
    expect(standOf(L, 'wheels')).toEqual(L.stations[0].stand);
    expect(standOf(L, 'buddies')).toEqual(L.buddyStation.stand);
    expect(standOf(L, 'center')).toEqual(L.board.stand);
    expect(standOf(L, undefined)).toEqual(L.board.stand);
  });

  it.each(kinds)('gives the %s globe a full-sized tap target inside the top corner', (kind) => {
    const L = roomLayout(kind, []);
    const g = L.worldButton;
    expect(Math.min(g.w, g.h)).toBeGreaterThanOrEqual(WS_UI.tapMin);
    expect(g.x + g.w / 2).toBeLessThanOrEqual(L.size.w);
    expect(g.y - g.h / 2).toBeGreaterThanOrEqual(0);
    expect(g.y + g.h / 2).toBeLessThan(160);
    const wallet = { ...WS_WALLET[kind === 'tall' ? 'tallRoom' : 'wide'], w: 192, h: 92 };
    expect(rectsOverlap(g, wallet)).toBe(false);
  });

  it('puts the tall tracker at the top and the kid off to the model’s side on return', () => {
    const L = roomLayout('tall', ['wheels']);
    expect(L.buddyBar.w).toBeGreaterThan(L.buddyBar.h);
    expect(L.buddyBar.y + L.buddyBar.h / 2).toBeLessThan(120);
    expect(L.characterHome.x).toBeGreaterThan(L.model.x + L.model.maxW / 2);
    expect(standOf(L, 'wheels')).toEqual(L.characterHome);
    expect(standOf(L, undefined)).toEqual(L.characterHome);
  });

  it('walking: duration and stepping reach the target', () => {
    expect(walkSeconds({ x: 0, y: 0 }, { x: 520, y: 0 }, 520)).toBeCloseTo(1);
    let p = { x: 0, y: 0 };
    let n = 0;
    for (;;) { const r = stepToward(p, { x: 300, y: 400 }, 40); p = r.p; n++; if (r.arrived) break; }
    expect(p).toEqual({ x: 300, y: 400 });
    expect(n).toBe(13);
  });
});
