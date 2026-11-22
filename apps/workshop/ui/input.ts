/**
 * Shell extensions of the PaneInput contract (core/runtime.ts), plus button-prompt labels.
 *
 * `ctx.input` is really a ShellPaneInput. Screens that need typed letters call `typedText(ctx.input)`
 * (physical keyboards only; returns [] elsewhere). `promptLabel(ctx.input, 'confirm')` gives the text for a
 * button badge: 'A' / 'B' / 'Start' on a pad, 'Space' / 'Enter' / 'Esc' / 'Back' on a keyboard, null on touch.
 */
import type { PaneAction, PaneInput } from '../core/runtime';
import type { DeviceId } from '../../../shared/input/deviceInput';

export interface ShellPaneInput extends PaneInput {
  /** Letters (and "\n" for Enter) typed on a physical keyboard since the last call. Call once per frame, like poll(). */
  text(): string[];
  /** The device this pane was joined with (null: touch). In 1P any device is accepted, this one decides the prompts. */
  readonly device: DeviceId | null;
}

export function typedText(input: PaneInput): string[] {
  return (input as Partial<ShellPaneInput>).text?.() ?? [];
}

/** Badge text for an action, or null when no badge should show (touch). */
export function promptLabel(input: PaneInput, action: PaneAction): string | null {
  if (input.prompts === 'none') return null;
  const device = (input as Partial<ShellPaneInput>).device;
  if (input.prompts === 'pad') return action === 'confirm' ? 'A' : action === 'back' ? 'B' : action === 'menu' ? 'Start' : null;
  const layout = device && device.kind === 'kb' ? device.layout : 1;
  if (action === 'confirm') return layout === 1 ? 'Space' : 'Enter';
  if (action === 'back') return layout === 1 ? 'Esc' : 'Back';
  if (action === 'menu') return layout === 1 ? 'Tab' : 'Shift';
  return null;
}
