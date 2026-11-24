/** Shell-side extension of the PaneContext contract. `ctx` passed to screens is really a ShellPaneContext. */
import type { PaneContext } from '../core/runtime';
import type { ShellPaneInput } from '../ui/input';

export interface ShellPaneContext extends PaneContext {
  readonly input: ShellPaneInput;
  /** Profile picked by the OTHER pane (2P), so the profile screen can lock it. */
  otherProfileId(): string | undefined;
  /** Go back to the previous screen of this pane (exit() when there is none). */
  back(): void;
  /** Id of the screen currently shown. */
  readonly screenId: string;
}
