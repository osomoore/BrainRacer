import { createMenuInput, keyActions, type MenuAction } from '../input/menuInput';
import { familySync } from './runtime';
import { normalizeFamilyCode } from './code';
import { encodeQr } from './qr';

type DialogWindow = Window & { __familySyncDialogOpen?: boolean };
const qrCache = new Map<string, { url: string; canvas?: HTMLCanvasElement }>();

export function syncDotColor(): number | null {
  if (!familySync.enabled) return null;
  const status = familySync.state.status;
  return status === 'error' ? 0xff5c68 : status === 'offline' ? 0xffc857 : status === 'synced' ? 0x48d597 : 0x929bb0;
}

export function consumeFamilyJoinCode(): string | undefined {
  const url = new URL(location.href);
  const raw = url.searchParams.get('join');
  if (!raw) return undefined;
  url.searchParams.delete('join');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return normalizeFamilyCode(raw) ?? undefined;
}

function siteRoot(): string {
  const path = location.pathname.replace(/(?:racer|workshop)\.html$/i, '');
  return path.endsWith('/') ? path : `${path}/`;
}

/** Full-screen, controller and touch accessible grown-up panel shared by both games. */
export function openFamilySyncPanel(options: { joinCode?: string; onClose?: () => void } = {}): () => void {
  if (!familySync.enabled) return () => {};
  const input = createMenuInput();
  const root = document.createElement('div');
  root.dataset.familySyncPanel = 'true';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Family sync');
  root.setAttribute('aria-modal', 'true');
  Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '2147483000', background: '#101d3b', color: '#fff',
    font: 'bold 40px Arial, sans-serif', overflow: 'auto', padding: '20px', boxSizing: 'border-box', textAlign: 'center' });
  const inner = document.createElement('div');
  Object.assign(inner.style, { maxWidth: '1200px', margin: '0 auto' });
  root.append(inner); document.body.append(root);
  (window as DialogWindow).__familySyncDialogOpen = true;

  let view: 'home' | 'leave' | 'delete' | 'deleteFinal' = 'home';
  let focus = 0;
  let showCode = false;
  let message = '';
  let busy = false;
  let closed = false;
  let raf = 0;
  let controls: HTMLElement[] = [];
  let actions: (() => void)[] = [];
  let codeValue = options.joinCode ?? '';
  const codeInput = document.createElement('input');
  codeInput.value = codeValue;
  codeInput.placeholder = 'TIGER-MAPLE-SOCK-42';
  codeInput.autocomplete = 'off';
  codeInput.spellcheck = false;
  codeInput.addEventListener('input', () => { codeValue = codeInput.value; });
  codeInput.setAttribute('aria-label', 'Family code');
  Object.assign(codeInput.style, { width: 'min(90%, 720px)', height: '72px', font: 'bold 40px Arial', textAlign: 'center', textTransform: 'uppercase', margin: '12px', borderRadius: '12px' });

  const finish = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf); unsub(); input.dispose(); root.remove();
    delete (window as DialogWindow).__familySyncDialogOpen;
    window.removeEventListener('keydown', onKey, true);
    options.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    if (document.activeElement === codeInput && (e.key.length === 1 || e.code === 'Backspace' || e.code === 'Delete')) return;
    if (document.activeElement === codeInput && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
      e.preventDefault();
      const joinIndex = controls.findIndex((el) => el.textContent === 'Join a family');
      if (!busy && !familySync.state.busy && joinIndex >= 0) { focus = joinIndex; actions[focus]?.(); }
      return;
    }
    const action = keyActions(e.code);
    if (!action) return; // Let physical letters and digits reach the code field.
    e.preventDefault(); e.stopImmediatePropagation(); handle(action);
  };
  window.addEventListener('keydown', onKey, true);
  const addText = (text: string, size = 40): void => {
    const p = document.createElement('p'); p.textContent = text;
    Object.assign(p.style, { fontSize: `${size}px`, margin: '10px 4px' }); inner.append(p);
  };
  const addButton = (label: string, run: () => void, aria = label): void => {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-label', aria);
    Object.assign(b.style, { minHeight: '72px', minWidth: '130px', padding: '8px 20px', margin: '7px', border: '4px solid #fff',
      borderRadius: '14px', background: '#ffd43b', color: '#14213d', font: 'bold 40px Arial', cursor: 'pointer', maxWidth: 'calc(100vw - 56px)', whiteSpace: 'normal' });
    const index = controls.length;
    b.onclick = () => { focus = index; setFocus(); if (!busy && !familySync.state.busy) run(); };
    controls.push(b); actions.push(run); inner.append(b);
  };
  const addKey = (key: string): void => addButton(key, () => {
    if (key === '⌫') codeInput.value = codeInput.value.slice(0, -1);
    else if (key === 'CLEAR') codeInput.value = '';
    else codeInput.value += key;
    codeValue = codeInput.value;
  }, key === '⌫' ? 'Delete last character' : key);
  const addCodeKeyboard = (): void => {
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(42px, 1fr))', maxWidth: '900px', width: '100%', margin: '8px auto' });
    inner.append(grid);
    for (const key of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      addKey(key);
      const keyButton = controls[controls.length - 1];
      Object.assign(keyButton.style, { minWidth: '0', minHeight: '64px', padding: '2px', margin: '3px', fontSize: '40px' });
      grid.append(keyButton);
    }
    const digitGrid = document.createElement('div');
    Object.assign(digitGrid.style, { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(42px, 1fr))', maxWidth: '750px', width: '100%', margin: '8px auto' });
    inner.append(digitGrid);
    for (const key of '0123456789') { addKey(key); const b = controls[controls.length - 1]; Object.assign(b.style, { minWidth: '0', minHeight: '64px', padding: '2px', margin: '3px', fontSize: '40px' }); digitGrid.append(b); }
    for (const key of ['-', '⌫', 'CLEAR']) { addKey(key); const b = controls[controls.length - 1]; Object.assign(b.style, { minWidth: '0', minHeight: '64px', padding: '2px', margin: '3px', fontSize: '40px' }); digitGrid.append(b); }
  };
  const revealQr = (code: string): HTMLCanvasElement | undefined => {
    let entry = qrCache.get(code);
    const url = new URL(siteRoot(), location.origin);
    url.searchParams.set('join', code);
    const fake = new URLSearchParams(location.search).get('syncfake') === '1';
    if (fake) url.searchParams.set('syncfake', '1');
    const href = url.toString();
    if (entry?.url === href && entry.canvas) return entry.canvas;
    let modules: boolean[][];
    try { modules = encodeQr(href); }
    catch { return undefined; }
    const quiet = 4, scale = 5, n = modules.length + quiet * 2;
    const canvas = document.createElement('canvas'); canvas.width = n * scale; canvas.height = n * scale;
    canvas.setAttribute('aria-label', 'QR code to join this family');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale); }));
    }
    qrCache.set(code, { url: href, canvas });
    return canvas;
  };
  const render = (): void => {
    if (closed) return;
    const s = familySync.state;
    inner.replaceChildren(); controls = []; actions = [];
    addText(view === 'home' ? 'FAMILY SYNC' : view === 'leave' ? 'LEAVE FAMILY?' : view === 'delete' ? 'DELETE FAMILY?' : 'FINAL DELETE CONFIRMATION', 56);
    if (s.lastSync) addText(`Last sync ${new Date(s.lastSync).toLocaleString()}`);
    if (s.status === 'offline') addText('Offline. Changes stay on this device.');
    if (s.error) addText(s.error);
    if (s.code && !s.lastSync && !s.error && s.status !== 'offline') addText('First sync pending.');
    if (message) addText(message);
    if (view === 'leave') {
      addText('Local profiles and progress will stay on this device.');
      addButton(busy ? 'Working…' : 'Yes, leave family', () => { busy = true; render(); familySync.leaveFamily(); busy = false; view = 'home'; message = 'This device left the family.'; render(); });
      addButton('Keep family', () => { view = 'home'; render(); });
    } else if (view === 'delete') {
      addText('This will erase synced profiles and progress for every device.');
      addButton('Continue to delete', () => { view = 'deleteFinal'; render(); });
      addButton('Keep family', () => { view = 'home'; render(); });
    } else if (view === 'deleteFinal') {
      addText('This erases synced profiles and progress for every device.', 40);
      addButton(busy ? 'Deleting…' : 'Delete family now', async () => { busy = true; render(); const ok = await familySync.deleteFamily(); busy = false; view = 'home'; message = ok ? 'Family data deleted.' : ''; render(); });
      addButton('Keep family', () => { view = 'home'; render(); });
    } else if (!s.code) {
      addButton(busy ? 'Working…' : 'Make a family', async () => { busy = true; message = ''; render(); const ok = await familySync.makeFamily(); busy = false; message = ok ? 'Family created. Show the code before sharing it.' : ''; showCode = false; render(); });
      if (options.joinCode) addText('Grown-up: confirm Join to add this device to the family.');
      addText('Or enter a family code');
      codeInput.value = codeValue;
      controls.push(codeInput); actions.push(() => codeInput.focus()); inner.append(codeInput);
      addCodeKeyboard();
      addButton(busy ? 'Joining…' : 'Join a family', async () => {
        const code = normalizeFamilyCode(codeInput.value);
        if (!code) { message = 'Check the code and try again.'; render(); return; }
        busy = true; message = ''; render(); const ok = await familySync.joinFamily(code); busy = false; codeValue = ''; showCode = false;
        message = ok ? 'Joined. Profiles and progress are syncing.' : ''; render();
      });
    } else {
      const codeText = showCode ? s.code! : 'Family code hidden';
      addText(codeText, 48);
      const codeLine = inner.lastElementChild as HTMLElement;
      codeLine.style.overflowWrap = 'anywhere';
      addButton(showCode ? 'Hide code and QR' : 'Show code and QR', () => { showCode = !showCode; render(); });
      if (showCode) {
        const qrWrap = document.createElement('div'); Object.assign(qrWrap.style, { margin: '8px auto', width: 'max-content', padding: '8px', background: '#fff' });
        const qr = revealQr(s.code);
        if (qr) { qrWrap.append(qr); inner.append(addTextNode('Scan to add another device')); inner.append(qrWrap); }
        else addText('The QR link is too long. Enter the family code on the other device.');
      }
      addText(`Pending changes: ${s.pending}`);
      addButton(busy ? 'Syncing…' : 'Sync now', async () => { busy = true; render(); await familySync.syncNow(); busy = false; render(); });
      addButton('Leave family on this device', () => { view = 'leave'; render(); });
      addButton('Delete family for all devices', () => { view = 'delete'; render(); });
    }
    addButton('Close', finish);
    focus = Math.min(focus, controls.length - 1);
    setFocus();
  };
  function addTextNode(text: string): HTMLParagraphElement {
    const p = document.createElement('p'); p.textContent = text;
    Object.assign(p.style, { fontSize: '40px', margin: '8px' }); return p;
  }
  const setFocus = (): void => {
    controls.forEach((el, i) => {
      el.style.outline = i === focus ? '5px solid #7ee7ff' : '';
      el.style.outlineOffset = i === focus ? '3px' : '';
    });
    controls[focus]?.focus({ preventScroll: true });
  };
  const moveFocus = (direction: 'left' | 'right' | 'up' | 'down'): void => {
    const current = controls[focus];
    if (!current) return;
    const a = current.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = -1, bestScore = Number.POSITIVE_INFINITY;
    controls.forEach((candidate, i) => {
      if (i === focus) return;
      const r = candidate.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
      const forward = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      if (forward <= 0) return;
      const cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      const score = forward + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best < 0) {
      const edge = controls.map((el, i) => ({ i, r: el.getBoundingClientRect() }));
      const score = ({ r }: typeof edge[number]) => direction === 'left' ? r.left : direction === 'right' ? -r.right : direction === 'up' ? r.top : -r.bottom;
      best = edge.sort((x, y) => score(x) - score(y))[0]?.i ?? focus;
    }
    focus = best;
    setFocus();
    controls[focus]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const handle = (action: MenuAction): void => {
    if (closed) return;
    if (action === 'back') {
      if (view !== 'home') { view = 'home'; render(); }
      else finish();
      return;
    }
    if (controls.length === 0) return;
    if (action === 'left' || action === 'right' || action === 'up' || action === 'down') { moveFocus(action); return; }
    else if (action === 'confirm' && !busy && !familySync.state.busy) actions[focus]?.();
    setFocus();
  };
  const unsub = familySync.subscribe(render);
  render();
  if (options.joinCode && !familySync.state.code) codeInput.focus();
  const poll = (): void => {
    if (closed) return;
    const controllerActions = input.poll();
    controllerActions.forEach(handle);
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);
  return finish;
}
