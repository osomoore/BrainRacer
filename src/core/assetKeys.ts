import { UNLOCK_GUIDE_IDS, UNLOCK_VEHICLE_IDS, type UnlockGuide, type UnlockVehicle } from '../config/collectibles';
import { QUEUED_BOSS_TEXTURES } from '../art/queuedBossKeys';

/**
 * Texture keys produced by src/art (package E) at boot and consumed everywhere else.
 * Orchestrator-owned contract. All vehicle/creature textures face +x (east).
 * Sizes are the intended texture pixel sizes (consumers may scale).
 */
export const TEX = {
  queuedBosses: QUEUED_BOSS_TEXTURES,
  queuedFeature: {
    deck: (map: string) => `queued_deck_${map}`,
    gate: (map: string) => `queued_gate_${map}`,
    track: (map: string) => `queued_track_${map}`,
    mover: (map: string) => `queued_mover_${map}`,
    railCar: (map: string, variant: number) => `queued_rail_car_${map}_${variant}`,
    signal: 'queued_feature_signal',
    eruption: 'queued_volcano_eruption',
  },
  // hero cars (length x width)
  carDino: 'car_dino',          // 72 x 40, green dino roadster
  carKart: 'car_kart',          // 60 x 36, red kart, driver cap with white circle + gold star
  carShadow: 'car_shadow',      // soft ellipse, 80 x 48
  unlockVehicles: Object.fromEntries(UNLOCK_VEHICLE_IDS.map(kind => [kind, `car_${kind}`])) as Record<UnlockVehicle, string>,
  brakeLights: 'traffic_brake_lights',

  // traffic / police
  traffic: ['traffic_0', 'traffic_1', 'traffic_2', 'traffic_3'] as const, // 64 x 36 sedans, varied colors
  convertible: ['convertible_coral', 'convertible_aqua'] as const,
  homingBomb: 'homing_bomb',
  homingBombGlow: 'homing_bomb_glow',
  truck: 'truck',               // 120 x 48 box truck
  freightTruck: 'vehicle_freight_truck', // 160 x 58 heavy freight truck
  underground: {
    caveBuggy: 'underground_cave_buggy', crystalRunner: 'underground_crystal_runner',
    surveyRover: 'underground_survey_rover', oreHauler: 'underground_ore_hauler',
    rockCrusher: 'underground_rock_crusher', oreCrate: 'underground_ore_crate', oreChip: 'underground_ore_chip',
  },
  police: ['police_0', 'police_1'] as const, // 66 x 38, light bar frames (red-left / blue-left) for flashing

  // dino (top-down T-rex, facing +x)
  dinoBody: 'dino_body',        // ~300 x 140 torso + neck
  dinoHead: 'dino_head',        // ~140 x 96
  dinoTail: 'dino_tail',        // ~180 x 60, pivot at RIGHT edge (attaches to body rear, trails toward -x); see DINO_RIG
  dinoLeg: ['dino_leg_0', 'dino_leg_1', 'dino_leg_2', 'dino_leg_3'] as const, // walk cycle, ~70 x 40
  dinoShadow: 'dino_shadow',    // 460 x 220 soft ellipse
  rockMonster: {
    body: 'rock_monster_body', head: 'rock_monster_head', arm: 'rock_monster_arm', foot: 'rock_monster_foot',
    beam: 'rock_monster_beam', glow: 'rock_monster_glow',
  },
  octopus: {
    body: 'octopus_body', head: 'octopus_head', arm: 'octopus_arm', foot: 'octopus_foot',
    beam: 'octopus_beam', glow: 'octopus_glow',
  },
  factoryRobot: {
    body: 'factory_robot_body', head: 'factory_robot_head', arm: 'factory_robot_arm', foot: 'factory_robot_foot',
    beam: 'factory_robot_beam', glow: 'factory_robot_glow',
  },
  giantChicken: {
    body: 'giant_chicken_body', head: 'giant_chicken_head', arm: 'giant_chicken_wing', foot: 'giant_chicken_foot',
    beam: 'giant_chicken_beam', glow: 'giant_chicken_glow',
  },
  thundercloud: {
    body: 'thundercloud_body', head: 'thundercloud_head', arm: 'thundercloud_arm', foot: 'thundercloud_foot',
    beam: 'thundercloud_beam', glow: 'thundercloud_glow',
  },
  walkingTree: {
    body: 'walking_tree_body', head: 'walking_tree_head', arm: 'walking_tree_arm', foot: 'walking_tree_foot',
    beam: 'walking_tree_beam', glow: 'walking_tree_glow',
  },
  landshark: {
    body: 'landshark_body', head: 'landshark_head', arm: 'landshark_arm', foot: 'landshark_foot',
    beam: 'landshark_beam', glow: 'landshark_glow',
  },

  // world tiles: 128x128 each. Road variants chosen by roadMask (ROAD_N|E|S|W) → `road_${mask}`
  tileWater: 'tile_water',
  tileGrass: 'tile_grass',
  tileSidewalk: 'tile_sidewalk',
  tilePark: 'tile_park',
  tilePlaza: 'tile_plaza',
  tileDirt: 'tile_dirt',
  roadPrefix: 'road_',          // road_0 .. road_15 (all 16 masks)

  roof: ['roof_0', 'roof_1', 'roof_2', 'roof_3', 'roof_4', 'roof_5'] as const, // 128x128 tileable roof textures
  signFrame: 'sign_frame',      // 150 x 150 board; scene image drawn on top at ~130 px
  ramp: 'ramp',                 // 128 x 96 (w along travel), yellow/black chevrons

  industrial: {
    bridge: 'industrial_bridge',
    factoryBay: 'industrial_factory_bay',
    gantry: 'industrial_gantry',
    loadingYard: 'industrial_loading_yard',
    waterTower: 'industrial_water_tower',
    containerStack: 'industrial_container_stack',
    pallets: 'industrial_pallets',
    barrels: 'industrial_barrels',
    fuelTank: 'industrial_fuel_tank',
    conveyor: 'industrial_conveyor',
    smokeStack: 'industrial_smoke_stack',
    lampPost: 'industrial_lamp_post',
    parkedTruck: 'industrial_parked_truck',
    forklift: 'industrial_forklift',
    pipes: 'industrial_pipes',
    fence: 'industrial_fence',
    roofLights: 'industrial_roof_lights',
    rail: 'industrial_rail',
    crossing: ['industrial_crossing_idle', 'industrial_crossing_lit'],
    engine: 'industrial_engine',
    freightCar: 'industrial_freight_car',
    headlight: 'industrial_headlight',
  },

  /**
   * Farm art (src/art/farm*.ts). Top-down, no baked shadows (renderer adds directional ones), faces +x at angle 0.
   * Sizes in px for the 128-px tile grid. Tileset indices: see FARM_TILE in src/art/farmTiles.ts.
   */
  farm: {
    // buildings (roof ridge runs along x)
    barn: 'farm_barn',                 // 384 x 256 red roof, white X trim, hayloft hood at +x end
    silo: 'farm_silo',                 // 128 x 128 round dome
    farmhouse: 'farm_farmhouse',       // 256 x 192 roof with chimney + dormer
    shed: 'farm_shed',                 // 128 x 128 tin roof
    windmill: 'farm_windmill',         // 128 x 128 body (octagon cap), blade is a separate sprite on its centre
    windmillBlade: 'farm_windmill_blade', // 256 x 256 four sails, pivot = centre
    turbine: 'farm_turbine',           // 64 x 64 tower top + nacelle, blade sprite on its centre
    turbineBlade: 'farm_turbine_blade', // 224 x 224 three blades, pivot = centre
    // decor
    hayRound: 'farm_hay_round',        // 56 x 56
    haySquare: 'farm_hay_square',      // 64 x 40
    orchardTree: 'farm_orchard_tree',  // 112 x 112 canopy with red apples
    pumpkin: 'farm_pumpkin',           // 32 x 32
    fence: 'farm_fence',               // 128 x 24, tileable along x
    gatePost: 'farm_gate_post',        // 24 x 24
    bridge: 'farm_bridge',             // 192 x 128 wooden deck, travel along x, rails on the long edges
    mazeSign: 'farm_maze_sign',        // 96 x 64
    cornFlat: 'farm_corn_flat',        // 96 x 96 transparent stamp of flattened stalks (run-over trail)
    // animals, facing +x: 3 walk frames each + one tumble pose (star eyes, legs out)
    cow: ['farm_cow_0', 'farm_cow_1', 'farm_cow_2'] as const,             // 88 x 52
    sheep: ['farm_sheep_0', 'farm_sheep_1', 'farm_sheep_2'] as const,     // 64 x 48
    pig: ['farm_pig_0', 'farm_pig_1', 'farm_pig_2'] as const,             // 64 x 42
    horse: ['farm_horse_0', 'farm_horse_1', 'farm_horse_2'] as const,     // 104 x 44
    chicken: ['farm_chicken_0', 'farm_chicken_1', 'farm_chicken_2'] as const, // 32 x 28
    duck: ['farm_duck_0', 'farm_duck_1', 'farm_duck_2'] as const,         // 32 x 26
    cowTumble: 'farm_cow_tumble',           // same sizes as the walk frames
    sheepTumble: 'farm_sheep_tumble',
    pigTumble: 'farm_pig_tumble',
    horseTumble: 'farm_horse_tumble',
    chickenTumble: 'farm_chicken_tumble',
    duckTumble: 'farm_duck_tumble',
    // vehicles, facing +x
    pickup: ['farm_pickup_0', 'farm_pickup_1'] as const, // 84 x 44 (red, blue)
    tractor: 'farm_tractor',           // 80 x 56 big rear wheels; hitch at rear (x=0)
    hayWagon: 'farm_hay_wagon',        // 120 x 50 trailer; hitch at front (+x)
    combine: 'farm_combine',           // 150 x 84 wide header at +x
    // farm renderer extras (src/art/farmExtras.ts): signed-lot looks + fillers for square lots
    well: 'farm_well',                 // 128 x 128 stone well with a little roof
    campsite: 'farm_campsite',         // 256 x 256 clearing, two tents, campfire
    cave: 'farm_cave',                 // 256 x 256 rocky hill, cave mouth opening toward +y
    pines: 'farm_pines',               // 256 x 128 cluster of pine trees ('forest')
    boathouse: 'farm_boathouse',       // 256 x 128 boathouse + jetty + rowboat ('lake')
    leanTo: 'farm_lean_to',            // 384 x 128 tin lean-to, top edge goes against the barn
    porch: 'farm_porch',               // 256 x 64 wooden porch, top edge goes against the farmhouse
    pad: 'farm_pad',                   // 128 x 128 concrete pad (silo / turbine / tractor bay)
    windmillBase: 'farm_windmill_base', // 256 x 256 grassy knoll with stone apron
  },

  // props
  tree: 'prop_tree',            // 80 x 80 canopy
  bush: 'prop_bush',            // 40 x 40
  lamp: 'prop_lamp',            // 20 x 20
  hydrant: 'prop_hydrant',      // 16 x 16
  bench: 'prop_bench',          // 48 x 20
  cone: 'prop_cone',            // 18 x 18

  // goal
  goalRing: 'goal_ring',        // 360 x 360 glowing ring
  beacon: 'goal_beacon',        // 64 x 64 radial glow
  arrow: 'ui_arrow',            // 64 x 64 arrow pointing +x (HUD goal arrow)

  // particles (small, white-ish so they can be tinted unless noted)
  fxSpark: 'fx_spark',
  fxSmoke: 'fx_smoke',
  fxFlame: 'fx_flame',          // already colored orange/yellow
  fxStar: 'fx_star',
  fxConfetti: 'fx_confetti',
  fxDust: 'fx_dust',
  fxRing: 'fx_ring',            // shockwave ring 256 x 256
  fxRainbow: 'fx_rainbow',      // already colored
  skid: 'fx_skid',              // 8 x 8 dark mark

  // guide buddies (flying dino for the dino car, shining star for the kart)
  buddyDino: ['buddy_dino_0', 'buddy_dino_1', 'buddy_dino_2'] as const, // 64 x 56 wing-flap frames, face +x
  buddyStar: 'buddy_star',      // 56 x 56
  unlockGuides: Object.fromEntries(UNLOCK_GUIDE_IDS.map(kind => [kind, `buddy_${kind}`])) as Record<UnlockGuide, string>,
  buddyGlow: 'buddy_glow',      // 128 x 128 soft additive glow (white, tint as needed)

  // ui
  buttonBadge: ['btn_x', 'btn_y', 'btn_b', 'btn_a'] as const, // 72 x 72 round badges with letters, colored per ANSWER_COLORS (index = AnswerSlot)
  panel: 'ui_panel',            // 9-slice-able rounded panel 96x96 (white, tint as needed)
} as const;

/** Scene image texture key for a SceneEntry id ("scene_001" → "scene_001"). */
export const sceneTex = (sceneId: string) => sceneId;
export const roadTex = (mask: number) => `${TEX.roadPrefix}${mask}`;
