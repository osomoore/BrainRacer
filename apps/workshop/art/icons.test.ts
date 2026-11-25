import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURRENCY_ICON_TEXTURES, ensureCurrencyIcon, ensurePriceTagIcon } from './icons';

function fakeScene() {
  const keys = new Set<string>();
  const created: { key: string; width: number; height: number }[] = [];
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(target, prop) {
      if (prop in target) return Reflect.get(target, prop);
      return vi.fn();
    },
    set(target, prop, value) { return Reflect.set(target, prop, value); },
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const scene = {
    textures: {
      exists: (key: string) => keys.has(key),
      create: (key: string, { width, height }: HTMLCanvasElement) => {
        keys.add(key);
        created.push({ key, width, height });
        return { add: vi.fn() };
      },
    },
  } as unknown as Phaser.Scene;
  return { scene, created };
}

describe('workshop currency and price tag icons', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses distinct baked coin and juice textures for each workshop', () => {
    const { scene, created } = fakeScene();
    expect(ensureCurrencyIcon(scene, 'race')).toBe(CURRENCY_ICON_TEXTURES.race);
    expect(ensureCurrencyIcon(scene, 'dino')).toBe(CURRENCY_ICON_TEXTURES.dino);
    expect(CURRENCY_ICON_TEXTURES.race).not.toBe(CURRENCY_ICON_TEXTURES.dino);
    expect(created).toEqual([
      { key: CURRENCY_ICON_TEXTURES.race, width: 144, height: 144 },
      { key: CURRENCY_ICON_TEXTURES.dino, width: 144, height: 144 },
    ]);
  });

  it('bakes each texture once and makes a wide price tag with room for a number', () => {
    const { scene, created } = fakeScene();
    const coinKey = ensureCurrencyIcon(scene, 'race');
    expect(ensureCurrencyIcon(scene, 'race')).toBe(coinKey);
    expect(ensurePriceTagIcon(scene)).toBe('ws:currency:price-tag');
    expect(ensurePriceTagIcon(scene)).toBe('ws:currency:price-tag');
    expect(created).toEqual([
      { key: CURRENCY_ICON_TEXTURES.race, width: 144, height: 144 },
      { key: 'ws:currency:price-tag', width: 300, height: 168 },
    ]);
  });
});
