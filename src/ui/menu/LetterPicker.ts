import { services } from '../../core/services';
import { LetterPicker as SharedLetterPicker, type LetterPickerOpts } from '../../../shared/ui/menu/LetterPicker';

export type { LetterPickerOpts, PickerResult } from '../../../shared/ui/menu/LetterPicker';
/** BrainRacer adapter supplies its audio service; other apps can inject their own in shared opts. */
export class LetterPicker extends SharedLetterPicker {
  constructor(scene: Phaser.Scene, x: number, y: number, opts: LetterPickerOpts) {
    super(scene, x, y, { ...opts, sfx: opts.sfx ?? ((name) => services.audio?.sfx(name)) });
  }
}
