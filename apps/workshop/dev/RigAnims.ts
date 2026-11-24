/**
 * One model cycling through every RigAnim. `workshop.html?dev=RigAnims[&workshop=dino][&model=rex][&view=top][&anim=jump]`
 * Keys: Left/Right = previous/next anim, Up/Down = next model, 1/2 = workshop, V = side/top, Space = pause auto-advance.
 */
import Phaser from 'phaser';
import { buildRig } from '../art';
import { CATALOGS } from '../content';
import type { ModelRig, RigAnim } from '../core/runtime';
import type { Model, View, WorkshopId } from '../core/types';

const ANIMS: RigAnim[] = ['idle', 'drive', 'spinWheels', 'walk', 'run', 'jump', 'tumble', 'chomp', 'crouch', 'stand', 'flap', 'wag', 'happy', 'dizzy', 'celebrate'];
const MODELS: Record<WorkshopId, { name: string; set: Model }[]> = {
  race: [
    { name: 'default', set: {} },
    { name: 'monster pickup', set: { body: 'body.truck', wheels: 'wheels.monster', springs: 'springs.lifted', paint: 'paint.red', bumpers: 'bumpers.pusher', extra: 'extra.winch', size: 'size.big', gears: 'gears.fourByFour', engine: 'engine.big' } },
    { name: 'rocket sports', set: { body: 'body.sports', shape: 'shape.sleek', wheels: 'wheels.racing', paint: 'paint.rainbow', extra: 'extra.rocket', engine: 'engine.turbo', springs: 'springs.sport' } },
  ],
  dino: [
    { name: 'default', set: {} },
    { name: 'T-Rex', set: { head: 'head.rex', teeth: 'teeth.mega', claws: 'claws.tinyArms', legs: 'legs.powerful', move: 'move.stand', tail: 'tail.heavy', size: 'size.big', color: 'color.green' } },
    { name: 'flyer', set: { move: 'move.fly', head: 'head.crest', teeth: 'teeth.beak', color: 'color.blue', extra: 'extra.feathers', tail: 'tail.long' } },
    { name: 'swimmer', set: { move: 'move.swim', legs: 'legs.flippers', tail: 'tail.paddle', extra: 'extra.feathers', color: 'color.purple', body: 'body.slim' } },
    { name: 'spiked tail', set: { tail: 'tail.spiked', extra: 'extra.feathers', size: 'size.huge' } },
    { name: 'glow spots', set: { extra: 'extra.glow', size: 'size.small', head: 'head.horned' } },
    { name: 'leaf pattern', set: { extra: 'extra.camo' } },
    { name: 'long neck', set: { head: 'head.longNeck', body: 'body.belly', legs: 'legs.long', tail: 'tail.long', extra: 'extra.stripes' } },
  ],
};

export default class RigAnims extends Phaser.Scene {
  private workshop: WorkshopId = 'race';
  private mi = 0;
  private ai = 0;
  private view: View = 'side';
  private rig: ModelRig | null = null;
  private title!: Phaser.GameObjects.Text;
  private auto = true;
  private timer = 0;

  constructor() { super('RigAnims'); }

  create(): void {
    const q = new URLSearchParams(location.search);
    if (q.get('workshop') === 'dino') this.workshop = 'dino';
    if (q.get('view') === 'top') this.view = 'top';
    const want = (q.get('model') ?? '').toLowerCase();
    const mi = want ? MODELS[this.workshop].findIndex((m) => m.name.toLowerCase().includes(want)) : -1;
    if (mi >= 0) this.mi = mi;
    const an = ANIMS.indexOf((q.get('anim') ?? '') as RigAnim);
    if (an >= 0) { this.ai = an; this.auto = false; }
    this.title = this.add.text(960, 20, '', { fontSize: '48px', color: '#1b1b3a', fontStyle: 'bold', backgroundColor: '#ffffffcc', padding: { x: 10, y: 4 } }).setOrigin(0.5, 0);
    this.add.rectangle(960, 900, 1920, 6, 0x1b1b3a, 0.35);
    const k = this.input.keyboard!;
    const n = () => MODELS[this.workshop].length;
    k.on('keydown-RIGHT', () => { this.ai = (this.ai + 1) % ANIMS.length; this.start(); });
    k.on('keydown-LEFT', () => { this.ai = (this.ai + ANIMS.length - 1) % ANIMS.length; this.start(); });
    k.on('keydown-UP', () => { this.mi = (this.mi + 1) % n(); this.build(); });
    k.on('keydown-DOWN', () => { this.mi = (this.mi + n() - 1) % n(); this.build(); });
    k.on('keydown-ONE', () => { this.workshop = 'race'; this.mi = 0; this.build(); });
    k.on('keydown-TWO', () => { this.workshop = 'dino'; this.mi = 0; this.build(); });
    k.on('keydown-V', () => { this.view = this.view === 'side' ? 'top' : 'side'; this.build(); });
    k.on('keydown-SPACE', () => { this.auto = !this.auto; });
    this.build();
  }

  private build(): void {
    this.rig?.destroy();
    const cat = CATALOGS[this.workshop];
    const base: Model = Object.fromEntries(cat.aspects.map((a) => [a.id, a.starters[0]]));
    const mod = MODELS[this.workshop][this.mi];
    const model = { ...base, ...mod.set };
    if (this.workshop === 'dino') {
      const q = new URLSearchParams(location.search);
      for (const aspect of ['head', 'size']) {
        const variant = cat.variants.find((v) => v.aspect === aspect && v.id === q.get(aspect));
        if (variant) model[aspect] = variant.id;
      }
    }
    this.rig = buildRig(this, this.workshop, model, this.view);
    const s = Math.min(2, 560 / Math.max(this.rig.height, 1), 1500 / Math.max(this.rig.width, 1));
    this.rig.root.setScale(s);
    this.rig.root.setPosition(960, this.view === 'side' ? 880 : 520);
    this.start();
  }

  private start(): void {
    this.timer = 0;
    const a = ANIMS[this.ai];
    this.rig?.play(a);
    this.title.setText(`${this.workshop}: ${MODELS[this.workshop][this.mi].name} - ${a} (${this.view})`);
  }

  update(_t: number, dt: number): void {
    if (!this.auto) return;
    this.timer += dt;
    if (this.timer > 2600) { this.ai = (this.ai + 1) % ANIMS.length; this.start(); }
  }
}
