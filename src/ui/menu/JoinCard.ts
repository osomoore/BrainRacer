import Phaser from 'phaser';
import type { CarKind, ControllerFamily, InputDevice } from '../../core/types';
import { deviceLabel, carName, carPreview } from './style';
import { ConfirmPrompt } from './FaceButtonBadge';
import { JoinCard as SharedJoinCard } from '../../../shared/ui/menu/JoinCard';

export class JoinCard extends SharedJoinCard {
  private readonly prompt: ConfirmPrompt;
  constructor(scene: Phaser.Scene, x: number, y: number, slot: 0 | 1, colorHex: string, carKind: CarKind) {
    const prompt = new ConfirmPrompt(scene, 0, 105, 'to join');
    super(scene, x, y, slot, colorHex, {
      visual: carPreview(scene, carKind, 0, -52, 2.8), visualLabel: carName(carKind),
      keyboardHint: 'Space / Enter', confirmPrompt: prompt,
    });
    this.prompt = prompt;
  }
  setPromptFamily(family: ControllerFamily): void { this.prompt.setFamily(family); }
  setJoined(label: string | null, family?: ControllerFamily): void;
  setJoined(device: InputDevice | null, family?: ControllerFamily): void;
  setJoined(deviceOrLabel: InputDevice | string | null, family?: ControllerFamily): void {
    const label = typeof deviceOrLabel === 'string' ? deviceOrLabel : deviceOrLabel ? deviceLabel(deviceOrLabel, family) : null;
    super.setJoined(label, family);
  }
}
