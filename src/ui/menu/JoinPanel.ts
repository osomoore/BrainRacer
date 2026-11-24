import Phaser from 'phaser';
import { guideArt } from '../../art/loadoutKeys';
import { isMobile } from '../../../shared/device';
import { JBQ_SETUP } from '../../config/gameConfig';
import type { CarKind, ControllerFamily, GuideKind, InputDevice } from '../../core/types';
import { carPreview, deviceLabel } from './style';
import { CHIP_KEYS, CHIP_LABEL, ROW_CAR, ROW_DONE, ROW_GUIDE, ROW_POINTS, ROW_QUESTIONS, ROW_RACER, ROW_SCOPE } from './questionPick';
import { JoinPanel as SharedJoinPanel, type JoinPanelDependencies } from '../../../shared/ui/menu/JoinPanel';

export { JOIN_PANEL, joinPanelX } from '../../../shared/ui/menu/JoinPanel';
export type { PanelView } from '../../../shared/ui/menu/JoinPanel';
export class JoinPanel extends SharedJoinPanel {
  constructor(scene: Phaser.Scene, slot: number, colorHex: string) {
    const deps: JoinPanelDependencies = {
      guideArt: (kind) => guideArt(kind as GuideKind),
      carPreview: (s, kind, x, y, scale) => carPreview(s, kind as CarKind, x, y, scale),
      deviceLabel: (device, family) => deviceLabel(device as InputDevice, family as ControllerFamily),
      isMobile,
      jbqSetup: JBQ_SETUP,
      chipKeys: CHIP_KEYS,
      chipLabels: CHIP_LABEL,
      rows: { RACER: ROW_RACER, CAR: ROW_CAR, GUIDE: ROW_GUIDE, QUESTIONS: ROW_QUESTIONS, POINTS: ROW_POINTS, SCOPE: ROW_SCOPE, DONE: ROW_DONE },
    };
    super(scene, slot, colorHex, deps);
  }
}
