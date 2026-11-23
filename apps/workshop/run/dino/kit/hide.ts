/**
 * Dino Lab scene kit: the "hide from the big sniffing dino" routine shared by ferns, desert and tall grass.
 * The big dino is goofy and friendly: it sniffs, scratches its head, shrugs and wanders off (hidden), or it finds the
 * dino and gives a friendly lick / tap (found: "you're it", nothing scary, no words).
 */
import type { Act } from './act';
import { BigDino } from './critters';

/** Big dino placed off the right edge, facing left, scaled against the player's dino and the area width. */
export function makeBig(a: Act, fromX = a.W + 380): BigDino {
  const k = Math.max(0.5, Math.min(1.5, (a.rig.height * a.rs * 1.15) / 340, (a.W * 0.3) / 440));
  const big = new BigDino(a, fromX, a.gy - 14, k);
  big.setScale(k, -1);
  return big;
}

/** Stand the big dino so its nose is over `noseX` (facing left). */
export const bigXForNose = (big: BigDino, noseX: number): number => noseX + big.nose.x * Math.abs(big.box.scaleX);

/** Plod in sniffing the ground to a spot with its nose over `noseX`. */
export async function bigArrive(_a: Act, big: BigDino, noseX: number, ms = 2200): Promise<void> {
  big.setMood('normal');
  await big.walkTo(bigXForNose(big, noseX), ms);
}

/** Hidden: sniff, scratch head, shrug, wander off to `exitX`. Resolves when it has left. */
export async function bigSniffsPast(a: Act, big: BigDino, exitX: number): Promise<void> {
  await big.sniff(3);
  big.setMood('shrug');
  await big.tilt(-8, 220);
  const p = big.nosePos();
  void a.floatIcon('p:question', p.x, p.y - 110 * Math.abs(big.box.scaleX), 0.9, 50, 1100);
  a.sfx('wobble');
  await a.wait(500);
  await big.tilt(0, 250);
  big.setMood('normal');
  await big.walkTo(exitX, 1500);
}

/** Found: it spots the dino, then licks it (heart + soggy drops), or taps its head. `dinoHead` = world point above the dino. */
export async function bigFindsDino(a: Act, big: BigDino, how: 'lick' | 'tap'): Promise<void> {
  await big.sniff(2);
  big.setMood('surprised');
  a.sfx('giggle', { rate: 0.8 });
  const ks = Math.abs(big.box.scaleX);
  void a.floatIcon('p:exclaim', big.nosePos().x, big.nosePos().y - 120 * ks, 0.9, 40, 900);
  await big.tilt(-10, 160);
  await a.wait(300);
  if (how === 'lick') {
    big.setMood('lick');
    await big.tilt(30, 220);
    a.sfx('sniff');
    await big.tilt(44, 180);
    const h = a.pt('headTop');
    void a.burst('drop', h.x, h.y + 20, { n: 8, spread: 200, up: 160, gravity: 700, ms: 800 });
    void a.floatIcon('p:heart', h.x - 20, h.y - 20, 1.1, 120, 1300);
    void a.floatIcon('p:heart', h.x + 50, h.y - 60, 0.8, 110, 1300);
    a.sfx('splat', { volume: 0.5 });
    a.play('happy');
    await a.wait(300);
    a.sfx('giggle');
    await big.tilt(10, 300);
  } else {
    big.setMood('laugh');
    for (let i = 0; i < 2; i++) { await big.tilt(38, 140); a.sfx('boing', { volume: 0.6 }); await big.tilt(14, 140); }
    const h = a.pt('headTop');
    void a.burst('star', h.x, h.y, { n: 4, spread: 100, up: 140, gravity: 500, ms: 700, scale: 0.8 });
    a.sfx('giggle');
    void a.hop(70, 520);
  }
  void a.sparkle(6);
}
