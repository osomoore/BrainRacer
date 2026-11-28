import type Phaser from 'phaser';
import { bakeBuddyTextures, buddyBob, buddyTexture, dinoFlapTexture, type BuddyKind } from '../../../shared/buddies';
import { WORLD_BUDDIES } from '../config';
import { DEPTH, type WorldContext, type WorldPlayer } from '../core/runtime';
import type { BuddySpot, Vec } from '../core/types';
import { polygonDistanceSquared } from '../gen/geometry';
import { ABadge } from '../hud/aBadge';
import { featurePassable, terrainWall } from '../logic/rules';
import { BuddyCards } from './BuddyCards';
import { buddyHop, followBuddy } from './follow';
import { buddyOffer, buyBuddy, chooseBuddy, ownedBuddies } from './ownership';
import { BUDDY_SHORT } from './text';

const C = WORLD_BUDDIES;
const HUT = 'world-buddy-hut';
type PickInput = { type: 'nav'; dir: -1 | 1 } | { type: 'press'; button: 'a' };
type View = {
  badge: ABadge;
  cards?: BuddyCards;
  back?: () => void;
  offer?: BuddySpot;
  picker?: { options: (BuddyKind | undefined)[]; index: number };
  follower?: { kind: BuddyKind; image: Phaser.GameObjects.Image; at?: Vec };
};
type SpotArt = { hut: Phaser.GameObjects.Image; portraits: Map<WorldPlayer, Phaser.GameObjects.Image> };

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** World interaction and art with screen-space cards mounted in the existing HUD scene. */
export class BuddyModule {
  private readonly views = new Map<WorldPlayer, View>();
  private readonly spots = new Map<string, SpotArt>();
  private centers = '';

  constructor(private readonly ctx: WorldContext) {
    bakeBuddyTextures(ctx.scene);
    this.bakeHut();
    for (const player of ctx.players) this.views.set(player, { badge: new ABadge(ctx, player) });
    this.startDemo();
  }

  build(scene: Phaser.Scene, back: (player: WorldPlayer) => void): void {
    for (const [player, view] of this.views) {
      view.back = () => back(player);
      view.cards = new BuddyCards(scene, player, this.ctx.players.length, {
        buy: yes => this.answer(player, view, yes),
        cycle: dir => this.pick(player, { type: 'nav', dir }),
        pick: () => this.pick(player, { type: 'press', button: 'a' }),
        back: view.back,
      });
    }
  }

  showPicker(player: WorldPlayer, visible: boolean): void {
    const view = this.views.get(player)!;
    if (!visible) {
      view.picker = undefined;
      view.cards?.showPicker(false, undefined);
      return;
    }
    if (!view.picker) {
      const options = [undefined, ...ownedBuddies(player.save)];
      view.picker = { options, index: Math.max(0, options.indexOf(player.save.buddies?.following)) };
    }
    view.cards?.showPicker(true, view.picker.options[view.picker.index]);
  }

  pick(player: WorldPlayer, input: PickInput): void {
    const view = this.views.get(player)!;
    const picker = view.picker;
    if (!picker) return;
    if (input.type === 'nav') {
      const count = picker.options.length;
      picker.index = (picker.index + input.dir + count) % count;
      this.showPicker(player, true);
    } else {
      if (chooseBuddy(player.save, picker.options[picker.index])) this.ctx.save(player);
      view.back?.();
    }
  }

  update(dt: number): void {
    this.updateSpots();
    for (const [player, view] of this.views) {
      this.interact(player, view);
      this.updateFollower(player, view, dt);
    }
  }

  destroy(): void {
    for (const [player, view] of this.views) {
      if (view.offer) player.busy = false;
      view.cards?.destroy();
      view.badge.destroy();
      view.follower?.image.destroy();
    }
    for (const art of this.spots.values()) this.destroySpot(art);
    this.spots.clear();
    this.views.clear();
  }

  private interact(player: WorldPlayer, view: View): void {
    const { a, b, menu } = player.controls.pressed;
    const { world } = this.ctx;
    view.badge.hide();
    if (view.offer) {
      if (a || b || menu) this.answer(player, view, a && !b && !menu);
    } else if (view.cards && !player.busy && !player.move.flying) {
      const spot = world.plan(player.hex).buddySpot;
      const kind = spot && buddyOffer(world.seed, spot, player.profileId, player.save);
      if (spot && kind && distance(spot.at, player.move) <= C.handRadius) {
        view.badge.show();
        if (a) {
          player.controls.pressed.a = false;
          player.busy = true;
          view.offer = spot;
          view.cards.showOffer(player, kind);
          view.badge.hide();
        }
      }
    }
    view.badge.update();
  }

  private answer(player: WorldPlayer, view: View, yes: boolean): void {
    if (!view.offer) return;
    const spot = view.offer;
    view.offer = undefined;
    player.busy = false;
    view.cards?.showOffer(player, undefined);
    if (!yes) return;
    const result = buyBuddy(this.ctx.world.seed, spot, player.profileId, player.save);
    if (result === 'short') this.ctx.bus.emit('ui:banner', { player, text: BUDDY_SHORT });
    if (result === 'bought') {
      this.ctx.save(player);
      this.spots.get(spot.id)?.portraits.get(player)?.setVisible(false);
    }
  }

  private updateSpots(): void {
    const { players, world, scene } = this.ctx;
    const centers = players.map(({ hex }) => `${hex.q},${hex.r}`).join('|');
    if (centers !== this.centers) {
      this.centers = centers;
      const keep = new Set<string>();
      for (const player of players) {
        for (const coord of world.hexesNear(player.move.x, player.move.y, C.renderRings)) {
          const spot = world.plan(coord).buddySpot;
          if (!spot || keep.has(spot.id)) continue;
          keep.add(spot.id);
          if (this.spots.has(spot.id)) continue;
          const hut = scene.add.image(spot.at.x, spot.at.y, HUT).setDepth(DEPTH.objects);
          const portraits = new Map<WorldPlayer, Phaser.GameObjects.Image>();
          for (const viewer of players) {
            const kind = buddyOffer(world.seed, spot, viewer.profileId, viewer.save);
            if (!kind) continue;
            const image = scene.add.image(spot.at.x, spot.at.y, buddyTexture(kind)).setDepth(DEPTH.objects + 1);
            image.setScale(44 / Math.max(image.width, image.height));
            this.ctx.showOnlyTo(image, viewer);
            portraits.set(viewer, image);
          }
          this.spots.set(spot.id, { hut, portraits });
        }
      }
      for (const [id, art] of this.spots) if (!keep.has(id)) {
        this.destroySpot(art);
        this.spots.delete(id);
      }
    }
    for (const art of this.spots.values()) {
      for (const [player, portrait] of art.portraits) portrait.setRotation(-this.ctx.viewRotation(player));
    }
  }

  private destroySpot(art: SpotArt): void {
    art.hut.destroy();
    for (const portrait of art.portraits.values()) portrait.destroy();
  }

  private updateFollower(player: WorldPlayer, view: View, dt: number): void {
    const kind = player.save.buddies?.following;
    if (view.follower && view.follower.kind !== kind) {
      view.follower.image.destroy();
      view.follower = undefined;
    }
    if (!kind) return;
    const { scene, world, time } = this.ctx;
    view.follower ??= { kind, image: scene.add.image(0, 0, buddyTexture(kind)).setDepth(DEPTH.players - 1) };
    const follower = view.follower;
    const C = WORLD_BUDDIES.follower;
    const { obstacles, features } = world.nearbySolids(player.move.x, player.move.y, C.catchUpDistance + C.radius);
    const walls = features.filter(feature => feature.kind === 'jump' || !featurePassable(feature, player.traits));
    const clear = ({ x, y }: Vec) => {
      for (const [dx, dy] of [[0, 0], [C.radius, 0], [-C.radius, 0], [0, C.radius], [0, -C.radius]]) {
        const sample = world.surfaceAt(x + dx, y + dy);
        if (sample.kind === 'cliff' || terrainWall(sample, player.traits)) return false;
      }
      return !walls.some(wall => polygonDistanceSquared(wall.area, x, y) <= C.radius ** 2);
    };
    const at = followBuddy(follower.at, player.move, dt, clear);
    follower.at = at;
    follower.image.setVisible(!!at);
    if (!at) return;
    const hop = buddyHop(at, obstacles);
    const rotation = -this.ctx.viewRotation(player);
    const lift = hop + buddyBob(time, 1.5, 4);
    const lifted = { x: at.x + Math.sin(rotation) * lift, y: at.y - Math.cos(rotation) * lift };
    const drawn = clear(lifted) ? lifted : at;
    const texture = kind === 'dino' ? dinoFlapTexture(time, 10) : buddyTexture(kind);
    if (follower.image.texture.key !== texture) follower.image.setTexture(texture);
    follower.image.setPosition(drawn.x, drawn.y).setRotation(rotation)
      .setScale(C.size / Math.max(follower.image.width, follower.image.height) * (1 + 0.18 * hop / C.hopHeight));
  }

  private bakeHut(): void {
    const { scene } = this.ctx;
    if (scene.textures.exists(HUT)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x283747).fillCircle(52, 52, 49);
    g.fillStyle(0x8d93a3).fillCircle(52, 50, 44);
    g.fillStyle(0xc2c6cf).fillCircle(46, 42, 32);
    g.fillStyle(0x283747).fillCircle(52, 53, 27);
    g.fillStyle(0x131e29).fillCircle(52, 53, 22);
    g.generateTexture(HUT, 104, 104);
    g.destroy();
  }

  private startDemo(): void {
    const { players, world } = this.ctx;
    if (!import.meta.env.DEV || new URLSearchParams(location.search).get('buddy') !== 'demo'
      || players.some(player => !/^world-quick-[12]$/.test(player.profileId))) return;
    const { move } = players[0];
    const spot = world.hexesNear(move.x, move.y, 3)
      .map(coord => world.plan(coord).buddySpot)
      .find(candidate => candidate && players.every(player =>
        buddyOffer(world.seed, candidate, player.profileId, player.save)
        && !terrainWall(world.surfaceAt(candidate.at.x, candidate.at.y), player.traits)));
    if (!spot) return;
    for (const player of players) {
      player.move.x = spot.at.x - 66;
      player.move.y = spot.at.y + (player.index - (players.length - 1) / 2) * 96;
      player.move.angle = 0;
      player.save.stars = Math.max(player.save.stars, C.price);
    }
  }
}
