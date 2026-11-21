import type { Ctx } from '../art/draw';
import type { QueuedMap } from '../config/queuedMaps';

export type Palette = {
  floor: readonly [string, string, string, string, string, string];
  road: string;
  curb: string;
  lane: string;
  shade: string;
  light: string;
  colors: readonly string[];
};

export const QUEUED_PALETTES: Record<QueuedMap, Palette> = {
  brickworks: {
    floor: ['#2f7396', '#6b9760', '#b0a079', '#729f56', '#be9769', '#a47750'],
    road: '#927454', curb: '#62472f', lane: '#f4cb86', shade: '#293941', light: '#fff1b0',
    colors: ['#bc6645', '#62a466', '#d7ae64', '#5a8d9e', '#a09572', '#a66980'],
  },
  mushroom: {
    floor: ['#165b79', '#537974', '#9f7196', '#74866a', '#ae8ca9', '#a18191'],
    road: '#66556f', curb: '#403957', lane: '#f4cfc5', shade: '#343354', light: '#fff0c8',
    colors: ['#e87268', '#ef9e5b', '#aa7ec0', '#eeb076', '#b8c45e', '#e47e9a'],
  },
  tundra: {
    floor: ['#417e9a', '#b6d3d4', '#bad4e0', '#82acbb', '#dae9e4', '#8dc6d7'],
    road: '#698995', curb: '#e3f2ee', lane: '#eff8e8', shade: '#385061', light: '#f4faf4',
    colors: ['#e89773', '#9cc6da', '#d7dbcb', '#78a6a7', '#dca968', '#a6abc7'],
  },
  volcano: {
    floor: ['#cb502e', '#4e3b47', '#63565e', '#674555', '#795653', '#795048'],
    road: '#4b4550', curb: '#241f30', lane: '#ffc076', shade: '#302739', light: '#ffd089',
    colors: ['#b66a47', '#946052', '#ca915b', '#8d676f', '#a37265', '#77586c'],
  },
  candy: {
    floor: ['#a36e9c', '#91b97a', '#d29ba9', '#bf9b9e', '#e8c1a9', '#dcbc94'],
    road: '#af718b', curb: '#754a61', lane: '#ffedca', shade: '#863e5f', light: '#ffefdc',
    colors: ['#ee8b9f', '#a5c7f0', '#ffd184', '#c7afe4', '#92d5b4', '#df946f'],
  },
  castle: {
    floor: ['#39617b', '#879071', '#aea498', '#9a7d65', '#b9ab8d', '#a48369'],
    road: '#a3907e', curb: '#695a51', lane: '#f0d5aa', shade: '#574453', light: '#eaddb9',
    colors: ['#bcab8d', '#a1a6a6', '#aeb48c', '#c2a591', '#a1a6b9', '#ccb892'],
  },
  airport: {
    floor: ['#27445a', '#748a72', '#809393', '#495d67', '#a2ada5', '#717f85'],
    road: '#43515c', curb: '#2f4050', lane: '#f5d486', shade: '#3a5065', light: '#d5e9df',
    colors: ['#8fb7bd', '#acbac5', '#c5c9a9', '#80a8bb', '#b8a2a1', '#9aafa7'],
  },
  house: {
    floor: ['#3b3438', '#b08160', '#ce995c', '#75718c', '#d0a283', '#aa795d'],
    road: '#5d7b85', curb: '#334a5c', lane: '#e6cea2', shade: '#744962', light: '#fff0ce',
    colors: ['#b47384', '#86a7bc', '#d4ab73', '#ca9876', '#a8ab78', '#bb91b7'],
  },
};

export function box(c: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
