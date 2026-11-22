import { describe, expect, it } from 'vitest';
import { engine } from '../logic';
import { AdminSandboxes, sandboxSave } from './sandboxes';

describe('AdminSandboxes', () => {
  it('builds once per profile+workshop, rebuilds on demand, never touches the real save', () => {
    const real = engine.newPlayerSave('medium');
    const before = JSON.stringify(real);
    const sb = new AdminSandboxes();
    const a = sb.get('p1', 'race', real);
    expect(sb.get('p1', 'race', real)).toBe(a);
    expect(sb.size).toBe(1);
    sb.get('p1', 'dino', real);
    expect(sb.size).toBe(2);
    const b = sb.rebuild('p1', 'race', real);
    expect(sb.get('p1', 'race', real)).toBe(b);
    expect(JSON.stringify(real)).toBe(before);
    sb.clear();
    expect(sb.size).toBe(0);
  });
  it('seeds differ between calls', () => {
    const sb = new AdminSandboxes();
    expect(sb.nextSeed()).not.toBe(sb.nextSeed());
  });
  it('sandboxSave swaps only the workshop progress', () => {
    const real = engine.newPlayerSave('hard');
    const prog = engine.newProgress('race');
    const s = sandboxSave(real, 'race', prog);
    expect(s.reading).toBe('hard');
    expect(s.workshops.race).toBe(prog);
    expect(real.workshops.race).toBeUndefined();
  });
});
