import type { QueuedMap } from '../../config/queuedMaps';
import type { TrackData } from '../musicTheory';
import airport from './tracks/airport.json';
import brickworks from './tracks/brickworks.json';
import candy from './tracks/candy.json';
import castle from './tracks/castle.json';
import house from './tracks/house.json';
import mushroom from './tracks/mushroom.json';
import tundra from './tracks/tundra.json';
import volcano from './tracks/volcano.json';

export const QUEUED_TRACKS: Record<QueuedMap, TrackData> = {
  brickworks: brickworks as TrackData,
  mushroom: mushroom as TrackData,
  tundra: tundra as TrackData,
  volcano: volcano as TrackData,
  candy: candy as TrackData,
  castle: castle as TrackData,
  airport: airport as TrackData,
  house: house as TrackData,
};
