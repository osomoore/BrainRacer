import type { RaceMap } from '../core/types';
import { specFromRatings, type VehicleRatings } from '../entities/vehicleStats';

type RatingTuple = readonly [speed: number, zoom: number, turning: number, weight: number, grip: number];

type CarFamily = 'cycle' | 'trike' | 'open' | 'racer' | 'closed' | 'utility' | 'van' | 'tracked';

/** Family-default ratings [speed, zoom, turning, weight, grip]; each sums to VEHICLE_STATS.budget. Per-vehicle overrides below. */
const FAMILY_RATINGS: Record<CarFamily, RatingTuple> = {
  cycle: [3, 3, 5, 1, 3],    // nimble, light
  trike: [2, 4, 4, 2, 3],
  open: [3, 4, 4, 2, 2],     // karts/buggies: zippy and slidey
  racer: [5, 3, 2, 2, 3],    // fast, wide turns
  closed: [3, 3, 3, 3, 3],   // all-rounders
  utility: [2, 2, 3, 4, 4],  // heavy, planted
  van: [2, 3, 2, 4, 4],      // heavy, slow turning
  tracked: [1, 3, 3, 5, 3],  // crawlers
};

function vehicle(name: string, family: CarFamily, colors: readonly [string, string, string], length: number, width: number, tuple: RatingTuple = FAMILY_RATINGS[family]) {
  const [speed, zoom, turning, weight, grip] = tuple;
  const ratings: VehicleRatings = { speed, zoom, turning, weight, grip };
  return { name, family, colors, ratings, spec: specFromRatings(ratings, length, width) };
}

export const UNLOCK_VEHICLES = {
  motorTrike: vehicle('Motor Trike', 'trike', ['#ffb058', '#d05e1e', '#fff3a7'], 70, 39),
  motorbike: vehicle('Motorbike', 'cycle', ['#71e7ff', '#1762ac', '#fff07b'], 69, 25),
  pickup: vehicle('Pickup', 'utility', ['#fa826b', '#ac322b', '#f7e6c7'], 82, 44, [3, 2, 2, 4, 4]),
  rally: vehicle('Rally Car', 'closed', ['#f0fdff', '#51b5da', '#ed5749'], 74, 41, [4, 3, 3, 2, 3]),
  buggy: vehicle('Dune Buggy', 'open', ['#ffe274', '#c9801a', '#5cceff'], 70, 45),
  hotRod: vehicle('Hot Rod', 'open', ['#ff7a82', '#b41b49', '#ffd045'], 77, 39, [4, 4, 2, 3, 2]),
  scooter: vehicle('Scooter', 'cycle', ['#9ff6c6', '#187f6b', '#fff2c6'], 62, 29, [2, 4, 5, 1, 3]),
  van: vehicle('Delivery Van', 'van', ['#9beeff', '#345cbf', '#ffffff'], 81, 42),
  bus: vehicle('School Bus', 'van', ['#ffe981', '#d79414', '#603b24'], 92, 44, [2, 2, 2, 4, 5]),
  roadster: vehicle('Roadster', 'open', ['#ffb2db', '#c74591', '#ffffff'], 74, 39, [3, 3, 4, 2, 3]),
  sports: vehicle('Sports Car', 'racer', ['#66f0dc', '#087d98', '#fffbbb'], 80, 41, [5, 3, 3, 2, 2]),
  monsterTruck: vehicle('Monster Truck', 'utility', ['#d4a9ff', '#6a3faa', '#ffed72'], 82, 54, [2, 2, 2, 5, 4]),
  jeep: vehicle('Trail Jeep', 'utility', ['#c1ed77', '#518b35', '#fff0bd'], 74, 47, [2, 3, 3, 3, 4]),
  tractor: vehicle('Tractor', 'utility', ['#8adc72', '#297f45', '#ffd54c'], 76, 51, [2, 2, 2, 5, 4]),
  taxi: vehicle('Taxi', 'closed', ['#fff27a', '#d99114', '#303955'], 75, 42),
  ambulance: vehicle('Ambulance', 'van', ['#ffffff', '#83c1d5', '#f55369'], 86, 44, [3, 3, 1, 4, 4]),
  camper: vehicle('Camper', 'van', ['#aaffed', '#428ea0', '#fff5d2'], 84, 45, [2, 2, 2, 5, 4]),
  snowcat: vehicle('Snowcat', 'tracked', ['#ffa563', '#be441e', '#f7f2d2'], 81, 50, [2, 3, 1, 5, 4]),
  dragster: vehicle('Dragster', 'racer', ['#bca1ff', '#5d3ac5', '#fbee6d'], 90, 40, [5, 3, 1, 3, 3]),
  towTruck: vehicle('Tow Truck', 'utility', ['#a1d4ff', '#315ea7', '#ffb83d'], 86, 45, [2, 2, 3, 5, 3]),
  skyTaxi: vehicle('Sky Taxi', 'closed', ['#ffd46d', '#d08736', '#eafcff'], 76, 42, [3, 3, 3, 2, 4]),
  cloudCoupe: vehicle('Cloud Coupe', 'closed', ['#f7fbff', '#8fa8d9', '#a5e9ff'], 74, 42, [2, 3, 4, 1, 5]),
  galeRoadster: vehicle('Gale Roadster', 'open', ['#8af2eb', '#238ba8', '#fff1a0'], 78, 40, [4, 3, 4, 2, 2]),
  propellerBuggy: vehicle('Propeller Buggy', 'open', ['#ff9167', '#a94053', '#ffde91'], 74, 46, [3, 5, 3, 1, 3]),
  courierPod: vehicle('Courier Pod', 'van', ['#baabfc', '#6250ae', '#e1fcff'], 80, 44, [3, 4, 2, 3, 3]),
  leafRacer: vehicle('Leaf Racer', 'racer', ['#cdf887', '#42883d', '#ecffbf'], 77, 39, [4, 3, 4, 1, 3]),
  twigBuggy: vehicle('Twig Buggy', 'open', ['#d7aa6a', '#795036', '#ffcd72'], 72, 45),
  acornCoupe: vehicle('Acorn Coupe', 'closed', ['#f3bc77', '#a45036', '#ffe5a5'], 71, 41),
  mossRover: vehicle('Moss Rover', 'utility', ['#90d899', '#326951', '#c6f999'], 79, 47, [2, 3, 3, 3, 4]),
  barkWagon: vehicle('Bark Wagon', 'van', ['#c79163', '#613d48', '#ffc75e'], 86, 46),
  mantaRacer: vehicle('Manta Racer', 'racer', ['#9e9bff', '#514aa2', '#98ffff'], 80, 46, [4, 3, 4, 2, 2]),
  bubbleSub: vehicle('Bubble Sub', 'closed', ['#ffe078', '#cb823c', '#c4fcff'], 74, 42, [2, 3, 4, 3, 3]),
  coralBuggy: vehicle('Coral Buggy', 'open', ['#ff9c9a', '#be496e', '#ffe2a7'], 72, 45),
  stingrayGT: vehicle('Stingray GT', 'racer', ['#79e4e7', '#276b96', '#fbf78f'], 81, 41),
  nautilusVan: vehicle('Nautilus Van', 'van', ['#f1c4aa', '#a75a72', '#a1f6ff'], 85, 46),
  brickBuggy: vehicle('Brick Buggy', 'open', ['#9adf5d', '#487c38', '#ffea97'], 73, 45),
  studCoupe: vehicle('Stud Coupe', 'closed', ['#e99e66', '#a85230', '#ffdf91'], 76, 42),
  quarryTruck: vehicle('Quarry Truck', 'utility', ['#80b9bd', '#416873', '#fff1ac'], 86, 50, [2, 2, 2, 4, 5]),
  toadstoolKart: vehicle('Toadstool Kart', 'open', ['#ff7767', '#ae2d4a', '#fff2c6'], 70, 43, [2, 5, 4, 2, 2]),
  sporeCoupe: vehicle('Spore Coupe', 'closed', ['#dda4ff', '#763daa', '#ffe6a3'], 76, 42, [3, 2, 3, 3, 4]),
  capWagon: vehicle('Cap Wagon', 'van', ['#ffcb6a', '#ac6538', '#e9fff1'], 84, 48),
  skiSled: vehicle('Ski Sled', 'open', ['#fa8e5b', '#b6363e', '#d0f7ff'], 75, 41, [4, 4, 4, 2, 1]),
  iceCoupe: vehicle('Ice Coupe', 'closed', ['#c8faff', '#397aa9', '#ffffff'], 76, 43, [3, 3, 4, 4, 1]),
  glacierCrawler: vehicle('Glacier Crawler', 'tracked', ['#eeebff', '#7177b2', '#ffd97c'], 84, 50, [1, 4, 3, 4, 3]),
  cinderBuggy: vehicle('Cinder Buggy', 'open', ['#ffb243', '#c74c37', '#fff1a9'], 73, 44, [3, 5, 4, 1, 2]),
  magmaGT: vehicle('Magma GT', 'racer', ['#fd7854', '#992d49', '#fff284'], 83, 42, [5, 3, 1, 2, 4]),
  basaltHauler: vehicle('Basalt Hauler', 'utility', ['#8982a2', '#40364f', '#ffad61'], 88, 51, [2, 2, 2, 4, 5]),
  waferKart: vehicle('Wafer Kart', 'open', ['#ffda9b', '#a76051', '#ef94cd'], 71, 42, [2, 5, 5, 1, 2]),
  gumdropGT: vehicle('Gumdrop GT', 'racer', ['#d3a1ff', '#8655bc', '#aaffc1'], 80, 43),
  sundaeVan: vehicle('Sundae Van', 'van', ['#ffb9d2', '#c65b97', '#fff4c6'], 84, 47),
  joustKart: vehicle('Joust Kart', 'open', ['#7bc7ff', '#3a64b9', '#ffe385'], 71, 42, [3, 4, 5, 1, 2]),
  heraldCoupe: vehicle('Herald Coupe', 'closed', ['#ff858e', '#a74265', '#ffde81'], 77, 42),
  timberCoach: vehicle('Timber Coach', 'van', ['#dca56b', '#774b46', '#efcf86'], 88, 49),
  runwayRacer: vehicle('Runway Racer', 'racer', ['#ebfbff', '#587abe', '#fa7666'], 79, 41, [5, 3, 3, 1, 3]),
  jetBuggy: vehicle('Jet Buggy', 'open', ['#6fe1de', '#267c98', '#ffdf73'], 78, 46, [4, 4, 3, 2, 2]),
  bagTug: vehicle('Baggage Tug', 'utility', ['#ffda6c', '#c67d32', '#f5fbff'], 82, 48, [2, 4, 3, 4, 2]),
  springRacer: vehicle('Spring Racer', 'racer', ['#fe996f', '#b73b6a', '#ffeaa7'], 76, 41, [4, 3, 4, 1, 3]),
  sockBuggy: vehicle('Sock Buggy', 'open', ['#aef1cc', '#409189', '#ffb5da'], 75, 45, [2, 4, 4, 3, 2]),
  toyTruck: vehicle('Toy Truck', 'utility', ['#85c5ff', '#4c53a2', '#fff090'], 86, 48, [2, 3, 3, 4, 3]),
  tileRunner: vehicle('Tile Runner', 'racer', ['#75e5db', '#286074', '#ffcf74'], 78, 42, [5, 2, 3, 2, 3]),
  kilnVan: vehicle('Kiln Van', 'van', ['#ffb36a', '#9b4a3e', '#ffeca0'], 86, 46),
  morelRoadster: vehicle('Morel Roadster', 'open', ['#e1b177', '#79534c', '#d5f8a6'], 74, 42, [3, 3, 4, 2, 3]),
  chanterelleTruck: vehicle('Chanterelle Truck', 'utility', ['#ffd477', '#b16c32', '#fde8c9'], 88, 49),
  powderVan: vehicle('Powder Van', 'van', ['#a8e9f5', '#466ca6', '#f1faff'], 85, 47),
  auroraRacer: vehicle('Aurora Racer', 'racer', ['#a4f4cd', '#6661ae', '#dcafff'], 82, 41),
  obsidianCoupe: vehicle('Obsidian Coupe', 'closed', ['#ae8ac8', '#403353', '#ffac7b'], 77, 44, [4, 2, 3, 4, 2]),
  ventRunner: vehicle('Vent Runner', 'open', ['#ffe082', '#ce6b3e', '#ff473e'], 74, 45, [4, 4, 3, 2, 2]),
  licoriceRacer: vehicle('Licorice Racer', 'racer', ['#d66ca6', '#4b305c', '#f7d9fb'], 81, 42, [4, 4, 3, 1, 3]),
  macaronMini: vehicle('Macaron Mini', 'closed', ['#b3f4ad', '#51987f', '#ffb9df'], 70, 40, [2, 4, 5, 1, 3]),
  turretTruck: vehicle('Turret Truck', 'utility', ['#b6b9dc', '#575777', '#ffd47d'], 89, 48, [3, 1, 2, 5, 4]),
  royalRoadster: vehicle('Royal Roadster', 'open', ['#d598f1', '#70428e', '#ffe28d'], 76, 43, [3, 3, 3, 3, 3]),
  beaconVan: vehicle('Beacon Van', 'van', ['#fff4d4', '#637fbc', '#ff9957'], 85, 46, [3, 3, 2, 4, 3]),
  tarmacSweeper: vehicle('Tarmac Sweeper', 'utility', ['#abe4f8', '#32648a', '#f7d35f'], 85, 49, [2, 2, 3, 4, 4]),
  buttonKart: vehicle('Button Kart', 'open', ['#ff9ebc', '#aa5081', '#c5f8dd'], 68, 41, [2, 5, 4, 1, 3]),
  teacupCoupe: vehicle('Teacup Coupe', 'closed', ['#d2c6ff', '#7e64ac', '#fff0a1'], 76, 43, [2, 3, 5, 2, 3]),
} as const;

export type UnlockVehicle = keyof typeof UNLOCK_VEHICLES;
export const UNLOCK_VEHICLE_IDS = Object.keys(UNLOCK_VEHICLES) as UnlockVehicle[];

export const WORLD_VEHICLES = {
  sky: ['skyTaxi', 'cloudCoupe', 'galeRoadster', 'propellerBuggy', 'courierPod'],
  forest: ['leafRacer', 'twigBuggy', 'acornCoupe', 'mossRover', 'barkWagon'],
  underwater: ['mantaRacer', 'bubbleSub', 'coralBuggy', 'stingrayGT', 'nautilusVan'],
  brickworks: ['brickBuggy', 'studCoupe', 'quarryTruck', 'tileRunner', 'kilnVan'],
  mushroom: ['toadstoolKart', 'sporeCoupe', 'capWagon', 'morelRoadster', 'chanterelleTruck'],
  tundra: ['skiSled', 'iceCoupe', 'glacierCrawler', 'powderVan', 'auroraRacer'],
  volcano: ['cinderBuggy', 'magmaGT', 'basaltHauler', 'obsidianCoupe', 'ventRunner'],
  candy: ['waferKart', 'gumdropGT', 'sundaeVan', 'licoriceRacer', 'macaronMini'],
  castle: ['joustKart', 'heraldCoupe', 'timberCoach', 'turretTruck', 'royalRoadster'],
  airport: ['runwayRacer', 'jetBuggy', 'bagTug', 'beaconVan', 'tarmacSweeper'],
  house: ['springRacer', 'sockBuggy', 'toyTruck', 'buttonKart', 'teacupCoupe'],
} as const satisfies Record<string, readonly UnlockVehicle[]>;

export type WorldVehicle = (typeof WORLD_VEHICLES)[keyof typeof WORLD_VEHICLES][number];
export const WORLD_VEHICLE_IDS: readonly WorldVehicle[] = Object.values(WORLD_VEHICLES).flat();

export const UNLOCK_GUIDES = {
  fairy: { name: 'Fairy', glow: 0xff8bed },
  bumblebee: { name: 'Bumblebee', glow: 0xffda5b },
  owl: { name: 'Night Owl', glow: 0xe2b0ff },
  rocket: { name: 'Rocket', glow: 0xff9259 },
  bombBuddy: { name: 'Bomb Buddy', glow: 0xffb349 },
  cloudPuff: { name: 'Cloud Puff', glow: 0xb7eaff },
  firefly: { name: 'Firefly', glow: 0xe8ff83 },
  jelly: { name: 'Jelly', glow: 0x96f4ff },
  puffCub: { name: 'Puff Cub', glow: 0xc6ff8f },
  sporeSprout: { name: 'Spore Sprout', glow: 0xffb4ea },
  squareSnowman: { name: 'Square Snowman', glow: 0xbafaff },
  ember: { name: 'Ember', glow: 0xffb670 },
  sugarSprite: { name: 'Sugar Sprite', glow: 0xffa7d9 },
  crownSquire: { name: 'Crown Squire', glow: 0xffe17f },
  paperPlane: { name: 'Paper Plane', glow: 0xb8eeff },
  yarnBall: { name: 'Yarn Ball', glow: 0xffbd9f },
} as const;

export type UnlockGuide = keyof typeof UNLOCK_GUIDES;
export const UNLOCK_GUIDE_IDS = Object.keys(UNLOCK_GUIDES) as UnlockGuide[];
export const WORLD_GUIDES: readonly UnlockGuide[] = [
  'cloudPuff', 'firefly', 'jelly', 'puffCub', 'sporeSprout', 'squareSnowman', 'ember',
  'sugarSprite', 'crownSquire', 'paperPlane', 'yarnBall',
];

export type Collectible = UnlockVehicle | UnlockGuide;
export const COLLECTIBLES: readonly Collectible[] = [...UNLOCK_VEHICLE_IDS, ...UNLOCK_GUIDE_IDS];

export function collectibleName(id: Collectible): string {
  return Object.hasOwn(UNLOCK_VEHICLES, id) ? UNLOCK_VEHICLES[id as UnlockVehicle].name : UNLOCK_GUIDES[id as UnlockGuide].name;
}

/**
 * What each world can reward: its cars and its one buddy. Every unlockable car and buddy belongs to
 * exactly one world (checked by collectibles.test.ts). Starter cars/buddies (dino, kart, star) are not listed.
 */
export const WORLD_REWARDS: Record<RaceMap, { cars: readonly UnlockVehicle[]; buddy: UnlockGuide }> = {
  city: { cars: ['taxi', 'bus', 'ambulance', 'sports'], buddy: 'rocket' },
  industrial: { cars: ['towTruck', 'van', 'pickup', 'dragster'], buddy: 'owl' },
  harbor: { cars: ['buggy', 'scooter', 'camper', 'roadster'], buddy: 'fairy' },
  underground: { cars: ['monsterTruck', 'jeep', 'snowcat', 'motorTrike'], buddy: 'bombBuddy' },
  farm: { cars: ['tractor', 'hotRod', 'rally', 'motorbike'], buddy: 'bumblebee' },
  sky: { cars: WORLD_VEHICLES.sky, buddy: 'cloudPuff' },
  forest: { cars: WORLD_VEHICLES.forest, buddy: 'firefly' },
  underwater: { cars: WORLD_VEHICLES.underwater, buddy: 'jelly' },
  brickworks: { cars: WORLD_VEHICLES.brickworks, buddy: 'puffCub' },
  mushroom: { cars: WORLD_VEHICLES.mushroom, buddy: 'sporeSprout' },
  tundra: { cars: WORLD_VEHICLES.tundra, buddy: 'squareSnowman' },
  volcano: { cars: WORLD_VEHICLES.volcano, buddy: 'ember' },
  candy: { cars: WORLD_VEHICLES.candy, buddy: 'sugarSprite' },
  castle: { cars: WORLD_VEHICLES.castle, buddy: 'crownSquire' },
  airport: { cars: WORLD_VEHICLES.airport, buddy: 'paperPlane' },
  house: { cars: WORLD_VEHICLES.house, buddy: 'yarnBall' },
};

/** Everything a world can reward (cars, then its buddy). */
export function worldRewards(map: RaceMap): Collectible[] {
  const w = WORLD_REWARDS[map];
  return [...w.cars, w.buddy];
}
