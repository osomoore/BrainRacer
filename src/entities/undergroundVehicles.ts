import { UNDERGROUND_PLAYER_DRIVE, UNDERGROUND_VEHICLE_SPECS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { VehicleSpec } from '../core/types';

export const UNDERGROUND_VEHICLES = {
  caveBuggy: { texture: TEX.underground.caveBuggy, spec: UNDERGROUND_VEHICLE_SPECS.caveBuggy, truck: false },
  crystalRunner: { texture: TEX.underground.crystalRunner, spec: UNDERGROUND_VEHICLE_SPECS.crystalRunner, truck: false },
  surveyRover: { texture: TEX.underground.surveyRover, spec: UNDERGROUND_VEHICLE_SPECS.surveyRover, truck: false },
  oreHauler: { texture: TEX.underground.oreHauler, spec: UNDERGROUND_VEHICLE_SPECS.oreHauler, truck: true },
  rockCrusher: { texture: TEX.underground.rockCrusher, spec: UNDERGROUND_VEHICLE_SPECS.rockCrusher, truck: true },
} as const;

export type UndergroundVehicleKind = keyof typeof UNDERGROUND_VEHICLES;

export const UNDERGROUND_VEHICLE_KINDS = Object.keys(UNDERGROUND_VEHICLES) as UndergroundVehicleKind[];

export function undergroundPlayerSpec(texture: string, spec: VehicleSpec): VehicleSpec | undefined {
  const kind = UNDERGROUND_VEHICLE_KINDS.find(kind => UNDERGROUND_VEHICLES[kind].texture === texture);
  return kind === undefined ? undefined : { ...spec, ...UNDERGROUND_PLAYER_DRIVE[kind] };
}
