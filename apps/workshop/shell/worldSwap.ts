/** Workshop -> World without re-picking players: hands over every pane's profile + device (P1, P2 order). */
import { writeHandoff, type HandoffPlayer } from '../../../shared/handoff';
import { goToGame } from '../../../shared/hub';
import { shell } from './shell';

export function worldHandoffPlayers(): HandoffPlayer[] {
  return shell.panes.slice(0, shell.count).flatMap((pane, i): HandoffPlayer[] => {
    const device = shell.router.devices[i];
    if (!pane.profileId || !device) return [];
    return [{ profileId: pane.profileId, device, ...(pane.workshopId ? { workshop: pane.workshopId === 'dino' ? 'dino' as const : 'car' as const } : {}) }];
  });
}

export function goToWorld(): void {
  writeHandoff({ to: 'world', players: worldHandoffPlayers() });
  goToGame('world');
}
