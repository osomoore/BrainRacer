export type FacePosition = 'left' | 'top' | 'right' | 'bottom';
export type ControllerFamily = 'nintendo' | 'xbox' | 'other';
export const ANSWER_POSITIONS: readonly FacePosition[] = ['left', 'top', 'right', 'bottom'];
const SWITCH_LABELS = ['Y', 'X', 'A', 'B'] as const;
const ANSWER_LABELS = ['X', 'Y', 'B', 'A'] as const;
const ANSWER_COLORS = ['#1e6fff', '#ffcc00', '#ff3b30', '#2ecc40'] as const;
export function faceButton(family: ControllerFamily, position: FacePosition): { label: string; color: string } {
  const slot = ANSWER_POSITIONS.indexOf(position);
  if (family === 'nintendo') return { label: SWITCH_LABELS[slot], color: '#343846' };
  if (family === 'xbox') return { label: '', color: ANSWER_COLORS[slot] };
  return { label: '', color: '#485c85' };
}
export const xboxFaceLetter = (position: FacePosition): string => ANSWER_LABELS[ANSWER_POSITIONS.indexOf(position)];
