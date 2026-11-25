import type { WorkshopCatalog } from '../core/types';

// Short regular words, including simple blends, digraphs, inflections and silent-e words.
const SOUND_OUT = `
  all big dip far fix flag job low out patch plant ramp see smart sped splash split steep sun
  risk saved shifted take that them time took tops trap wall
  as at back bad bag bend bends bit bite black blast blend block blocks box branch bridge bug buds bump bumps
  can catch check chill chomp chug cliff cold cool crack cracked cross cut dash dark deep den dent did dig dirt
  drop drags duck ducks dug fast fell fern ferns fish fit flat flex flop fluff fog frog fun gap gas
  get got grab grass green grip gripped gulp had hang hard hat heat held help hid hide hill hit hits hold
  honk hop hot hum hush in jump kept kick kit lag lab land last let lift lit log long lot match mix mud must nap
  nest next not nut off or pack pass past path pest pick pile plants pop quick ran red rev rig rock rocks
  run ruts sand scat seen set shake shape sharp shell shift shop shook short shut side sink sip sit skid skin slick
  slid slim slip slush small snap snack snag soft spot stack stand step stick sticky still stop stretch stuck
  swam swim swish tall tap test thick thin this thump tight tint top track trip trunk try tug twist up
  weak well went will with zip
`;
const SIGHT_WORDS = 'a the is to you it of and I go no do put on';

export const STARTER_DENYLIST = new Set([
  'frost', 'needed', 'bright', 'delivery', 'clearance', 'toughness', 'handling', 'camouflage',
  'efficiency', 'acceleration', 'traction', 'slippery', 'vehicle', 'insulation', 'maneuver',
]);

const allowed = new Set(`${SOUND_OUT} ${SIGHT_WORDS.toLowerCase()}`.trim().split(/\s+/));
const escape = (s: string) => s.replace(/[.*+?${}()|[\]\\]/g, '\\$&');
const masks = new WeakMap<WorkshopCatalog, RegExp>();

/** Replace complete, case-sensitive names with one token. Aliases and individual words of a name carry no exemption. */
function maskStarterNames(cat: WorkshopCatalog, line: string): string {
  let mask = masks.get(cat);
  if (!mask) {
    const names = [...cat.variants.map((v) => v.name), ...cat.aspects.map((a) => a.label)];
    mask = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    masks.set(cat, mask);
  }
  return line.replace(mask, '#').replace(/\{(?:part|parts|aspect)\}/g, '#');
}

export function starterWordProblems(cat: WorkshopCatalog, line: string): string[] {
  const words = maskStarterNames(cat, line).toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
  return [...new Set(words.filter((word) => STARTER_DENYLIST.has(word) || !allowed.has(word)))];
}
