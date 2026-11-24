/**
 * newProfile: name (on-screen letter grid, or type on a physical keyboard) then reading level, then creates the
 * shared profile and the workshop save. Duplicate names (any case) are refused. B deletes a letter; with an empty
 * name (or on the level step) it goes back. Creating a profile is always real, even in Admin Mode.
 */
import { createProfile, listProfiles } from '../../../shared/profiles';
import type { PaneContext, Screen, ScreenFactory } from '../core/runtime';
import { engine } from '../logic';
import type { ShellPaneContext } from '../shell/paneContext';
import { shell } from '../shell/shell';
import { Button } from '../ui/Button';
import { FocusGroup } from '../ui/FocusGroup';
import { typedText } from '../ui/input';
import { appendName, checkName, deleteName, NAME_MESSAGES } from '../ui/letterGrid';
import { LetterGrid, type LetterKey } from '../ui/LetterGridView';
import { addBackButton, addHeader } from '../ui/screenChrome';
import { COLORS, fitText, makeText, roundedOriginY, roundedTexture } from '../ui/style';
import { PROFILE_NAME } from '../../../shared/profiles';
import { buildLevelPicker } from './reading/levelPicker';

const newProfileScreen: ScreenFactory = (): Screen => {
  let ctx: ShellPaneContext;
  let group: FocusGroup | undefined;
  let phase: 'name' | 'level' = 'name';
  let name = '';
  let objs: Phaser.GameObjects.GameObject[] = [];
  let nameText: Phaser.GameObjects.Text | undefined;
  let message: Phaser.GameObjects.Text | undefined;
  let grid: LetterGrid | undefined;

  const clear = () => {
    group?.destroy(); group = undefined;
    grid?.destroy(); grid = undefined;
    objs.forEach((o) => o.destroy());
    objs = [];
    nameText = undefined; message = undefined; // destroyed with objs: never touch them after a screen change
  };

  const showName = () => {
    clear();
    phase = 'name';
    const { w } = ctx.size;
    const wide = ctx.layout === 'wide';
    objs.push(addHeader(ctx, 'What is your name?', wide ? 80 : 70, wide ? 76 : 56));
    const boxW = wide ? 860 : 640;
    const boxX = wide ? w / 2 : 600;
    const boxY = wide ? 210 : 205;
    const back = addBackButton(ctx, () => ctx.go('profile'), wide ? 175 : 155, boxY);
    objs.push(back);
    objs.push(ctx.scene.add.image(boxX, boxY, roundedTexture(ctx.scene, boxW, 140, COLORS.paper, { radius: 30, gloss: false })).setOrigin(0.5, roundedOriginY(140)));
    nameText = makeText(ctx.scene, boxX, boxY, '', { size: 84 });
    message = makeText(ctx.scene, w / 2, wide ? 318 : 312, '', { size: 44, color: COLORS.red, stroke: COLORS.paper, wrap: w - 60 });
    objs.push(nameText, message);
    grid = new LetterGrid(ctx.scene, { x: w / 2, y: wide ? 370 : 350, layout: ctx.layout, onKey: onKey });
    group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch, wrap: true });
    group.set([...grid.buttons, back]);
    group.focus(grid.buttons[0]);
    renderName();
  };

  const renderName = () => {
    if (!nameText) return;
    nameText.setText(name + (name.length < PROFILE_NAME.maxLen ? '_' : '')).setFontSize(84);
    fitText(nameText, (ctx.layout === 'wide' ? 860 : 640) - 40, 48);
  };

  const onKey = (k: LetterKey) => {
    message?.setText('');
    if (k.type === 'add') name = appendName(name, k.ch);
    else if (k.type === 'delete') name = deleteName(name);
    else { done(); return; } // DONE changes the screen (or shows a message): nothing more to render here
    renderName();
  };

  const done = () => {
    const r = checkName(name, listProfiles().map((p) => p.name));
    if (!r.ok) { message?.setText(NAME_MESSAGES[r.reason]); ctx.audio.sfx('back'); return; }
    name = r.name;
    showLevel();
  };

  const showLevel = () => {
    clear();
    phase = 'level';
    const { w } = ctx.size;
    objs.push(addHeader(ctx, `${name}, how well do you read?`, 110, ctx.layout === 'wide' ? 76 : 52));
    const buttons = buildLevelPicker(ctx, (level) => {
      const p = createProfile(name);
      if (!p) { showName(); message?.setText(NAME_MESSAGES.empty); return; }
      shell.store.setPlayer(p.id, engine.newPlayerSave(level));
      ctx.setProfile(p.id);
      ctx.audio.sfx('sparkle');
      ctx.go('pickWorkshop');
    });
    const back = addBackButton(ctx, showName);
    objs.push(...buttons, back);
    group = new FocusGroup({ audio: ctx.audio, touch: ctx.input.touch });
    group.set([...buttons, back]);
    group.focus(buttons[1]);
    void w;
  };

  return {
    create(c: PaneContext) {
      ctx = c as ShellPaneContext;
      ctx.audio.music('title');
      name = '';
      showName();
    },
    update() {
      const actions = ctx.input.poll();
      const text = typedText(ctx.input);
      let submitted = false;
      if (phase === 'name') {
        for (const ch of text) {
          if (ch === ' ' && actions.includes('confirm')) continue; // Space also presses the focused key: don't type it twice
          if (ch === '\n') { submitted = true; done(); break; }
          message?.setText('');
          name = appendName(name, ch);
          renderName();
        }
      }
      for (const a of actions) {
        if (submitted && a === 'confirm') continue; // Enter already finished the name
        if (a === 'back') {
          if (phase === 'level') { showName(); return; }
          if (name.length > 0) { name = deleteName(name); message?.setText(''); renderName(); } else { ctx.go('profile'); return; }
        } else group?.handle(a);
        if (phase === 'level' && submitted) break;
      }
    },
    destroy() { clear(); nameText = undefined; message = undefined; },
  };
};

export default newProfileScreen;
export type { Button };
