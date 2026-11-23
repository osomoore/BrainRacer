import { Q, type PartSpec } from '../bake';
import { hashStr } from '../geom';
import { dinoRunArtSpec, fernKey, FRUIT, grassKey } from '../../run/dino/kit/art';
import { artFile, FACE_NEGATIVE, HOUSE_STYLE, jobSpecHash, NEGATIVE, PAINT_TUNE, PICKS, type ArtJob } from './jobs';

const SUBJECTS: Record<string, string> = {
  cloud: 'soft white cloud with a pale blue accent',
  sun: 'golden sun with lemon-yellow rays',
  bush: 'rounded leafy green bush with pink berries',
  flowers: 'green-stemmed flower patch with purple petals',
  trunk: 'warm brown tree trunk with dark brown bark grooves',
  canopy: 'rounded green tree crown with lime-green leaf accents',
  palm: 'palm tree with a brown trunk and green fronds',
  cactus: 'green cactus with one pink blossom',
  stump: 'brown tree stump with golden wood rings',
  log: 'brown fallen log from the side with golden end grain',
  logEnd: 'round brown log cross-section with golden growth rings',
  pebble: 'small grey pebble with a silver highlight',
  dirt: 'brown dirt mound with dark brown clods',
  dune: 'golden sand dune with an ochre accent',
  snowmound: 'white snow pile with pale blue shading',
  dome: 'rounded grassy green hill with pink flowers',
  hole: 'dark oval burrow entrance with a brown rim, side view',
  glow: 'soft warm yellow glow fading out from the center',
  nestBack: 'brown oval twig nest interior with a dark brown rim',
  nestFront: 'curved brown front rim of a twig nest with tan twigs',
  egg: 'cream egg with coral spots',
  treat: 'round golden kernel with an orange star accent',
  nutHalfL: 'brown left nut shell half with a cream interior',
  nutHalfR: 'brown right nut shell half with a cream interior',
  plank: 'broken brown bridge boards with tan wood grain',
  waveTop: 'blue horizontal wave crest strip with white foam, repeating edges',
  water: 'blue water surface tile with light blue ripples, repeating edges',
  heat: 'three translucent white wavy lines representing heat shimmer',
  windline: 'single translucent white curved wind streak',
  shade: 'soft translucent violet-grey oval shadow',
  arrow: 'golden yellow downward arrow with an amber accent',
  icicle: 'pale blue icicle with a white glint',
  shades: 'navy sunglasses with white reflections',
  bulge: 'rounded cream belly bulge with a pale gold accent',
  birdWing: 'single blue bird wing with a sky-blue accent',
  bigBody: 'rounded purple dinosaur torso with tail and golden accents',
  bigLeg: 'single purple dinosaur leg with cream toes',
  'hole:top': 'dark oval burrow entrance with a brown rim, top-down view',
  tuftTop: 'green grass tuft with a dark green accent, top-down view',
  rockTop: 'grey boulder with a silver patch, top-down view',
  flowerTop: 'pink flower with a golden center, top-down view',
  'nut:1': 'hard brown nut with a tan ridge',
  'nut:2': 'hairy brown coconut with a dark brown accent',
  'nut:3': 'grey giant nut with silver stone bands',
  [FRUIT]: 'orange mango with a green leaf',
  'far:hills': 'wide layered backdrop of rolling green hills with a lime-green accent',
  'far:peaks': 'wide layered backdrop of blue mountain peaks with white snow caps',
  'far:mesas': 'wide layered backdrop of terracotta mesas with an ochre accent',
  'far:dunes': 'wide layered backdrop of golden dunes with an ochre accent',
  'far:forest': 'wide layered backdrop of green treetops with an emerald accent',
  'wall:cliff': 'tan layered cliff wall with brown seams, repeating edges',
  'wall:red': 'terracotta layered cliff wall with russet seams, repeating edges',
  'wall:ice': 'icy blue layered cliff wall with white streaks, repeating edges',
  'wall:dirt': 'brown layered dirt wall with tan seams, repeating edges',
  'rock:a': 'large cool grey boulder with a silver accent',
  'rock:b': 'medium taupe boulder with a sand-colored accent',
  'rock:c': 'small slate-grey boulder with a silver accent',
  'rock:d': 'warm grey boulder with a beige accent',
};

const FACE_FAMILIES = [
  ['beetle', 'round red beetle with navy spots', ['happy', 'giggle', 'oops', 'scared', 'sleep']],
  ['frog', 'small green frog with a pale lime belly', ['happy', 'giggle', 'oops', 'scared']],
  ['lizard', 'green lizard with lime spots, side view', ['happy', 'giggle', 'oops', 'scared', 'sleep']],
  ['lizardTop', 'green lizard with lime spots, top-down view', ['happy', 'sleep', 'scared']],
  ['bird', 'round blue bird with a golden beak', ['happy', 'laugh', 'peck']],
  ['fish', 'round orange fish with a cream belly', ['happy', 'scared']],
  ['bigHead', 'round purple dinosaur head with golden spikes', ['normal', 'sniff', 'lick', 'surprised', 'sneeze', 'shrug', 'laugh']],
  ['friend', 'small pink dinosaur with a pale pink belly', ['a', 'b']],
  ['friend2', 'small periwinkle dinosaur with a pale blue belly', ['a', 'b']],
] as const;

export function dinoRunJobs(specs: Map<string, PartSpec>): ArtJob[] {
  const add = (name: string, subject: string, faceSafe = false): ArtJob => {
    const spec = dinoRunArtSpec(name);
    if (!spec) throw new Error(`Dino Lab scenery has no shape for ${name}`);
    specs.set(spec.key, spec);
    const defaultSeed = hashStr(spec.key);
    const pick = PICKS[spec.key]?.pick;
    const job: ArtJob = {
      key: spec.key, file: artFile(spec.key), kind: 'shape', workshop: 'scene',
      aspect: 'scenery', part: name.split(':')[0], subject,
      prompt: `${HOUSE_STYLE}, ${subject}${faceSafe ? ', preserve the original facial expression and features' : ''}`,
      negative: `${NEGATIVE}, ${FACE_NEGATIVE}`,
      defaultSeed, seed: typeof pick === 'number' ? pick : defaultSeed,
      w: Math.ceil(spec.w * Q), h: Math.ceil(spec.h * Q),
      denoise: faceSafe ? PAINT_TUNE.faceDenoise : PAINT_TUNE.denoise,
      control: faceSafe ? PAINT_TUNE.faceControl : PAINT_TUNE.control,
      sticker: faceSafe ? PAINT_TUNE.faceSticker : PAINT_TUNE.sticker,
      ...(faceSafe ? { protect: 'features' as const } : {}),
      specHash: '',
    };
    job.specHash = jobSpecHash(job);
    return job;
  };

  return [
    ...Object.entries(SUBJECTS).map(([name, subject]) => add(name, subject)),
    ...[3, 5, 7].map((n) => add(fernKey(n), `${n}-frond green fern clump with pale green leaflets`)),
    ...[0, 1, 2].map((n) => add(grassKey(n), 'tall green grass clump with a lime-green accent')),
    ...FACE_FAMILIES.flatMap(([family, subject, variants]) => variants.map((variant) =>
      add(`${family}:${variant}`, subject, true))),
  ];
}
