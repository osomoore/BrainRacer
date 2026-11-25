/**
 * Painted art runtime (the ComfyUI paint pass output, see docs/WORKSHOP_ART_PIPELINE.md).
 * `public/art/workshop/manifest.json` maps texture keys to PNGs. The baker uses the same canvas texture for
 * shapes and painted art, so a late paint upgrade keeps all existing sprites, frames and origins.
 * URLs are relative to the page (the site may be served from a sub-path).
 */
import type Phaser from 'phaser';

export interface PaintedEntry { file: string; w: number; h: number; specHash: string; srcHash?: string; shapeHash?: string; model?: string; seed?: number }
export interface PaintedManifest { version: 1; model?: string; entries: Record<string, PaintedEntry> }

const BASE = 'art/workshop/';
const images = new Map<string, HTMLImageElement>();
type FinishPaint = (g: CanvasRenderingContext2D) => void;
const watching = new Map<string, ((image: HTMLImageElement) => void)[]>();
let started: Promise<void> | null = null;
let manifest: PaintedManifest | null = null;
let finished = false;

/** `?art=shapes` forces the code-drawn shapes (to compare with the painted look). */
export function paintedEnabled(): boolean {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('art') !== 'shapes';
}

export function paintedManifest(): PaintedManifest | null { return manifest; }

/** Replace a baked shape texture's pixels with the painted image (same size only). */
function applyPainted(g: CanvasRenderingContext2D, img: HTMLImageElement, finishPaint?: FinishPaint): boolean {
  const c = g.canvas;
  if (img.naturalWidth !== c.width || img.naturalHeight !== c.height) return false;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  finishPaint?.(g);
  return true;
}

/** Paint a baked texture by its registered key. Return false when the baker should draw the fallback now. */
export function paintTexture(key: string, g: CanvasRenderingContext2D, refresh: () => void, finishPaint?: FinishPaint): boolean {
  if (!paintedEnabled()) return false;
  const im = images.get(key);
  if (im) return applyPainted(g, im, finishPaint);
  if (finished || (manifest && !Object.hasOwn(manifest.entries, key))) return false;
  const list = watching.get(key) ?? [];
  list.push((img) => { if (applyPainted(g, img, finishPaint)) refresh(); });
  watching.set(key, list);
  void startPaintedArt();
  return false;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

/** Fetches the manifest and every painted PNG (once). Never rejects: missing art simply means code shapes. */
export function startPaintedArt(): Promise<void> {
  if (!paintedEnabled()) return Promise.resolve();
  if (started) return started;
  started = (async () => {
    try {
      const res = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      const m = (await res.json()) as PaintedManifest;
      if (m?.version !== 1 || !m.entries) return;
      manifest = m;
      await Promise.all(Object.entries(m.entries).map(async ([key, e]) => {
        const im = await loadImage(`${BASE}${e.file}`);
        if (!im) return;
        images.set(key, im);
        for (const apply of watching.get(key) ?? []) {
          try { apply(im); } catch { /* texture gone */ }
        }
        watching.delete(key);
      }));
    } catch { /* offline or no art: code shapes */ }
    finally {
      finished = true;
      watching.clear();
    }
  })();
  return started;
}

/** Boot: kick off loading in preload, wait (bounded) in create so the first screens already show painted art. */
export function preloadPaintedArt(): void { void startPaintedArt(); }
export function paintedReady(timeoutMs = 4000): Promise<void> {
  return Promise.race([startPaintedArt(), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/** Painted texture key for prompt-only art (backdrops, textures): the key itself when its image is loaded into the scene. */
export function ensurePaintedTexture(scene: Phaser.Scene, key: string): string | null {
  if (!paintedEnabled()) return null;
  if (scene.textures.exists(key)) return key;
  const im = images.get(key);
  if (!im) return null;
  scene.textures.addImage(key, im);
  return key;
}
