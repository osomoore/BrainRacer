/**
 * Adventure Workshop entry. Currently the Coming Soon page; the shell package replaces the game part.
 * `?dev=<Name>` boots a bare Phaser game running `apps/workshop/dev/<Name>.ts` (default export = Scene class).
 * KEEP the ?dev= behaviour when replacing this file.
 */
import { goToHub } from '../../shared/hub';
import { installMobileShell } from '../../shared/mobile';
import { ensureProfiles } from '../../shared/profiles';
import { createMenuInput } from '../../shared/input/menuInput';
import { fitScale } from './layout';
import { sceneMarkup } from './scene';
import './style.css';

ensureProfiles();
installMobileShell();

const devName = new URLSearchParams(location.search).get('dev');
if (devName) void bootDev(devName);
else comingSoon();

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

function comingSoon(): void {
  const stage = document.getElementById('stage');
  if (!stage) throw new Error('missing #stage');
  stage.innerHTML = sceneMarkup();
  const fit = () => stage.style.setProperty('--s', String(fitScale(window.innerWidth, window.innerHeight)));
  fit();
  window.addEventListener('resize', fit);
  let leaving = false;
  const leave = () => { if (!leaving) { leaving = true; goToHub(); } };
  document.getElementById('back-hint')?.addEventListener('click', leave);
  const input = createMenuInput();
  const frame = () => {
    if (leaving) return;
    if (input.poll().some((a) => a === 'back' || a === 'confirm')) { leave(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
