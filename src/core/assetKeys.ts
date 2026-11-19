/**
 * Texture keys produced by src/art (package E) at boot and consumed everywhere else.
 * Orchestrator-owned contract. All vehicle/creature textures face +x (east).
 * Sizes are the intended texture pixel sizes (consumers may scale).
 */
export const TEX = {
  // hero cars (length x width)
  carDino: 'car_dino',          // 72 x 40, green dino roadster
  carKart: 'car_kart',          // 60 x 36, red kart, driver cap with white circle + gold star
  carShadow: 'car_shadow',      // soft ellipse, 80 x 48

  // traffic / police
  traffic: ['traffic_0', 'traffic_1', 'traffic_2', 'traffic_3'] as const, // 64 x 36 sedans, varied colors
  truck: 'truck',               // 120 x 48 box truck
  freightTruck: 'vehicle_freight_truck', // 160 x 58 heavy freight truck
  police: ['police_0', 'police_1'] as const, // 66 x 38, light bar frames (red-left / blue-left) for flashing

  // dino (top-down T-rex, facing +x)
  dinoBody: 'dino_body',        // ~300 x 140 torso + neck
  dinoHead: 'dino_head',        // ~140 x 96
  dinoTail: 'dino_tail',        // ~180 x 60, pivot at RIGHT edge (attaches to body rear, trails toward -x); see DINO_RIG
  dinoLeg: ['dino_leg_0', 'dino_leg_1', 'dino_leg_2', 'dino_leg_3'] as const, // walk cycle, ~70 x 40
  dinoShadow: 'dino_shadow',    // 460 x 220 soft ellipse

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
    rail: 'industrial_rail',
    crossing: ['industrial_crossing_idle', 'industrial_crossing_lit'],
    engine: 'industrial_engine',
    freightCar: 'industrial_freight_car',
    headlight: 'industrial_headlight',
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
  buddyGlow: 'buddy_glow',      // 128 x 128 soft additive glow (white, tint as needed)

  // ui
  buttonBadge: ['btn_x', 'btn_y', 'btn_b', 'btn_a'] as const, // 72 x 72 round badges with letters, colored per ANSWER_COLORS (index = AnswerSlot)
  panel: 'ui_panel',            // 9-slice-able rounded panel 96x96 (white, tint as needed)
} as const;

/** Scene image texture key for a SceneEntry id ("scene_001" → "scene_001"). */
export const sceneTex = (sceneId: string) => sceneId;
export const roadTex = (mask: number) => `${TEX.roadPrefix}${mask}`;
