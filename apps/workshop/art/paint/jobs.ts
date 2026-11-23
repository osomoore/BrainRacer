/**
 * Art job manifest (pure, no Phaser, no Node): every texture the ComfyUI paint pass can repaint.
 *  - `shape` jobs: one per part texture the rigs bake (variant x view x part). The key, size and shape come from the
 *    very same PartSpec builders the rigs call, so keys can never drift from the baked textures.
 *  - `prompt` jobs: hand-listed images with no shape (backdrops, tileable textures).
 * `specHash` covers everything that decides the painted pixels except the shape drawing itself (prompt, seed,
 * strengths, size); `scripts/art/paint.py` additionally records a pixel hash of the exported shape.
 * See docs/WORKSHOP_ART_PIPELINE.md.
 */
import { CATALOGS } from '../../content';
import type { Model, View, WorkshopId } from '../../core/types';
import { type PartSpec, Q } from '../bake';
import { hashStr } from '../geom';
import { BEAK_LOOKS, CLAWS } from '../dino/looks';
import * as DS from '../dino/drawSide';
import * as DT from '../dino/drawTop';
import { dinoLooks, skeleton } from '../dino/skeleton';
import { type PatternedPartSpec, skinSpec } from '../dino/skin';
import { raceGeom, raceLooks } from '../race/geometry';
import { SPRING } from '../race/looks';
import * as RS from '../race/drawSide';
import * as RT from '../race/drawTop';
import { dinoRunJobs } from './jobsDinoRun';
import picksData from './picks.json';
import { addRaceRunShapes } from './jobsRaceRun';

export type ArtGroup = 'race' | 'dino' | 'scene';

export interface ArtJob {
  /** Texture key (`ws:...`), also the key in the painted manifest. */
  key: string;
  /** File name stem inside art-src/ and public/art/workshop/. */
  file: string;
  kind: 'shape' | 'prompt';
  workshop: ArtGroup;
  view?: View;
  /** Part family (`head`, `torso`, `body`, `wheel`...). */
  part: string;
  /** Aspect whose variants this job belongs to (`color`, `head`, `paint`...), for `--only`-style grouping. */
  aspect: string;
  /** Human-readable subject, also the middle of the prompt. */
  subject: string;
  prompt: string;
  negative: string;
  seed: number;
  /** Final PNG size in pixels (shape jobs: the baked texture size). */
  w: number;
  h: number;
  /** img2img denoise (shape jobs) and ControlNet strength (shape jobs). Prompt jobs ignore both. */
  denoise: number;
  control: number;
  /** StickersRedmond LoRA weight (shape jobs). Low for plain body pieces so the model does not invent faces. */
  sticker: number;
  /** Prompt jobs: native generation size before downscaling to w x h. */
  genW?: number;
  genH?: number;
  /** Prompt jobs: make the result tile seamlessly. */
  tileable?: boolean;
  /**
   * `features`: the shape carries eyes/nostrils/brows (dino heads). The paint pass then only repaints the skin
   * (masked img2img around a feature mask exported from the shape), copies the feature pixels back exactly and scrubs
   * any dark stroke the model invented on the skin (extra mouths).
   */
  protect?: 'features';
  /** The seed the job had before a vote (hash of the key); candidates derive their seeds from it. */
  defaultSeed: number;
  defaultPatternSeed?: number;
  patternSeed?: number;
  specHash: string;
}

/** Votes from `npm run art:pick` (apps/workshop/art/paint/picks.json): key -> a candidate seed, 'shape' (keep the code shape) or 'more' ('pending' = only a comment). */
export interface ArtPick { pick: number | 'shape' | 'more' | 'pending'; comment?: string; patternSeed?: number }
export const PICKS = picksData as unknown as Record<string, ArtPick>;

export const HOUSE_STYLE = 'Stickers, cute cartoon game asset, thick dark navy outline, bold saturated flat colors with soft cel shading and a glossy highlight, friendly, for kids, clean sharp edges, plain light grey background, centered, full object visible';
export const NEGATIVE = 'realistic, photo, 3d render, scary, blood, text, letters, watermark, blurry, noisy, extra limbs, cropped, background scenery, shadow on the ground';
export const BACKDROP_STYLE = 'cute cartoon illustration for a kids game, bold colors, soft cel shading, thick friendly shapes, cheerful, no people, no text, no letters';

/** Tuning knobs (the only numbers to touch when a look needs adjusting). */
export const PAINT_TUNE = { denoise: 0.62, control: 0.9, sticker: 0.6, bodyDenoise: 0.55, bodySticker: 0.2, faceDenoise: 0.55, faceControl: 0.95, faceSticker: 0.4 };
/** Extra negatives for parts that carry facial features: the model must not invent mouths, eyes or face lines. */
export const FACE_NEGATIVE = 'mouth, lips, teeth, tongue, smile, extra eyes, second eye, face, nose, nostrils, eyebrows, wrinkles, lines on the face, open jaw';

export const artFile = (key: string): string => key.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');

/** Stable 53-bit hex hash of a string. */
export function hash53(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function jobSpecHash(j: Pick<ArtJob, 'key' | 'kind' | 'prompt' | 'negative' | 'seed' | 'w' | 'h' | 'denoise' | 'control' | 'sticker' | 'genW' | 'genH' | 'tileable' | 'protect' | 'patternSeed'>): string {
  const base: unknown[] = [j.key, j.kind, j.prompt, j.negative, j.seed, j.w, j.h, j.denoise, j.control, j.sticker, j.genW ?? 0, j.genH ?? 0, !!j.tileable];
  if (j.protect) base.push(j.protect); // only when set, so existing hashes stay valid
  if (j.patternSeed !== undefined) base.push(['patternSeed', j.patternSeed]);
  return hash53(JSON.stringify(base));
}

const words = (id: string): string => (id.split('.')[1] ?? id).replace(/([A-Z])/g, ' $1').toLowerCase();
const viewText = (v: View): string => (v === 'side' ? 'side view' : 'seen from directly above, top-down view');

// ------------------------------------------------------------------ shape job builder

const SPECS = new Map<string, PatternedPartSpec>();

const HEAD_PARTS = new Set(['head', 'jaw', 'fhead']);
const BODYISH_PARTS = new Set(['torso', 'tail', 'leg', 'arm', 'wing', 'plates', 'sail', 'frill']);
/** Extra negatives per part so the model does not invent faces or limbs on plain body pieces. */
function negativeFor(part: string, workshop: WorkshopId): string {
  let n = NEGATIVE;
  if (workshop === 'dino' && !HEAD_PARTS.has(part)) n += ', face, eyes, mouth, smile, nostrils, head';
  if (part === 'torso') n += ', legs, feet, arms, hands, tail, claws, toes';
  if (part === 'leg' || part === 'arm') n += ', body, torso, two legs, multiple feet';
  if (BODYISH_PARTS.has(part) && part !== 'torso') n += ', whole animal';
  return n;
}

function shapeJob(workshop: WorkshopId, view: View, part: string, aspect: string, spec: PatternedPartSpec, subject: string,
  faceSafe = workshop === 'dino' && part === 'head',
): ArtJob {
  const w = Math.ceil(spec.w * Q), h = Math.ceil(spec.h * Q);
  const full = `${subject}, ${viewText(view)}`;
  // Plain body pieces get a face-free "flat vector" template: the cute sticker style invents eyes and limbs on them.
  const plain = workshop === 'dino' && BODYISH_PARTS.has(part);
  const facePrompt = workshop === 'dino'
    ? ', smooth skin, the eye is the only facial feature'
    : ', preserve the existing facial features and expression';
  const seed = hashStr(spec.key), picked = PICKS[spec.key]?.pick;
  const j: ArtJob = {
    key: spec.key, file: artFile(spec.key), kind: 'shape', workshop, view, part, aspect, subject: full,
    prompt: plain
      ? `flat cartoon vector illustration, ${full}, soft cel shading, thick dark navy outline, plain light grey background, a single smooth abstract shape with no face, no eyes, no mouth`
      : `${HOUSE_STYLE}, ${full}${faceSafe ? facePrompt : ''}`,
    negative: negativeFor(part, workshop) + (faceSafe ? `, ${FACE_NEGATIVE}` : ''), seed: typeof picked === 'number' ? picked : seed, defaultSeed: seed, w, h,
    denoise: plain ? PAINT_TUNE.bodyDenoise : faceSafe ? PAINT_TUNE.faceDenoise : PAINT_TUNE.denoise,
    control: faceSafe ? PAINT_TUNE.faceControl : PAINT_TUNE.control,
    sticker: plain ? PAINT_TUNE.bodySticker : faceSafe ? PAINT_TUNE.faceSticker : PAINT_TUNE.sticker, specHash: '',
    defaultPatternSeed: spec.defaultPatternSeed, patternSeed: spec.pickedPatternSeed,
    ...(faceSafe ? { protect: 'features' as const } : {}),
  };
  j.specHash = jobSpecHash(j);
  SPECS.set(spec.key, spec);
  return j;
}

// ------------------------------------------------------------------ Race Shop

const RACE_BODY_WORD: Record<string, string> = {
  'body.car': 'small hatchback car', 'body.truck': 'pickup truck', 'body.sports': 'low sports car', 'body.van': 'boxy delivery van', 'body.jeep': 'rugged jeep with spare tire',
};
const PAINT_WORD: Record<string, string> = {
  'paint.blue': 'bright blue', 'paint.yellow': 'sunny yellow', 'paint.red': 'cherry red', 'paint.green': 'fresh green', 'paint.black': 'dark charcoal black', 'paint.rainbow': 'rainbow striped, red orange yellow green blue purple bands',
};
const WHEEL_WORD: Record<string, string> = {
  'wheels.road': 'plain black road tire with silver rim', 'wheels.mud': 'chunky brown mud tire with deep lugs', 'wheels.racing': 'slick racing tire with yellow stripe and gold rim',
  'wheels.snow': 'white snow tire with blue rim', 'wheels.monster': 'giant monster truck tire with red rim',
};
const SHAPE_WORD: Record<string, string> = { 'shape.boxy': 'boxy', 'shape.round': 'round bubbly', 'shape.sleek': 'sleek aerodynamic', 'shape.wedge': 'wedge-shaped' };

function raceJobs(m: Model, aspect: string, out: Map<string, ArtJob>): void {
  const L = raceLooks(m), geo = raceGeom(L);
  const { body: b } = L;
  const paint = PAINT_WORD[m.paint] ?? words(m.paint);
  const add = (view: View, part: string, spec: PartSpec | null, subject: string): void => {
    if (!spec || out.has(spec.key)) return;
    out.set(spec.key, shapeJob('race', view, part, aspect, spec, subject));
  };
  const bodyWord = `${SHAPE_WORD[m.shape] ?? ''} ${RACE_BODY_WORD[m.body] ?? 'toy car'}`.trim();
  const bodySubject = `cartoon toy ${bodyWord} body painted ${paint}, glass windows, no wheels`;
  // ---- side
  if (m.gears === 'gears.fourByFour') add('side', 'shaft', RS.shaftSide(geo.frontAxle - geo.rearAxle), 'cartoon metal drive shaft');
  if (m.extra === 'extra.rocket') add('side', 'rocket', RS.rocketSide(), 'cartoon toy rocket booster, white with red fins');
  add('side', 'body', RS.bodySide(L, geo, m.paint, { body: m.body, shape: m.shape }), bodySubject);
  if (m.extra === 'extra.floats') add('side', 'floats', RS.floatSide(b.len - 30), 'orange inflatable boat float');
  add('side', 'engine', RS.engineSide(m.engine), `cartoon engine hood badge, ${words(m.engine)} engine`);
  add('side', 'exhaust', RS.exhaustSide(m.engine), 'cartoon exhaust pipes');
  add('side', 'gear', RS.gearSide(m.gears), `cartoon gear wheels badge, ${words(m.gears)}`);
  const [r0, r1] = geo.cabinTopRange;
  if (m.extra === 'extra.roofRack') {
    const w = Math.max(70, (r1 - r0) * 0.9), cx = (r0 + r1) / 2;
    const legH = Math.round(Math.max(10, geo.topY(cx - w / 2) - geo.roofTop + 6));
    add('side', 'rack', RS.rackSide(w, legH), 'cartoon metal roof rack with a brown suitcase and orange cone');
  }
  if (m.extra === 'extra.spoiler') add('side', 'spoiler', RS.spoilerSide(), 'cartoon black car spoiler wing with red tips');
  if (m.extra === 'extra.snorkel') { const x = b.cab[1] + 4, y0 = geo.topY(x) + 4; add('side', 'snorkel', RS.snorkelSide(Math.round(y0 - geo.roofTop + 26)), 'cartoon car snorkel tube'); }
  if (m.extra === 'extra.winch') add('side', 'winch', RS.winchSide(), 'cartoon yellow winch with a hook');
  add('side', 'bumper', RS.bumperSide(m.bumpers), `cartoon car bumper, ${words(m.bumpers)}`);
  add('side', 'wheel', RS.wheelSide(m.wheels), `cartoon ${WHEEL_WORD[m.wheels] ?? 'car wheel'}`);
  const sp = SPRING[m.springs] ?? SPRING['springs.soft'];
  add('side', 'spring', RS.springSide(m.springs, sp.lift + 26 + (m.springs === 'springs.bouncy' ? 6 : 0)), `cartoon coil spring suspension, ${words(m.springs)}`);
  // ---- top
  const hw = b.hw, cw = hw * 0.76, [c0, c1] = b.cab;
  if (m.extra === 'extra.rocket') add('top', 'rocket', RT.rocketTop(), 'cartoon toy rocket booster, white with red fins');
  if (m.extra === 'extra.floats') add('top', 'floats', RT.floatTop(b.len * 0.6), 'orange inflatable boat float');
  add('top', 'body', RT.bodyTop(L, m.paint, { body: m.body, shape: m.shape }), `cartoon toy ${bodyWord} painted ${paint}, glass windows`);
  add('top', 'engine', RT.engineTop(m.engine), `cartoon engine hood badge, ${words(m.engine)} engine`);
  add('top', 'exhaust', RT.exhaustTop(m.engine, hw), 'cartoon exhaust pipes');
  if (m.extra === 'extra.roofRack') add('top', 'rack', RT.rackTop((c1 - c0) * 0.8, cw * 1.5), 'cartoon metal roof rack');
  if (m.extra === 'extra.spoiler') add('top', 'spoiler', RT.spoilerTop(hw), 'cartoon black car spoiler wing');
  if (m.extra === 'extra.snorkel') add('top', 'snorkel', RT.snorkelTop(), 'cartoon snorkel tube opening');
  if (m.extra === 'extra.winch') add('top', 'winch', RT.winchTop(), 'cartoon yellow winch');
  add('top', 'bumper', RT.bumperTop(m.bumpers, hw), `cartoon car bumper, ${words(m.bumpers)}`);
  add('top', 'wheel', RT.wheelTop(m.wheels), `cartoon ${WHEEL_WORD[m.wheels] ?? 'car wheel'} tread`);
}

// ------------------------------------------------------------------ Dino Lab

const SKIN_WORD: Record<string, string> = {
  'color.orange': 'bright orange', 'color.green': 'forest green', 'color.sandy': 'sandy tan', 'color.blue': 'bright sky blue', 'color.purple': 'purple', 'color.spotted': 'golden yellow with brown spots',
};
const HEAD_WORD: Record<string, string> = {
  'head.round': 'round friendly head', 'head.horned': 'head with big horns and a nose horn', 'head.longNeck': 'small head on a long neck', 'head.crest': 'head with a tall crest', 'head.rex': 'big T-Rex head with a brow',
};

function dinoJobs(m: Model, aspect: string, out: Map<string, ArtJob>): void {
  const l = dinoLooks(m), sk = skinSpec(m), claw = CLAWS[m.claws] ?? CLAWS['claws.small'], k = skeleton(l, claw.arm);
  const skin = SKIN_WORD[m.color] ?? words(m.color);
  const dino = `cute cartoon dinosaur, ${skin} skin`;
  const plainDino = `${skin} dinosaur`;
  const h = l.head, beakLook = BEAK_LOOKS[0];
  const add = (view: View, part: string, spec: PartSpec | null, subject: string): void => {
    if (!spec || out.has(spec.key)) return;
    out.set(spec.key, shapeJob('dino', view, part, aspect, spec, subject));
  };
  const headWord = HEAD_WORD[m.head] ?? 'head';
  // ---- side
  add('side', 'tail', DS.tailSide(l.tail, sk, m.tail), `${plainDino} ${words(m.tail)} tail, tail only`);
  if (k.pose === 'fly') for (const far of [true, false]) add('side', 'wing', DS.wingSide(sk, far), `${plainDino} bat-like wing, one wing only`);
  for (const s of k.legs) {
    const hand = k.pose === 'crawl' && s.front;
    add('side', 'leg', DS.legSide(l.legs, sk, m.legs, claw, m.claws, s.len, s.far, hand, k.pose === 'swim'), `${plainDino} ${words(m.legs)} leg with foot and claws, single leg only`);
  }
  for (const s of k.arms) add('side', 'arm', DS.armSide(claw, sk, m.claws, s.far), `${plainDino} small arm with ${words(m.claws)} claws`);
  if (l.body.kind === 'sail') add('side', 'sail', DS.sailSide(l.body), `${plainDino} back sail fin`);
  add('side', 'torso', DS.torsoSide(l.body, h, k, sk, m.body, m.head), `smooth glossy ${skin} blob shape with a lighter belly patch and a thick neck stub, tiny scale texture`);
  if (l.body.kind === 'armor') add('side', 'plates', DS.platesSide(l.body), 'row of grey bony armor plates on a dinosaur back');
  if (sk.ex?.kind === 'frill') add('side', 'frill', DS.frillSide(h, sk), 'big pink dinosaur neck frill');
  if (sk.ex?.kind === 'feathers') add('side', 'fhead', DS.featherHeadSide(h, sk), 'colorful feathers on a dinosaur head');
  add('side', 'teeth', DS.teethSide(h, m.teeth), `row of ${words(m.teeth)} white dinosaur teeth`);
  add('side', 'jaw', DS.jawSide(h, sk, m.head, m.teeth, beakLook), `${dino}, lower jaw only, ${words(m.teeth)} teeth, mouth open`);
  add('side', 'head', DS.headSide(h, sk, m.head, m.teeth, beakLook), `${dino}, ${headWord} with a big friendly eye`);
  // ---- top
  const hand = (pose: string, front: boolean): boolean => pose === 'crawl' && front;
  add('top', 'tail', DT.tailTop(l.tail, sk, m.tail), `${plainDino} ${words(m.tail)} tail, tail only`);
  add('top', 'leg', DT.legTop(l.legs, claw, sk, m.legs, m.claws, hand(k.pose, false)), `${plainDino} ${words(m.legs)} leg and foot, single leg only`);
  if (k.pose === 'crawl') add('top', 'leg', DT.legTop(l.legs, claw, sk, m.legs, m.claws, hand(k.pose, true)), `${plainDino} ${words(m.legs)} leg and foot, single leg only`);
  if (k.pose === 'fly') add('top', 'wing', DT.wingTop(sk), `${plainDino} bat-like wing, one wing only`);
  if (k.pose !== 'crawl') add('top', 'arm', DT.armTop(claw, sk, m.claws), `${plainDino} small arm with ${words(m.claws)} claws`);
  add('top', 'torso', DT.torsoTop(l.body, h, k.pose, sk, m.body, m.head), `smooth glossy ${skin} oval shape with tiny scale texture`);
  if (l.body.kind === 'armor') add('top', 'plates', DT.platesTop(l.body, k.pose), 'row of grey bony armor plates on a dinosaur back');
  if (l.body.kind === 'sail') add('top', 'sail', DT.sailTop(l.body, k.pose), `${plainDino} back sail fin`);
  if (sk.ex?.kind === 'frill') add('top', 'frill', DT.frillTop(h, sk), 'big pink dinosaur neck frill');
  if (sk.ex?.kind === 'feathers') add('top', 'fhead', DT.featherHeadTop(h, sk), 'colorful feathers on a dinosaur head');
  add('top', 'head', DT.headTop(h, sk, m.head, m.teeth, beakLook), `${dino}, ${headWord}, eyes on both sides`);
}

// ------------------------------------------------------------------ prompt-only jobs

function promptJob(key: string, part: string, subject: string, prompt: string, w: number, h: number, genW: number, genH: number, tileable = false): ArtJob {
  const j: ArtJob = {
    key, file: artFile(key), kind: 'prompt', workshop: 'scene', part, aspect: 'backdrop', subject,
    prompt, negative: NEGATIVE.replace('background scenery, ', ''), seed: hashStr(key), defaultSeed: hashStr(key), w, h, denoise: 1, control: 0, sticker: 0, genW, genH, tileable, specHash: '',
  };
  j.specHash = jobSpecHash(j);
  return j;
}

export const PROMPT_JOBS: readonly ArtJob[] = [
  promptJob('ws:bg:garage', 'backdrop', 'Race Shop garage', `${BACKDROP_STYLE}, wide view of a cozy car workshop garage interior, tool wall with wrenches, a workbench, tire stack, oil cans, big open garage door with blue sky, warm light, empty floor in the middle`, 1024, 576, 1024, 576),
  promptJob('ws:bg:dinolab', 'backdrop', 'Dino Lab', `${BACKDROP_STYLE}, wide view of a friendly dinosaur science lab with colorful machines, glowing green tubes, big round window showing a jungle and volcano, fern plants, empty floor in the middle`, 1024, 576, 1024, 576),
  promptJob('ws:tex:skin', 'texture', 'mottled skin texture', 'seamless tileable texture, soft mottled orange reptile skin with tiny round scales, flat cartoon pattern, top-down, even lighting, no outline, no objects', 512, 512, 768, 768, true),
];

// ------------------------------------------------------------------ the manifest

/** Every job, in a stable order. Variants are swapped one aspect at a time into the starter model. */
export function allArtJobs(): ArtJob[] {
  const out = new Map<string, ArtJob>();
  for (const workshop of ['race', 'dino'] as const) {
    const cat = CATALOGS[workshop];
    const base: Model = Object.fromEntries(cat.aspects.map((a) => [a.id, a.starters[0]]));
    for (const a of cat.aspects) {
      const ids = cat.variants.filter((v) => v.aspect === a.id).map((v) => v.id);
      for (const id of ids) {
        const m = { ...base, [a.id]: id };
        if (workshop === 'race') raceJobs(m, a.id, out); else dinoJobs(m, a.id, out);
      }
    }
  }
  for (const job of dinoRunJobs(SPECS)) out.set(job.key, job);
  addRaceRunShapes((view, part, [spec, subject, faceSafe]) => {
    out.set(spec.key, shapeJob('race', view, part, 'run', spec, subject, faceSafe));
  });
  for (const j of PROMPT_JOBS) out.set(j.key, j);
  return [...out.values()];
}

/** The PartSpec behind a shape job (filled by `allArtJobs`; the export scene bakes it). */
export function artSpec(key: string): PartSpec | undefined {
  const candidate = /^(.*):pattern=(\d+)$/.exec(key);
  if (!candidate) return SPECS.get(key);
  const spec = SPECS.get(candidate[1])?.withPatternSeed?.(Number(candidate[2]));
  // ArtExport uses the requested key to look up and remove the temporary canvas texture.
  return spec && { ...spec, key };
}
