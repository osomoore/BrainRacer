/**
 * Adventure Workshop "Coming Soon" page. Scales the 1920x1080 stage to the window and returns to
 * the launcher on back / confirm (any controller or keyboard) or when the hint is clicked.
 */
import { goToHub } from '../../shared/hub';
import { installMobileShell } from '../../shared/mobile';
import { createMenuInput } from '../../shared/input/menuInput';
import { fitScale } from './layout';
import { sceneMarkup } from './scene';
import './style.css';

installMobileShell();
const stage = document.getElementById('stage');
if (!stage) throw new Error('missing #stage');
stage.innerHTML = sceneMarkup();

function fit(): void {
  stage!.style.setProperty('--s', String(fitScale(window.innerWidth, window.innerHeight)));
}
fit();
window.addEventListener('resize', fit);

let leaving = false;
function leave(): void {
  if (leaving) return;
  leaving = true;
  goToHub();
}

document.getElementById('back-hint')?.addEventListener('click', leave);

const input = createMenuInput();
function frame(): void {
  if (leaving) return;
  if (input.poll().some((a) => a === 'back' || a === 'confirm')) {
    leave();
    return;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
