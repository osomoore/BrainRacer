import '../../shared/offline';
import { installMobileShell } from '../../shared/mobile';
import { ensureProfiles } from '../../shared/profiles';
import { familySync } from '../../shared/sync/runtime';
import { WORLD } from './config';

ensureProfiles();
familySync.start();
installMobileShell();

const stage = document.getElementById('stage')!;
const devName = new URLSearchParams(location.search).get('dev');
void (devName ? bootDev(devName) : bootGame());

async function bootGame(): Promise<void> {
  const { createWorldGame } = await import('./shell/game');
  exposeGame(createWorldGame(stage));
}

async function bootDev(name: string): Promise<void> {
  const scenes = import.meta.glob<{ default: new () => Phaser.Scene }>('./dev/*.ts');
  const load = scenes[`./dev/${name}.ts`];
  if (!load) throw new Error(`no dev scene apps/world/dev/${name}.ts`);
  const [{ default: Phaser }, scene] = await Promise.all([import('phaser'), load()]);
  exposeGame(new Phaser.Game({
    type: Phaser.AUTO, parent: stage, width: WORLD.width, height: WORLD.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene.default],
  }));
}

function exposeGame(game: Phaser.Game): void {
  (window as Window & { __world?: Phaser.Game }).__world = game;
}
