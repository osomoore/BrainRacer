import type { PlayerSave, WorkshopId } from '../apps/workshop/core/types';
import { isLearningChallenge } from '../apps/workshop/logic/learning';
import { challengeTitle } from '../apps/workshop/logic/wording';
import { createMenuInput, keyActions, type MenuAction } from './input/menuInput';
import { createAdminPanelRoot, styleAdminPanelButton } from './sync/panel';

type Entry = { title: string; at: number; activeMs?: number; tries?: number; hintShown?: boolean };
type ReportWindow = Window & { __progressReportOpen?: boolean };
const ROWS_PER_PAGE = 8;
const DASH = '—';
const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Format measured challenge time in whole minutes; short runs remain visible as <1. */
export function formatActiveMinutes(activeMs?: number): string {
  if (activeMs === undefined || !Number.isFinite(activeMs) || activeMs < 0) return DASH;
  if (activeMs < 30_000) return '<1';
  return String(Math.round(activeMs / 60_000));
}

function entries(save: PlayerSave, workshop: WorkshopId): Entry[] {
  const progress = save.workshops[workshop];
  if (!progress) return [];
  return Object.entries(progress.completed).flatMap(([id, done]) => {
    const challenge = progress.challenges[id];
    if (!challenge || !isLearningChallenge(challenge)) return [];
    const learning = progress.learning?.[id];
    const measured = learning?.wonAt !== undefined ? learning : undefined;
    return [{ title: challengeTitle(challenge, save.reading), at: measured?.wonAt ?? done.wonAt,
      activeMs: measured?.activeMs,
      tries: measured?.tries, hintShown: measured?.hintShown }];
  }).sort((a, b) => b.at - a.at);
}

function knownTries(wins: readonly Entry[]): number[] {
  return wins.flatMap(win => win.tries === undefined ? [] : [win.tries]);
}

function average(wins: readonly Entry[]): string {
  const tries = knownTries(wins);
  return tries.length ? (tries.reduce((sum, n) => sum + n, 0) / tries.length).toFixed(1) : DASH;
}

function trend(wins: readonly Entry[]): string {
  const tries = knownTries(wins);
  const percent = tries.length ? `${Math.round(tries.filter(n => n === 1).length / tries.length * 100)}%` : DASH;
  return `Average tries: ${average(wins.slice(0, 10))} (last 10) vs ${average(wins.slice(10, 20))} (previous 10) · First-try wins: ${percent}`;
}

const styles = `
  [data-progress-report] main { max-width: 1320px; margin: 0 auto; }
  [data-progress-report] h1 { font-size: clamp(32px, 4vw, 52px); margin: 8px 0 4px; }
  [data-progress-report] p { font-size: clamp(18px, 2.1vw, 30px); margin: 10px 0 18px; }
  [data-progress-report] .report-controls { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; }
  [data-progress-report] .report-controls button { min-height: 54px !important; }
  [data-progress-report] button[aria-pressed="false"] { background: #26385e !important; color: #fff !important; border-color: #6d82ac !important; }
  [data-progress-report] button:focus { outline: 4px solid #7ee7ff; outline-offset: 3px; }
  [data-progress-report] table { border-collapse: collapse; width: 100%; margin: 12px auto; font-size: clamp(16px, 2vw, 30px); }
  [data-progress-report] th, [data-progress-report] td { padding: clamp(8px, 1vw, 16px); border-bottom: 1px solid #526582; }
  [data-progress-report] thead { background: #26385e; }
  [data-progress-report] tbody th { font-weight: 600; }
  [data-progress-report] tbody td { font-weight: 400; }
  [data-progress-report] tr:nth-child(even) { background: #182849; }
  [data-progress-report] tr > :first-child { text-align: left; width: 48%; }
  [data-progress-report] .report-page { font-size: clamp(18px, 2vw, 28px); margin: 0 12px; }
`;

/** Report for the kid selected in Workshop's grown-up settings. */
export function openProgressReport(save: PlayerSave, options: { playerName: string; onClose?: () => void }): () => void {
  const input = createMenuInput();
  const root = createAdminPanelRoot('Progress report', 'progressReport');
  root.style.zIndex = '2147483001';
  const style = document.createElement('style');
  style.textContent = styles;
  const inner = document.createElement('main');
  root.append(style, inner);
  document.body.append(root);
  (window as ReportWindow).__progressReportOpen = true;

  let closed = false;
  let raf = 0;
  let workshop: WorkshopId = 'race';
  let page = 0;
  let controls: HTMLButtonElement[] = [];
  const wins = { race: entries(save, 'race'), dino: entries(save, 'dino') };

  function finish(): void {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    input.dispose();
    window.removeEventListener('keydown', onKey, true);
    root.remove();
    delete (window as ReportWindow).__progressReportOpen;
    options.onClose?.();
  }

  function button(parent: HTMLElement, id: string, label: string, action: () => void): HTMLButtonElement {
    const control = document.createElement('button');
    control.type = 'button';
    control.dataset.action = id;
    control.textContent = label;
    styleAdminPanelButton(control, 26);
    control.onclick = action;
    controls.push(control);
    parent.append(control);
    return control;
  }

  function render(focus: string): void {
    inner.replaceChildren();
    controls = [];
    const heading = document.createElement('h1');
    heading.textContent = 'Progress report';
    const name = document.createElement('p');
    name.textContent = options.playerName;
    const shops = document.createElement('nav');
    shops.className = 'report-controls';
    shops.setAttribute('aria-label', 'Shops');
    const changeShop = (id: WorkshopId, label: string) => {
      button(shops, id, label, () => { workshop = id; page = 0; render(id); })
        .setAttribute('aria-pressed', String(workshop === id));
    };
    changeShop('race', 'Race Shop');
    changeShop('dino', 'Dino Lab');

    const list = wins[workshop];
    const summary = document.createElement('p');
    summary.textContent = trend(list);
    inner.append(heading, name, shops, summary);
    if (list.length) {
      const table = document.createElement('table');
      table.setAttribute('aria-label', 'Solved tests');
      const headings = table.createTHead().insertRow();
      // No hint column: every failed try already names a fix, so "hint seen" would just mean tries > 1.
      for (const label of ['Solved test', 'Solved', 'Minutes', 'Tries']) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        headings.append(cell);
      }
      const body = table.createTBody();
      for (const win of list.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)) {
        const row = body.insertRow();
        const title = document.createElement('th');
        title.scope = 'row';
        title.textContent = win.title;
        row.append(title);
        const when = new Date(win.at);
        row.insertCell().textContent = win.at > 0 && Number.isFinite(when.getTime()) ? date.format(when) : DASH;
        row.insertCell().textContent = formatActiveMinutes(win.activeMs);
        row.insertCell().textContent = win.tries?.toString() ?? DASH;
      }
      inner.append(table);
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'No solved tests yet.';
      inner.append(empty);
    }

    const footer = document.createElement('div');
    footer.className = 'report-controls';
    const pages = Math.ceil(list.length / ROWS_PER_PAGE);
    if (pages > 1) {
      if (page > 0) button(footer, 'previous', 'Previous', () => { page--; render(page > 0 ? 'previous' : 'next'); });
      const label = document.createElement('span');
      label.className = 'report-page';
      label.textContent = `Page ${page + 1} of ${pages}`;
      footer.append(label);
      if (page + 1 < pages) button(footer, 'next', 'Next', () => { page++; render(page + 1 < pages ? 'next' : 'previous'); });
    }
    button(footer, 'close', 'Close', finish);
    inner.append(footer);
    controls.find(control => control.dataset.action === focus)?.focus({ preventScroll: true });
  }

  function move(direction: 'left' | 'right' | 'up' | 'down'): void {
    const focused = controls.findIndex(control => control === document.activeElement);
    const current = controls[focused];
    if (!current) { controls[0]?.focus(); return; }
    const from = current.getBoundingClientRect();
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    let best: HTMLButtonElement | undefined;
    let score = Infinity;
    for (const control of controls) {
      const to = control.getBoundingClientRect();
      const x = to.x + to.width / 2 - from.x - from.width / 2;
      const y = to.y + to.height / 2 - from.y - from.height / 2;
      const forward = (horizontal ? x : y) * sign;
      const distance = forward + 2.5 * Math.abs(horizontal ? y : x);
      if (forward <= 0 || distance >= score) continue;
      score = distance;
      best = control;
    }
    best?.focus();
  }

  function handle(action: MenuAction): void {
    if (action === 'back') finish();
    else if (action === 'confirm') controls.find(control => control === document.activeElement)?.click();
    else move(action);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.stopImmediatePropagation();
    if (event.code === 'Tab') {
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === boundary || !root.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
      return;
    }
    const action = keyActions(event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) handle(action);
  }

  function poll(): void {
    for (const action of input.poll()) {
      handle(action);
      if (closed) return;
    }
    raf = requestAnimationFrame(poll);
  }
  window.addEventListener('keydown', onKey, true);
  render('race');
  poll();
  return finish;
}
