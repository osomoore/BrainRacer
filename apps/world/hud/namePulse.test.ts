import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import type { WorldContext, WorldPlayer } from '../core/runtime';
import { createWorldBus } from '../host/bus';
import { NamePulse } from './namePulse';

class Label {
  text = '';
  visible = false;
  scale = 1;
  alpha = 1;
  constructor(readonly x: number, readonly y: number, readonly fontSize: string) {}
  setOrigin(): this { return this; }
  setDepth(): this { return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setText(text: string): this { this.text = text; return this; }
  setScale(scale: number): this { this.scale = scale; return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
}

describe('name pulse', () => {
  it('pulses in only the interacting view and restarts when another thing is touched', () => {
    const players = [{ index: 0 }, { index: 1 }] as WorldPlayer[];
    const ctx = { players, time: 0, bus: createWorldBus() } as WorldContext;
    const labels: Label[] = [];
    const scene = { add: { text(x: number, y: number, _text: string, style: { fontSize: string }) {
      const label = new Label(x, y, style.fontSize);
      labels.push(label);
      return label;
    } } } as unknown as Phaser.Scene;
    const pulse = new NamePulse(ctx);
    pulse.build(scene);
    expect(labels.map(label => label.x)).toEqual([480, 1440]);

    ctx.bus.emit('player:interact', { player: players[1], target: { kind: 'item', id: 'egg' } });
    ctx.time = 0.3;
    pulse.update();
    expect(labels[0].visible).toBe(false);
    expect(labels[1]).toMatchObject({ text: 'Egg', visible: true, scale: 1.1, alpha: 1 });
    expect(parseInt(labels[1].fontSize, 10)).toBeGreaterThanOrEqual(56);

    ctx.time = 1.1;
    pulse.update();
    expect(labels[1].alpha).toBeCloseTo(0.5);
    ctx.bus.emit('player:interact', { player: players[1], target: { kind: 'obstacle', id: 'iceBlock' } });
    pulse.update();
    expect(labels[1]).toMatchObject({ text: 'Ice Block', visible: true, alpha: 1 });

    ctx.time = 2.4;
    pulse.update();
    expect(labels[1].visible).toBe(false);
    pulse.destroy();
  });
});
