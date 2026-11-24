import { ellipse, fillStroke, OUTLINE, poly, rr, star, type Ctx } from '../art/draw';
import { paintBomb } from './bombArt';

function box(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string | CanvasGradient) {
  rr(ctx, x, y, w, h, radius);
  fillStroke(ctx, color, OUTLINE, 2.3);
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ellipse(ctx, x, y, rx, ry);
  fillStroke(ctx, color, OUTLINE, 2.3);
}

function guideFace(ctx: Ctx, x: number, y: number) {
  for (const side of [-1, 1]) oval(ctx, x + side * 5, y, 1.3, 2.4, '#20314d');
  ctx.beginPath(); ctx.arc(x, y + 4, 3, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
}

export const EARLY_BUDDY_PAINTERS = {
  fairy(ctx) {
    for (const x of [14, 44]) {
      oval(ctx, x, 23, 11, 10, '#d3f7ff');
      oval(ctx, x + (x < 29 ? 1 : -1) * 3, 35, 8, 8, '#f9bbfc');
    }
    poly(ctx, [29, 26, 43, 44, 36, 48, 22, 48, 15, 44]);
    fillStroke(ctx, '#d867c5', OUTLINE, 2.5);
    oval(ctx, 29, 20, 12, 11, '#ffdbad');
    oval(ctx, 29, 12, 10, 5, '#ffb65b');
    guideFace(ctx, 29, 20);
    star(ctx, 46, 9, 7, 3, 4);
    fillStroke(ctx, '#fff29a', OUTLINE, 1.5);
  },
  bumblebee(ctx) {
    for (const x of [16, 42]) oval(ctx, x, 20, 11, 12, '#caf6ff');
    oval(ctx, 29, 31, 15, 18, '#ffd85b');
    box(ctx, 16, 35, 26, 4, 2, '#263752');
    box(ctx, 21, 43, 16, 3, 1.5, '#263752');
    guideFace(ctx, 29, 23);
  },
  owl(ctx) {
    oval(ctx, 29, 33, 19, 19, '#a66cdb');
    poly(ctx, [11, 24, 10, 8, 23, 15, 35, 15, 48, 8, 47, 24, 40, 41, 18, 41]);
    fillStroke(ctx, '#bb88e5', OUTLINE, 2.5);
    for (const x of [20, 38]) {
      oval(ctx, x, 25, 9, 10, '#fff0d3');
      oval(ctx, x, 25, 2.8, 4, '#374168');
    }
    poly(ctx, [25, 33, 33, 33, 29, 40]); fillStroke(ctx, '#ffb661', OUTLINE, 1.5);
  },
  rocket(ctx) {
    poly(ctx, [19, 32, 9, 48, 24, 44, 34, 44, 49, 48, 39, 32]);
    fillStroke(ctx, '#ff8078', OUTLINE, 2.5);
    poly(ctx, [23, 41, 29, 55, 35, 41]); fillStroke(ctx, '#ffd166', OUTLINE, 2);
    poly(ctx, [29, 3, 39, 15, 42, 35, 35, 44, 23, 44, 16, 35, 19, 15]);
    fillStroke(ctx, '#e0f0ff', OUTLINE, 2.5);
    oval(ctx, 29, 24, 9, 9, '#56cff2');
    oval(ctx, 27, 21, 3.5, 2.2, '#e3faff');
  },
  bombBuddy(ctx) {
    ctx.scale(58 / 220, 58 / 220);
    paintBomb(ctx);
  },
} satisfies Record<string, (ctx: Ctx) => void>;
