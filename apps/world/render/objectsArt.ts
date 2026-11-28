import type Phaser from 'phaser';

type Paint = (c: CanvasRenderingContext2D) => void;
const size = 128;

function ellipse(c: CanvasRenderingContext2D, color: string, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function rect(c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function poly(c: CanvasRenderingContext2D, color: string, first: [number, number], ...points: [number, number][]): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...first);
  for (const point of points) c.lineTo(...point);
  c.closePath();
  c.fill();
}

function shadow(c: CanvasRenderingContext2D): void {
  ellipse(c, '#17312e55', 69, 88, 57, 30);
}

function boulder(c: CanvasRenderingContext2D): void {
  shadow(c);
  poly(c, '#525b69', [6, 72], [23, 27], [67, 9], [105, 30], [122, 77], [98, 108], [38, 115]);
  poly(c, '#9da5a8', [6, 72], [23, 27], [67, 9], [105, 30], [84, 66], [42, 79]);
  poly(c, '#c0c6bd', [23, 27], [67, 9], [84, 30], [46, 47]);
}

function foliage(c: CanvasRenderingContext2D, dark: string, light: string): void {
  shadow(c);
  ellipse(c, dark, 64, 63, 56, 53);
  ellipse(c, light, 43, 48, 31, 32);
  ellipse(c, light, 84, 48, 28, 30);
  ellipse(c, dark, 70, 76, 31, 29);
}

function tree(c: CanvasRenderingContext2D): void { foliage(c, '#206047', '#41915a'); }

function bush(c: CanvasRenderingContext2D): void {
  foliage(c, '#3c7540', '#70a64c');
  ellipse(c, '#ffcc62', 39, 45, 6, 6);
  ellipse(c, '#ffcc62', 78, 63, 6, 6);
  ellipse(c, '#ffcc62', 92, 38, 5, 5);
}

function log(c: CanvasRenderingContext2D): void {
  shadow(c);
  rect(c, '#a36442', 22, 32, 82, 64);
  rect(c, '#ce9058', 27, 41, 75, 12);
  rect(c, '#794935', 26, 69, 75, 10);
  ellipse(c, '#704535', 23, 64, 16, 32);
  ellipse(c, '#efbe78', 102, 64, 19, 32);
  ellipse(c, '#a76c47', 102, 64, 10, 20);
}

function iceBlock(c: CanvasRenderingContext2D): void {
  shadow(c);
  poly(c, '#609ebe', [10, 36], [66, 15], [114, 42], [116, 84], [62, 110], [13, 86]);
  poly(c, '#c8fcff', [10, 36], [66, 15], [114, 42], [62, 68]);
  poly(c, '#80dce9', [62, 68], [114, 42], [116, 84], [62, 110]);
}

function cactus(c: CanvasRenderingContext2D): void {
  shadow(c);
  ellipse(c, '#407a53', 64, 59, 32, 54);
  ellipse(c, '#67a663', 64, 55, 20, 47);
  ellipse(c, '#407a53', 32, 61, 17, 27);
  ellipse(c, '#407a53', 95, 75, 16, 25);
  ellipse(c, '#ffd092', 63, 15, 11, 8);
}

function vent(c: CanvasRenderingContext2D): void {
  boulder(c);
  ellipse(c, '#343c4f', 66, 52, 30, 20);
  ellipse(c, '#8eeafd', 66, 51, 21, 13);
  ellipse(c, '#d3ffff', 74, 41, 7, 7);
}

function item(c: CanvasRenderingContext2D): void {
  ellipse(c, '#fff3a1', 64, 64, 53, 53);
  poly(c, '#258f91', [64, 27], [102, 61], [64, 104], [26, 61]);
  poly(c, '#baffeb', [64, 27], [102, 61], [64, 68], [26, 61]);
}

function giver(c: CanvasRenderingContext2D): void {
  shadow(c);
  ellipse(c, '#eaa363', 25, 30, 19, 22);
  ellipse(c, '#eaa363', 103, 30, 19, 22);
  ellipse(c, '#cf7750', 64, 66, 52, 51);
  ellipse(c, '#ffca88', 62, 62, 42, 42);
  ellipse(c, '#382842', 45, 57, 6, 9);
  ellipse(c, '#382842', 80, 57, 6, 9);
  ellipse(c, '#b56154', 63, 74, 9, 5);
}

function home(c: CanvasRenderingContext2D): void {
  ellipse(c, '#284f55', 64, 64, 63, 63);
  ellipse(c, '#83d2b2', 64, 64, 56, 56);
  ellipse(c, '#397f76', 64, 64, 50, 50);
  poly(c, '#e4ffe7', [29, 60], [64, 32], [99, 60], [91, 60], [91, 92], [37, 92], [37, 60]);
  rect(c, '#397f76', 56, 70, 16, 22);
}

function door(c: CanvasRenderingContext2D): void {
  shadow(c);
  rect(c, '#6b493f', 14, 24, 100, 88);
  poly(c, '#ac544c', [5, 37], [64, 6], [123, 37]);
  rect(c, '#e2ac66', 29, 42, 70, 66);
  rect(c, '#453c50', 47, 51, 35, 57);
  ellipse(c, '#fff591', 74, 83, 4, 4);
}

function treasure(c: CanvasRenderingContext2D): void {
  shadow(c);
  rect(c, '#865343', 10, 36, 108, 67);
  rect(c, '#bc7547', 10, 32, 108, 37);
  rect(c, '#ffcd65', 23, 32, 12, 71);
  rect(c, '#ffcd65', 93, 32, 12, 71);
  rect(c, '#ffcd65', 54, 61, 20, 20);
}

function jump(c: CanvasRenderingContext2D): void {
  rect(c, '#976d53', 0, 14, 128, 100);
  rect(c, '#ffba55', 114, 14, 14, 100);
  poly(c, '#fff2b1', [38, 44], [70, 64], [38, 84], [58, 84], [89, 64], [58, 44]);
}

function bridge(c: CanvasRenderingContext2D): void {
  rect(c, '#694934', 0, 0, 128, 128);
  for (let x = 0; x < size; x += 16) rect(c, '#c79660', x, 8, 14, 112);
  rect(c, '#905b3a', 0, 0, 128, 9);
  rect(c, '#905b3a', 0, 119, 128, 9);
}

function roof(c: CanvasRenderingContext2D): void {
  poly(c, '#3c414e', [0, 8], [27, 0], [106, 0], [128, 18], [128, 110], [106, 128], [27, 128], [0, 120]);
  poly(c, '#69737a', [6, 18], [27, 9], [100, 9], [118, 22], [118, 75], [87, 89], [20, 72], [6, 59]);
  poly(c, '#58616b', [65, 10], [88, 28], [84, 67], [104, 99], [73, 101], [62, 67], [69, 29]);
}

function narrow(c: CanvasRenderingContext2D): void {
  rect(c, '#ac8565', 0, 0, 128, 12);
  rect(c, '#ac8565', 0, 116, 128, 12);
  for (let x = 8; x < size; x += 36) {
    ellipse(c, '#d5bc94', x, 9, 6, 8);
    ellipse(c, '#d5bc94', x, 119, 6, 8);
  }
}

const obstacleArt = new Map<string, Paint>(Object.entries({
  boulder, rock: boulder, bush, tree, log, iceBlock, cactus, vent,
}));
const propArt = { item, giver, home, door, treasure, jump, bridge, tunnel: roof, cave: roof, narrow };

export function objectTexture(scene: Phaser.Scene, kind: string, obstacle = false): string {
  const key = `world:w5a:${obstacle ? 'obstacle' : 'prop'}:${kind}`;
  if (scene.textures.exists(key)) return key;
  const draw = obstacle ? obstacleArt.get(kind) ?? boulder : propArt[kind as keyof typeof propArt];
  const texture = scene.textures.createCanvas(key, size, size)!;
  draw(texture.context);
  texture.refresh();
  return key;
}
