/**
 * Shape export for the ComfyUI paint pass: `workshop.html?dev=ArtExport&art=shapes` bakes every shape job's texture
 * from the code drawing (never the painted art) and exposes `window.__artExport` so `scripts/art/exportShapes.ts`
 * can pull the PNGs out of headless Edge. Without `art=shapes` it only lists jobs.
 */
import Phaser from 'phaser';
import { ensureTexture } from '../art/bake';
import { allArtJobs, artSpec, type ArtJob } from '../art/paint/jobs';

export interface ArtExportApi {
  jobs(): ArtJob[];
  /** Bakes the shape for `key` and returns it as base64 PNG (no data: prefix). */
  png(key: string): string;
}

export default class ArtExport extends Phaser.Scene {
  constructor() { super('ArtExport'); }

  create(): void {
    const jobs = allArtJobs();
    const api: ArtExportApi = {
      jobs: () => jobs,
      png: (key) => {
        const spec = artSpec(key);
        if (!spec) throw new Error(`no shape job for ${key}`);
        ensureTexture(this, spec);
        const canvas = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
        const url = canvas.toDataURL('image/png');
        this.textures.remove(key);
        return url.slice(url.indexOf(',') + 1);
      },
    };
    (window as unknown as { __artExport: ArtExportApi }).__artExport = api;
    this.add.text(40, 40, `ArtExport: ${jobs.length} jobs (${jobs.filter((j) => j.kind === 'shape').length} shapes)`, { fontSize: '44px', color: '#ffffff' });
  }
}
