/** Save creation, validation and repair. Input is untrusted (localStorage JSON); nothing is mutated. */
import { WS_RULES } from '../config';
import type {
  Challenge, ChallengeId, CompletedInfo, Model, PlayerSave, ReadingLevel, VariantId, VariantOverride, WorkshopCatalog,
  WorkshopId, WorkshopProgress,
} from '../core/types';
import { READING_LEVELS, WORKSHOP_IDS } from '../core/types';
import { index } from './catalogIndex';
import { newProgress, refreshBoard } from './board';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function newPlayerSave(reading: ReadingLevel): PlayerSave {
  return { version: 1, reading, workshops: {} };
}

function repairModel(cat: WorkshopCatalog, raw: unknown, fallback: Model): Model {
  const ix = index(cat);
  const out: Model = {};
  for (const a of cat.aspects) {
    const v = isObj(raw) ? raw[a.id] : undefined;
    out[a.id] = typeof v === 'string' && ix.variantById.get(v)?.aspect === a.id ? v : fallback[a.id];
  }
  return out;
}

function validChallenge(c: unknown, id: string, workshop: WorkshopId): c is Challenge {
  if (!isObj(c) || c.id !== id || c.workshop !== workshop || !Array.isArray(c.stages) || c.stages.length === 0) return false;
  if (!isObj(c.intro) || typeof c.title !== 'string') return false;
  return (c.stages as unknown[]).every((s) => isObj(s) && Array.isArray(s.requirements)
    && (s.requirements as unknown[]).every((r) => isObj(r) && typeof r.id === 'string' && Array.isArray(r.checks) && isObj(r.text) && isObj(r.hint)));
}

export function normalizeProgress(cat: WorkshopCatalog, raw: unknown): WorkshopProgress | null {
  if (!isObj(raw)) return null;
  const ix = index(cat);
  const base = newProgress(cat);
  const out: WorkshopProgress = { ...base };
  out.model = repairModel(cat, raw.model, base.model);
  out.earned = Array.isArray(raw.earned)
    ? [...new Set((raw.earned as unknown[]).filter((v): v is VariantId => typeof v === 'string' && ix.variantById.has(v) && !ix.starterIds.has(v)))]
    : [];
  if (isObj(raw.overrides)) {
    for (const [k, v] of Object.entries(raw.overrides)) {
      if (ix.variantById.has(k) && (v === 'open' || v === 'locked')) out.overrides[k] = v as VariantOverride;
    }
  }
  if (isObj(raw.challenges)) {
    for (const [k, v] of Object.entries(raw.challenges)) {
      if (validChallenge(v, k, cat.id)) out.challenges[k] = JSON.parse(JSON.stringify(v)) as Challenge;
    }
  }
  if (isObj(raw.completed)) {
    for (const [k, v] of Object.entries(raw.completed)) {
      if (!isObj(v) || !out.challenges[k]) continue;
      const info: CompletedInfo = {
        build: repairModel(cat, v.build, out.model),
        wins: isNum(v.wins) ? Math.max(1, Math.floor(v.wins)) : 1,
        firstWinAt: isNum(v.firstWinAt) ? v.firstWinAt : 0,
        lastWinAt: isNum(v.lastWinAt) ? v.lastWinAt : 0,
      };
      out.completed[k] = info;
    }
  }
  if (Array.isArray(raw.active)) {
    out.active = [...new Set((raw.active as unknown[]).filter((id): id is ChallengeId => typeof id === 'string' && !!out.challenges[id]))].slice(0, WS_RULES.boardSize);
  }
  if (isObj(raw.fails)) {
    for (const [k, v] of Object.entries(raw.fails)) if (out.challenges[k] && isNum(v) && v > 0) out.fails[k] = Math.floor(v);
  }
  out.lastWin = isObj(raw.lastWin) ? repairModel(cat, raw.lastWin, out.model) : null;
  out.nextStarter = isNum(raw.nextStarter) ? Math.min(cat.starters.length, Math.max(0, Math.floor(raw.nextStarter))) : 0;
  out.firstWins = isNum(raw.firstWins) ? Math.max(0, Math.floor(raw.firstWins)) : 0;
  // genSeq must exceed every generated id in the save so ids are never reused
  let seq = isNum(raw.genSeq) ? Math.max(1, Math.floor(raw.genSeq)) : 1;
  for (const id of Object.keys(out.challenges)) {
    const m = /-g(\d+)$/.exec(id);
    if (m) seq = Math.max(seq, Number(m[1]) + 1);
  }
  out.genSeq = seq;
  return out;
}

export function normalizeSave(catalogs: Readonly<Record<WorkshopId, WorkshopCatalog>>, raw: unknown): PlayerSave | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const reading = (READING_LEVELS as readonly unknown[]).includes(raw.reading) ? (raw.reading as ReadingLevel) : 'easy';
  const save = newPlayerSave(reading);
  if (isObj(raw.workshops)) {
    for (const id of WORKSHOP_IDS) {
      const p = normalizeProgress(catalogs[id], raw.workshops[id]);
      if (p) save.workshops[id] = p;
    }
  }
  if (typeof raw.lastWorkshop === 'string' && (WORKSHOP_IDS as readonly string[]).includes(raw.lastWorkshop)) {
    save.lastWorkshop = raw.lastWorkshop as WorkshopId;
  }
  return save;
}

export function progressOf(cat: WorkshopCatalog, save: PlayerSave): WorkshopProgress {
  return refreshBoard(cat, save.workshops[cat.id] ?? newProgress(cat));
}
