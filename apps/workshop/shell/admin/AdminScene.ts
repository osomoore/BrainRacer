/**
 * Grown-up admin (full stage, text >= 36 px). Opened by the pad chord / F9 (straight in) or the gear
 * (multiplication gate first). Pauses the panes while open; they refresh when it closes.
 */
import Phaser from 'phaser';
import { checkGateAnswer, appendGateDigit, makeGateQuestion, type GateQuestion } from '../../../../shared/adminGate';
import { listProfiles } from '../../../../shared/profiles';
import { STAGE, WS_ADMIN, WS_RULES, WS_UI } from '../../config';
import { READING_LABEL, READING_LEVELS, WORKSHOP_IDS, type PlayerSave, type ReadingLevel, type VariantOverride, type WorkshopId } from '../../core/types';
import { engine } from '../../logic';
import { Button } from '../../ui/Button';
import { Confirm } from '../../ui/Confirm';
import { FocusGroup } from '../../ui/FocusGroup';
import { NumberPad } from '../../ui/NumberPad';
import { showBanner } from '../../ui/Banner';
import { COLORS, css, makeText, roundedOriginY, roundedTexture } from '../../ui/style';
import { shell } from '../shell';
import { applyKey, firstRow, scrollTop, type AdminRow, type ListKey, type ListState } from './adminModel';
import { openFamilySyncPanel } from '../../../../shared/sync/panel';
import { familySync } from '../../../../shared/sync/runtime';

type View = { kind: 'gate' } | { kind: 'main' } | { kind: 'player'; profile: string } | { kind: 'workshop'; profile: string; ws: WorkshopId };

const NAVY = 0x14213d;
const WS_TITLE: Record<WorkshopId, string> = { race: 'Race Shop', dino: 'Dino Lab' };
const LIST_X = 150, LIST_W = 1500, LIST_Y = 170;

export class AdminScene extends Phaser.Scene {
  private view: View = { kind: 'main' };
  private stack: View[] = [];
  private rows: AdminRow[] = [];
  private ls: ListState = { focus: 0, editing: false, draft: 0 };
  private top = 0;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private confirm?: Confirm;
  private gate?: { q: GateQuestion; entered: string; text: Phaser.GameObjects.Text };
  private group?: FocusGroup;
  private opened = 0;
  private startGate = false;

  constructor() { super('admin'); }

  init(d: { gate?: boolean }): void { this.startGate = !!d?.gate; }

  create(): void {
    this.cameras.main.setViewport(0, 0, STAGE.w, STAGE.h);
    this.cameras.main.setBackgroundColor(css(NAVY));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.view.kind === 'gate' && /^Digit[0-9]$|^Numpad[0-9]$/.test(e.code)) this.gateDigit(Number(e.code.slice(-1)));
    });
    this.open(this.startGate);
  }

  private open(gate: boolean): void {
    this.opened = this.game.getFrame();
    this.stack = [];
    this.confirm?.destroy(); this.confirm = undefined;
    this.show(gate ? { kind: 'gate' } : { kind: 'main' });
  }

  // ---------------------------------------------------------------- views

  private show(v: View, keepFocus = false): void {
    const prevFocus = this.ls.focus;
    this.view = v;
    this.clear();
    this.add.rectangle(STAGE.w / 2, STAGE.h / 2, STAGE.w, STAGE.h, NAVY).setDepth(-1);
    if (v.kind === 'gate') { this.buildGate(); return; }
    this.rows = this.buildRows(v);
    const f = keepFocus ? Math.min(prevFocus, this.rows.length - 1) : firstRow(this.rows);
    this.ls = { focus: this.rows[f] && (this.rows[f].kind === 'action' || this.rows[f].kind === 'value') ? f : firstRow(this.rows), editing: false, draft: 0 };
    this.top = keepFocus ? this.top : 0;
    this.render();
  }

  private clear(): void {
    this.group?.destroy(); this.group = undefined;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.gate = undefined;
    this.children.removeAll(true);
  }

  private title(v: View): string {
    if (v.kind === 'main') return 'Grown-up settings';
    if (v.kind === 'player') return `Player: ${listProfiles().find((p) => p.id === v.profile)?.name ?? v.profile}`;
    if (v.kind === 'workshop') return `${listProfiles().find((p) => p.id === v.profile)?.name ?? ''} - ${WS_TITLE[v.ws]}`;
    return '';
  }

  private realSave(id: string): PlayerSave | null { return shell.store.player(id); }

  private buildRows(v: View): AdminRow[] {
    const rows: AdminRow[] = [];
    if (v.kind === 'main') {
      rows.push({ kind: 'section', label: 'This device' });
      rows.push({
        kind: 'value', label: 'Admin Mode', value: shell.adminMode() ? 'on' : 'off',
        options: [{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }],
        set: (id) => shell.setAdminMode(id === 'on'),
      });
      rows.push({ kind: 'note', label: 'On: all parts open, 10 test challenges, nothing is saved.' });
      rows.push({ kind: 'section', label: 'Players' });
      const profiles = listProfiles();
      if (profiles.length === 0) rows.push({ kind: 'note', label: 'No players yet.' });
      for (const p of profiles) {
        rows.push({ kind: 'action', label: p.name, tag: shell.store.hasPlayer(p.id) ? '>' : 'no workshop save > ', run: () => this.push({ kind: 'player', profile: p.id }) });
      }
      if (familySync.enabled) {
        rows.push({ kind: 'action', label: 'Family sync', tag: '>', run: () => openFamilySyncPanel() });
      }
      rows.push({ kind: 'section', label: '' });
      rows.push({ kind: 'action', label: 'Close', run: () => this.close() });
    } else if (v.kind === 'player') {
      const save = this.realSave(v.profile);
      if (!save) {
        rows.push({ kind: 'note', label: 'This player has not entered the workshop yet.' });
      } else {
        rows.push({
          kind: 'value', label: 'Reading level', value: save.reading,
          options: READING_LEVELS.map((l) => ({ id: l, label: READING_LABEL[l] })),
          set: (id) => shell.store.setPlayer(v.profile, { ...save, reading: id as ReadingLevel }),
        });
      }
      for (const ws of WORKSHOP_IDS) rows.push({ kind: 'action', label: WS_TITLE[ws], tag: '>', run: () => this.push({ kind: 'workshop', profile: v.profile, ws }) });
      rows.push({ kind: 'action', label: 'Reset this player (fresh start)', run: () => {
        this.confirm = new Confirm(this, {
          cx: STAGE.w / 2, cy: STAGE.h / 2, w: 1100, text: 'Reset both workshops to a fresh start? Reading level stays the same.', yes: 'Yes, reset', no: 'No', defaultYes: false,
          touch: false, depth: 900,
          onYes: () => this.mutate(v, (save) => engine.resetPlayer(save), 'Player reset'),
        });
      } });
      rows.push({ kind: 'action', label: 'Back', run: () => this.pop() });
    } else if (v.kind === 'workshop') {
      const save = this.realSave(v.profile) ?? engine.newPlayerSave('medium');
      const progress = engine.progressOf(save, v.ws);
      const grant = WS_RULES.adminCurrencyGrant;
      rows.push({ kind: 'action', label: `Add +${grant} ${v.ws === 'race' ? 'coins' : 'Bio Juice'} (wallet: ${progress.wallet})`, run: () => this.mutate(v, (s) => {
        const p = engine.grantCurrency(v.ws, engine.progressOf(s, v.ws));
        return { ...s, workshops: { ...s.workshops, [v.ws]: p } };
      }, `+${grant} added`) });
      rows.push({ kind: 'action', label: 'Regenerate challenges', run: () => this.mutate(v, (s) => ({ ...s, workshops: { ...s.workshops, [v.ws]: engine.regenerate(v.ws, engine.progressOf(s, v.ws)) } }), 'New challenges made') });
      rows.push({
        kind: 'action', label: 'Reset workshop progress',
        run: () => {
          this.confirm = new Confirm(this, {
            cx: STAGE.w / 2, cy: STAGE.h / 2, w: 1000, text: `Erase all ${WS_TITLE[v.ws]} progress for this player?`, yes: 'Yes, erase', no: 'No', defaultYes: false,
            touch: false, depth: 900,
            onYes: () => this.mutate(v, (s) => { const w = { ...s.workshops }; delete w[v.ws]; return { ...s, workshops: w }; }, 'Progress erased'),
          });
        },
      });
      const cat = engine.catalog(v.ws);
      const avail = engine.available(v.ws, progress);
      for (const aspect of cat.aspects) {
        rows.push({ kind: 'section', label: aspect.label });
        for (const variant of cat.variants.filter((x) => x.aspect === aspect.id)) {
          const cur = progress.overrides[variant.id] ?? 'auto';
          rows.push({
            kind: 'value', label: variant.name, value: cur, tag: avail.has(variant.id) ? 'in use' : 'closed',
            options: [{ id: 'auto', label: 'Auto' }, { id: 'open', label: 'Open' }, { id: 'locked', label: 'Locked' }],
            set: (id) => this.mutate(v, (s) => {
              const p = engine.setOverride(v.ws, engine.progressOf(s, v.ws), variant.id, id as VariantOverride | 'auto');
              return { ...s, workshops: { ...s.workshops, [v.ws]: engine.refreshBoard(v.ws, p) } };
            }, undefined, true),
          });
        }
      }
      rows.push({ kind: 'section', label: '' });
      rows.push({ kind: 'action', label: 'Back', run: () => this.pop() });
    }
    return rows;
  }

  /** Applies a change to the player's REAL save (even in Admin Mode), then redraws. */
  private mutate(v: View, f: (s: PlayerSave) => PlayerSave, msg?: string, keep = false): void {
    if (v.kind !== 'workshop' && v.kind !== 'player') return;
    const save = this.realSave(v.profile) ?? engine.newPlayerSave('medium');
    shell.store.setPlayer(v.profile, f(save));
    this.show(v, keep);
    if (msg) showBanner(this, { x: STAGE.w / 2, y: 980, text: msg, depth: 1000 });
  }

  private push(v: View): void { this.stack.push(this.view); this.show(v); }

  private pop(): void {
    const v = this.stack.pop();
    if (v) this.show(v); else this.close();
  }

  private close(): void { shell.closeAdmin(); }

  // ---------------------------------------------------------------- list rendering

  private get rowHeight(): number {
    return this.view.kind === 'main' ? WS_ADMIN.rowH : WS_UI.tapMin + 12;
  }

  private get visibleRows(): number {
    return Math.min(WS_ADMIN.visibleRows, Math.floor((STAGE.h - LIST_Y - 65) / this.rowHeight));
  }

  private render(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.objs.push(o); return o; };
    const rowH = this.rowHeight, vis = this.visibleRows, f = WS_ADMIN.font;
    this.top = scrollTop(this.ls.focus, this.top, vis, this.rows.length);
    add(makeText(this, STAGE.w / 2, 70, this.title(this.view), { size: 56, color: COLORS.yellow, small: true }));
    add(new Button(this, { x: 150, y: 70, w: 220, h: 100, label: this.stack.length ? 'Back' : 'Close', fontSize: 44, color: COLORS.yellow, small: true, onClick: () => this.keyInput('back', true) }));

    const slice = this.rows.slice(this.top, this.top + vis);
    slice.forEach((row, k) => {
      const i = this.top + k;
      const y = LIST_Y + k * rowH + rowH / 2;
      const focused = i === this.ls.focus;
      if (row.kind === 'section') {
        if (row.label) add(makeText(this, LIST_X, y + 16, row.label.toUpperCase(), { size: 36, color: 0x9bd7ff, origin: [0, 0.5], small: true }));
        return;
      }
      if (row.kind === 'note') {
        add(makeText(this, LIST_X + 20, y, row.label, { size: 36, color: 0xdfe8ff, bold: false, origin: [0, 0.5], small: true, wrap: LIST_W - 40 }));
        return;
      }
      const h = rowH - 12;
      add(this.add.image(LIST_X + LIST_W / 2, y, roundedTexture(this, LIST_W, h, focused ? COLORS.yellow : 0x2a3a66, { radius: 20, strokeW: 4, stroke: focused ? COLORS.paper : 0x0b1530, shadow: 0, gloss: false })).setOrigin(0.5, roundedOriginY(h, 0)));
      const ink = focused ? COLORS.ink : COLORS.paper;
      add(makeText(this, LIST_X + 30, y, row.label, { size: f, color: ink, origin: [0, 0.5], small: true }));
      if (row.kind === 'action') {
        if (row.tag) add(makeText(this, LIST_X + LIST_W - 30, y, row.tag, { size: 36, color: ink, origin: [1, 0.5], small: true }));
      } else {
        const editing = focused && this.ls.editing;
        const opt = editing ? row.options[this.ls.draft] : row.options.find((o) => o.id === row.value) ?? row.options[0];
        const txt = editing ? `<   ${opt.label}   >` : opt.label;
        if (row.tag) add(makeText(this, LIST_X + 900, y, row.tag, { size: 36, color: focused ? 0x555577 : 0x9bd7ff, bold: false, origin: [0, 0.5], small: true }));
        add(makeText(this, LIST_X + LIST_W - 30, y, txt, { size: f, color: editing ? 0x0a7a2a : ink, origin: [1, 0.5], small: true }));
      }
      const zone = add(this.add.zone(LIST_X + LIST_W / 2, y, LIST_W, h).setInteractive());
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.tapRow(i, p.x));
    });

    // touch scroll arrows + hint
    const needScroll = this.rows.length > vis;
    if (needScroll) {
      add(new Button(this, { x: 1780, y: 300, w: 120, h: 120, label: '^', fontSize: 64, color: COLORS.yellow, small: true, onClick: () => this.scroll(-1) }));
      add(new Button(this, { x: 1780, y: 800, w: 120, h: 120, label: 'v', fontSize: 52, color: COLORS.yellow, small: true, onClick: () => this.scroll(1) }));
    }
    add(makeText(this, STAGE.w / 2, STAGE.h - 40, this.ls.editing ? 'Left / Right: change   A: finish   B: cancel' : 'Up / Down: move   A: change or open   B: back   F9: close', { size: 34, color: 0x9bd7ff, bold: false, small: true }));
  }

  private scroll(dir: 1 | -1): void {
    this.top = Math.max(0, Math.min(this.top + dir * 4, this.rows.length - this.visibleRows));
    // move focus into the window if it left it
    const vis = this.visibleRows;
    if (this.ls.focus < this.top || this.ls.focus >= this.top + vis) {
      for (let i = this.top; i < Math.min(this.rows.length, this.top + vis); i++) {
        if (this.rows[i].kind === 'action' || this.rows[i].kind === 'value') { this.ls = { ...this.ls, focus: i, editing: false }; break; }
      }
    }
    this.render();
  }

  private tapRow(i: number, px: number): void {
    if (this.confirm?.open) return;
    if (i === this.ls.focus && this.ls.editing) {
      const x = px;
      if (x > LIST_X + LIST_W - 520 && x < LIST_X + LIST_W - 270) this.keyInput('left');
      else if (x >= LIST_X + LIST_W - 270) this.keyInput('right');
      else this.keyInput('confirm');
      return;
    }
    this.ls = { ...this.ls, focus: i, editing: false };
    this.keyInput('confirm');
  }

  private keyInput(key: ListKey, fromButton = false): void {
    void fromButton;
    const r = applyKey(this.rows, this.ls, key);
    this.ls = r.state;
    if (r.commit) {
      const row = this.rows[r.commit.row];
      if (row.kind === 'value') row.set(r.commit.id);
      if (this.view.kind === 'main' || this.view.kind === 'player') this.show(this.view, true);
      return;
    }
    if (r.run !== undefined) { const row = this.rows[r.run]; if (row.kind === 'action') row.run(); return; }
    if (r.leave) { this.pop(); return; }
    this.render();
  }

  // ---------------------------------------------------------------- gate

  private buildGate(): void {
    const cx = STAGE.w / 2;
    const q = makeGateQuestion(Math.random, WS_ADMIN.gateMin, WS_ADMIN.gateMax);
    this.add.rectangle(cx, STAGE.h / 2, STAGE.w, STAGE.h, NAVY).setDepth(-1);
    makeText(this, cx, 80, 'Grown-ups only!', { size: 64, color: COLORS.yellow, small: true });
    makeText(this, cx, 200, `${q.a} x ${q.b} = ?`, { size: 110, color: COLORS.paper, small: true });
    this.add.image(cx, 350, roundedTexture(this, 460, 110, COLORS.paper, { radius: 24, shadow: 0, gloss: false })).setOrigin(0.5, roundedOriginY(110, 0));
    const text = makeText(this, cx, 350, '', { size: 80, color: COLORS.ink, small: true });
    this.gate = { q, entered: '', text };
    const pad = new NumberPad(this, {
      x: cx, y: 440, key: 120, gap: 14, small: true,
      onDigit: (d) => this.gateDigit(d),
      onDelete: () => this.gateSet(this.gate!.entered.slice(0, -1)),
      onOk: () => this.gateSubmit(),
    });
    const cancel = new Button(this, { x: 330, y: 540, w: 360, h: 130, label: 'Cancel', fontSize: 52, color: COLORS.red, textColor: COLORS.paper, small: true, onClick: () => this.close() });
    this.group = new FocusGroup({ touch: false });
    this.group.set([...pad.buttons, cancel]);
    this.group.focus(pad.buttons[0]);
    this.objs.push(...pad.buttons, cancel);
  }

  private gateSet(s: string): void { if (this.gate) { this.gate.entered = s; this.gate.text.setText(s); } }

  private gateDigit(d: number): void {
    if (this.gate) this.gateSet(appendGateDigit(this.gate.entered, d, WS_ADMIN.gateMaxDigits));
  }

  private gateSubmit(): void {
    if (!this.gate) return;
    if (checkGateAnswer(this.gate.q, this.gate.entered)) { this.show({ kind: 'main' }); return; }
    this.show({ kind: 'gate' }); // wrong: a fresh question
  }

  override update(): void {
    if ((window as Window & { __familySyncDialogOpen?: boolean }).__familySyncDialogOpen) return;
    shell.router.step(this.game.getFrame());
    if (this.game.getFrame() === this.opened) return;
    const actions = shell.router.rawActions();
    for (const a of actions) {
      if (this.confirm?.open) { this.confirm.handle(a === 'menu' ? 'back' : a); continue; }
      if (this.view.kind === 'gate') {
        if (a === 'back') { this.close(); return; }
        this.group?.handle(a);
        continue;
      }
      if (a === 'menu') continue;
      this.keyInput(a as ListKey);
      if (!this.scene.isActive()) return;
    }
  }
}
