/** Reading-level chooser shared by the newProfile and reading screens: four big buttons with a sample sentence. */
import type { PaneContext } from '../../core/runtime';
import { READING_LABEL, READING_LEVELS, type ReadingLevel } from '../../core/types';
import { WS_UI } from '../../config';
import { Button } from '../../ui/Button';

const COLORS_BY_LEVEL: Record<ReadingLevel, number> = { starter: 0xbfe3ff, easy: 0xa8e6a1, medium: 0xffe08a, hard: 0xffb08a };

export function buildLevelPicker(ctx: PaneContext, onPick: (l: ReadingLevel) => void): Button[] {
  const { w } = ctx.size;
  const wide = ctx.layout === 'wide';
  return READING_LEVELS.map((level, i) => new Button(ctx.scene, {
    x: wide ? w / 2 + (i - (READING_LEVELS.length - 1) / 2) * 452 : w / 2,
    y: wide ? 560 : 264 + i * 184,
    w: wide ? 420 : Math.min(880, w - 60),
    h: wide ? 520 : 160,
    label: READING_LABEL[level],
    sub: WS_UI.readingSamples[level],
    fontSize: wide ? 72 : 58,
    color: COLORS_BY_LEVEL[level],
    onClick: () => onPick(level),
  }));
}
