import type { MusicTrack } from '../../core/types';
import type { TrackStyle } from '../musicTheory';
import styles from './trackStyles.json';

/**
 * Per-track playback style (see `trackStyles.json`): duration unit, pitched-note sustain, optional lowpass.
 * A missing entry or field means the original behaviour: `d` played as seconds, no sustain, no filter.
 */
export const TRACK_STYLES: Record<MusicTrack, TrackStyle | undefined> = styles as Record<MusicTrack, TrackStyle>;
