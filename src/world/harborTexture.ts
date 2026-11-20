import type Phaser from 'phaser';

/** Make reusable canvas sprites once; no live Graphics paths in the two cameras. */
export function harborTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): string {
  const name = `harbor_${key}`;
  if (!scene.textures.exists(name)) {
    const t = scene.textures.createCanvas(name, w, h);
    if (!t) throw new Error('Harbor texture allocation failed');
    draw(t.getContext()); t.refresh();
  }
  return name;
}
