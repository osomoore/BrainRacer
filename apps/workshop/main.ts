/**
 * Adventure Workshop entry. Boots the Phaser game (title / join -> one pane per player -> screens).
 * `?dev=<Name>` boots a bare Phaser game running `apps/workshop/dev/<Name>.ts` (default export = Scene class).
 */
import '../../shared/offline';
import { installMobileShell } from '../../shared/mobile';
import { ensureProfiles } from '../../shared/profiles';

ensureProfiles();
installMobileShell();

const devName = new URLSearchParams(location.search).get('dev');
void (devName ? bootDev(devName) : bootGame());

async function bootGame(): Promise<void> {
  const { createWorkshopGame } = await import('./shell/game');
  const stage = document.getElementById('stage')!;
  stage.removeAttribute('id');
  stage.style.cssText = 'position:fixed;inset:0';
  createWorkshopGame(stage);
}

async function bootDev(name: string): Promise<void> {
  const mods = import.meta.glob<{ default: new () => Phaser.Scene }>('./dev/*.ts');
  const load = mods[`./dev/${name}.ts`];
  if (!load) throw new Error(`no dev scene apps/workshop/dev/${name}.ts`);
  const [{ default: Phaser }, mod] = await Promise.all([import('phaser'), load()]);
  const stage = document.getElementById('stage')!;
  stage.removeAttribute('id');
  stage.style.cssText = 'position:fixed;inset:0';
  (window as unknown as { __game: Phaser.Game }).__game = new Phaser.Game({
    type: Phaser.AUTO, parent: stage, width: 1920, height: 1080, backgroundColor: '#4fc3ff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, fixedStep: true, fps: 60 } },
    scene: [mod.default],
  });
}
