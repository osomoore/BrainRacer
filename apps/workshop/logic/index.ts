/**
 * Adventure Workshop engine: pure rules (stats, evaluate, solver, generator, board, shop, hints, saves, admin sandbox).
 * No Phaser, no DOM, no Math.random. See docs/WORKSHOP.md "Engine semantics".
 */
import type { WorkshopEngine } from '../core/engineApi';
import type { WorkshopCatalog, WorkshopId } from '../core/types';
import { CATALOGS } from '../content';
import { adminSandbox, grantCurrency } from './admin';
import { setBuddy } from './buddies';
import { shopOffers } from './shop';
import { available, availableFor, sanitizeModel } from './available';
import { hint, newProgress, purchase, recordFail, recordWin, refreshBoard, regenerate, setOverride, setPart } from './board';
import { evaluate } from './evaluate';
import { newPlayerSave, normalizeSave, progressOf } from './save';
import { computeModel, defaultModel } from './stats';

export function createEngine(catalogs: Readonly<Record<WorkshopId, WorkshopCatalog>>): WorkshopEngine {
  const c = (id: WorkshopId): WorkshopCatalog => catalogs[id];
  return {
    catalog: c,
    computeModel: (id, model) => computeModel(c(id), model),
    defaultModel: (id) => defaultModel(c(id)),
    available: (id, p) => available(c(id), p),
    availableFor: (id, p, aspect) => availableFor(c(id), p, aspect),
    sanitizeModel: (id, p, model) => sanitizeModel(c(id), p, model),
    setPart: (id, p, aspect, variant) => setPart(c(id), p, aspect, variant),
    setBuddy,
    shopOffers: (id, p, aspect) => shopOffers(c(id), p, aspect),
    purchase: (id, p, aspect, variant) => purchase(c(id), p, aspect, variant),
    evaluate: (id, model, challenge) => evaluate(c(id), model, challenge),
    hint,
    newProgress: (id, buddySeed) => newProgress(c(id), buddySeed),
    refreshBoard: (id, p) => refreshBoard(c(id), p),
    recordFail: (_id, p, challengeId) => recordFail(p, challengeId),
    recordWin: (id, p, challengeId, model, now) => recordWin(c(id), p, challengeId, model, now),
    regenerate: (id, p) => regenerate(c(id), p),
    setOverride: (id, p, variant, value) => setOverride(c(id), p, variant, value),
    adminSandbox: (id, p, seed, count) => adminSandbox(c(id), p, seed, count),
    grantCurrency: (id, p) => grantCurrency(c(id), p),
    newPlayerSave,
    resetPlayer: (save) => newPlayerSave(save.reading, save.buddySeed),
    normalizeSave: (raw) => normalizeSave(catalogs, raw),
    progressOf: (save, id) => progressOf(c(id), save),
  };
}

export const engine: WorkshopEngine = createEngine(CATALOGS);

export { validateCatalog } from './validateCatalog';
export { simulate } from './simulate';
export type { SimReport, SimOptions } from './simulate';
