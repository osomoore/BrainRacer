/**
 * STUB engine from the orchestrator so the shell can run before the engine package lands.
 * The engine package REPLACES this file (keep `export const engine: WorkshopEngine`).
 * Only the save helpers and model basics work here; progression throws.
 */
import type { WorkshopEngine } from '../core/engineApi';
import type { Model, PlayerSave, WorkshopId, WorkshopProgress } from '../core/types';
import { CATALOGS } from '../content';

const todo = (name: string): never => { throw new Error(`engine stub: ${name} not implemented yet`); };

function defaultModel(id: WorkshopId): Model {
  return Object.fromEntries(CATALOGS[id].aspects.map((a) => [a.id, a.starters[0]]));
}

function newProgress(id: WorkshopId): WorkshopProgress {
  return {
    model: defaultModel(id), earned: [], overrides: {}, challenges: {}, active: [], completed: {}, fails: {},
    lastWin: null, nextStarter: 0, firstWins: 0, genSeq: 1,
  };
}

export const engine: WorkshopEngine = {
  catalog: (id) => CATALOGS[id],
  computeModel: () => ({ stats: {}, tags: new Set() }),
  defaultModel,
  available: (id) => new Set(CATALOGS[id].aspects.flatMap((a) => [...a.starters])),
  availableFor: (id, _p, aspect) => [...(CATALOGS[id].aspects.find((a) => a.id === aspect)?.starters ?? [])],
  sanitizeModel: (_id, _p, model) => model,
  setPart: (_id, p, aspect, variant) => ({ ...p, model: { ...p.model, [aspect]: variant } }),
  evaluate: () => todo('evaluate'),
  hint: () => null,
  newProgress,
  refreshBoard: (_id, p) => p,
  recordFail: (_id, p, c) => ({ ...p, fails: { ...p.fails, [c]: (p.fails[c] ?? 0) + 1 } }),
  recordWin: () => todo('recordWin'),
  regenerate: (_id, p) => p,
  setOverride: (_id, p) => p,
  adminSandbox: (_id, p) => p,
  newPlayerSave: (reading): PlayerSave => ({ version: 1, reading, workshops: {} }),
  normalizeSave: (raw) => (raw && typeof raw === 'object' && (raw as PlayerSave).version === 1 ? (raw as PlayerSave) : null),
  progressOf: (save, id) => save.workshops[id] ?? newProgress(id),
};
