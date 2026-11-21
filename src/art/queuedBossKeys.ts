const PARTS = ['body', 'head', 'arm', 'foot', 'beam', 'glow'] as const;
type Part = typeof PARTS[number];

function textures(map: string): Record<Part, string> {
  return Object.fromEntries(PARTS.map(part => [part, `queued_boss_${map}_${part}`])) as Record<Part, string>;
}

export const QUEUED_BOSS_PARTS = {
  brickworks: textures('brickworks'),
  mushroom: textures('mushroom'),
  tundra: textures('tundra'),
  volcano: textures('volcano'),
  candy: textures('candy'),
  castle: textures('castle'),
  airport: textures('airport'),
  house: textures('house'),
};

// The texture registry enumerates one object level.
export const QUEUED_BOSS_TEXTURES = Object.fromEntries(Object.entries(QUEUED_BOSS_PARTS)
  .flatMap(([map, parts]) => PARTS.map(part => [`${map}_${part}`, parts[part]])));
