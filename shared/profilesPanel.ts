import { createMenuInput, keyActions, type MenuAction } from './input/menuInput';
import { listManagedProfiles, renameManagedProfile, deleteManagedProfile, mergeManagedProfiles } from './profileManager';
import { PROFILE_NAME } from './profiles';
import { createAdminPanelRoot, styleAdminPanelButton } from './sync/panel';
import { familySync } from './sync/runtime';

type ManagedProfile = ReturnType<typeof listManagedProfiles>[number];
type PanelWindow = Window & { __profilesPanelOpen?: boolean };

/** Shared grown-up profile manager, usable from either game's admin menu. */
export function openProfilesPanel(options: { onClose?: () => void; profileId?: string; initialAction?: 'delete' } = {}): () => void {
  const input = createMenuInput();
  const root = createAdminPanelRoot('Profiles', 'profilesPanel');
  root.style.zIndex = '2147483001';
  const inner = document.createElement('div'); Object.assign(inner.style, { maxWidth: '1250px', margin: '0 auto' }); root.append(inner); document.body.append(root);
  (window as PanelWindow).__profilesPanelOpen = true;
  let closed = false, raf = 0, focus = 0, message = '';
  let view: 'list' | 'rename' | 'delete' | 'confirmDelete' | 'merge' | 'confirmMerge' = options.initialAction ? 'delete' : 'list';
  let selected = options.profileId ?? '', mergeTarget = '';
  let controls: HTMLElement[] = [], actions: (() => void)[] = [];
  let profiles: ManagedProfile[] = [];
  const nameInput = document.createElement('input');
  nameInput.maxLength = PROFILE_NAME.maxLen;
  nameInput.setAttribute('aria-label', 'New profile name');
  Object.assign(nameInput.style, { font: 'bold 36px Arial', padding: '10px', borderRadius: '10px', width: 'min(80%, 500px)' });
  const finish = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    input.dispose();
    root.remove();
    window.removeEventListener('keydown', onKey, true);
    unsubscribeProfiles();
    delete (window as PanelWindow).__profilesPanelOpen;
    options.onClose?.();
  };
  const text = (s: string, size = 30) => { const p = document.createElement('p'); p.textContent = s; Object.assign(p.style, { fontSize: `${size}px`, margin: '8px' }); inner.append(p); };
  const button = (label: string, run: () => void, aria = label, parent: HTMLElement = inner) => {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-label', aria);
    styleAdminPanelButton(b, 36);
    const i = controls.length; controls.push(b); actions.push(run); b.onclick = () => { focus = i; setFocus(); run(); }; parent.append(b); return b;
  };
  const quantity = (count: number, singular: string): string => `${count} ${singular}${count === 1 ? '' : 's'}`;
  const profilesList = () => { profiles = listManagedProfiles(); };
  const duplicateGroups = () => {
    const groups = new Map<string, ManagedProfile[]>();
    for (const p of profiles) { const key = p.name.trim().toLowerCase(); groups.set(key, [...(groups.get(key) ?? []), p]); }
    return [...groups.values()].filter(group => group.length > 1).map(group => group.sort((a, b) => a.createdAt - b.createdAt));
  };
  const askDelete = (p: ManagedProfile) => { selected = p.id; view = 'delete'; focus = 0; render(); };
  const doDelete = () => { try { deleteManagedProfile(selected); message = 'Profile deleted.'; view = 'list'; } catch (e) { message = e instanceof Error ? e.message : 'Could not delete profile.'; view = 'list'; } render(); };
  const doMerge = (target: string) => {
    try {
      mergeManagedProfiles(selected, target);
      message = 'Profiles merged.';
      view = 'list';
    } catch (e) {
      message = e instanceof Error ? e.message : 'Could not merge profiles.';
      view = 'list';
    }
    render();
  };
  function render() {
    if (closed) return; profilesList(); inner.replaceChildren(); controls = []; actions = [];
    text(view === 'list' ? 'PROFILES' : view === 'rename' ? 'RENAME PROFILE' : view === 'delete' || view === 'confirmDelete' ? 'DELETE PROFILE?' : view === 'merge' ? 'MERGE PROFILE' : 'CONFIRM MERGE?', 48);
    if (message) text(message, 28);
    if (view === 'list') {
      const groups = duplicateGroups();
      const duplicateIds = new Set(groups.flatMap(group => group.map(profile => profile.id)));
      for (const group of groups) {
        const oldest = group[0]!;
        const dupeSection = document.createElement('section');
        Object.assign(dupeSection.style, { border: '3px solid #ffd43b', borderRadius: '12px', margin: '12px auto', padding: '8px' });
        inner.append(dupeSection);
        const hint = document.createElement('p'); hint.textContent = `${group.length} profiles named ${oldest.name}. Merge them?`;
        Object.assign(hint.style, { fontSize: '28px', margin: '8px' }); dupeSection.append(hint);
        button('Merge', () => {
          selected = group[group.length - 1]!.id;
          mergeTarget = oldest.id;
          view = 'confirmMerge';
          focus = 0;
          render();
        }, `Merge duplicate into oldest profile ${oldest.name}`, dupeSection);
      }
      if (!profiles.length) text('No profiles yet.');
      profiles.forEach(p => {
        const row = document.createElement('section');
        Object.assign(row.style, { border: '2px solid #63718f', borderRadius: '12px', margin: '12px auto', padding: '8px' }); inner.append(row);
        const duplicate = duplicateIds.has(p.id);
        const created = duplicate ? new Date(p.createdAt).toLocaleString() : new Date(p.createdAt).toLocaleDateString();
        const summary = document.createElement('p');
        summary.textContent = `${p.name}${duplicate ? ' · Same name' : ''} · Created ${created} · Workshop ${quantity(p.workshopParts, 'part')}, ${quantity(p.workshopChallenges, 'challenge')} · Racer ${quantity(p.racerWorlds, 'world')}, ${quantity(p.racerCars, 'car')}`;
        Object.assign(summary.style, { fontSize: '30px', margin: '8px' }); row.append(summary);
        button('Rename', () => { selected = p.id; nameInput.value = p.name; view = 'rename'; focus = 0; render(); nameInput.focus(); }, `Rename ${p.name}`, row);
        button('Delete', () => askDelete(p), `Delete ${p.name}`, row);
        button('Merge into…', () => { selected = p.id; view = 'merge'; render(); }, `Merge ${p.name} into another profile`, row);
      });
    } else if (view === 'rename') {
      text('Enter a name using letters and spaces.');
      controls.push(nameInput); actions.push(() => nameInput.focus()); inner.append(nameInput);
      button('Save name', () => { try { renameManagedProfile(selected, nameInput.value); message = 'Name saved.'; view = 'list'; } catch (e) { message = e instanceof Error ? e.message : 'Could not rename profile.'; view = 'list'; } render(); });
      button('Cancel', () => { view = 'list'; render(); });
      const keyboard = document.createElement('div');
      Object.assign(keyboard.style, { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(42px, 1fr))', maxWidth: '900px', width: '100%', margin: '8px auto' });
      inner.append(keyboard);
      const addKey = (key: string, aria = key) => {
        const b = button(key, () => {
          const start = nameInput.selectionStart ?? nameInput.value.length;
          const end = nameInput.selectionEnd ?? start;
          const insertion = key === '␣' ? ' ' : key === '⌫' ? '' : key;
          const from = key === '⌫' && start === end ? Math.max(0, start - 1) : start;
          if (nameInput.value.length - (end - from) + insertion.length > PROFILE_NAME.maxLen) return;
          nameInput.value = nameInput.value.slice(0, from) + insertion + nameInput.value.slice(end);
          const caret = from + insertion.length; nameInput.setSelectionRange(caret, caret);
        }, aria, keyboard);
        Object.assign(b.style, { minWidth: '0', minHeight: '58px', padding: '2px', margin: '3px', fontSize: '32px' });
      };
      for (const key of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') addKey(key);
      addKey('␣', 'Space'); addKey('⌫', 'Backspace');
    } else if (view === 'delete') {
      const profile = profiles.find(p => p.id === selected);
      text(`Delete ${profile?.name ?? 'this profile'} and its progress from both games?`);
      button('No', () => { view = 'list'; render(); });
      button('Continue to delete', () => { view = 'confirmDelete'; focus = 0; render(); });
    } else if (view === 'confirmDelete') {
      text('This permanently removes the profile and its progress from both games.');
      button('No', () => { view = 'list'; render(); }); button('Yes, delete profile', doDelete);
    } else if (view === 'confirmMerge') {
      const source = profiles.find(p => p.id === selected), target = profiles.find(p => p.id === mergeTarget);
      const sameName = source?.name.trim().toLowerCase() === target?.name.trim().toLowerCase();
      const identity = (p: ManagedProfile | undefined) => p ? `${p.name}${sameName ? ` (${new Date(p.createdAt).toLocaleString()})` : ''}` : 'the selected profile';
      text(`Merge ${identity(source)} into ${identity(target)}? The source profile will be removed.`);
      button('No', () => { view = 'list'; render(); }); button('Yes, merge', () => doMerge(mergeTarget));
    } else if (view === 'merge') {
      const source = profiles.find(p => p.id === selected);
      const targets = profiles.filter(p => p.id !== selected);
      text(`Choose the profile that will keep its name. ${source?.name ?? ''} and its progress will be merged into it.`);
      targets.forEach(t => {
        const same = source?.name.trim().toLowerCase() === t.name.trim().toLowerCase();
        const date = same ? ` · ${new Date(t.createdAt).toLocaleString()}` : '';
        button(`Merge into ${t.name}${date}`, () => {
          selected = source?.id ?? selected;
          mergeTarget = t.id;
          view = 'confirmMerge';
          focus = 0;
          render();
        });
      });
      button('Cancel', () => { view = 'list'; render(); });
    }
    const closeRow = document.createElement('div'); Object.assign(closeRow.style, { margin: '14px auto' }); inner.append(closeRow);
    button('Close', finish, 'Close profiles', closeRow); focus = Math.min(focus, controls.length - 1); setFocus();
  }
  function showFocus() {
    controls.forEach((control, i) => { control.style.outline = i === focus ? '5px solid #7ee7ff' : ''; });
  }
  function setFocus() {
    controls[focus]?.focus({ preventScroll: true });
    showFocus();
  }
  root.addEventListener('focusin', event => {
    const index = controls.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    focus = index;
    showFocus();
  });
  function move(dir: 'left' | 'right' | 'up' | 'down'): void {
    const current = controls[focus];
    if (!current) return;
    const rect = current.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    let best = -1, bestScore = Number.POSITIVE_INFINITY;
    controls.forEach((candidate, i) => {
      if (i === focus) return;
      const r = candidate.getBoundingClientRect();
      const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      const forward = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      if (forward <= 0) return;
      const cross = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      const score = forward + cross * 2.5;
      if (score < bestScore) { best = i; bestScore = score; }
    });
    if (best < 0) best = dir === 'up' ? 0 : controls.length - 1;
    focus = best;
    setFocus();
    controls[focus]?.scrollIntoView({ block: 'nearest' });
  }
  const handle = (action: MenuAction): void => {
    if (action === 'back') {
      if (view !== 'list') { view = 'list'; render(); }
      else finish();
    } else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') move(action);
    else if (action === 'confirm') actions[focus]?.();
  };
  function onKey(e: KeyboardEvent): void {
    if (root.contains(e.target as Node)) {
      e.stopImmediatePropagation();
      if (e.code === 'Tab') {
        const active = controls.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && active <= 0) { e.preventDefault(); controls.at(-1)?.focus(); }
        else if (!e.shiftKey && active === controls.length - 1) { e.preventDefault(); controls[0]?.focus(); }
        return;
      }
    }
    if (document.activeElement === nameInput) {
      if (e.code === 'Escape') { e.preventDefault(); handle('back'); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); actions[1]?.(); }
      return;
    }
    const action = keyActions(e.code);
    if (!action) return;
    e.preventDefault();
    handle(action);
  }
  window.addEventListener('keydown', onKey, true);
  const unsubscribeProfiles = familySync.subscribeProfiles(() => {
    queueMicrotask(() => { if (view === 'list') render(); });
  });
  render();
  const poll = () => {
    if (closed) return;
    input.poll().forEach(handle);
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);
  return finish;
}
