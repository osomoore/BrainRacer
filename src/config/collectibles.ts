import type { VehicleSpec } from '../core/types';

const flyweight = { mass: 8, maxSpeed: 302, reverseSpeed: 96, accel: 226, brake: 1160, turnRate: 3.15, grip: 0.87, drag: 0.69 };
const standard = { mass: 13, maxSpeed: 306, reverseSpeed: 100, accel: 195, brake: 1110, turnRate: 2.8, grip: 0.84, drag: 0.64 };
const heavy = { mass: 20, maxSpeed: 287, reverseSpeed: 92, accel: 170, brake: 1100, turnRate: 2.55, grip: 0.81, drag: 0.61 };

type CarFamily = 'cycle' | 'trike' | 'open' | 'racer' | 'closed' | 'utility' | 'van' | 'tracked';

function vehicle(name: string, family: CarFamily, colors: readonly [string, string, string], length: number, width: number, tuning: Omit<VehicleSpec, 'length' | 'width'>) {
  return { name, family, colors, spec: { ...tuning, length, width } };
}

export const UNLOCK_VEHICLES = {
  motorTrike: vehicle('Motor Trike', 'trike', ['#ffb058', '#d05e1e', '#fff3a7'], 70, 39, flyweight),
  motorbike: vehicle('Motorbike', 'cycle', ['#71e7ff', '#1762ac', '#fff07b'], 69, 25, flyweight),
  pickup: vehicle('Pickup', 'utility', ['#fa826b', '#ac322b', '#f7e6c7'], 82, 44, heavy),
  rally: vehicle('Rally Car', 'closed', ['#f0fdff', '#51b5da', '#ed5749'], 74, 41, standard),
  buggy: vehicle('Dune Buggy', 'open', ['#ffe274', '#c9801a', '#5cceff'], 70, 45, flyweight),
  hotRod: vehicle('Hot Rod', 'open', ['#ff7a82', '#b41b49', '#ffd045'], 77, 39, standard),
  scooter: vehicle('Scooter', 'cycle', ['#9ff6c6', '#187f6b', '#fff2c6'], 62, 29, flyweight),
  van: vehicle('Delivery Van', 'van', ['#9beeff', '#345cbf', '#ffffff'], 81, 42, heavy),
  bus: vehicle('School Bus', 'van', ['#ffe981', '#d79414', '#603b24'], 92, 44, heavy),
  roadster: vehicle('Roadster', 'open', ['#ffb2db', '#c74591', '#ffffff'], 74, 39, standard),
  sports: vehicle('Sports Car', 'racer', ['#66f0dc', '#087d98', '#fffbbb'], 80, 41, standard),
  monsterTruck: vehicle('Monster Truck', 'utility', ['#d4a9ff', '#6a3faa', '#ffed72'], 82, 54, heavy),
  jeep: vehicle('Trail Jeep', 'utility', ['#c1ed77', '#518b35', '#fff0bd'], 74, 47, standard),
  tractor: vehicle('Tractor', 'utility', ['#8adc72', '#297f45', '#ffd54c'], 76, 51, heavy),
  taxi: vehicle('Taxi', 'closed', ['#fff27a', '#d99114', '#303955'], 75, 42, standard),
  ambulance: vehicle('Ambulance', 'van', ['#ffffff', '#83c1d5', '#f55369'], 86, 44, heavy),
  camper: vehicle('Camper', 'van', ['#aaffed', '#428ea0', '#fff5d2'], 84, 45, heavy),
  snowcat: vehicle('Snowcat', 'tracked', ['#ffa563', '#be441e', '#f7f2d2'], 81, 50, heavy),
  dragster: vehicle('Dragster', 'racer', ['#bca1ff', '#5d3ac5', '#fbee6d'], 90, 40, standard),
  towTruck: vehicle('Tow Truck', 'utility', ['#a1d4ff', '#315ea7', '#ffb83d'], 86, 45, heavy),
} as const;

export type UnlockVehicle = keyof typeof UNLOCK_VEHICLES;
export const UNLOCK_VEHICLE_IDS = Object.keys(UNLOCK_VEHICLES) as UnlockVehicle[];

export const UNLOCK_GUIDES = {
  fairy: { name: 'Fairy', glow: 0xff8bed },
  bumblebee: { name: 'Bumblebee', glow: 0xffda5b },
  owl: { name: 'Night Owl', glow: 0xe2b0ff },
  rocket: { name: 'Rocket', glow: 0xff9259 },
  comet: { name: 'Comet', glow: 0x70e5ff },
} as const;

export type UnlockGuide = keyof typeof UNLOCK_GUIDES;
export const UNLOCK_GUIDE_IDS = Object.keys(UNLOCK_GUIDES) as UnlockGuide[];

export type Collectible = UnlockVehicle | UnlockGuide;
export const COLLECTIBLES: readonly Collectible[] = [...UNLOCK_VEHICLE_IDS, ...UNLOCK_GUIDE_IDS];

export function collectibleName(id: Collectible): string {
  return Object.hasOwn(UNLOCK_VEHICLES, id) ? UNLOCK_VEHICLES[id as UnlockVehicle].name : UNLOCK_GUIDES[id as UnlockGuide].name;
}
