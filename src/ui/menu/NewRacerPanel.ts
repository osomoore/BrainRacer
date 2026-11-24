import { GAME_HEIGHT, GAME_WIDTH, NEW_RACER } from '../../config/gameConfig';
import { validRacerName } from '../../core/racerProfiles';
import { services } from '../../core/services';
import { AGE_BANDS, bandDifficulty, difficultyBand } from '../../core/ageBands';
import type { JbqSettings, QuestionTypes } from '../../core/types';
import { NewRacerPanel as SharedPanel, type NewRacerPanelOptions } from '../../../shared/ui/menu/NewRacerPanel';
import { bandChoiceLabel } from '../../../shared/ui/menu/newRacerLogic';

export type { PickerResult } from '../../../shared/ui/menu/LetterPicker';
export class NewRacerPanel extends SharedPanel<JbqSettings> {
  constructor(scene: Phaser.Scene, color: number, colorHex: string, playerNum: number, takenNames: readonly string[], keyboardTyping: boolean,
    initialTypes?: QuestionTypes, initialJbq?: JbqSettings) {
    const options: NewRacerPanelOptions<JbqSettings> = {
      color, colorHex, playerNum, takenNames, keyboardTyping,
      width: GAME_WIDTH, height: GAME_HEIGHT, nameMaxLen: NEW_RACER.nameMaxLen,
      defaultDifficulty: NEW_RACER.defaultDifficulty, defaultQuestionTypes: NEW_RACER.defaultQuestionTypes,
      defaultJbq: NEW_RACER.defaultJbq, ageBands: AGE_BANDS,
      difficultyBand, bandDifficulty, bandChoiceLabel,
      validRacerName: (value) => validRacerName(value) ?? null,
      audio: (name) => services.audio.sfx(name), initialTypes, initialJbq,
    };
    super(scene, options);
  }
}
